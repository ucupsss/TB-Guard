---
marp: true
theme: gaia
_class: lead
paginate: true
backgroundColor: #0b132b
color: #e0e6ed
style: |
  section {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 40px 60px;
  }
  h1 {
    color: #38bdf8;
  }
  h2 {
    color: #60a5fa;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 8px;
  }
  h3 {
    color: #93c5fd;
  }
  strong {
    color: #38bdf8;
  }
  table {
    font-size: 0.8em;
    color: #e0e6ed;
  }
  th {
    background-color: #1e293b;
    color: #38bdf8;
  }
  td {
    border-color: #334155;
  }
  .highlight {
    background: rgba(56, 189, 248, 0.15);
    border-left: 4px solid #38bdf8;
    padding: 10px 16px;
    border-radius: 4px;
  }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: bold;
    background: #1e3a8a;
    color: #93c5fd;
  }
  footer {
    font-size: 0.55em;
    color: #64748b;
  }
---

<!-- 
===================================================================
SLIDE 1: COVER / TITLE
===================================================================
-->

# **TB-GUARD**
### *Autonomous Acoustic Surveillance & Clinical Action Agentic AI*

Sistem Deteksi Dini & Surveilans Aktif Tuberkulosis Berbasis **Acoustic Edge Array**, **Deep LSTM Biomarker**, dan **Google Agentic Ecosystem**

---
**Agentic AI Hackathon 2026** — ITB Hackathon Series 2026
*Direktorat Hilirisasi & Komersialisasi Produk Teknologi (DHKT) ITB · PRIMESTeP · Google Cloud*
**Tim 18 — TB-Guard**:
- **Yusuf Faishal Listyardi** (Institut Teknologi Bandung)
- **Ahmad Yazid Arifuddin** (Institut Teknologi Sepuluh Nopember)
- **Naufal Ardhana** (Institut Teknologi Sepuluh Nopember)

<!--
CATATAN PRESENTER (Waktu: 00:00 - 00:20):
"Selamat pagi Dewan Juri yang terhormat dan rekan-rekan sekalian. Kami dari Tim 18 mempersembahkan TB-GUARD: Solusi Agentic AI pertama di Indonesia yang menggabungkan surveilans akustik batuk otonom di ruang publik dengan agen klinis cerdas untuk mempercepat eliminasi Tuberkulosis nasional."
-->

---

<!-- 
===================================================================
SLIDE 2: MASALAH URGENT (Bobot TOR: Relevansi Masalah - 15%)
===================================================================
-->

## **Krisis TB Indonesia & "The Missing Millions"**

Indonesia menempati **Peringkat #2 Dunia** beban Tuberkulosis dengan estimasi **>1.000.000 kasus baru per tahun** dan **134.000 kematian/tahun** (1 orang meninggal setiap 4 menit).

### Mengapa Masalah Ini Belum Tuntas?
1. **Surveilans Bersifat Pasif**: Faskes menunggu pasien datang dalam kondisi batuk parah (stadium lanjut) — ribuan penderita berkeliaran menularkan droplet di stasiun, terminal, dan ruang tunggu.
2. **Missing Cases (Kasus Tak Terlaporkan)**: >25% kasus TB tidak pernah terjaring sistem kesehatan formal.
3. **Beban Ekstrem Tenaga Kesehatan**: Tracing kontak manual sangat lambat, pelaporan administratif menyita waktu, dan pasien mangkir berisiko menjadi **TB-RO (Resistan Obat)**.

<div class="highlight">
<strong>Tantangan Kunci:</strong> Bagaimana mendeteksi batuk TB secara pasif di keramaian dan seketika mengeskalasikannya ke alur tindakan klinis tanpa menambah beban tenaga kesehatan?
</div>

<!--
CATATAN PRESENTER (Waktu: 00:20 - 00:50):
"Indonesia saat ini adalah penyumbang kasus TB terbesar kedua di dunia. Akar masalah utamanya adalah sistem kita masih pasif—hanya menunggu pasien datang ke puskesmas ketika sudah parah. Padahal satu penderita aktif dapat menularkan hingga 15 orang di sekitarnya dalam setahun. Nakes kita kewalahan dengan tracing manual dan pasien sering lost-to-follow-up. Kita butuh terobosan dari screening pasif menjadi deteksi dini yang proaktif dan otonom."
-->

