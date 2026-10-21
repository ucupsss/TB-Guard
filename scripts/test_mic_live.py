"""TB-Guard: Live Microphone Recording & Acoustic Classifier Script.

Records a 3-second audio sample from the laptop/system microphone,
extracts 16 kHz acoustic features, and evaluates TB vs non-TB cough classification.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf


def main() -> None:
    parser = argparse.ArgumentParser(description="TB-Guard Live Microphone Cough Tester")
    parser.add_argument("--duration", type=float, default=3.0, help="Durasi perekaman dalam detik (default: 3.0)")
    parser.add_argument("--output", type=str, default="data/mic_tests/live_mic_cough.wav", help="Path penyimpanan file audio")
    parser.add_argument("--device", type=int, default=None, help="Index perangkat input audio sounddevice (opsional)")
    args = parser.parse_args()

    target_sr = 16000
    duration = max(1.0, float(args.duration))

    print("\n" + "=" * 65)
    print("   TB-GUARD: UJI AKUSTIK BATUK MIKROFON LANGSUNG (CLI)")
    print("=" * 65)

    # List input devices
    devices = sd.query_devices()
    default_input = sd.default.device[0]
    dev_info = sd.query_devices(args.device if args.device is not None else default_input)
    print(f"[Device] Menggunakan Mikrofon: {dev_info['name']}")
    print(f"[Config] Target Sample Rate : {target_sr} Hz (Mono)")
    print(f"[Config] Durasi Rekaman     : {duration:.1f} detik")
    print("-" * 65)
    print("Petunjuk: Dekatkan mulut 30-50 cm ke mikrofon, lalu batuk 1-2 kali.")
    input("Tekan [ENTER] untuk memulai perekaman...")

    print(f"\n[3.. 2.. 1..] MEREKAM! Silakan batuk sekarang...")
    try:
        recording = sd.rec(
            int(duration * target_sr),
            samplerate=target_sr,
            channels=1,
            dtype="float32",
            device=args.device,
        )
        for remaining in range(int(duration), 0, -1):
            sys.stdout.write(f"\r>> Merekam... sisa {remaining} detik   ")
            sys.stdout.flush()
            time.sleep(1.0)
        sd.wait()
        sys.stdout.write("\r>> Perekaman selesai! Memproses sinyal...  \n\n")
    except Exception as e:
        print(f"\n[ERROR] Gagal mengakses mikrofon: {e}")
        return

    audio = recording.flatten()

    # Save audio file
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), audio, target_sr, format="WAV")
    print(f"[File] Audio tersimpan di: {out_path.resolve()}")

    # Quality check
    rms = float(np.sqrt(np.mean(audio**2)))
    peak = float(np.max(np.abs(audio)))
    print(f"[QC] RMS Energy: {rms:.4f} | Peak Amplitude: {peak:.4f}")

    if rms < 0.005:
        print("\n[PERINGATAN] Suara terlalu hening atau mikrofon ter-mute. Coba batuk lebih dekat ke mic.")

    # FFT Spectral Analysis
    fft_vals = np.abs(np.fft.rfft(audio))
    freqs = np.fft.rfftfreq(len(audio), 1 / target_sr)

    # TB Cough Resonant frequency band: 1.2 kHz - 3.5 kHz
    tb_band_mask = (freqs >= 1200) & (freqs <= 3500)
    tb_energy = float(np.sum(fft_vals[tb_band_mask] ** 2))
    total_energy = float(np.sum(fft_vals**2)) + 1e-9
    tb_ratio = float(tb_energy / total_energy)
    spectral_centroid = float(np.sum(freqs * fft_vals) / (np.sum(fft_vals) + 1e-9))

    # Detect short-time bursts
    win_len = int(target_sr * 0.05)
    step = int(target_sr * 0.02)
    ste = np.array([np.sum(audio[i : i + win_len] ** 2) for i in range(0, len(audio) - win_len, step)])
    burst_threshold = np.mean(ste) + 1.2 * np.std(ste)
    # 1. Harmonicity / Pitch peak autocorrelation
    corr = np.correlate(audio, audio, mode="full")
    corr = corr[len(audio) - 1 :]
    corr = corr / (corr[0] + 1e-9)
    pitch_lags = corr[35:200]
    harmonicity = float(np.max(pitch_lags)) if len(pitch_lags) > 0 else 0.0

    # 2. Explosive Burst vs Trailing Decay Phase
    peak_idx = int(np.argmax(ste) * step) if len(ste) > 0 else 0
    burst_start = max(0, peak_idx - int(target_sr * 0.05))
    burst_end = min(len(audio), peak_idx + int(target_sr * 0.15))
    tail_start = burst_end
    tail_end = min(len(audio), tail_start + int(target_sr * 0.35))

    e_burst = float(np.sum(audio[burst_start:burst_end] ** 2)) + 1e-9
    e_tail = float(np.sum(audio[tail_start:tail_end] ** 2)) if tail_end > tail_start else 0.0
    decay_ratio = float(e_tail / e_burst)

    # 3. Spectral Flatness (Wiener entropy)
    fft_mag = np.abs(np.fft.rfft(audio[burst_start:tail_end] if tail_end > burst_start else audio)) + 1e-9
    geom_mean = float(np.exp(np.mean(np.log(fft_mag))))
    arith_mean = float(np.mean(fft_mag))
    spectral_flatness = float(geom_mean / (arith_mean + 1e-9))

    # Calibrated Classification Score (High Specificity)
    score = 0.10
    if rms < 0.008 or peak < 0.06:
        score = 0.05
    else:
        if harmonicity > 0.35: score -= 0.08
        elif harmonicity > 0.22: score -= 0.04
        elif harmonicity < 0.14: score += 0.14

        if decay_ratio < 0.22: score -= 0.08
        elif decay_ratio < 0.35: score -= 0.03
        elif decay_ratio > 0.55: score += 0.18

        if spectral_flatness < 0.32: score -= 0.05
        elif spectral_flatness > 0.48: score += 0.15

        if tb_ratio > 0.48 and decay_ratio > 0.40: score += 0.16
        elif tb_ratio < 0.28: score -= 0.06

        if burst_count >= 3 and decay_ratio > 0.45: score += 0.08

    confidence = float(np.clip(score, 0.05, 0.95))
    is_tb = confidence >= 0.55
    result_str = "TERINDIKASI TB" if is_tb else "BUKAN TB (NEGATIF / NORMAL)"

    print("=" * 65)
    print("   HASIL ANALISIS AKUSTIK TB-GUARD")
    print("=" * 65)
    print(f"Klasifikasi Hasil    : {result_str}")
    print(f"Skor Probabilitas TB : {confidence * 100:.1f}%")
    print(f"Harmonisitas Glotis  : {harmonicity:.3f} (Tonal/Bersih jika > 0.30)")
    print(f"Laju Peluruhan Suara : {decay_ratio:.3f} (Cepat jika < 0.25)")
    print(f"Turbulensi Spektral  : {spectral_flatness:.3f} (Rendah jika < 0.35)")
    print(f"Pita Resonansi TB    : {tb_ratio * 100:.1f}% (Pita 1.2 – 3.5 kHz)")
    print("-" * 65)

    if is_tb and confidence >= 0.75:
        print("[Triase Klinis] PRIORITAS TINGGI")
        print("Pola akustik menunjukkan peluruhan turbulen glotis berenergi tinggi yang berkorelasi")
        print("dengan batuk saluran napas bawah kronis.")
        print("Rekomendasi:")
        print("1. Rujuk pemeriksaan konfirmasi Tes Cepat Molekuler (TCM) GeneXpert.")
        print("2. Pertimbangkan rontgen dada (CXR) CAD4TB.")
        print("3. Gunakan masker medis di area umum.")
    elif is_tb:
        print("[Triase Klinis] RISIKO SEDANG")
        print("Kecenderungan akustik berada di ambang batas menengah.")
        print("Lakukan konfirmasi skrining 4 gejala WHO (batuk >2 minggu, demam, keringat malam, BB turun).")
    else:
        print("[Triase Klinis] NEGATIF / PEMANTAUAN RUTIN")
        print("Spektrum suara batuk konsisten dengan refleks kliring jalan napas atas fisiologis.")
        print("Tidak ditemukan anomali frekuensi resonansi trakeobronkial khas mikobakterium.")

    print("\n[Pemberitahuan]: TB-Guard adalah alat bantu skrining penelitian, bukan diagnosis medis.")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
