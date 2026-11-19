package orders

import (
	"encoding/json"
	"net/http"
)

type CreateOrderRequest struct {
	CustomerID string `json:"customer_id"`
	SKU        string `json:"sku"`
	Quantity   int    `json:"quantity"`
}

type Inventory interface {
	Reserve(sku string, qty int) error
}

type OrderRepo interface {
	Insert(customerID, sku string, qty int) (orderID string, err error)
}

type Handler struct {
	store     *KeyStore
	inventory Inventory
	repo      OrderRepo
}

func NewHandler(store *KeyStore, inv Inventory, repo OrderRepo) *Handler {
	return &Handler{store: store, inventory: inv, repo: repo}
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		http.Error(w, "missing Idempotency-Key", http.StatusBadRequest)
		return
	}

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Quantity <= 0 {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	scoped := req.CustomerID + ":" + key
	rec, ok := h.store.Get(scoped)
	if ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Idempotent-Replay", "true")
		w.WriteHeader(rec.Status)
		w.Write(rec.Body)
		return
	}

	if err := h.inventory.Reserve(req.SKU, req.Quantity); err != nil {
		http.Error(w, "out of stock", http.StatusConflict)
		return
	}
	id, err := h.repo.Insert(req.CustomerID, req.SKU, req.Quantity)
	if err != nil {
		http.Error(w, "could not create order", http.StatusInternalServerError)
		return
	}

	body, _ := json.Marshal(map[string]string{"order_id": id})
	h.store.Put(scoped, Record{Status: http.StatusCreated, Body: body})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write(body)
}