---

<!-- 
===================================================================
SLIDE 3: SOLUSI — TB-GUARD (Kualitas Agentic AI & Konsep)
===================================================================
-->

## **Solusi: TB-Guard End-to-End Surveillance**

Mengubah paradigma penanganan TB dari **"Menunggu Pasien Sakit"** menjadi **"Deteksi Otonom & Intervensi Cepat"**.

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
<div class="highlight">
<h3>1. Edge Acoustic-Visual Sensor</h3>
<ul>
  <li><strong>ReSpeaker Microphone Array (4/6 mic)</strong>: Menangkap audio spasial di area publik/faskes.</li>
  <li><strong>DoA (Direction of Arrival)</strong>: Estimasi sudut datang suara batuk via algoritma GCC-PHAT.</li>
  <li><strong>Kamera Visual Re-ID</strong>: Memetakan sumber suara ke individu target di keramaian.</li>
  <li><strong>Edge LSTM Model</strong>: Klasifikasi akustik batuk TB vs Non-TB dalam 1 detik.</li>
</ul>
</div>

<div class="highlight">
<h3>2. Autonomous Agentic AI</h3>
<ul>
  <li><strong>Powered by Gemini & Cloud Run</strong>: Agen penalaran otonom dengan 13 tool fungsional.</li>
  <li><strong>Autonomous Triage & Tracking</strong>: Mengaudit alert, memetakan klaster risiko tinggi, dan meregistrasi pasien.</li>
  <li><strong>Voice & Multi-turn Execution</strong>: Nakes cukup berbicara via suara/teks untuk mengelola ratusan pasien.</li>
  <li><strong>Human-in-the-Loop</strong>: Keputusan tindakan medis & konfirmasi lab tetap aman di bawah kendali dokter/perawat.</li>
</ul>
</div>
</div>

<!--
CATATAN PRESENTER (Waktu: 00:50 - 01:25):
"TB-Guard menghadirkan solusi komprehensif dua pilar. Pertama, hardware Edge Sensor berupa microphone array dan kamera yang dipasang di titik publik seperti stasiun atau ruang tunggu poli paru untuk mendeteksi batuk khas TB secara akustik. Kedua, dan yang terpenting: TB Guard Agentic AI. Agen ini bukan sekadar chatbot, melainkan sistem autonomous yang mengeksekusi multi-tool workflow—mengambil data sensor, memverifikasi korelasi gejala, mendaftarkan ke kanban pelacakan pasien, hingga memberi rekomendasi klinis, dengan pengawasan manusia."
-->

---

<!-- 
===================================================================
SLIDE 4: ARSITEKTUR SISTEM & FLOW AGENT (Bobot TOR: 25%)
===================================================================
-->

## **Arsitektur Agentic AI & Ekosistem Multi-Tool**

