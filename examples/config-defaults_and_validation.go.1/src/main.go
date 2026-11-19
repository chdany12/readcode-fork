package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
)

type server struct {
	cfg    Config
	client *http.Client
}

func newServer(cfg Config) *server {
	return &server{
		cfg:    cfg,
		client: &http.Client{Timeout: cfg.SearchTimeout},
	}
}

func (s *server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := url.Values{}
	q.Set("from", r.URL.Query().Get("from"))
	q.Set("to", r.URL.Query().Get("to"))
	q.Set("currency", s.cfg.CurrencyCode)

	resp, err := s.client.Get(s.cfg.InventoryURL + "/offers?" + q.Encode())
	if err != nil {
		http.Error(w, "inventory unavailable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var offers []map[string]any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&offers); err != nil {
		http.Error(w, "bad inventory response", http.StatusBadGateway)
		return
	}
	if len(offers) > s.cfg.MaxSearchResults {
		offers = offers[:s.cfg.MaxSearchResults]
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(offers)
}

func (s *server) handleHold(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OfferID    string `json:"offer_id"`
		Passengers int    `json:"passengers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.Passengers < 1 || req.Passengers > s.cfg.MaxPassengers {
		http.Error(w, "invalid passenger count", http.StatusUnprocessableEntity)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"offer_id":   req.OfferID,
		"expires_in": s.cfg.HoldTTL.Seconds(),
	})
}

func main() {
	cfg, err := Load()
	if err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}
	s := newServer(cfg)
	mux := http.NewServeMux()
	mux.HandleFunc("/search", s.handleSearch)
	mux.HandleFunc("/holds", s.handleHold)
	log.Printf("listening on %s", cfg.ListenAddr)
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, mux))
}
