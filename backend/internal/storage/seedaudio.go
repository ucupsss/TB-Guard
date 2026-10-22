package storage

import (
	"context"
	"encoding/binary"
	"hash/fnv"
	"log/slog"
	"math"
	"sync"
	"time"
)

// Rekaman batuk SINTETIS untuk data simulasi: dibuat sekali di server lalu disimpan di Neon Object Storage
// (bukan lagi dibuat di browser). Jumlah dan durasi dibatasi agar kuota storage tetap aman.

const (
	seedSampleRate = 16000
	seedOwner      = "seed"
	seedMetaKey    = "audio_seeded"
)

type mulberry struct{ a uint32 }

func newRNG(seed string) *mulberry {
	h := fnv.New32a()
	h.Write([]byte(seed))
	return &mulberry{h.Sum32()}
}

func (m *mulberry) next() float64 {
	m.a += 0x6D2B79F5
	t := m.a
	t = (t ^ (t >> 15)) * (t | 1)
	t ^= t + (t^(t>>7))*(t|61)
	return float64((t^(t>>14))&0xFFFFFFFF) / 4294967296
}

func addCough(buf []float64, start int, r *mulberry, tb bool) int {
	dur := 0.22 + r.next()*0.12
	cutoff, decay := 0.28, 0.3
	if tb {
		dur = 0.38 + r.next()*0.22
		cutoff, decay = 0.55, 0.42
	}
	n := int(dur * seedSampleRate)
	f0 := 160 + r.next()*140
	var lp, lp2 float64
	for i := 0; i < n && start+i < len(buf); i++ {
		t := float64(i) / seedSampleRate
		env := (1 - math.Exp(-t/0.004)) * math.Exp(-t/(dur*decay))
		white := r.next()*2 - 1
		lp += cutoff * (white - lp)
		lp2 += 0.08 * (white - lp2)
		rough := 1.0
		if tb {
			rough = 0.6 + 0.4*math.Sin(2*math.Pi*(28+r.next()*4)*t)
		}
		voiced := math.Sin(2*math.Pi*f0*t)*0.35*math.Exp(-t/0.12) + math.Sin(2*math.Pi*f0*2.02*t)*0.12
		gate := 0.1
		if t > 0.03 {
			gate = 0.6
		}
		buf[start+i] += (lp*0.9+lp2*0.6)*rough*env*(0.65+r.next()*0.35) + voiced*gate*env
	}
	return n
}

