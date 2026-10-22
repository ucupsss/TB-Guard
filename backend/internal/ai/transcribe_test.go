package ai

import "testing"

func TestNormalizeText(t *testing.T) {
	for in, want := range map[string]string{
		"Tambahkan di Fest TV Gward 5":                      "Tambahkan di TB Guard 5",
		"tebe gard lima":                                    "TB Guard lima",
		"pasien tebece dites jin exper":                     "pasien TBC dites GeneXpert",
		"cek ti bi pasien":                                  "cek TB pasien",
		"  spasi   ganda  ":                                 "spasi ganda",
		"Pemba kan tebe guard atau edufas tebe guard lima?": "Pemba kan TB Guard atau edufas TB Guard lima?",
	} {
		if got := normalizeText(in); got != want {
			t.Errorf("normalizeText(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestScoreSegmentsFiltersNoiseAndScores(t *testing.T) {
	segs := []whisperSeg{
		{Text: " halo agen", Start: 0, End: 1, AvgLogprob: -0.1, NoSpeechProb: 0.01, CompressionRatio: 1.2},
		{Text: " Terima kasih telah menonton", Start: 1, End: 2, AvgLogprob: -1.9, NoSpeechProb: 0.95, CompressionRatio: 1.0},
	}
	text, conf := scoreSegments("x", segs)
	if text != "halo agen" || conf < 0.85 {
		t.Fatalf("hasil salah: %q %.2f", text, conf)
	}
	if text, _ := scoreSegments("Terima kasih telah menonton!", nil); text != "" {
		t.Fatalf("halusinasi harus dibuang, dapat %q", text)
	}
	if _, conf := scoreSegments("", []whisperSeg{{Text: "abc", Start: 0, End: 1, AvgLogprob: -2.5, CompressionRatio: 1}}); conf > 0.2 {
		t.Fatalf("logprob buruk harus berkeyakinan rendah, dapat %.2f", conf)
	}
}
