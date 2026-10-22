package data

import "testing"

func TestEntitySQLUsesOnlySpecColumns(t *testing.T) {
	q, args, err := DeviceEntity.updateSQL(int64(1), map[string]any{"zone": "x", "evil; DROP": "y", "lastSeen": 12.6})
	if err != nil {
		t.Fatal(err)
	}
	if q != "UPDATE devices SET zone=$1,last_seen=$2 WHERE id=$3" || len(args) != 3 || args[1] != int64(13) {
		t.Fatalf("sql/args salah: %s %v", q, args)
	}
	if _, _, err := DeviceEntity.updateSQL(int64(1), map[string]any{"zone": 5.0}); err == nil {
		t.Fatal("tipe salah harus ditolak")
	}
	if _, _, err := DetectionEntity.insertSQL(map[string]any{"result": "TB"}); err == nil {
		t.Fatal("pk wajib")
	}
}
