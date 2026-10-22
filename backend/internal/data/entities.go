package data

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
)

// Tipe kolom untuk koersi nilai JSON -> parameter SQL.
const (
	tText  = "text"
	tInt   = "int"
	tFloat = "float"
	tBool  = "bool"
	tMs    = "ms"   // epoch ms, BIGINT (pecahan dibulatkan)
	tJSON  = "json" // JSONB
)

type col struct {
	json string // nama field di JSON (camelCase, sama dengan frontend)
	db   string // nama kolom
	typ  string
}

// Entity memetakan satu tabel. Nama kolom HANYA berasal dari spec ini, tidak pernah dari input klien.
type Entity struct {
	table string
	pk    col
	cols  []col // semua kolom termasuk pk
	order string
}

var DeviceEntity = Entity{
	table: "devices", order: "seq ASC",
	pk: col{"id", "id", tInt},
	cols: []col{
		{"id", "id", tInt}, {"name", "name", tText}, {"type", "type", tText}, {"status", "status", tText},
		{"location", "location", tText}, {"zone", "zone", tText}, {"city", "city", tText}, {"mics", "mics", tInt},
		{"array", "mic_array", tText}, {"camera", "camera", tText}, {"fw", "fw", tText}, {"installed", "installed", tText},
		{"lastSeen", "last_seen", tMs}, {"lat", "lat", tFloat}, {"lng", "lng", tFloat},
	},
}

var DetectionEntity = Entity{
	table: "detections", order: "time DESC",
	pk: col{"uuid", "uuid", tText},
	cols: []col{
		{"uuid", "uuid", tText}, {"deviceId", "device_id", tInt}, {"time", "time", tMs}, {"type", "type", tText},
		{"result", "result", tText}, {"confidence", "confidence", tFloat}, {"name", "name", tText}, {"gender", "gender", tText},
		{"age", "age", tJSON}, {"doa", "doa", tJSON}, {"person", "person", tJSON}, {"reviewed", "reviewed", tBool},
		{"coughs", "coughs", tInt}, {"verified", "verified", tText},
	},
}

var PatientEntity = Entity{
	table: "patients", order: "seq DESC",
	pk: col{"id", "id", tText},
	cols: []col{
		{"id", "id", tText}, {"name", "name", tText}, {"gender", "gender", tText}, {"age", "age", tJSON}, {"nik", "nik", tText},
		{"phone", "phone", tText}, {"facility", "facility", tText}, {"stage", "stage", tInt}, {"start", "start_ts", tMs},
		{"daysIn", "days_in", tInt}, {"uuid", "uuid", tText}, {"deviceId", "device_id", tInt}, {"adherence", "adherence", tFloat},
		{"nextVisit", "next_visit", tMs}, {"pic", "pic", tText}, {"events", "events", tJSON},
	},
}

// coerce mengubah nilai hasil decode JSON menjadi tipe yang diterima pgx. nil tetap nil (NULL).
func coerce(c col, v any) (any, error) {
	if v == nil {
		return nil, nil
	}
	switch c.typ {
	case tText:
		if s, ok := v.(string); ok {
			return s, nil
		}
	case tInt, tMs:
		if f, ok := v.(float64); ok && !math.IsNaN(f) && !math.IsInf(f, 0) {
			return int64(math.Round(f)), nil
		}
	case tFloat:
		if f, ok := v.(float64); ok && !math.IsNaN(f) && !math.IsInf(f, 0) {
			return f, nil
		}
	case tBool:
		if b, ok := v.(bool); ok {
			return b, nil
		}
	case tJSON:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil // di-cast ke jsonb di SQL
	}
	return nil, fmt.Errorf("field %q bertipe salah", c.json)
}

// build menyusun daftar kolom/placeholder/arg dari body; hanya kolom yang ada di spec dan di body.
func (e Entity) build(body map[string]any, skipPK bool) (cols []string, holders []string, args []any, err error) {
	for _, c := range e.cols {
		if skipPK && c.db == e.pk.db {
			continue
		}
		raw, ok := body[c.json]
		if !ok {
			continue
		}
		v, err := coerce(c, raw)
		if err != nil {
			return nil, nil, nil, err
		}
		args = append(args, v)
		ph := fmt.Sprintf("$%d", len(args))
		if c.typ == tJSON {
			ph += "::jsonb"
		}
		cols = append(cols, c.db)
		holders = append(holders, ph)
	}
	return
}

// attribCols: kolom atribusi (dibaca klien, tapi hanya diisi server dari sesi login).
var attribCols = []col{{"createdBy", "created_by", tText}, {"updatedBy", "updated_by", tText}, {"updatedAt", "updated_at", tMs}}

func (e Entity) insertSQL(body map[string]any, actor string) (string, []any, error) {
	if _, ok := body[e.pk.json]; !ok {
		return "", nil, fmt.Errorf("field %q wajib", e.pk.json)
	}
	cols, holders, args, err := e.build(body, false)
	if err != nil {
		return "", nil, err
	}
	now := time.Now().UnixMilli()
	for _, v := range []any{actor, actor, now} {
		args = append(args, v)
		holders = append(holders, fmt.Sprintf("$%d", len(args)))
	}
	cols = append(cols, "created_by", "updated_by", "updated_at")
	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", e.table, strings.Join(cols, ","), strings.Join(holders, ",")), args, nil
}

func (e Entity) updateSQL(pk any, body map[string]any, actor string) (string, []any, error) {
	cols, holders, args, err := e.build(body, true)
	if err != nil {
		return "", nil, err
	}
	if len(cols) == 0 {
		return "", nil, fmt.Errorf("tidak ada field yang diubah")
	}
	sets := make([]string, len(cols), len(cols)+2)
	for i := range cols {
		sets[i] = cols[i] + "=" + holders[i]
	}
	args = append(args, actor, time.Now().UnixMilli())
	sets = append(sets, fmt.Sprintf("updated_by=$%d", len(args)-1), fmt.Sprintf("updated_at=$%d", len(args)))
	args = append(args, pk)
	return fmt.Sprintf("UPDATE %s SET %s WHERE %s=$%d", e.table, strings.Join(sets, ","), e.pk.db, len(args)), args, nil
}

// outCols: kolom yang dikirim ke klien (data + atribusi).
func (e Entity) outCols() []col {
	return append(append([]col{}, e.cols...), attribCols...)
}

func (e Entity) selectSQL() string {
	oc := e.outCols()
	names := make([]string, len(oc))
	for i, c := range oc {
		names[i] = c.db
	}
	return fmt.Sprintf("SELECT %s FROM %s ORDER BY %s", strings.Join(names, ","), e.table, e.order)
}
