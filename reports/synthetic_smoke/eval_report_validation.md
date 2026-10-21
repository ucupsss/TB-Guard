# TB-Guard Model Evaluation Report — Split: VALIDATION

> [!WARNING]
> **SYNTHETIC SMOKE TEST DATA ONLY**
> The metrics below are computed on synthetic non-clinical audio to verify pipeline integrity.
> These results MUST NOT be interpreted as medical diagnostic performance.

- **Dataset Provenance:** `SYNTHETIC_SMOKE_TEST`
- **Sample Size:** 4 participants (20 audio windows)
- **Decision Threshold:** 0.1600 (Validation Youden J optimization)

## Primary Performance Metrics
| Metric | Value | 95% Bootstrap CI (Participant Resampled) |
| :--- | :--- | :--- |
| **Sensitivity (Recall)** | 0.3750 | [0.333, 0.500] |
| **Specificity** | 0.9167 | [0.833, 1.000] |
| **Precision (PPV)** | 0.7500 | [0.290, 1.000] |
| **F1-Score** | 0.5000 | [0.348, 0.667] |
| **ROC-AUC** | 0.5521 | [0.472, 0.750] |
| **PR-AUC** | 0.5877 | [0.236, 0.842] |
| **Brier Calibration Score** | 0.3162 | [0.098, 0.534] |

## Confusion Matrix
| | Predicted Negative (0) | Predicted Positive (1) |
| :--- | :--- | :--- |
| **Actual Negative (0)** | TN: 11 | FP: 1 |
| **Actual Positive (1)** | FN: 5 | TP: 3 |

## Scientific Safeguards & Notes
1. Participant-level isolation guarantees no acoustic windows from the same participant crossed splits.
2. Resampling unit for confidence intervals is the participant (cluster bootstrap), preserving intra-participant correlation.
3. Audio representations alone cannot diagnose TB or establish active transmission.