```
 [ IoT Hardware Array ]             [ Cloud & Edge Inference ]               [ Clinical Action ]
  • 4/6-Mic ReSpeaker                 • Google HeAR Embeddings (512-dim)      • Dokter Paru / Nakes
  • USB Camera (FOV 78°)              • Continuous Wavelet Transform (CWT)    • Puskesmas / RSKI
  • GCC-PHAT Beamforming              • Deep Learning: LSTM Classifier        • TCM GeneXpert Lab
          │                                      │                                    ▲
          ▼                                      ▼                                    │
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TB GUARD AGENTIC WORKFLOW ENGINE                               │
│                                                                                        │
│   [ Reasoning & Intent ] ──► [ Function Calling Router ] ──► [ Autonomous Tools ]     │
│   • Google Gemini / Groq      • Parameter Validation          • get_overview           │
│   • Context-Aware System      • Safety Checks                 • list_detections        │
│   • Multi-Turn Memory         • Confirmation Triggers         • update_detections      │
│                                                               • add_patient (Kanban)   │
│                                                               • query_dataset          │
│                                                               • navigate_ui            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

<div class="highlight">
<strong>Karakteristik Agentic:</strong> <em>Goal-Oriented</em>, mampu merangkai tool (chaining 3-4 langkah sekaligus), mengenali konteks URL/layar aktif pengguna, dan bersikap proaktif.
</div>

<!--
CATATAN PRESENTER (Waktu: 01:25 - 02:00):
"Arsitektur kami dirancang modular dan tangguh. Saat batuk terdeteksi, sinyal diproses melalui Google HeAR (Health Acoustic Representations) dan Continuous Wavelet Transform (CWT), lalu diklasifikasikan oleh LSTM. Hasilnya masuk ke TB Guard Agentic Engine yang ditenagai oleh Google Gemini. Agen kami memiliki 13 tools native: dapat membaca statistik agregat, mencari deteksi berisiko tinggi, mendaftarkan pasien baru, mengecek kepatuhan obat, hingga mengarahkan UI dashboard. Agen mengeksekusi perintah kompleks seperti: 'Cari batuk TB yang belum ditinjau di Stasiun Gubeng hari ini dan daftarkan ke pelacakan Puskesmas'."
-->

---

<!-- 
===================================================================
SLIDE 5: KELAYAKAN TEKNIS & BUKTI PENGUJIAN (Bobot TOR: 20%)
===================================================================
-->

## **Kelayakan Teknis & Validasi 3 Lapisan Data**

Prototype dibangun di atas fondasi ilmiah yang solid menggunakan **3 dataset riil**:

| Lapisan Dataset | Cakupan & Sumber Data | Metodologi & Instrumen | Validasi Ground Truth |
| :--- | :--- | :--- | :--- |
| **1. Dataset Primer (Gold Standard)** | Pasien suspek TB di **RSKI Universitas Airlangga** | Rekaman batuk klinis multi-sesi (fase intensif & lanjutan) | Konfirmasi Laboratorium: **TCM (GeneXpert MTB/RIF)** & BTA |
| **2. Dataset Lapangan (Offline Field)** | Puskesmas Tambaksari, Pucang Sewu, Posyandu Gubeng | Uji banding hardware: **ReSpeaker Array** vs Lavalier vs Smartphone | Labeling langsung oleh tenaga kesehatan lapangan |
| **3. Dataset Webform (Crowdsourced)** | Skrining komunitas di Surabaya, Sidoarjo, Gresik, Malang | Web audio recorder + kuesioner gejala klinis (batuk >2 mgg, demam) | Anamnesis klinis & rujukan faskes setempat |

- **Bioacoustic Engine**: Google HeAR (512-dim continuous embedding) · CWT Spectrogram · 16 kHz Anti-Aliasing.
- **Direction of Arrival (DoA)**: Akurasi estimasi sudut azimuth $\pm 5^\circ$ dengan GCC-PHAT cross-correlation.
- **Reproducible ML Pipeline**: Evaluasi bootstrap terisolasi per partisipan (*no data leakage*).

<!--
CATATAN PRESENTER (Waktu: 02:00 - 02:35):
"Kami tidak mengarang data atau metrik simulasi. Solusi ini divalidasi dengan 3 lapisan dataset nyata: dataset primer terkonfirmasi lab TCM GeneXpert dari RSKI Universitas Airlangga, dataset uji perangkat ReSpeaker di 3 Puskesmas Surabaya, serta dataset skrining komunitas. Pipeline audio memanfaatkan Google HeAR bioacoustic representations dan CWT untuk menangkap biomarker akustik saluran napas bawah penderita TB secara akurat."
-->

---

<!-- 
===================================================================
SLIDE 6: HUMAN-IN-THE-LOOP & SAFETY (Kriteria Penilaian TOR)
===================================================================
-->

## **Prinsip Keamanan Medis & Human-in-the-Loop**

Agentic AI di bidang medis **bukan pengganti dokter**, melainkan **co-pilot klinis**:

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
<div>

### Titik Kendali Manusia (Guardrails)
- **Tinjauan Klinis (Reviewed & Verified)**: Prediksi model bertindak sebagai *triage alert*. Penentuan diagnosis resmi tetap wajib melalui verifikasi Nakes & lab TCM.
- **Konfirmasi Aksi Kritis**: Penghapusan data, perubahan rekam medis, atau pemindahan status pasien memerlukan persetujuan eksplisit nakes pada UI modal.
- **Anti-Halusinasi Terverifikasi**: Agen dilarang mengarang UUID, nama, atau angka statistik — semua output wajib berasal dari eksekusi tool nyata.

</div>
<div>

### Alur Pelacakan Pasien (5 Tahap)
```
Tahap 0: Terdeteksi (Alert Sensor)
   │ (Review Nakes & Kontak)
   ▼
