"""Unit tests for audio loading, preprocessing, anti-aliased resampling, and segmentation."""

from pathlib import Path
import numpy as np
import pytest
import soundfile as sf

from tb_guard_ml.audio.loading import load_audio_file
from tb_guard_ml.audio.preprocessing import AudioPreprocessor
from tb_guard_ml.audio.segmentation import WindowSegmenter


def test_corrupt_and_empty_audio_handling(tmp_path: Path):
    """Verify empty and corrupt audio files fail gracefully without throwing unhandled exceptions."""
    # 1. Non-existent file
    res_missing = load_audio_file(tmp_path / "non_existent.wav")
    assert not res_missing.is_valid
    assert "File not found" in str(res_missing.error_message)

    # 2. Empty 0-byte file
    empty_file = tmp_path / "empty.wav"
    empty_file.write_bytes(b"")
    res_empty = load_audio_file(empty_file)
    assert not res_empty.is_valid
    assert "empty" in str(res_empty.error_message).lower()

    # 3. Corrupt file with non-audio junk bytes
    corrupt_file = tmp_path / "corrupt.wav"
    corrupt_file.write_bytes(b"RIFF\x00\x00\x00\x00WAVEfmt junk not valid header data 1234567890")
    res_corrupt = load_audio_file(corrupt_file)
    assert not res_corrupt.is_valid


def test_mono_conversion():
    """Verify multichannel audio is averaged to single-channel mono."""
    preprocessor = AudioPreprocessor()
    # 2-channel audio
    ch1 = np.ones(1000, dtype=np.float32) * 0.4
    ch2 = np.ones(1000, dtype=np.float32) * 0.8
    stereo = np.stack([ch1, ch2], axis=1)

    mono = preprocessor.to_mono(stereo)
    assert mono.ndim == 1
    assert len(mono) == 1000
    assert np.isclose(mono[0], 0.6)


def test_anti_aliased_resampling():
    """Verify 44.1 kHz audio is cleanly resampled to 16 kHz."""
    preprocessor = AudioPreprocessor()
    orig_sr = 44100
    duration = 1.0  # 1 second
    t = np.linspace(0, duration, int(orig_sr * duration), endpoint=False)
    # 440 Hz test sine tone
    audio_44k = np.sin(2 * np.pi * 440 * t).astype(np.float32)

    resampled = preprocessor.resample_16k(audio_44k, orig_sr=44100)
    assert len(resampled) == 16000
    assert np.all(np.isfinite(resampled))


def test_two_second_segmentation_and_padding():
    """Verify segmentation strictly generates 32,000-sample windows with recorded padding."""
    segmenter = WindowSegmenter(sample_rate=16000, window_duration_seconds=2.0)
    target_samples = 32000

    # Test 1: Short audio (1.2 seconds = 19,200 samples)
    short_audio = np.ones(19200, dtype=np.float32) * 0.5
    windows_short = segmenter.segment(
        short_audio,
        recording_id="rec_short",
        participant_id="part_01",
        target_label=1,
    )
    assert len(windows_short) == 1
    w0 = windows_short[0]
    assert len(w0.audio_data) == target_samples
    assert w0.padding_samples == (target_samples - 19200)
    # Check that tail is zero-padded
    assert np.all(w0.audio_data[19200:] == 0.0)

    # Test 2: Long audio (3.5 seconds = 56,000 samples)
    long_audio = np.ones(56000, dtype=np.float32) * 0.3
    windows_long = segmenter.segment(
        long_audio,
        recording_id="rec_long",
        participant_id="part_02",
        target_label=0,
    )
    # 56,000 samples with 32,000 window size -> window 0: [0:32000], window 1: [32000:56000] padded to 32,000
    assert len(windows_long) == 2
    assert len(windows_long[0].audio_data) == target_samples
    assert windows_long[0].padding_samples == 0
    assert len(windows_long[1].audio_data) == target_samples
    assert windows_long[1].padding_samples == (32000 - (56000 - 32000))
