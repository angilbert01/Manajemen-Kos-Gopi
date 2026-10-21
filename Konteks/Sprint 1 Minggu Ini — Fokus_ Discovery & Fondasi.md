### Sprint 1 Minggu Ini — Fokus: Discovery & Fondasi

Karena kalian baru saja terbentuk dan MVP baru dikunci di Pertemuan 7, Sprint 1 minggu ini **bukan sprint coding penuh** — ini sprint menggali kebutuhan dan menyiapkan fondasi dokumen. Coding ringan (setup project) boleh mulai jalan paralel, tapi jangan build fitur final dulu karena scope masih bisa berubah.

**Hasan (PM/Scrum Master)**

* Buat & finalisasi struktur workspace ClickUp di atas  
* Jadwalkan sesi wawancara resmi pertama dengan pemilik kos (gali: berapa kamar, cara pencatatan saat ini, siapa yang pegang tagihan, pain point terbesar)  
* Susun draft awal **Stakeholder Mapping** (siapa: pemilik kos, penghuni kos, tim kalian)  
* Mulai draft kerangka **Project Charter** (tujuan, ruang lingkup awal, deliverable, syarat: klien bersedia ditemui 3x)  
* Pastikan komitmen klien tertulis: nama, jabatan, nomor telepon (syarat wajib biar dianggap "punya klien")

**Firdaus (BA & QA)**

* Ikut wawancara klien, fokus menerjemahkan keluhan jadi kebutuhan fungsional  
* Mulai susun **Product Backlog** awal di ClickUp berdasarkan 4 MVP dari brief: Data kamar & penghuni, Tagihan bulanan \+ status bayar, Pengingat jatuh tempo, Form keluhan \+ status penanganan  
* Tulis user story sederhana per fitur (format: "Sebagai \[peran\], saya ingin \[aksi\], supaya \[manfaat\]")  
* Siapkan draft kriteria penerimaan (acceptance criteria) tiap story — ini nanti jadi checklist QA  
* Catat konflik kepentingan yang sudah diketahui: pemilik ingin tagihan tegas vs penghuni minta toleransi telat — ini penting masuk risk register

**Akhmad (FE Dev)**

* Riset & tentukan stack: Figma untuk Hi-Fi prototype, atau langsung ke framework kalau pilih opsi aplikasi ter-deploy  
* Buat skeleton/wireframe kasar dulu (low-fi) berdasarkan 4 fitur MVP — jangan hi-fi dulu sebelum requirement fix  
* Ingat catatan risiko dari brief: pemilik kos jarang akrab dengan aplikasi → UI harus bisa dipakai tanpa pelatihan, prioritaskan kesederhanaan  
* Setup repo/project frontend kosong \+ struktur folder dasar

**Angilbert (BE Dev)**

* Rancang draft skema data awal: entitas Kamar, Penghuni, Tagihan, Keluhan (masih boleh berubah setelah requirement final)  
* Setup project backend kosong \+ pilih stack (database, framework)  
* Diskusi dengan Firdaus soal field data apa saja yang perlu ditangkap dari form keluhan dan tagihan  
* Riset opsi teknis untuk fitur "pengingat jatuh tempo" (cron job/scheduler sederhana)

**Semua anggota** — di akhir minggu, lakukan sprint review singkat internal: cek apakah hasil wawancara klien sudah cukup untuk mulai menulis Project Charter, dan update task di ClickUp dari Backlog → Done sesuai progres.

Kalau mau, aku bisa bantu buatkan template Project Charter atau draft user story list yang siap kalian tempel ke ClickUp — tinggal bilang.

**Product Backlog \- MVP Kos** 

4 Kategori Epic List:

