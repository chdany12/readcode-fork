package tickets

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

const maxBodyBytes = 1 << 20

var ErrNotFound = errors.New("ticket not found")

type Store interface {
	Create(ctx context.Context, t Ticket) (Ticket, error)
	Get(ctx context.Context, id string) (Ticket, error)
	Update(ctx context.Context, id string, apply func(*Ticket)) (Ticket, error)
}

type Handler struct {
	store Store
	now   func() time.Time
}

func NewHandler(store Store) *Handler {
	return &Handler{store: store, now: time.Now}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /tickets", h.create)
	mux.HandleFunc("GET /tickets/{id}", h.get)
	mux.HandleFunc("PATCH /tickets/{id}", h.patch)
	return mux
}

func decodeStrict(w http.ResponseWriter, r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if _, err := dec.Token(); err != io.EOF {
		return errors.New("request body must contain a single JSON value")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in NewTicket
	if err := decodeStrict(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(in.Subject) == "" {
		writeError(w, http.StatusBadRequest, "subject is required")
		return
	}
	t, err := h.store.Create(r.Context(), Ticket{
		Subject:   in.Subject,
		Status:    StatusOpen,
		DueAt:     in.DueAt,
		Tags:      in.Tags,
		CreatedAt: h.now().UTC(),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create ticket")
		return
	}
	w.Header().Set("Location", "/tickets/"+t.ID)
	writeJSON(w, http.StatusCreated, t)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	t, err := h.store.Get(r.Context(), r.PathValue("id"))
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "ticket not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load ticket")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *Handler) patch(w http.ResponseWriter, r *http.Request) {
	var in TicketPatch
	if err := decodeStrict(w, r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if in.Subject != nil && strings.TrimSpace(*in.Subject) == "" {
		writeError(w, http.StatusBadRequest, "subject must not be blank")
		return
	}
	t, err := h.store.Update(r.Context(), r.PathValue("id"), func(t *Ticket) {
		if in.Subject != nil {
			t.Subject = *in.Subject
		}
		if in.Status != nil {
			t.Status = *in.Status
		}
		if in.DueAt != nil {
			t.DueAt = in.DueAt
		}
	})
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "ticket not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update ticket")
		return
	}
	writeJSON(w, http.StatusOK, t)
}
