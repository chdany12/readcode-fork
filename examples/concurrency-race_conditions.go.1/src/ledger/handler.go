package ledger

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Handler struct {
	Store *Store
}

type withdrawRequest struct {
	AccountID string `json:"account_id"`
	Amount    int64  `json:"amount"`
	Reason    string `json:"reason"`
}

func (h *Handler) Withdraw(w http.ResponseWriter, r *http.Request) {
	var req withdrawRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	err := h.Store.Withdraw(req.AccountID, req.Amount, req.Reason)
	switch {
	case err == nil:
		w.WriteHeader(http.StatusNoContent)
	case errors.Is(err, ErrUnknownAccount):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, ErrInsufficientFunds):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, ErrInvalidAmount):
		http.Error(w, err.Error(), http.StatusBadRequest)
	default:
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
