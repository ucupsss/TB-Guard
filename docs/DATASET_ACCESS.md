# TB-Guard Dataset Access & Provenance Guide

This guide details how to obtain, configure, and maintain data provenance for datasets used in TB-Guard public health acoustic screening research.

---

## 1. Primary Research Dataset: CODA TB DREAM Challenge

- **Synapse ID:** [syn31472953](https://www.synapse.org/Synapse:syn31472953)
- **Host Institution:** DREAM Challenges / Sage Bionetworks
- **Intended Use:** Research evaluation of acoustic algorithms for tuberculosis screening.
- **License / Terms:** Requires Synapse registration and challenge data use agreement.

### Access Instructions:
1. Register an account at [Synapse.org](https://www.synapse.org/).
2. Navigate to [Synapse syn31472953](https://www.synapse.org/Synapse:syn31472953) and accept the Terms of Data Access.
3. Generate a Personal Access Token in your Synapse user account settings.
4. Set the environment variable in `.env`:
   ```bash
   SYNAPSE_AUTH_TOKEN="your_personal_access_token"
   ```
5. Download raw audio files and clinical reference metadata into:
   ```
   data/raw/coda/
   ```
6. The canonical manifest generator will automatically discover:
   - Microbiological reference standard labels (`culture_result`, `genexpert_result`).
   - Participant IDs for participant-level splitting.

---

## 2. Pretrained Audio Encoder: Google HeAR

- **Hugging Face Model:** [google/hear](https://huggingface.co/google/hear)
- **PyTorch Hub / Weights:** [google/hear-pytorch](https://huggingface.co/google/hear-pytorch)
- **Input Contract:** 2.0-second, 16 kHz single-channel mono audio (32,000 samples).
- **Output:** 512-dimensional continuous latent embedding.

### Access Instructions:
1. HeAR is a gated model on Hugging Face.
2. Sign in at [https://huggingface.co/google/hear](https://huggingface.co/google/hear) and submit the access request form.
3. Once approved, generate a Hugging Face Read Token at [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
4. Configure your token in `.env`:
   ```bash
   HF_TOKEN="hf_your_access_token"
   ```
5. If running in a smoke-test environment without Hugging Face access, TB-Guard automatically provides `hear_synthetic_surrogate` to verify the pipeline end-to-end without failing.

---

## 3. Supplementary Respiratory Sound Data

- **Kaggle Challenge:** [Artificial Intelligence in Respiratory Sounds](https://www.kaggle.com/competitions/artificial-intelligence-in-respiratory-sounds/data)
- **Terms:** Check competition terms and limitations.
- **Placement:** Store in `data/raw/respiratory_sounds/`.

---

## Scientific Safeguard & Legal Notice
- TB-Guard enforces that raw participant audio and sensitive demographic attributes are kept immutable and never committed to version control (`.gitignore` protects all audio and participant identifiers).
- Synthetic smoke test data (`source_dataset="SYNTHETIC_SMOKE_TEST"`) is strictly separated from clinical datasets.