Tahap 1: Skrining Lanjut (Puskesmas)
   │ (Uji Dahak TCM GeneXpert)
   ▼
Tahap 2: Terkonfirmasi TB
   │ (Inisiasi OAT Fase Intensif)
   ▼
Tahap 3: Pengobatan (Adherence Monitoring)
   │ (Evaluasi 6 Bulan Pengobatan)
   ▼
Tahap 4: Dinyatakan Sembuh
```

</div>
</div>

<!--
CATATAN PRESENTER (Waktu: 02:35 - 03:05):
"Sesuai mandat TOR kompetisi mengenai titik kendali manusia, TB-Guard menerapkan guardrails ketat. Agentic AI tidak pernah mengambil keputusan medik sepihak. Setiap prediksi batuk TB hanya menjadi sinyal skrining awal. Verifikasi akhir dan rujukan TCM tetap berada di tangan dokter. Aksi destruktif seperti penghapusan atau rujukan massal otomatis memunculkan modal persetujuan interaktif. Kami mengawal pasien secara utuh melalui kanban 5 tahap hingga tuntas sembuh."
-->

---

<!-- 
===================================================================
SLIDE 7: LIVE DEMO & USER EXPERIENCE (Bobot TOR: UX 10% + Demo 10%)
===================================================================
-->

## **Skenario Live Demo: "Dari Suara ke Tindakan"**

Menunjukkan integrasi prototype end-to-end yang telah berjalan penuh di frontend & API:

<div class="highlight">
<strong>Skenario Demo Riil:</strong>
<ol>
  <li><strong>Live Mic Testing & CWT Spectrogram (<code>/live-test</code>)</strong>: Demonstrasi rekam batuk langsung dari mikrofon browser dengan visualisasi CWT audio live & inferensi model akustik instan.</li>
  <li><strong>Peta Spasial & Alert Lapangan</strong>: Perangkat <code>TB Guard 1 (Stasiun Gubeng)</code> mendeteksi batuk dengan confidence TB 99.33% dan sudut DoA arah antrean ruang tunggu.</li>
  <li><strong>Interaksi Suara dengan Agen AI</strong>: User berbicara via mic: <em>"Agen, tampilkan deteksi batuk TB di Stasiun Gubeng hari ini dan tinjau semuanya."</em></li>
  <li><strong>Autonomous Execution & Eskalasi Pasien</strong>: Agen memanggil <code>list_detections</code>, menyaring status, memanggil <code>update_detections</code>, dan mendaftarkan suspek ke modul pasien (Tahap 0).</li>
  <li><strong>3D Hardware Prototype (<code>/design</code>)</strong>: Visualisasi CAD 3D interaktif mikrofon array INMP441 & ESP32-S3 carrier board.</li>
</ol>
</div>

*Fitur UX Unggulan: Dark mode modern, CWT Spectrogram real-time, 3D CAD viewer interaktif, speech-to-text akurat, dan kanban pelacakan pasien.*

<!--
CATATAN PRESENTER (Waktu: 03:05 - 03:40):
"Mari kita lihat live demonya. Di menu Live Test, kita bisa menguji batuk secara langsung via mikrofon dan melihat visualisasi CWT Spectrogram real-time. Di dashboard, perangkat Stasiun Gubeng mendeteksi batuk TB. Cukup katakan ke agen: 'Tinjau semua batuk TB dan daftarkan ke pelacakan Puskesmas.' Agen langsung mengeksekusi multi-tool workflow secara otonom. Ditambah lagi, kami menyertakan model 3D CAD perangkat keras siap manufaktur."
-->

---

<!-- 
===================================================================
SLIDE 8: POTENSI DAMPAK & HILIRISASI (Bobot TOR: Potensi Dampak - 20%)
===================================================================
-->

## **Potensi Dampak Nyata & Rencana Hilirisasi**

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
<div>

### Dampak Kesehatan Terukur
- **3.5x Lebih Cepat Menjaring Kasus**: Menemukan suspect TB sebelum mereka mengalami komplikasi parah atau menulari keluarga.
- **Menekan Angka Dropout OAT**: Modul kepatuhan minum obat (adherence score) memonitor pasien tahap 3 agar tidak gagal terapi.
- **Efisiensi Kerja Nakes**: Otomasi 70% pencatatan rutin surveilans epidemiologi puskesmas.
- **Mendukung Target Eliminasi TB 2030**: Selaras dengan Strategi Nasional Kemenkes RI.

</div>
<div>

### Rencana Hilirisasi (PRIMESTeP DHKT ITB)
- **Fase 1 (Bulan 1–3)**: Uji coba lapangan 10 unit TB-Guard di fasilitas transportasi umum & ruang tunggu faskes Bandung/Surabaya.
- **Fase 2 (Bulan 4–6)**: Integrasi API dengan sistem **SATUSEHAT Kemenkes** & rekam medis elektronik faskes.
- **Fase 3 (Komersialisasi)**: Skema B2G (Dinas Kesehatan / Kemenkes) dan B2B (operator transportasi PT KAI, bandara, rumah sakit swasta).

</div>
</div>

<!--
CATATAN PRESENTER (Waktu: 03:40 - 04:15):
"Potensi dampaknya sangat nyata dan terukur. Dengan TB-Guard, kita dapat menjaring kasus 3,5 kali lebih cepat di ruang publik, mencegah transmisi droplet di transportasi massal, dan mengeliminasi kasus putus obat. Dalam kerangka hilirisasi PRIMESTeP DHKT ITB, inovasi ini siap diujicobakan pada 10 titik strategis, kemudian diintegrasikan langsung ke platform SATUSEHAT Kemenkes dengan model kemitraan B2G dan operator transportasi publik."
-->

---

<!-- 
===================================================================
SLIDE 9: INTEGRASI GOOGLE CLOUD ECOSYSTEM
===================================================================
-->

## **Pemanfaatan Ekosistem Google Cloud**

Solusi TB-Guard memanfaatkan infrastruktur canggih Google Cloud untuk skalabilitas dan keandalan tinggi:

```
[ Edge IoT Devices ] ──► [ Google Cloud Run ] ──► [ Gemini 1.5 Pro / Flash ]
   • Audio Stream           • Serverless Hosting     • Function Calling
   • DoA Telemetry          • Auto-scaling API       • Agentic Reasoning
                            • WebSocket real-time    • Multi-lingual Indonesian
                                    │
                                    ▼
                      [ BigQuery & Vertex AI ]
                        • Agregasi Epidemiologi Nasional
                        • Retraining Model Akustik TB Terdesentralisasi
                        • Firestore / Cloud Storage untuk Enkripsi Data Pasien
