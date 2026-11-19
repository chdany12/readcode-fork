package pipelines

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"
)

type Scheduler interface {
	Enqueue(project string, req *TriggerRequest) (runID string, err error)
}

type Handler struct {
	Scheduler Scheduler
}

func (h *Handler) Trigger(w http.ResponseWriter, r *http.Request) {
	project := r.PathValue("project")
	req, err := decodeTrigger(w, r)
	if err != nil {
		var reqErr *RequestError
		if errors.As(err, &reqErr) {
			writeRequestError(w, reqErr)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	runID, err := h.Scheduler.Enqueue(project, req)
	if err != nil {
		log.Printf("enqueue failed project=%q branch=%q: %v", project, req.Branch, err)
		http.Error(w, "could not schedule run", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"run_id": runID})
}

func writeRequestError(w http.ResponseWriter, e *RequestError) {
	sort.Slice(e.Fields, func(i, j int) bool { return e.Fields[i].Field < e.Fields[j].Field })
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.Status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":  http.StatusText(e.Status),
		"fields": e.Fields,
	})
}
