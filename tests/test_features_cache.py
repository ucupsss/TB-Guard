"""Unit tests for feature extraction and fingerprint-based embedding cache."""

from pathlib import Path
import numpy as np
import pytest

from tb_guard_ml.features.cache import EmbeddingCache
from tb_guard_ml.features.hear_encoder import HearSyntheticSurrogateEncoder, get_encoder


def test_embedding_shape_and_numerical_validity():
    """Verify encoder produces strictly 512-dimensional, finite embeddings for 32,000-sample inputs."""
    encoder = HearSyntheticSurrogateEncoder()
    assert encoder.embedding_dim == 512
    assert encoder.is_synthetic_surrogate

    batch_size = 4
    # Shape: (4, 32000)
    audio_batch = np.random.randn(batch_size, 32000).astype(np.float32) * 0.1
    emb = encoder.encode_batch(audio_batch)

    assert emb.shape == (batch_size, 512)
    assert np.all(np.isfinite(emb))
    # Check L2 normalized
    norms = np.linalg.norm(emb, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-4)


def test_cache_fingerprint_reuse_and_invalidation(tmp_path: Path):
    """Verify cache hits on identical fingerprints and misses when inputs change."""
    cache_dir = tmp_path / "cache"
    model_id = "test_model_v1"
    cache = EmbeddingCache(cache_dir, model_id)

    audio_bytes_1 = np.ones(32000, dtype=np.float32).tobytes()
    audio_bytes_2 = np.zeros(32000, dtype=np.float32).tobytes()

    fp_1 = EmbeddingCache.compute_fingerprint(audio_bytes_1, model_id)
    fp_2 = EmbeddingCache.compute_fingerprint(audio_bytes_2, model_id)
    assert fp_1 != fp_2

    mock_emb_1 = np.random.randn(512).astype(np.float32)

    # 1. Cache miss initially
    assert cache.get("win_01", fp_1) is None

    # 2. Put into cache
    cache.put(
        window_id="win_01",
        fingerprint=fp_1,
        embedding=mock_emb_1,
        recording_id="rec_01",
        participant_id="part_01",
        target_label=1,
        split="train",
        padding_samples=0,
    )

    # 3. Cache hit on matching fingerprint
    cached_emb = cache.get("win_01", fp_1)
    assert cached_emb is not None
    assert np.allclose(cached_emb, mock_emb_1)

    # 4. Invalidation: requesting same window_id with modified audio fingerprint returns None
    assert cache.get("win_01", fp_2) is None


def test_cache_model_version_isolation(tmp_path: Path):
    """Verify cache rejects entries from a different model version."""
    cache_dir = tmp_path / "cache_version_test"
    cache_v1 = EmbeddingCache(cache_dir, "model_v1")
    audio_bytes = np.ones(32000, dtype=np.float32).tobytes()
    fp = EmbeddingCache.compute_fingerprint(audio_bytes, "model_v1")

    cache_v1.put(
        window_id="win_01",
        fingerprint=fp,
        embedding=np.zeros(512, dtype=np.float32),
        recording_id="rec_01",
        participant_id="part_01",
        target_label=0,
        split="train",
        padding_samples=0,
    )

    # Load same directory with new model_id
    cache_v2 = EmbeddingCache(cache_dir, "model_v2")
    assert cache_v2.get("win_01", fp) is None