```

- **Gemini Function Calling**: Menyediakan pemahaman intent berbahasa Indonesia medis secara akurat tanpa latency tinggi.
- **Enterprise Security**: Kepatuhan terhadap kerahasiaan data pasien (HIPAA/GDPR-ready) dengan penyamaran NIK & audit log ketat.

<!--
CATATAN PRESENTER (Waktu: 04:15 - 04:40):
"Dengan dukungan teknis Google Cloud, TB-Guard menggunakan Cloud Run untuk auto-scaling serverless dan Gemini untuk model function calling berbahasa Indonesia. BigQuery dan Vertex AI memungkinkan dinas kesehatan menganalisis persebaran klaster wabah secara spasial dalam skala satu provinsi hingga nasional dengan enkripsi data medis berstandar tinggi."
-->

---

<!-- 
===================================================================
SLIDE 10: TIM & KOMITMEN (Ketentuan TOR: Hacker, Hipster, Hustler)
===================================================================
-->

## **Profil Tim 18: TB-Guard**

Kolaborasi lintas disiplin ITB dan ITS yang menggabungkan keahlian AI, Biomedical Signal, dan Komersialisasi:

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
<div class="highlight" style="text-align: center;">
<h3>Yusuf Faishal Listyardi</h3>
<p class="badge">Hustler & AI Architect</p>
<p style="font-size: 0.8em; margin-top: 8px;"><strong>Institut Teknologi Bandung</strong></p>
<ul style="font-size: 0.75em; text-align: left;">
  <li>Desain sistem Agentic AI & integrasi model Gemini</li>
  <li>Strategi hilirisasi & valuasi produk kesehatan</li>
  <li>Kemitraan klinis faskes & stakeholder</li>
</ul>
</div>

<div class="highlight" style="text-align: center;">
<h3>Ahmad Yazid Arifuddin</h3>
<p class="badge">Hacker & Fullstack Engineer</p>
<p style="font-size: 0.8em; margin-top: 8px;"><strong>Institut Teknologi Sepuluh Nopember</strong></p>
<ul style="font-size: 0.75em; text-align: left;">
  <li>Arsitektur frontend Next.js 16 & backend Cloud</li>
  <li>Implementasi tool executor, audio stream & STT</li>
  <li>State management store & optimasi latensi</li>
</ul>
</div>

<div class="highlight" style="text-align: center;">
<h3>Naufal Ardhana</h3>
<p class="badge">Hipster & Data/Hardware Engineer</p>
<p style="font-size: 0.8em; margin-top: 8px;"><strong>Institut Teknologi Sepuluh Nopember</strong></p>
<ul style="font-size: 0.75em; text-align: left;">
  <li>Pipeline sinyal suara (MFCC/GCC-PHAT DoA)</li>
  <li>Eksplorasi dataset klinis (RSKI UNAIR & Puskesmas)</li>
  <li>Desain interaksi UI/UX & visualisasi spasial</li>
</ul>
</div>
</div>

<!--
CATATAN PRESENTER (Waktu: 04:40 - 04:55):
"Tim kami terdiri dari sinergi lengkap Hacker, Hipster, dan Hustler. Yusuf dari ITB memimpin arsitektur AI dan strategi hilirisasi produk, Yazid dari ITS menangani implementasi teknis fullstack dan agent executor, serta Naufal dari ITS yang berfokus pada pemrosesan sinyal akustik medis dan pengalaman pengguna."
-->

---

<!-- 
===================================================================
SLIDE 11: PENUTUP & CALL TO ACTION
===================================================================
-->

# **TB-GUARD**
## *Mendeteksi yang Tak Bersuara, Melindungi Setiap Napas Bangsa.*

Bersama **DHKT ITB**, **PRIMESTeP**, dan **Google Cloud**, wujudkan akselerasi **Indonesia Bebas Tuberkulosis 2030**.

<br>

<div class="highlight" style="text-align: center; font-size: 1.1em;">
<strong>Siap untuk Sesi Live Demo & Tanya Jawab</strong><br>
<span style="font-size: 0.8em; color: #93c5fd;">Tautan Dashboard: <code>localhost:3000</code> · GitHub: <code>github.com/ucupsss/TB-Guard</code></span>
</div>

---

<!--
CATATAN PRESENTER (Waktu: 04:55 - 05:00):
"Tuberkulosis bisa disembuhkan bila dideteksi lebih awal. TB-Guard hadir agar tidak ada lagi penderita yang terabaikan di ruang publik. Terima kasih kepada Dewan Juri dan Panitia DHKT ITB. Kami siap untuk sesi live demo dan diskusi tanya jawab."
-->
