package v1

import (
	"context"
	"encoding/csv"
	"net/http/httptest"
	"strings"

	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services/reporting/eventbus"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/config"
	_ "github.com/sysadminsmedia/homebox/backend/pkgs/cgofreesqlite"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
)

func TestExtractEntityQuery(t *testing.T) {
	parent, tag := uuid.New(), uuid.New()
	values := url.Values{
		"q": {"#000-012345"}, "parentIds": {parent.String()}, "tags": {tag.String()},
		"negateTags": {"true"}, "includeArchived": {"true"}, "onlyWithPhoto": {"true"},
		"fields": {"color=blue=green", "broken", "size=large"}, "page": {"2"}, "pageSize": {"1"},
	}
	r := httptest.NewRequest("GET", "/api/v1/entities/export?filtered=true&"+values.Encode(), nil)
	q := extractEntityQuery(r)
	assert.Equal(t, repo.AssetID(12345), q.AssetID)
	assert.Empty(t, q.Search)
	assert.Equal(t, []uuid.UUID{parent}, q.ParentIDs)
	assert.Equal(t, []uuid.UUID{tag}, q.TagIDs)
	assert.True(t, q.NegateTags)
	assert.True(t, q.IncludeArchived)
	assert.True(t, q.OnlyWithPhoto)
	assert.Equal(t, []repo.FieldQuery{{Name: "color", Value: "blue=green"}, {Name: "size", Value: "large"}}, q.Fields)
	assert.Equal(t, 2, q.Page)
	assert.Equal(t, 1, q.PageSize)
	for _, text := range []string{"工具", "#invalid"} {
		q = extractEntityQuery(httptest.NewRequest("GET", "/?q="+url.QueryEscape(text), nil))
		assert.Equal(t, text, q.Search)
		assert.True(t, q.AssetID.Nil())
	}
	q = extractEntityQuery(httptest.NewRequest("GET", "/", nil))
	assert.False(t, q.IncludeArchived)
	assert.Equal(t, -1, q.Page)
	assert.Equal(t, -1, q.PageSize)
}

// Exercise the actual CSV response, including mode selection and query parsing.
// Authentication is separately tested through the registered route.
func TestHandleEntitiesExportModes(t *testing.T) {
	ctx := context.Background()
	client, err := ent.Open("sqlite3", "file:"+uuid.NewString()+"?mode=memory&cache=shared&_fk=1&_time_format=sqlite")
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Close() })
	require.NoError(t, client.Schema.Create(ctx))
	repos := repo.New(client, eventbus.New(), config.Storage{PrefixPath: "/", ConnString: "file://" + t.TempDir()}, "mem://{{ .Topic }}", config.Thumbnail{})
	svc := services.New(repos)
	ctrl := NewControllerV1(svc, repos, eventbus.New(), &config.Config{})
	g, err := repos.Groups.GroupCreate(ctx, "export", uuid.Nil)
	require.NoError(t, err)
	foreign, err := repos.Groups.GroupCreate(ctx, "foreign", uuid.Nil)
	require.NoError(t, err)
	lt, err := repos.EntityTypes.GetDefault(ctx, g.ID, true)
	require.NoError(t, err)
	_, err = repos.Entities.Create(ctx, g.ID, repo.EntityCreate{Name: "Room", EntityTypeID: lt.ID})
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		e, err := repos.Entities.Create(ctx, g.ID, repo.EntityCreate{Name: "工具, \"line\"\nnext"})
		require.NoError(t, err)
		_, err = client.Entity.UpdateOneID(e.ID).SetAssetID(int64(123 + i)).SetArchived(i == 2).Save(ctx)
		require.NoError(t, err)
	}
	_, err = repos.Entities.Create(ctx, foreign.ID, repo.EntityCreate{Name: "secret"})
	require.NoError(t, err)
	tests := []struct {
		query string
		count int
	}{
		{"", 4},
		{"?q=no-match&pageSize=1", 4}, // no filtered mode: query ignored
		{"?filtered=false&q=no-match", 4},
		{"?filtered=true&page=2&pageSize=1&isLocation=true", 2},
		{"?filtered=true&q=%23000-123", 1},
		{"?filtered=true&includeArchived=true", 3},
		{"?filtered=true&q=no-match", 0},
	}
	for _, tc := range tests {
		t.Run(tc.query, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/v1/entities/export"+tc.query, nil)
			r = r.WithContext(services.SetTenantCtx(ctx, g.ID))
			w := httptest.NewRecorder()
			require.NoError(t, ctrl.HandleEntitiesExport()(w, r))
			assert.Equal(t, "text/csv", w.Header().Get("Content-Type"))
			assert.Contains(t, w.Header().Get("Content-Disposition"), ".csv")
			rows, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
			require.NoError(t, err)
			assert.Len(t, rows, tc.count+1)
			assert.Contains(t, rows[0], "HB.name")
			assert.NotContains(t, w.Body.String(), "secret")
		})
	}
}