1. Manajemen Kamar & Penghuni  
   **Task 1.1 (FE\&BE**): Draf skema/database data kamar & penghuni  
   User Story: Sebagai Pemilik Kos, saya ingin mencatat nomor kamar, harga sewa, dan data penghuni (nama, no HP, tanggal masuk), supaya data terorganisir di satu tempat.   
   **Task 1.2 (FE**): Tampilan draf Kamar (tampilan Status Kamar)  
   USer Story: Sebagai Pemilik Kos, saya ingin melihat indikator kamar mana yang Terisi vs Kosong, supaya bisa mengelola ketersediaan kamar.   
   **Task 1.3 (FE\&BE)**: Form input data untuk penghuni baru   
   User Story: Sebagai pemilik kos, saya ingin mendaftarkan penghuni baru ke kamar tertentu yang kosong, supayamasa sewa dapat mulai dicatat.  
2. Tagihan Bulanan & Status Pembayaran  
   **Task 2.1 (BE):** Logika Generate Tagihhan bulanan Automatis/manual  
   User Story: Sebagai pemilik kos, saya ingin sistem membuatkan tagihan untuk setiap kamar yang terisi agar saya tidak perlu rekap manual setiap bulannya.  
   **Task 2.2 (FE):** Halaman Ringkasan Tagihan (Lunas / Belum Lunas)  
   User Story: Sebagai pemilik kos, saya ingin melihat daftar penghuni yang sudah bayar kos atau belum bayar kos tiap bulannya untuk mempermudah pembacaan keuangan.  
   **Task 2.3 (FE\&BE):** Fitur update status pembayaran (konfirmasi pembayaran)  
   User Story: Sebagai pemilik kos, saya ingin mengubah status tagihan menjadi “lunas” setelah menerima bukti pembayaran  
3. Pengingat Jatuh Tempo  
   **Task 3.1 (BE):**   
