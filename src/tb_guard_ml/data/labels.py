"""Label mapping and clinical provenance layer for TB-Guard.

Scientific Safeguard:
1. Only explicit microbiological / clinical reference standard labels map to binary targets (0 or 1).
2. Missing, indeterminate, contaminated, or absent labels are NEVER silently mapped to negative.
3. Clinical covariates (age, sex, symptoms, HIV status) are forbidden from the audio feature matrix
   in the baseline audio-only experiment to prevent confounding and data leakage.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Standard binary class designations
CLASS_TB_NEGATIVE = 0
CLASS_TB_POSITIVE = 1


@dataclass
class LabelMappingRule:
    """Explicit mapping rule from clinical metadata values to binary model targets."""
    target_field_name: str = "clinical_tb_status"
    positive_values: Set[str] = field(
        default_factory=lambda: {
            "tb_positive",
            "positive",
            "pos",
            "culture_positive",
            "genexpert_positive",
            "confirmed_tb",
            "1",
        }
    )
    negative_values: Set[str] = field(
        default_factory=lambda: {
            "tb_negative",
            "negative",
            "neg",
            "culture_negative",
            "genexpert_negative",
            "no_tb",
            "0",
        }
    )
    indeterminate_values: Set[str] = field(
        default_factory=lambda: {
            "indeterminate",
            "unknown",
            "missing",
            "contaminated",
            "inconclusive",
            "pending",
            "none",
            "nan",
            "",
        }
    )


class LabelMapper:
    """Strict clinical label mapper ensuring no silent assumptions or accidental negative imputation."""

    def __init__(self, rule: Optional[LabelMappingRule] = None):
        self.rule = rule or LabelMappingRule()

    def map_label(self, raw_label: Any) -> Tuple[Optional[int], Optional[str]]:
        """Map raw clinical label into (binary_target, exclusion_reason).

        Returns:
            Tuple of:
            - binary_target: 1 (positive), 0 (negative), or None (if excluded)
            - exclusion_reason: None if mapped cleanly, or human-readable reason for exclusion
        """
        if raw_label is None:
            return None, "missing_clinical_label"

        label_str = str(raw_label).strip().lower()

        if label_str in self.rule.indeterminate_values:
            return None, f"indeterminate_label_{label_str}"

        if label_str in self.rule.positive_values:
            return CLASS_TB_POSITIVE, None

        if label_str in self.rule.negative_values:
            return CLASS_TB_NEGATIVE, None

        # Unsupported or unrecognized label - do NOT guess or default to negative!
        return None, f"unsupported_label_{label_str}"

    @staticmethod
    def validate_feature_matrix_columns(columns: list[str]) -> None:
        """Enforce that demographic or clinical metadata are not injected into audio-only feature matrix."""
        prohibited_keywords = [
            "age",
            "sex",
            "gender",
            "symptom",
            "hiv",
            "fever",
            "weight",
            "hemoptysis",
            "night_sweats",
            "bmi",
            "clinic",
            "site",
        ]
        violating = []
        for col in columns:
            lower = col.lower()
            if any(kw in lower for kw in prohibited_keywords) and not lower.startswith("audio_"):
                violating.append(col)

        if violating:
            raise ValueError(
                f"Scientific Safeguard Violation: Prohibited clinical/demographic metadata "
                f"found in audio feature matrix: {violating}. Audio-only baseline strictly forbids "
                f"multimodal feature injection."
            )
