"""Baseline classification models and pipelines for TB-Guard."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from tb_guard_ml.config import ClassifierConfig

logger = logging.getLogger(__name__)


class MajorityClassBaseline:
    """Trivial baseline predicting the most frequent class in training data."""

    def __init__(self):
        self.majority_class: int = 0
        self.class_probability: float = 0.5

    def fit(self, X: np.ndarray, y: np.ndarray) -> MajorityClassBaseline:
        counts = np.bincount(y.astype(int), minlength=2)
        self.majority_class = int(np.argmax(counts))
        self.class_probability = float(counts[1] / len(y)) if len(y) > 0 else 0.5
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        n = X.shape[0]
        probs = np.zeros((n, 2), dtype=np.float32)
        probs[:, 0] = 1.0 - self.class_probability
        probs[:, 1] = self.class_probability
        return probs

    def predict(self, X: np.ndarray) -> np.ndarray:
        n = X.shape[0]
        return np.full(n, self.majority_class, dtype=int)


class TBGuardBaselineModel:
    """Standardized Audio Baseline Pipeline: Scaler + Class-Weighted Logistic Regression."""

    def __init__(self, config: Optional[ClassifierConfig] = None):
        self.config = config or ClassifierConfig()
        self.decision_threshold: float = self.config.decision_threshold or 0.5
        self.pipeline: Pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        C=self.config.c_regularization,
                        max_iter=self.config.max_iter,
                        class_weight=self.config.class_weight,
                        random_state=self.config.random_state,
                        solver="lbfgs",
                    ),
                ),
            ]
        )

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> TBGuardBaselineModel:
        """Fit scaler and logistic regression exclusively on training data."""
        logger.info("Fitting baseline model on %d training samples (dim=%d)...", X_train.shape[0], X_train.shape[1])
        self.pipeline.fit(X_train, y_train)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict class probabilities: returns shape (N, 2)."""
        return self.pipeline.predict_proba(X)

    def predict(self, X: np.ndarray, threshold: Optional[float] = None) -> np.ndarray:
        """Predict binary class using configured or overridden threshold."""
        thresh = threshold if threshold is not None else self.decision_threshold
        probs = self.predict_proba(X)[:, 1]
        return (probs >= thresh).astype(int)

    def save(self, filepath: str) -> None:
        """Serialize pipeline to disk."""
        data = {
            "pipeline": self.pipeline,
            "decision_threshold": self.decision_threshold,
            "config": self.config,
        }
        joblib.dump(data, filepath)
        logger.info("Saved trained baseline model to %s", filepath)

    @classmethod
    def load(cls, filepath: str) -> TBGuardBaselineModel:
        """Load trained pipeline from disk."""
        data = joblib.load(filepath)
        model = cls(config=data.get("config"))
        model.pipeline = data["pipeline"]
        model.decision_threshold = data.get("decision_threshold", 0.5)
        return model