4. Form Keluhan & Status penanganan

 Backend Development Draft – Kost Management Information System

  Date: 2026‑08‑31  
  Role: Backend Developer (Angilbert)

  \---

  1\. Chosen Technology Stack

  ┌──────────────────┬────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐  
  │      Layer       │             Recommendation             │                          Reasoning (student‑project friendly)                          │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Language /       │ Node.js with Express.js (or NestJS if  │ \- Easy to set up, huge ecosystem, good for REST APIs.\<br\>- Works well with relational  │  
  │ Framework        │ you prefer a more opinionated          │ & NoSQL DBs.\<br\>- Plenty of tutorials for cron‑like jobs (node‑cron, agenda, bull).    │  
  │                  │ structure)                             │                                                                                        │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │                  │                                        │ \- ACID compliance, solid for relational data (Kamar, Penghuni, Tagihan, Keluhan).\<br\>- │  
  │ Database         │ PostgreSQL (via Docker)                │  Free tier on most cloud providers; Docker image makes local dev painless.\<br\>-        │  
  │                  │                                        │ Supports JSONB if you ever need flexible fields.                                       │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ ORM / Query      │ Prisma (TypeScript) or Sequelize (JS)  │ \- Generates type‑safe client, migrations, and helps keep ERD in sync.\<br\>- Prisma      │  
  │ Builder          │                                        │ Studio gives a quick GUI for data inspection.                                          │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Authentication   │ JWT (access token) \+ bcrypt for        │ \- Stateless, simple to implement for a small app.\<br\>- Can be swapped later for OAuth  │  
  │                  │ password hashing                       │ if needed.                                                                             │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ API Style        │ RESTful JSON (versioned /api/v1/...)   │ \- Straightforward to test with Postman/Insomnia.\<br\>- Easy to document with            │  
  │                  │                                        │ Swagger/OpenAPI.                                                                       │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Scheduler /      │ node‑cron (lightweight) or Agenda      │ \- node‑cron: pure JavaScript, zero external deps.\<br\>- Agenda: persistent jobs, retry, │  
  │ Reminder         │ (Mongo‑agnostic, works with            │  and UI if you need more sophistication later.                                         │  
  │                  │ PostgreSQL)                            │                                                                                        │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ DevOps / CI      │ GitHub Actions (lint, test, build      │ \- Gives you a pipeline for free; can auto‑deploy to Render, Railway, or a cheap VPS.   │  
  │                  │ Docker image)                          │                                                                                        │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Testing          │ Jest (unit) \+ SuperTest (API)          │ \- Widely used, good reporting.                                                         │  
  ├──────────────────┼────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Documentation    │ Swagger UI (via swagger-ui-express)    │ \- Auto‑generated from JSDoc or YAML; helpful for frontend team.                        │  
  └──────────────────┴────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘

  ▎ \*\*If you already have experience with another stack (e.g., Laravel, Django, Spring Boot) feel free to swap, but the above keeps the setup quick and the  
  ▎ learning curve low for a semester project.

  \---

  2\. Initial Data Schema (ERD)

  Below is a draft ERD that captures the four core entities you mentioned. Fields are grouped as candidate – you can add/remove after the requirement  
  discussion with Firdaus.

  2.1 Entity: Kamar (Room)

  ┌─────────────────┬───────────────────────────────────────┬──────────────────────────────────────┐  
  │      Field      │                 Type                  │         Constraints / Notes          │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ id              │ UUID (PK)                             │ Generated by DB (uuid\_generate\_v4()) │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ nomor\_kamar     │ VARCHAR(10)                           │ Unique, not null                     │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ tipe            │ ENUM('single','double','triple')      │ Optional, for pricing                │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ lantai          │ SMALLINT                              │ Not null                             │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ status          │ ENUM('tersedia','terisi','perbaikan') │ Default 'tersedia'                   │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ harga\_per\_bulan │ DECIMAL(10,2)                         │ Not null                             │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ deskripsi       │ TEXT                                  │ Optional                             │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ created\_at      │ TIMESTAMP                             │ Default now()                        │  
  ├─────────────────┼───────────────────────────────────────┼──────────────────────────────────────┤  
  │ updated\_at      │ TIMESTAMP                             │ Default now()                        │  
  └─────────────────┴───────────────────────────────────────┴──────────────────────────────────────┘

  2.2 Entity: Penghuni (Tenant / Occupant)

  ┌───────────────┬──────────────────────────┬───────────────────────────────────────────┐  
  │     Field     │           Type           │            Constraints / Notes            │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ id            │ UUID (PK)                │                                           │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ nama\_lengkap  │ VARCHAR(100)             │ Not null                                  │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ email         │ VARCHAR(150)             │ Unique, not null                          │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ no\_telepon    │ VARCHAR(20)              │ Optional                                  │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ nik           │ VARCHAR(30)              │ Unique, optional (for admin verification) │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ password\_hash │ VARCHAR(255)             │ Not null (bcrypt)                         │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ role          │ ENUM('penghuni','admin') │ Default 'penghuni'                        │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ status\_aktif  │ BOOLEAN                  │ Default true                              │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ foto\_profil   │ VARCHAR(255)             │ URL to stored image (optional)            │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ created\_at    │ TIMESTAMP                │                                           │  
  ├───────────────┼──────────────────────────┼───────────────────────────────────────────┤  
  │ updated\_at    │ TIMESTAMP                │                                           │  
  └───────────────┴──────────────────────────┴───────────────────────────────────────────┘

  2.3 Entity: Tagihan (Invoice / Bill)

  ┌─────────────────────┬────────────────────────────────────────┬───────────────────────────────────────────────────┐  
  │        Field        │                  Type                  │                Constraints / Notes                │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ id                  │ UUID (PK)                              │                                                   │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ penghuni\_id         │ UUID (FK → Penghuni.id)                │ Not null, ON DELETE CASCADE                       │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ kamar\_id            │ UUID (FK → Kamar.id)                   │ Not null                                          │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ periode             │ DATE                                   │ First day of the billing month (e.g., 2026‑09‑01) │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ jumlah              │ DECIMAL(10,2)                          │ Not null                                          │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ status              │ ENUM('belum\_bayar','lunas','tertunda') │ Default 'belum\_bayar'                             │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ tanggal\_jatuh\_tempo │ DATE                                   │ Not null (usually \+7 hari dari tanggal pembuatan) │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ tanggal\_pembayaran  │ DATE                                   │ Nullable                                          │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ metode\_pembayaran   │ ENUM('transfer','e-wallet','cash')     │ Optional                                          │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ catatan             │ TEXT                                   │ Optional                                          │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ created\_at          │ TIMESTAMP                              │                                                   │  
  ├─────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────────────┤  
  │ updated\_at          │ TIMESTAMP                              │                                                   │  
  └─────────────────────┴────────────────────────────────────────┴───────────────────────────────────────────────────┘

  2.4 Entity: Keluhan (Complaint / Maintenance Request)

  ┌───────────────────┬─────────────────────────────────────────────────────────┬────────────────────────┐  
  │       Field       │                          Type                           │  Constraints / Notes   │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ id                │ UUID (PK)                                               │                        │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ penghuni\_id       │ UUID (FK → Penghuni.id)                                 │ Not null               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ kamar\_id          │ UUID (FK → Kamar.id)                                    │ Not null               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ judul             │ VARCHAR(200)                                            │ Not null               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ deskripsi         │ TEXT                                                    │ Not null               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ kategori          │ ENUM('listrik','air','sanitasi','keamanan','lain-lain') │ Not null               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ prioritas         │ ENUM('rendah','sedang','tinggi')                        │ Default 'sedang'       │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ status            │ ENUM('baru','diproses','selesai','ditolak')             │ Default 'baru'         │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ tanggal\_pengaduan │ TIMESTAMP                                               │ Default now()          │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ tanggal\_selesai   │ TIMESTAMP                                               │ Nullable               │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ balasan\_admin     │ TEXT                                                    │ Optional (admin reply) │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ created\_at        │ TIMESTAMP                                               │                        │  
  ├───────────────────┼─────────────────────────────────────────────────────────┼────────────────────────┤  
  │ updated\_at        │ TIMESTAMP                                               │                        │  
  └───────────────────┴─────────────────────────────────────────────────────────┴────────────────────────┘

  ▎ Relationships  
  ▎ \- One Penghuni can have many Tagihan and many Keluhan.  
  ▎ \- One Kamar can be assigned to many Tagihan (over time) and many Keluhan (different tenants over time).  
  ▎ \- A Tagihan belongs to exactly one Penghuni and one Kamar.  
  ▎ \- A Keluhan belongs to exactly one Penghuni and one Kamar.

  You can visualize this quickly with any ERD tool (draw.io, dbdiagram.io) – just copy the table definitions above.

  \---

  3\. Backend Project Setup – Step‑by‑Step

  1\. Initialize Repo  
  mkdir kost-management-api && cd kost-management-api  
  git init  
  npm init \-y  
  2\. Add Core Dependencies  
  npm i express prisma @prisma/client  
  npm i \-D nodemon typescript ts-node @types/node @types/express  
  3\. Configure TypeScript (tsconfig.json) – use the default es2022 target, enable strict.  
  4\. Initialize Prisma  
  npx prisma init \--datasource-provider postgres  
     \- Edit .env with your local Docker PostgreSQL URL:  
       DATABASE\_URL="postgresql://postgres:postgres@localhost:5432/kost?schema=public"  
     \- Run npx prisma migrate dev \--name init after you paste the schema (see below) into prisma/schema.sql or Prisma models.  
  5\. Define Prisma Models (in prisma/schema.prisma) – copy the fields from the ERD, using appropriate types (String, Int, DateTime, Enum, @relation).  
  6\. Generate Client & Run Migrations  
  npx prisma generate  
  npx prisma migrate dev  
  7\. Create Express Server (src/index.ts) – basic setup:  
  import express from 'express';  
  import { PrismaClient } from '@prisma/client';  
  const app \= express();  
  const prisma \= new PrismaClient();  
  app.use(express.json());

  // Example route  
  app.get('/api/v1/health', (\_req, res) \=\> res.json({ status: 'OK' }));

  const PORT \= process.env.PORT ?? 3000;  
  app.listen(PORT, () \=\> console.log(\`🚀 API listening on \${PORT}\`));  
  8\. Add Authentication Middleware  
     \- bcryptjs for hashing passwords.  
     \- jsonwebtoken for signing/verifying JWTs.  
     \- Middleware that reads Authorization: Bearer \<token\> and attaches req.user.  
  9\. Implement Core Routes (CRUD for each entity) – keep them simple for now:  
     \- POST /penghuni/register  
     \- POST /penghuni/login → returns JWT  
     \- GET /kamar, POST /kamar (admin only)  
     \- GET /tagihan/:penghuniId (list bills)  
     \- POST /keluhan (create complaint)

  10\. Add Validation – use joi or express-validator to sanitize input.  
  11\. Write Unit Tests (\_\_tests\_\_/) with Jest \+ SuperTest. Aim for at least 80% coverage on route handlers.  
  12\. Add Swagger UI (swagger-jsdoc \+ swagger-ui-express) – annotate routes with JSDoc for auto‑generated docs.  
  13\. Dockerize (optional but handy)  
      \- Create Dockerfile (node:20-alpine).  
      \- docker-compose.yml with two services: app and db.  
      \- Enables one‑click docker compose up.  
  14\. CI/CD (GitHub Actions) – basic workflow:  
  name: CI  
  on: \[push, pull\_request\]  
  jobs:  
    test:  
      runs-on: ubuntu-latest  
      steps:  
        \- uses: actions/checkout@v4  
        \- uses: actions/setup-node@v4  
          with: { node-version: '20' }  
        \- run: npm ci  
        \- run: npm run test

  \---

  4\. Reminder / “Jatuh Tempo” Feature

  Goal: Automatically notify tenants (via email or in‑app) when a bill’s due date is approaching (e.g., 1 day before) or when it becomes overdue.

  4.1 Options

  ┌──────────────────────────┬───────────────────────────────────────────────────┬──────────────────────────────────┬─────────────────────────────────┐  
  │          Option          │                   How it Works                    │               Pros               │              Cons               │  
  ├──────────────────────────┼───────────────────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤  
  │                          │ A simple cron.schedule('0 9 \* \* \*', async () \=\> { │ \- Zero extra dependencies.\<br\>-  │ \- If you scale to multiple      │  
  │ node‑cron (lightweight)  │  … }) that runs every day at 09:00, queries       │ Easy to understand & debug.\<br\>- │ instances, you may get          │  
  │                          │ Tagihan where tanggal\_jatuh\_tempo \= today \+ 1 and │  Works well in a single‑instance │ duplicate reminders (need a     │  
  │                          │  sends reminders.                                 │  Node process.                   │ lock or central scheduler).     │  
  ├──────────────────────────┼───────────────────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤  
  │                          │ Jobs are stored in the DB (PostgreSQL via agenda  │ \- Persistent, survives process   │ \- Slightly heavier; requires    │  
  │ Agenda (Mongo‑agnostic   │ adapter). You can create a recurring job every('1 │ restarts.\<br\>- Supports          │ extra collection/table for      │  
  │ job queue)               │  day') that runs the same logic, with built‑in    │ concurrency limits, retries, and │ jobs.\<br\>- Slight learning      │  
  │                          │ concurrency control and retry.                    │  a dashboard (Agenda UI).        │ curve.                          │  
  ├──────────────────────────┼───────────────────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤  
  │ External Scheduler       │ Offload the timing to the hosting platform; your  │ \- No in‑process scheduler;       │ \- Requires exposing an HTTP     │  
  │ (e.g., Render Cron, AWS  │ endpoint /api/v1/reminders/due-today gets called  │ scales naturally with multiple   │ endpoint (secure it\!).\<br\>-     │  
  │ EventBridge, GitHub      │ via HTTP at a set time.                           │ replicas.\<br\>- Easy to monitor   │ Slight latency due to network   │  
  │ Actions Schedule)        │                                                   │ via platform logs.               │ call.                           │  
  ├──────────────────────────┼───────────────────────────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤  
  │ Database‑level           │ Schedule a stored procedure directly inside       │ \- Guarantees exactly‑once        │ \- Requires superuser privileges │  
  │ (PostgreSQL pg\_cron      │ PostgreSQL that sends emails via pg\_notify or     │ execution (if configured).\<br\>-  │  to install extension.\<br\>-     │  
  │ extension)               │ calls an external webhook.                        │ Keeps logic close to data.       │ More complex to debug; email    │  
  │                          │                                                   │                                  │ sending from DB is less common. │  
  └──────────────────────────┴───────────────────────────────────────────────────┴──────────────────────────────────┴─────────────────────────────────┘

  Recommendation for a student project: Start with node‑cron because it’s quick to implement, requires no extra services, and is sufficient for a  
  single‑instance deployment (e.g., on Render’s free tier or a local Docker compose). If you later need to run multiple replicas or want persistence,  
  migrate to Agenda.

  4.2 Sample node‑cron Implementation

  // src/reminders/cron.ts  
  import cron from 'node-cron';  
  import { PrismaClient } from '@prisma/client';  
  import { sendEmail } from '../utils/email'; // you can implement with nodemailer or a mock

  const prisma \= new PrismaClient();

  /\*\*  
   \* Runs every day at 09:00 AM server time.  
   \* Sends reminder for bills whose due date is tomorrow.  
   \*/  
  cron.schedule('0 9 \* \* \*', async () \=\> {  
    try {  
      const tomorrow \= new Date();  
      tomorrow.setDate(tomorrow.getDate() \+ 1);  
      // strip time part  
      const dueDate \= new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

      const dueBills \= await prisma.tagihan.findMany({  
        where: {  
          tanggal\_jatuh\_tempo: dueDate,  
          status: 'belum\_bayar',  
        },  
        include: { penghuni: true, kamar: true },  
      });

      for (const bill of dueBills) {  
        const { penghuni, kamar, jumlah, tanggal\_jatuh\_tempo } \= bill;  
        await sendEmail({  
          to: penghuni.email,  
          subject: \`Pengingat Tagihan Kost \- Kamar \${kamar.nomor\_kamar}\`,  
          html: \`  
            \<p\>Halo \${penghuni.nama\_lengkap},\</p\>  
            \<p\>Tagihan untuk kamar \${kamar.nomor\_kamar} sebesar \<strong\>\${jumlah.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}\</strong\>  
  akan jatuh tempo pada \${tanggal\_jatuh\_tempo.toLocaleDateString('id-ID')}.\</p\>  
            \<p\>Silakan lakukan pembayaran sebelum tanggal tersebut untuk menghindari denda.\</p\>  
            \<p\>Terima kasih,\<br/\>Manajemen Kost\</p\>  
          \`,  
        });  
      }  
    } catch (err) {  
      console.error('⚠️ Reminder cron error:', err);  
    }  
  });

  \- Register the cron job in your server startup (src/index.ts) after DB connection is ready.  
  \- For overdue notices, you can run a second cron (e.g., every hour) that checks tanggal\_jatuh\_tempo \< now() && status='belum\_bayar' and maybe escalates  
    (send a different template or add a late fee).

  \---

  5\. Discussion Points with Firdaus (Frontend/Requirements)

  ┌───────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
  │       Topic       │                                                  Questions / Items to Clarify                                                   │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │                   │ \- Which fields are mandatory? (e.g., judul, deskripsi, kategori, prioritas) \<br\> \- Should users be able to attach photos or     │  
  │ Form Keluhan      │ files? (If yes, we need a storage plan – maybe Cloudinary or local uploads/ folder). \<br\> \- Do we need a “category” dropdown    │  
  │                   │ that can be extended by admins later?                                                                                           │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │                   │ \- Besides the auto‑generated amount (based on room rate), do we allow manual adjustments (e.g., extra service charges)? \<br\> \-  │  
  │ Form Tagihan      │ What payment methods should we list in the dropdown? \<br\> \- Should the system generate a PDF invoice? If yes, we’ll need a      │  
  │                   │ library like pdfkit or handlebars \+ puppeteer.                                                                                  │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Notification      │ \- Email only, or also in‑app notifications / WhatsApp gateway? \<br\> \- If email, do we have a SMTP server (e.g., Gmail,          │  
  │ Channel           │ SendGrid) or should we use a mock for dev?                                                                                      │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Access Levels     │ \- Define clearly which endpoints are accessible by penghuni vs admin. \<br\> \- For admin: ability to override status, add manual  │  
  │                   │ fees, view all complaints, etc.                                                                                                 │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Data Retention /  │ \- How long should we keep paid bills? (e.g., 2 years) – might affect indexing strategy.                                         │  
  │ Archiving         │                                                                                                                                 │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Performance       │ \- Expected concurrent users (maybe \< 50 for a student project). \<br\> \- This informs whether we need caching (Redis) later.      │  
  │ Expectations      │                                                                                                                                 │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Third‑Party       │ \- Any desire to integrate with a payment gateway (Midtrans, Xendit) for real‑time payment confirmation? If yes, we need webhook │  
  │ Integrations      │  endpoints.                                                                                                                     │  
  ├───────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ Future Features   │ \- “Pengingat jatuh tempo” via SMS? \<br\> \- Monthly report export (CSV/Excel) for admins. \<br\> \- Rating/review system for rooms.  │  
  └───────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  You can capture the answers in a short Requirements Clarification Doc (one‑page) and then update the ERD accordingly (e.g., add file\_url to Keluhan,  
  biaya\_tambahan to Tagihan, etc.).

  \---

  6\. Suggested Immediate Next Steps (Backend)

  1\. Set up repo & Docker Compose (Postgres \+ Adminer for DB inspection).  
  2\. Initialize Prisma schema with the draft entities above. Run migration, verify tables with Adminer.  
  3\. Create auth middleware (register, login, JWT). Test with Postman.  
  4\. Implement basic CRUD routes for Kamar and Penghuni (admin‑only for now).  
  5\. Add the reminder cron (node‑cron) and a mock email function that logs to console.  
  6\. Invite Firdaus to review the API contract (OpenAPI spec generated from JSDoc). Collect feedback on the complaint & billing forms.  
  7\. Iterate: add missing fields, validation, and maybe file‑upload handling (using multer \+ local storage or Cloudinary).  
  8\. Write unit tests for auth and reminder logic.  
  9\. Prepare a short demo (Postman collection \+ README) for the mid‑semester presentation.

  \---

  TL;DR Checklist

  \- \[ \] Repo init \+ Docker‑Compose (Postgres)  
  \- \[ \] Prisma schema → migrate → studio check  
  \- \[ \] Auth (register/login/JWT)  
  \- \[ \] CRUD for Kamar, Penghuni  
  \- \[ \] Tagihan & Keluhan models & routes  
  \- \[ \] Reminder cron (node‑cron) \+ mock email  
  \- \[ \] Swagger/OpenAPI docs  
  \- \[ \] Review with Firdaus (form fields, notifications)  
  \- \[ \] Unit tests \+ CI (GitHub Actions)  
  \- \[ \] Demo / presentation prep

  Feel free to ask for any specific code snippets (e.g., Prisma model, cron job, auth middleware) or for a diagram in SVG/Markdown if you’d like to  
  visualize the ERD. Good luck, and let me know what Firdaus says so we can refine the schema together\! 🚀

✻ Crunched for 43s · done 4:33 AM

