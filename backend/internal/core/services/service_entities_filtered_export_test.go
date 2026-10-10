package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/attachment"
	"github.com/sysadminsmedia/homebox/backend/internal/data/ent/entityfield"
	"github.com/sysadminsmedia/homebox/backend/internal/data/repo"
)

func csvColumn(t *testing.T, rows [][]string, name string) int {
	t.Helper()
	for i, h := range rows[0] {
		if h == name {
			return i
		}
	}
	t.Fatalf("missing CSV column %s", name)
	return -1
}

func TestFilteredCSVExport(t *testing.T) {
	ctx := context.Background()
	g, err := tRepos.Groups.GroupCreate(ctx, "filtered-"+fk.Str(4), uuid.Nil)
	require.NoError(t, err)
	other, err := tRepos.Groups.GroupCreate(ctx, "other-"+fk.Str(4), uuid.Nil)
	require.NoError(t, err)
	lt, err := tRepos.EntityTypes.GetDefault(ctx, g.ID, true)
	require.NoError(t, err)
	it, err := tRepos.EntityTypes.GetDefault(ctx, g.ID, false)
	require.NoError(t, err)
	create := func(gid uuid.UUID, name string, parent, typ uuid.UUID) repo.EntityOut {
		t.Helper()
		e, err := tRepos.Entities.Create(ctx, gid, repo.EntityCreate{Name: name, ParentID: parent, EntityTypeID: typ, ImportRef: name + "-ref"})
		require.NoError(t, err)
		return e
	}
	loc := create(g.ID, "Room", uuid.Nil, lt.ID)
	parent := create(g.ID, "Box", loc.ID, it.ID)
	child := create(g.ID, "Drill, \"工具\"\nline", parent.ID, it.ID)
	plain := create(g.ID, "Plain", loc.ID, it.ID)
	archived := create(g.ID, "Archived", loc.ID, it.ID)
	_, err = tClient.Entity.UpdateOneID(archived.ID).SetArchived(true).Save(ctx)
	require.NoError(t, err)
	_, err = tClient.Entity.UpdateOneID(child.ID).SetAssetID(12345).SetDescription("comma, quote\"\nUnicode café").Save(ctx)
	require.NoError(t, err)
	foreign := create(other.ID, "Drill foreign", uuid.Nil, uuid.Nil)
	foreignLoc := create(other.ID, "Secret Room", uuid.Nil, uuid.Nil)
	rootTag, err := tRepos.Tags.Create(ctx, g.ID, repo.TagCreate{Name: "Tools"})
	require.NoError(t, err)
	leafTag, err := tRepos.Tags.Create(ctx, g.ID, repo.TagCreate{Name: "Power", ParentID: rootTag.ID})
	require.NoError(t, err)
	foreignTag, err := tRepos.Tags.Create(ctx, other.ID, repo.TagCreate{Name: "Secret"})
	require.NoError(t, err)
	_, err = tClient.Entity.UpdateOneID(child.ID).AddTagIDs(leafTag.ID).Save(ctx)
	require.NoError(t, err)
	for _, f := range []struct{ name, value string }{{"zeta", "值,\"quoted\"\nnext"}, {"alpha", "yes"}} {
		_, err = tClient.EntityField.Create().SetType(entityfield.TypeText).SetEntityID(child.ID).SetName(f.name).SetTextValue(f.value).Save(ctx)
		require.NoError(t, err)
	}
	// A field on the omitted parent must not create a custom-field column.
	_, err = tClient.EntityField.Create().SetType(entityfield.TypeText).SetEntityID(parent.ID).SetName("parent-only").SetTextValue("secret").Save(ctx)
	require.NoError(t, err)
	_, err = tRepos.Attachments.Create(ctx, child.ID, repo.ItemCreateAttachment{Title: "photo.png", Content: bytes.NewReader([]byte("photo"))}, attachment.TypePhoto, true)
	require.NoError(t, err)
	// A non-primary photo does not satisfy the listing's photo filter.
	secondary, err := tRepos.Attachments.Create(ctx, plain.ID, repo.ItemCreateAttachment{Title: "secondary.png", Content: bytes.NewReader([]byte("secondary"))}, attachment.TypePhoto, false)
	require.NoError(t, err)
	_, err = tClient.Attachment.UpdateOneID(secondary.ID).SetPrimary(false).Save(ctx)
	require.NoError(t, err)

	tests := []struct {
		name string
		q    repo.EntityQuery
		want []string
	}{
		{"defaults", repo.EntityQuery{}, []string{parent.Name, child.Name, plain.Name}},
		{"search", repo.EntityQuery{Search: "Drill"}, []string{child.Name}},
		{"asset", repo.EntityQuery{AssetID: 12345}, []string{child.Name}},
		{"direct parent", repo.EntityQuery{ParentIDs: []uuid.UUID{loc.ID}}, []string{parent.Name, plain.Name}},
		{"item parent", repo.EntityQuery{ParentIDs: []uuid.UUID{parent.ID}}, []string{child.Name}},
		{"descendant tags", repo.EntityQuery{TagIDs: []uuid.UUID{rootTag.ID}}, []string{child.Name}},
		{"negate tags", repo.EntityQuery{TagIDs: []uuid.UUID{rootTag.ID}, NegateTags: true}, []string{parent.Name, plain.Name}},
		{"archived", repo.EntityQuery{IncludeArchived: true}, []string{archived.Name, parent.Name, child.Name, plain.Name}},
		{"with photo", repo.EntityQuery{OnlyWithPhoto: true}, []string{child.Name}},
		{"without photo", repo.EntityQuery{OnlyWithoutPhoto: true}, []string{parent.Name, plain.Name}},
		{"both photos", repo.EntityQuery{OnlyWithPhoto: true, OnlyWithoutPhoto: true}, nil},
		{"fields OR", repo.EntityQuery{Fields: []repo.FieldQuery{{Name: "alpha", Value: "yes"}, {Name: "zeta", Value: "missing"}}}, []string{child.Name}},
		{"combined", repo.EntityQuery{Search: "Drill", ParentIDs: []uuid.UUID{parent.ID}, TagIDs: []uuid.UUID{rootTag.ID}, OnlyWithPhoto: true, Fields: []repo.FieldQuery{{Name: "alpha", Value: "yes"}}, Page: 7, PageSize: 1}, []string{child.Name}},
		{"foreign parent", repo.EntityQuery{ParentIDs: []uuid.UUID{foreignLoc.ID}}, nil},
		{"foreign tag", repo.EntityQuery{TagIDs: []uuid.UUID{foreignTag.ID}}, nil},
		{"zero", repo.EntityQuery{Search: "no such name"}, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rows, err := tSvc.Entities.ExportFilteredCSV(ctx, g.ID, tc.q, "https://homebox.example")
			require.NoError(t, err)
			col := csvColumn(t, rows, "HB.name")
			names := []string{}
			for _, row := range rows[1:] {
				names = append(names, row[col])
				assert.NotEqual(t, foreign.Name, row[col])
			}
			assert.ElementsMatch(t, tc.want, names)
			// Predicate parity with item listing, without pagination.
			q := tc.q
			q.Page = -1
			q.PageSize = -1
			listed, err := tRepos.Entities.QueryByGroup(ctx, g.ID, q)
			require.NoError(t, err)
			listedNames := []string{}
			for _, e := range listed.Items {
				listedNames = append(listedNames, e.Name)
			}
			assert.ElementsMatch(t, listedNames, names)
			if len(tc.want) == 0 {
				assert.Len(t, rows, 1)
				assert.Len(t, rows[0], 25)
			}
		})
	}
	rows, err := tSvc.Entities.ExportFilteredCSV(ctx, g.ID, repo.EntityQuery{Search: "Drill"}, "https://homebox.example")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "Box-ref", rows[1][csvColumn(t, rows, "HB.parent_import_ref")])
	assert.Equal(t, "Room", rows[1][csvColumn(t, rows, "HB.location")])
	assert.Equal(t, []string{"HB.field.alpha", "HB.field.zeta"}, rows[0][len(rows[0])-2:])
	assert.Equal(t, "值,\"quoted\"\nnext", rows[1][csvColumn(t, rows, "HB.field.zeta")])
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	require.NoError(t, w.WriteAll(rows))
	parsed, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	assert.Equal(t, rows, parsed)

	legacy, err := tSvc.Entities.ExportCSV(ctx, g.ID, "https://homebox.example")
	require.NoError(t, err)
	assert.Len(t, legacy, 6) // location and archived record remain in legacy mode

	// More than a listing page: supplied pagination and location override cannot limit export.
	for i := 0; i < 65; i++ {
		create(g.ID, fmt.Sprintf("Bulk %03d", i), loc.ID, it.ID)
	}
	isLoc := true
	bulk, err := tSvc.Entities.ExportFilteredCSV(ctx, g.ID, repo.EntityQuery{Search: "Bulk", Page: 2, PageSize: 5, IsLocation: &isLoc}, "")
	require.NoError(t, err)
	assert.Len(t, bulk, 66)
	assert.Equal(t, "Bulk 000", bulk[1][csvColumn(t, bulk, "HB.name")])
	assert.Equal(t, "Bulk 064", bulk[65][csvColumn(t, bulk, "HB.name")])
}

