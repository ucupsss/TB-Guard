"""Fingerprint-based persistent caching for audio embeddings."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class CachedEmbeddingEntry:
    window_id: str
    recording_id: str
    participant_id: str
    fingerprint: str
    model_identifier: str
    embedding_dim: int
    target_label: Optional[int]
    split: str
    padding_samples: int
    cache_file_rel: str

    def to_dict(self) -> dict:
        return asdict(self)


class EmbeddingCache:
    """Persistent on-disk cache for audio embeddings with fingerprint verification."""

    def __init__(self, cache_dir: str | Path, model_identifier: str):
        self.cache_dir = Path(cache_dir)
        self.model_identifier = model_identifier
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.cache_dir / "index.json"
        self._index: Dict[str, CachedEmbeddingEntry] = {}
        self._load_index()

    def _load_index(self) -> None:
        """Load metadata index from disk if present."""
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for wid, item in data.items():
                    # Only accept entries from the matching model version
                    if item.get("model_identifier") == self.model_identifier:
                        self._index[wid] = CachedEmbeddingEntry(**item)
                logger.debug("Loaded %d valid cache entries for model %s", len(self._index), self.model_identifier)
            except Exception as e:
                logger.warning("Failed to parse cache index: %s. Rebuilding index.", e)
                self._index = {}

    def _save_index(self) -> None:
        """Persist metadata index to disk."""
        data = {k: v.to_dict() for k, v in self._index.items()}
        temp_file = self.index_file.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        temp_file.replace(self.index_file)

    @staticmethod
    def compute_fingerprint(audio_bytes: bytes, model_identifier: str) -> str:
        """Compute SHA-256 fingerprint from raw audio samples and model identifier."""
        hasher = hashlib.sha256()
        hasher.update(model_identifier.encode("utf-8"))
        hasher.update(audio_bytes)
        return hasher.hexdigest()

    def get(self, window_id: str, fingerprint: str) -> Optional[np.ndarray]:
        """Retrieve cached embedding if present and fingerprint matches."""
        entry = self._index.get(window_id)
        if not entry:
            return None

        # Check fingerprint match
        if entry.fingerprint != fingerprint:
            logger.debug("Fingerprint mismatch for window %s, invalidating cache entry", window_id)
            return None

        emb_file = self.cache_dir / entry.cache_file_rel
        if not emb_file.exists():
            return None

        try:
            emb = np.load(emb_file)
            return emb
        except Exception as e:
            logger.warning("Error loading cached embedding file %s: %s", emb_file, e)
            return None

    def put(
        self,
        window_id: str,
        fingerprint: str,
        embedding: np.ndarray,
        recording_id: str,
        participant_id: str,
        target_label: Optional[int],
        split: str,
        padding_samples: int,
    ) -> None:
        """Save embedding and metadata entry to cache."""
        filename = f"{window_id}_{fingerprint[:12]}.npy"
        filepath = self.cache_dir / filename
        np.save(filepath, embedding.astype(np.float32))

        entry = CachedEmbeddingEntry(
            window_id=window_id,
            recording_id=recording_id,
            participant_id=participant_id,
            fingerprint=fingerprint,
            model_identifier=self.model_identifier,
            embedding_dim=int(embedding.shape[0]),
            target_label=target_label,
            split=split,
            padding_samples=padding_samples,
            cache_file_rel=filename,
        )
        self._index[window_id] = entry
        self._save_index()

    def get_all_entries(self) -> List[CachedEmbeddingEntry]:
        """Return list of all cached entries."""
        return list(self._index.values())
