# Backend AI Company Assistant

Backend AI Company Assistant adalah sistem asisten pintar berbasis kecerdasan buatan (AI) yang dibangun menggunakan framework **NestJS**. Sistem ini mengintegrasikan **RAG (Retrieval-Augmented Generation)** dengan penyimpanan vektor lokal menggunakan **PostgreSQL (pgvector)** dan memanfaatkan AI provider **Sumopod** untuk pemrosesan teks tingkat lanjut (seperti DeepSeek-R1).

Sistem ini menyediakan 5 fungsi bisnis otomatis (function calling):
1. **Meeting Summarizer**: Menganalisis transkrip rapat, mengekstrak Action Items, melakukan Task Assignment otomatis ke karyawan di database, serta menjadwalkan pengingat (H-1 Hari & H-12 Jam).
2. **Quotation Generator**: Membuat penawaran harga formal berdasarkan profil klien dan rate card layanan.
3. **Proposal Generator**: Membuat proposal bisnis terstruktur menggunakan kebijakan SOP perusahaan.
4. **Follow Up Generator**: Menyusun email follow-up personal berdasarkan log riwayat interaksi sales lead.
5. **Business Insight**: Menganalisis log pergerakan barang, kinerja sales, dan rapor vendor untuk menghasilkan laporan strategis dan evaluasi vendor.

---

## 🛠️ Tech Stack
- **Framework**: NestJS (TypeScript)
- **Database Utama & Vektor**: PostgreSQL dengan ekstensi `pgvector`
- **ORM**: Prisma
- **AI Provider**: Sumopod (OpenAI compatible endpoint)
- **Queue/Background Worker**: BullMQ & Redis

---

## 🚀 Setup & Prerequisites

### 1. Kebutuhan Sistem
Pastikan perangkat Anda telah terinstal:
- Node.js (v18+)
- Docker & Docker Compose
- Redis (berjalan di port `6379`)

### 2. Jalankan Database PostgreSQL dengan pgvector
Jalankan container PostgreSQL yang sudah terintegrasi dengan ekstensi `pgvector` pada port `5434`:
```bash
docker run --name prototipe_postgres_vector -e POSTGRES_PASSWORD=postgres -p 5434:5432 -d pgvector/pgvector:pg17
```

Setelah container berjalan, buat database baru bernama `prototipe_sore` dan aktifkan ekstensinya:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -c "CREATE DATABASE prototipe_sore;"
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d prototipe_sore -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## ⚙️ Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env` dan sesuaikan nilainya:
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/prototipe_sore?schema=public"

# AI Provider Configurations (Sumopod)
SUMOPOD_API_KEY="your-sumopod-api-key-here"
SUMOPOD_BASE_URL="https://api.sumopod.com/v1"
SUMOPOD_MODEL="deepseek-r1"

# Vector Store Configurations
VECTOR_DB_PROVIDER="postgresql"

# Redis Configurations
REDIS_HOST="localhost"
REDIS_PORT=6379
```

---

## 📥 Inisialisasi Database (Seeding)

### 1. Sinkronisasi Skema Database
Generate Prisma Client dan sinkronkan skema ke database PostgreSQL:
```bash
npx prisma db push
```

### 2. Seed Direktori Karyawan
Impor data mock direktori karyawan ke database:
```bash
npx ts-node prisma/seed.ts
```

### 3. Upload & Embed Dokumen Mock (RAG Knowledge)
Unggah dan lakukan embedding untuk seluruh data dokumen mock (SOP, Katalog Produk, Rapor Vendor, dll.) ke pgvector:
```bash
npx ts-node prisma/uploadMockDocs.ts
```

---

## 🔌 API Endpoints untuk Frontend

### 1. AI Agent Assistant (`/api/agent`)
- **POST `/api/agent/run`**: Mengeksekusi asisten AI secara sinkronus. Menerima multipart/form-data jika melampirkan file.
- **GET `/api/agent/run/stream`**: Menjalankan asisten secara real-time streaming (SSE) via query string.
- **POST `/api/agent/run/stream`**: Menjalankan asisten secara real-time streaming (SSE) mendukung upload lampiran file (`multipart/form-data`).
- **GET `/api/agent/tasks`**: Mengambil daftar seluruh tugas (*Task Assignment*).
- **GET `/api/agent/reminders`**: Mengambil daftar seluruh pengingat (*Reminders*).
- **GET `/api/agent/employees`**: Mengambil data direktori karyawan.

### 2. Sesi Chat Obrolan (`/api/chats`)
- **POST `/api/chats`**: Membuat sesi percakapan baru.
- **GET `/api/chats`**: Mengambil daftar sesi percakapan.
- **GET `/api/chats/:id`**: Mengambil riwayat pesan dalam satu sesi.
- **POST `/api/chats/:id/messages`**: Mengirim pesan baru ke sesi (Respon AI secara penuh).
- **GET `/api/chats/:id/messages/stream`**: Mengirim pesan baru secara streaming (SSE). *Tanpa duplikasi event result.*
- **DELETE `/api/chats/:id`**: Menghapus sesi obrolan.

### 3. Modul RAG & Dokumen (`/api/rag`)
- **POST `/api/rag/upload`**: Mengunggah dokumen baru untuk bahan baku RAG.
- **GET `/api/rag/documents`**: Melihat status pemrosesan dokumen yang diunggah.
- **POST `/api/rag/query`**: Melakukan pencarian semantic search langsung ke database vektor.

---

## 💻 Menjalankan Aplikasi

Jalankan server dalam mode development:
```bash
npm run start:dev
```

Aplikasi akan berjalan dan mendengarkan di: `http://localhost:3000/api`