func TestFilteredCSVMetadataCollectionScope(t *testing.T) {
	ctx := context.Background()
	g, err := tRepos.Groups.GroupCreate(ctx, "metadata-"+fk.Str(4), uuid.Nil)
	require.NoError(t, err)
	other, err := tRepos.Groups.GroupCreate(ctx, "metadata-other-"+fk.Str(4), uuid.Nil)
	require.NoError(t, err)
	lt, err := tRepos.EntityTypes.GetDefault(ctx, g.ID, true)
	require.NoError(t, err)
	secret, err := tRepos.Entities.Create(ctx, other.ID, repo.EntityCreate{Name: "Foreign ancestor", ImportRef: "foreign-ref"})
	require.NoError(t, err)
	location, err := tRepos.Entities.Create(ctx, g.ID, repo.EntityCreate{Name: "Local room", EntityTypeID: lt.ID})
	require.NoError(t, err)
	parent, err := tRepos.Entities.Create(ctx, g.ID, repo.EntityCreate{Name: "Untyped parent", ImportRef: "untyped-ref", ParentID: location.ID})
	require.NoError(t, err)
	child, err := tRepos.Entities.Create(ctx, g.ID, repo.EntityCreate{Name: "Child", ParentID: parent.ID})
	require.NoError(t, err)
	rows, err := tSvc.Entities.ExportFilteredCSV(ctx, g.ID, repo.EntityQuery{Search: "Child"}, "")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, "untyped-ref", rows[1][csvColumn(t, rows, "HB.parent_import_ref")])
	assert.Equal(t, "Local room", rows[1][csvColumn(t, rows, "HB.location")])

	metadata, err := tRepos.Entities.GetExportParents(ctx, g.ID, []uuid.UUID{parent.ID, secret.ID})
	require.NoError(t, err)
	require.Len(t, metadata, 1)
	assert.Equal(t, parent.ID, metadata[0].ID)

	// Even inconsistent cross-collection links must not leak ancestor names or refs.
	_, err = tClient.Entity.UpdateOneID(location.ID).SetParentID(secret.ID).Save(ctx)
	require.NoError(t, err)
	rows, err = tSvc.Entities.ExportFilteredCSV(ctx, g.ID, repo.EntityQuery{Search: "Child"}, "")
	require.NoError(t, err)
	assert.Equal(t, "Local room", rows[1][csvColumn(t, rows, "HB.location")])
	_, err = tClient.Entity.UpdateOneID(child.ID).SetParentID(secret.ID).Save(ctx)
	require.NoError(t, err)
	rows, err = tSvc.Entities.ExportFilteredCSV(ctx, g.ID, repo.EntityQuery{Search: "Child"}, "")
	require.NoError(t, err)
	assert.Empty(t, rows[1][csvColumn(t, rows, "HB.parent_import_ref")])
	assert.Empty(t, rows[1][csvColumn(t, rows, "HB.location")])
}
