package checkout

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Gateway interface {
	Charge(customerID string, cents int64) (chargeID string, err error)
}

type PaymentHandler struct {
	journal *Journal
	gateway Gateway
}

type payRequest struct {
	CustomerID string `json:"customer_id"`
	Cents      int64  `json:"cents"`
}

func (h *PaymentHandler) Pay(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		http.Error(w, "Idempotency-Key required", http.StatusBadRequest)
		return
	}

	saved, err := h.journal.Begin(key)
	if errors.Is(err, ErrInFlight) {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	if saved != nil {
		w.WriteHeader(saved.Status)
		w.Write(saved.Body)
		return
	}

	status, body := h.process(r)
	h.journal.Complete(key, Saved{Status: status, Body: body})
	w.WriteHeader(status)
	w.Write(body)
}

func (h *PaymentHandler) process(r *http.Request) (int, []byte) {
	var req payRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return http.StatusBadRequest, []byte(`{"error":"invalid body"}`)
	}
	if req.Cents <= 0 {
		return http.StatusUnprocessableEntity, []byte(`{"error":"invalid amount"}`)
	}
	id, err := h.gateway.Charge(req.CustomerID, req.Cents)
	if err != nil {
		return http.StatusBadGateway, []byte(`{"error":"payment gateway unavailable"}`)
	}
	out, _ := json.Marshal(map[string]string{"charge_id": id})
	return http.StatusOK, out
}
