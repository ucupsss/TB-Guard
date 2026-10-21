"""Feature extraction with HeAR encoder interface and fingerprint-based caching."""

from tb_guard_ml.features.hear_encoder import BaseAudioEncoder, OfficialHearEncoder, HearSyntheticSurrogateEncoder, get_encoder
from tb_guard_ml.features.cache import EmbeddingCache, CachedEmbeddingEntry

__all__ = [
    "BaseAudioEncoder",
    "OfficialHearEncoder",
    "HearSyntheticSurrogateEncoder",
    "get_encoder",
    "EmbeddingCache",
    "CachedEmbeddingEntry",
]
