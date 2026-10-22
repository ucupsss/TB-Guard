# TB-Guard ML Pipeline & Acoustic Monitoring Simulation (dokumentasi riset)
> Dokumen ini membahas pipeline machine learning dan eksperimen riset. Untuk gambaran platform lengkap (aplikasi web, backend, agen AI), lihat [README utama](../README.md).


[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-Research--Only-lightgrey.svg)]()
[![Pipeline Status](https://img.shields.io/badge/pipeline-reproducible-green.svg)]()

TB-Guard is an investigational, research-stage acoustic monitoring and machine learning pipeline engineered for public-health screening research.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/ucupsss/TB-Guard/blob/main/TB_Guard_CWT_Training_Colab.ipynb)

> [!WARNING]
> **Scientific & Regulatory Notice:**  
> A cough detection result is **not** a tuberculosis prediction. An exploratory audio model prediction is **not** a clinical diagnosis. Acoustic representations alone cannot diagnose active tuberculosis infection or confirm disease transmission. TB-Guard is an investigational research prototype and simulation, **not a clinically cleared medical device**.

---

## Clinical Dataset & Model Benchmark (High-Accuracy Evaluation)

TB-Guard provides both an end-to-end local MLOps pipeline and a high-performance deep learning model (**MobileNetV3-Small on Continuous Wavelet Transform / CWT Scalograms**) trained on real clinical cough acoustics:

### 1. Model Evaluation Scores (Independent Held-Out Clinical Test Set)
Evaluation performed on **420 clinical cough samples** (`230 Healthy` vs `190 TB`) from `elffff/tuberculosis-cough-acoustics-curated-dataset`:

| Evaluation Metric | TB-Guard CWT MobileNetV3 | WHO Triage Target (TPP) | Status |
| :--- | :---: | :---: | :---: |
| **Overall Accuracy** | **93.10%** (391/420) | - | **High Accuracy** |
| **Sensitivity (Recall TB)** | **92.63%** (176/190) | $\ge 90.0\%$ | **Exceeds WHO Target** |
| **Specificity (Healthy)** | **93.48%** (215/230) | $\ge 70.0\%$ | **Exceeds WHO Target** |
| **Precision (TB Class)** | **92.15%** | - | **Low False Positive Rate** |
| **F1-Score (TB Class)** | **0.9239** | - | **Balanced & Robust** |
| **ROC-AUC** | **0.9682** | $\ge 0.85$ | **Superior Discrimination** |

### 2. 1-Click Reproduction on Google Colab
Reviewers and judges can reproduce the entire clinical dataset download, CWT training, and evaluation in **1 click**:
1. Open [`TB_Guard_CWT_Training_Colab.ipynb`](TB_Guard_CWT_Training_Colab.ipynb) in Google Colab (or click the badge above).
2. Runtime $\rightarrow$ Select GPU (T4 / V100).
3. Select **Run All**. The notebook automatically pulls the curated clinical dataset via `kagglehub` and trains the MobileNetV3 model.
4. Pretrained checkpoints and full evaluation reports are already available locally at:
   - Best Checkpoint: `models/mobilenetv3_cwt_best.pth`
   - Evaluation Report: `reports/cwt_training/eval_report_cwt_test.md`
   - Epoch History CSV: `reports/cwt_training/training_history.csv`

---

## Dataset Provenance & Storage Policy (FAQ for Reviewers)

| Dataset Type | Storage Location | Provenance & Purpose |
| :--- | :--- | :--- |
| **Clinical CWT Dataset (Real)** | KaggleHub (`elffff/tuberculosis-cough-acoustics-curated-dataset`) | **3,816 real patient cough recordings** (RespiScan, Coswara, COUGHVID) partitioned with patient-level isolation (`PID_xxx`). Downloaded dynamically via `kagglehub` to respect Git size limits and open-science repository standards. |
| **CODA TB Challenge (Real)** | `data/raw/coda/` (configured via `configs/default.yaml`) | Gated clinical benchmark from Synapse (`syn31472953`). Governed by Data Use Agreement (DUA) and patient privacy laws; access instructions documented in `docs/DATASET_ACCESS.md`. |
| **Synthetic Smoke Test (Mock)** | `data/synthetic_smoke/` | **Deterministic synthetic test audio** used solely for automated CI/CD and pipeline unit-testing (`pytest`), ensuring reviewers can test the pipeline locally without requiring a 20 GB medical download. |

---

## 1. Technical Capabilities

TB-Guard implements three decoupled technical capabilities:

1. **Acoustic Event Detection**: Robust loading, anti-aliased 16 kHz resampling, and 2.0-second (32,000 samples) window segmentation for cough-like acoustic events.
2. **TB-Associated Cough Classification Research**: Scientific research pipeline extracting frozen 512-dimensional continuous embeddings (via Google HeAR / surrogate encoder) and evaluating class-weighted linear classifiers with **strict participant-level splitting** and cluster-bootstrap confidence intervals.
3. **Multi-Node Event Aggregation**: Edge-to-cloud sensor simulation featuring multiple clinic zones, gateway deduplication/idempotency, echo suppression, node health telemetry, and human-review state triggers for public health dashboards.

---

## 2. Project Architecture

```
TB-INKUBATOR/
├── configs/                  # Pipeline YAML configurations
│   ├── default.yaml          # Clinical baseline config (CODA + Official HeAR)
│   └── synthetic_smoke.yaml  # Synthetic smoke-test config
├── data/                     # Data directory (ignored by git)
│   ├── raw/                  # Immutable raw audio & clinical tables
│   ├── interim/              # Quality-checked representations
│   ├── processed/            # 16 kHz mono window segments
│   └── splits/               # Participant-isolated manifests
├── docs/
│   └── DATASET_ACCESS.md     # Synapse & Hugging Face access guide
├── models/                   # Serialized model pipelines (joblib)
├── reports/                  # Machine-readable JSON metrics & Markdown QC reports
├── scripts/                  # Executable CLI workflows
│   ├── generate_synthetic_data.py
│   ├── run_qc.py
│   ├── run_pipeline.py
│   └── run_simulation.py
├── src/tb_guard_ml/          # Core Python package
│   ├── config.py             # Typed configuration system
│   ├── api/                  # FastAPI ingestion & dashboard backend
│   ├── audio/                # Safe loading, resampling, segmentation, QC
│   ├── data/                 # Adapters, manifests, strict label mapper, participant splits
│   ├── features/             # HeAR encoder, surrogate encoder, fingerprint cache
│   ├── inference/            # Prediction service with scientific disclaimers
│   ├── simulation/           # Sensor fleet, gateway idempotency, site aggregation
│   └── training/             # Baseline models, threshold tuning, bootstrap evaluation
├── tests/                    # Pytest test suite covering all critical paths
├── .env.example              # Environment template for API tokens
├── pyproject.toml            # Project packaging & dependencies
└── README.md
```

---

## 3. Quickstart & Installation

### Prerequisites
- Python 3.11+
- Virtual environment (recommended)

```powershell
# Clone or open repository
cd c:\Users\LOQ\Downloads\TB-INKUBATOR

# Install dependencies
py -3.13 -m pip install -e .
```

---

## 4. Execution Workflows

### Workflow 1: Generate Synthetic Smoke Test Data
Generates synthetic non-clinical audio bursts (varying sample rates 16k, 44.1k, 48k, mono/stereo) with explicit provenance:
```powershell
py -3.13 scripts/generate_synthetic_data.py --output-dir data/synthetic_smoke/raw --num-participants 24
```

### Workflow 2: Run Audio Quality Control Diagnostics
Validates files against corrupt headers, non-finite values, clipping, and RMS silence:
```powershell
py -3.13 scripts/run_qc.py --manifest data/synthetic_smoke/raw/manifest.csv --output-dir reports/synthetic_smoke
```

### Workflow 3: Run End-to-End ML Pipeline
Executes manifest ingestion, participant-level splitting (zero leakage), 512-dim embedding caching, logistic regression fitting, validation-based threshold optimization (Youden J), and held-out test evaluation:
```powershell
py -3.13 scripts/run_pipeline.py --config configs/synthetic_smoke.yaml
```

### Workflow 4: Run Multi-Node Sensor Fleet Simulator
Simulates multi-zone acoustic nodes, sends bursts, tests gateway duplicate suppression, simulates an acute cough spike, and aggregates site summaries:
```powershell
py -3.13 scripts/run_simulation.py
```

### Workflow 5: Run FastAPI Gateway & Dashboard Service
```powershell
py -3.13 -m uvicorn tb_guard_ml.api.app:app --host 0.0.0.0 --port 8000
```
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health check: `GET http://localhost:8000/health`
- Model info: `GET http://localhost:8000/model/info`
- Site aggregate: `GET http://localhost:8000/sites/SITE_CLINIC_A/summary`

---

## 5. Automated Test Suite

Run all unit and integration tests:
```powershell
py -3.13 -m pytest tests -v
```

Tests cover:
- Corrupt, empty, and non-existent audio handling.
- Multichannel-to-mono conversion and polyphase anti-aliasing resampling.
- Two-second (32,000-sample) window segmentation and deterministic padding.
- Clinical label mapping (guaranteeing missing/unknown values never default to negative).
- Participant-level split isolation and programmatic leakage detection.
- Embedding cache fingerprint verification and version isolation.
- Model training, threshold selection, and bootstrap evaluation.
- Gateway duplicate suppression and time-window site aggregation.
- FastAPI endpoints and schema validation.

---

## 6. Scientific Experiment Registry & Status

| Experiment | Description | Status | Outcome / Notes |
| :--- | :--- | :--- | :--- |
| **Experiment A** | Pipeline Smoke Test on Synthetic Audio | **COMPLETED** | Verified end-to-end loading, resampling, 512-dim caching, participant splitting, and threshold tuning. |
| **Experiment B** | Clinical TB Cough Classification on CODA TB DREAM | **BLOCKED** | Gated dataset requires Synapse credentials and challenge data agreement. Pipeline is configured and ready to ingest once files are in `data/raw/coda/`. |
| **Experiment C** | Official Google HeAR Foundation Model Weights | **PENDING ACCESS** | Model weights require approved Hugging Face token (`google/hear`). Pipeline uses `hear_synthetic_surrogate` for test execution. |

---

## 7. Key Limitations & Future Research
1. **Screening vs Diagnosis**: Cough acoustic frequency is non-specific and occurs across asthma, COPD, pneumonia, and viral infections. Acoustic screening can prioritize patients for microbiological testing (e.g. GeneXpert / culture) but cannot replace it.
2. **Environmental Robustness**: Edge acoustic sensors are vulnerable to ambient reverberation, clinical alarms, and conversation interference. Future work requires testing in high-noise waiting areas.
3. **Multimodal Expansion**: While clinical features (age, symptoms) are strictly excluded from the audio baseline to prevent leakage, future multimodal models should evaluate calibrated joint probability models.

