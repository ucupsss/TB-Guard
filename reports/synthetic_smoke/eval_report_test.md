# TB-Guard Model Evaluation Report — Split: TEST

> [!WARNING]
> **SYNTHETIC SMOKE TEST DATA ONLY**
> The metrics below are computed on synthetic non-clinical audio to verify pipeline integrity.
> These results MUST NOT be interpreted as medical diagnostic performance.

- **Dataset Provenance:** `SYNTHETIC_SMOKE_TEST`
- **Sample Size:** 5 participants (29 audio windows)
- **Decision Threshold:** 0.1600 (Frozen threshold 0.160 selected on validation split)

## Primary Performance Metrics
| Metric | Value | 95% Bootstrap CI (Participant Resampled) |
| :--- | :--- | :--- |
| **Sensitivity (Recall)** | 0.5000 | [0.000, 0.667] |
| **Specificity** | 0.3810 | [0.250, 0.500] |
| **Precision (PPV)** | 0.2353 | [0.000, 0.667] |
| **F1-Score** | 0.3200 | [0.000, 0.639] |
| **ROC-AUC** | 0.4762 | [0.073, 0.628] |
| **PR-AUC** | 0.3204 | [0.052, 0.747] |
| **Brier Calibration Score** | 0.3399 | [0.272, 0.503] |

## Confusion Matrix
| | Predicted Negative (0) | Predicted Positive (1) |
| :--- | :--- | :--- |
| **Actual Negative (0)** | TN: 8 | FP: 13 |
| **Actual Positive (1)** | FN: 4 | TP: 4 |

## Scientific Safeguards & Notes
1. Participant-level isolation guarantees no acoustic windows from the same participant crossed splits.
2. Resampling unit for confidence intervals is the participant (cluster bootstrap), preserving intra-participant correlation.
3. Audio representations alone cannot diagnose TB or establish active transmission.