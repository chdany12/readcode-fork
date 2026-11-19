package builds

import (
	"encoding/json"
	"errors"
	"net/http"
)

type API struct {
	store *Store
}

func NewAPI(store *Store) *API { return &API{store: store} }

func (a *API) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/projects/{project}/builds", a.create)
	mux.HandleFunc("GET /v1/projects/{project}/builds", a.list)
	mux.HandleFunc("GET /v1/projects/{project}/builds/{id}", a.get)
	mux.HandleFunc("POST /v1/projects/{project}/builds/{id}/cancel", a.cancel)
	mux.HandleFunc("DELETE /v1/projects/{project}/builds/{id}", a.delete)
	return mux
}

func (a *API) create(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Ref string `json:"ref"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&in); err != nil || in.Ref == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ref is required"})
		return
	}
	b := a.store.Create(r.PathValue("project"), in.Ref)
	w.Header().Set("Location", "/v1/builds/"+b.ID)
	writeJSON(w, http.StatusCreated, b)
}

func (a *API) list(w http.ResponseWriter, r *http.Request) {
	items := a.store.List(r.PathValue("project"), r.URL.Query().Get("status"))
	if items == nil {
		items = []Build{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *API) get(w http.ResponseWriter, r *http.Request) {
	b, err := a.store.Get(r.PathValue("project"), r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *API) cancel(w http.ResponseWriter, r *http.Request) {
	b, err := a.store.Cancel(r.PathValue("project"), r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, b)
}

func (a *API) delete(w http.ResponseWriter, r *http.Request) {
	a.store.Delete(r.PathValue("project"), r.PathValue("id"))
	w.WriteHeader(http.StatusNoContent)
}

func writeStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	case errors.Is(err, ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