// synthWAV membuat WAV mono 16 kHz 16-bit. notCough=true: hanya derau latar (bukan batuk).
func synthWAV(uuid string, tb bool, coughs int, notCough bool) []byte {
	r := newRNG(uuid)
	seconds := 3.0
	if tb {
		seconds = 4.0
	}
	n := int(seconds * seedSampleRate)
	buf := make([]float64, n)
	for i := range buf {
		buf[i] = (r.next()*2-1)*0.012 + math.Sin(2*math.Pi*50*float64(i)/seedSampleRate)*0.004
	}
	if !notCough {
		pos := int(0.25 * seedSampleRate)
		for c := 0; c < max(coughs, 1) && pos < n-int(0.3*seedSampleRate); c++ {
			l := addCough(buf, pos, r, tb)
			pos += l + int((0.12+r.next()*0.3)*seedSampleRate)
		}
	}
	peak := 1e-9
	for _, v := range buf {
		peak = math.Max(peak, math.Abs(v))
	}
	scale := 0.85 / peak
	if notCough {
		scale = 1 // derau latar tetap pelan
	}

	out := make([]byte, 44+n*2)
	copy(out[0:], "RIFF")
	binary.LittleEndian.PutUint32(out[4:], uint32(36+n*2))
	copy(out[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(out[16:], 16)
	binary.LittleEndian.PutUint16(out[20:], 1) // PCM
	binary.LittleEndian.PutUint16(out[22:], 1) // mono
	binary.LittleEndian.PutUint32(out[24:], seedSampleRate)
	binary.LittleEndian.PutUint32(out[28:], seedSampleRate*2)
	binary.LittleEndian.PutUint16(out[32:], 2)
	binary.LittleEndian.PutUint16(out[34:], 16)
	copy(out[36:], "data")
	binary.LittleEndian.PutUint32(out[40:], uint32(n*2))
	for i, v := range buf {
		s := math.Max(-1, math.Min(1, v*scale))
		binary.LittleEndian.PutUint16(out[44+i*2:], uint16(int16(s*32767)))
	}
	return out
}

// SeedAudio mengunggah rekaman simulasi untuk N deteksi terbaru, sekali saja (penanda di tabel meta).
// Menunggu database siap; aman dijalankan di banyak instance berkat advisory lock transaksi.
func (s *Service) SeedAudio(ctx context.Context) {
	if s.s3 == nil || !s.cfg.Seed || s.cfg.SeedAudioMax <= 0 {
		return
	}
	for s.db.Pool() == nil {
		select {
		case <-time.After(2 * time.Second):
		case <-ctx.Done():
			return
		}
	}
	if err := s.seedAudio(ctx); err != nil && ctx.Err() == nil {
		slog.Warn("seed rekaman simulasi gagal (akan dicoba lagi saat restart)", "err", err)
	}
}

func (s *Service) seedAudio(ctx context.Context) error {
	pool := s.db.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var got bool
	if err := tx.QueryRow(ctx, "SELECT pg_try_advisory_xact_lock(727004)").Scan(&got); err != nil || !got {
		return err // instance lain sedang mengerjakan
	}
	// hanya bila data contoh memang dimuat (tabel meta 'seeded' ada)
	var seeded int
	if err := tx.QueryRow(ctx, "SELECT COUNT(*) FROM meta WHERE key='seeded'").Scan(&seeded); err != nil || seeded == 0 {
		return err
	}

	// idempoten: hanya deteksi yang belum punya rekaman, jadi restart melengkapi yang kurang (mis. batas dinaikkan)
	rows, err := tx.Query(ctx, `SELECT d.uuid, d.result, d.coughs, d.type FROM detections d
		WHERE NOT EXISTS (SELECT 1 FROM uploads u WHERE u.detection = d.uuid)
		ORDER BY d.time DESC LIMIT $1`, s.cfg.SeedAudioMax)
	if err != nil {
		return err
	}
	type det struct {
		uuid, result, typ string
		coughs            int
	}
	var dets []det
	for rows.Next() {
		var d det
		if err := rows.Scan(&d.uuid, &d.result, &d.coughs, &d.typ); err != nil {
			rows.Close()
			return err
		}
		dets = append(dets, d)
	}
	rows.Close()

	type up struct {
		d    det
		key  string
		size int
		err  error
	}
	results := make([]up, len(dets))
	sem := make(chan struct{}, 4)
	var wg sync.WaitGroup
	for i, d := range dets {
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			data := synthWAV(d.uuid, d.result == "TB", d.coughs, d.typ == "-")
			key := "seed/recordings/" + d.uuid + ".wav"
			results[i] = up{d: d, key: key, size: len(data), err: s.s3.Put(ctx, key, "audio/wav", data)}
		}()
	}
	wg.Wait()

	now := time.Now().UnixMilli()
	var total int64
	for _, r := range results {
		if r.err != nil {
			return r.err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO uploads (id,key,owner,content_type,size,detection,created_at)
			VALUES ($1,$2,$3,'audio/wav',$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
			"seed-"+r.d.uuid, r.key, seedOwner, int64(r.size), r.d.uuid, now); err != nil {
			return err
		}
		total += int64(r.size)
	}
	if _, err := tx.Exec(ctx, "INSERT INTO meta (key) VALUES ($1) ON CONFLICT DO NOTHING", seedMetaKey); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	slog.Info("rekaman simulasi tersimpan di object storage", "jumlah", len(results), "bytes", total)
	return nil
}
