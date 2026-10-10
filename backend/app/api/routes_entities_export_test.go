package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/hay-kot/httpkit/errchain"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services/reporting/eventbus"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/config"
	"github.com/sysadminsmedia/homebox/backend/internal/web/mid"
)

func TestEntitiesExportRequiresAuthentication(t *testing.T) {
	a := &app{conf: &config.Config{}, repos: &repo.AllRepos{}, services: &services.AllServices{}, bus: eventbus.New()}
	router := chi.NewRouter()
	a.mountRoutes(router, errchain.New(mid.Errors(zerolog.Nop())), nil)
	for _, query := range []string{"", "?filtered=true", "?filtered=true&includeArchived=true&pageSize=1"} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/entities/export"+query, nil)
		req.Header.Set("X-Tenant", "00000000-0000-0000-0000-000000000001")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code, w.Body.String())
		assert.NotContains(t, w.Body.String(), "HB.name")
	}
}
