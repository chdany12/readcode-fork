package pipelines

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	maxBodyBytes   = 64 << 10
	maxVariables   = 50
	maxVarValueLen = 4096
)

var (
	branchPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$`)
	commitPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
	varNamePattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,63}$`)
)

type TriggerRequest struct {
	Branch    string            `json:"branch"`
	Commit    string            `json:"commit"`
	Variables map[string]string `json:"variables"`
	Priority  *int              `json:"priority"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type RequestError struct {
	Status int
	Fields []FieldError
}

func (e *RequestError) Error() string {
	return fmt.Sprintf("invalid request (%d): %d field errors", e.Status, len(e.Fields))
}

func decodeTrigger(w http.ResponseWriter, r *http.Request) (*TriggerRequest, error) {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		return nil, &RequestError{Status: http.StatusUnsupportedMediaType}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req TriggerRequest
	if err := dec.Decode(&req); err != nil {
		var tooLarge *http.MaxBytesError
		var typeErr *json.UnmarshalTypeError
		switch {
		case errors.As(err, &tooLarge):
			return nil, &RequestError{Status: http.StatusRequestEntityTooLarge}
		case errors.As(err, &typeErr):
			return nil, &RequestError{
				Status: http.StatusBadRequest,
				Fields: []FieldError{{Field: typeErr.Field, Message: "wrong type: expected " + typeErr.Type.String()}},
			}
		default:
			return nil, &RequestError{
				Status: http.StatusBadRequest,
				Fields: []FieldError{{Field: "", Message: "malformed JSON body"}},
			}
		}
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return nil, &RequestError{
			Status: http.StatusBadRequest,
			Fields: []FieldError{{Field: "", Message: "body must contain a single JSON object"}},
		}
	}

	if errs := req.validate(); len(errs) > 0 {
		return nil, &RequestError{Status: http.StatusUnprocessableEntity, Fields: errs}
	}
	return &req, nil
}

func (t *TriggerRequest) validate() []FieldError {
	var errs []FieldError
	add := func(field, msg string) { errs = append(errs, FieldError{field, msg}) }

	t.Branch = strings.TrimSpace(t.Branch)
	if !branchPattern.MatchString(t.Branch) || strings.Contains(t.Branch, "..") {
		add("branch", "must be a valid branch name of at most 128 characters")
	}
	if t.Commit != "" && !commitPattern.MatchString(t.Commit) {
		add("commit", "must be a full 40-character lowercase hex SHA")
	}
	if t.Priority != nil && (*t.Priority < 0 || *t.Priority > 9) {
		add("priority", "must be between 0 and 9")
	}
	if len(t.Variables) > maxVariables {
		add("variables", fmt.Sprintf("at most %d variables are allowed", maxVariables))
	} else {
		for name, value := range t.Variables {
			if !varNamePattern.MatchString(name) || strings.HasPrefix(name, "CI_") {
				add("variables."+name, "invalid or reserved variable name")
				continue
			}
			if utf8.RuneCountInString(value) > maxVarValueLen || strings.ContainsRune(value, 0) {
				add("variables."+name, "value too long or contains NUL")
			}
		}
	}
	return errs
}
