package dispatch

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Dispatcher interface {
	Assign(ctx context.Context, riderID string, pickup, dropoff Point) (Ride, error)
}

type Point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type Ride struct {
	ID       string `json:"id"`
	DriverID string `json:"driver_id"`
	RiderID  string `json:"rider_id"`
}

type rideRequest struct {
	Pickup  Point `json:"pickup"`
	Dropoff Point `json:"dropoff"`
}

type RideHandler struct {
	cache      *Cache
	dispatcher Dispatcher
}

func riderFromContext(ctx context.Context) string {
	id, _ := ctx.Value(riderKey{}).(string)
	return id
}

type riderKey struct{}

func (h *RideHandler) RequestRide(w http.ResponseWriter, r *http.Request) {
	riderID := riderFromContext(r.Context())
	if riderID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	cacheKey := r.Header.Get("Idempotency-Key")
	if cacheKey != "" {
		if body, status, ok := h.cache.Lookup(cacheKey); ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			w.Write(body)
			return
		}
	}

	var req rideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ride, err := h.dispatcher.Assign(r.Context(), riderID, req.Pickup, req.Dropoff)
	if err != nil {
		http.Error(w, "no drivers available", http.StatusServiceUnavailable)
		return
	}

	body, err := json.Marshal(ride)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if cacheKey != "" {
		h.cache.Save(cacheKey, http.StatusCreated, body, 24*time.Hour)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write(body)
}
