package adsapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
)

const maxBodyBytes = 1 << 20
const maxBatch = 500

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Handler struct {
	store Store
}

func NewHandler(store Store) http.Handler {
	h := &Handler{store: store}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/campaigns/{id}", h.getCampaign)
	mux.HandleFunc("POST /v1/campaigns/{id}/impressions", h.recordImpressions)
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write response: %v", err)
	}
}

func statusFor(err error) (int, apiError) {
	var verr *ValidationError
	switch {
	case errors.As(err, &verr):
		return http.StatusUnprocessableEntity, apiError{Code: "validation_failed", Message: verr.Error()}
	case errors.Is(err, ErrCampaignNotFound):
		return http.StatusNotFound, apiError{Code: "campaign_not_found", Message: "no such campaign"}
	case errors.Is(err, ErrCampaignPaused):
		return http.StatusConflict, apiError{Code: "campaign_paused", Message: "campaign is paused"}
	case errors.Is(err, ErrBudgetExhausted):
		return http.StatusConflict, apiError{Code: "budget_exhausted", Message: "daily budget exhausted"}
	case errors.Is(err, context.DeadlineExceeded):
		return http.StatusGatewayTimeout, apiError{Code: "timeout", Message: "request timed out"}
	default:
		return http.StatusBadRequest, apiError{Code: "bad_request", Message: err.Error()}
	}
}

func writeError(w http.ResponseWriter, err error) {
	status, body := statusFor(err)
	writeJSON(w, status, body)
}

func (h *Handler) getCampaign(w http.ResponseWriter, r *http.Request) {
	c, err := h.store.GetCampaign(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, fmt.Errorf("get campaign: %w", err))
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *Handler) recordImpressions(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	var batch []Impression
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeJSON(w, http.StatusRequestEntityTooLarge, apiError{Code: "body_too_large", Message: "batch exceeds 1 MiB"})
			return
		}
		writeJSON(w, http.StatusBadRequest, apiError{Code: "malformed_json", Message: "body is not a JSON array of impressions"})
		return
	}
	if len(batch) == 0 || len(batch) > maxBatch {
		writeError(w, &ValidationError{Field: "batch", Reason: fmt.Sprintf("size must be between 1 and %d", maxBatch)})
		return
	}
	for i, imp := range batch {
		if imp.EventID == "" || imp.AdID == "" {
			writeError(w, &ValidationError{Field: fmt.Sprintf("batch[%d]", i), Reason: "event_id and ad_id are required"})
			return
		}
		if imp.CostMicro < 0 {
			writeError(w, &ValidationError{Field: fmt.Sprintf("batch[%d].cost_micro", i), Reason: "must not be negative"})
			return
		}
	}

	id := r.PathValue("id")
	res, err := h.store.RecordImpressions(r.Context(), id, batch)
	if err != nil {
		writeError(w, fmt.Errorf("record impressions for %s: %w", id, err))
		return
	}
	writeJSON(w, http.StatusAccepted, res)
}
