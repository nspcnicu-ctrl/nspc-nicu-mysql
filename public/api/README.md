# 📘 Panduan Lengkap Backend REST API (PHP PDO MySQL)
## Aplikasi NSPC NICU RSUD Undata (Hosting cPanel Niagahoster)

Dokumen ini berisi panduan instalasi dan deployment file backend REST API PHP ke server hosting cPanel Niagahoster Anda.

---

### 📂 Struktur Direktori `public_html/api/`

```text
public_html/
└── api/
    ├── .htaccess                  <- Konfigurasi CORS, proteksi file & limit upload
    ├── schema.sql                 <- Skrip database MySQL (Import via phpMyAdmin)
    ├── login.php                  <- [POST] Login Nakes & Orang Tua
    ├── register_patient.php       <- [POST] Pendaftaran Pasien Baru & Auto Kredensial Orang Tua
    ├── get_patients.php           <- [GET]  Daftar seluruh pasien NICU
    ├── get_patient_logs.php       <- [GET]  Catatan harian & perkembangan bayi
    ├── add_daily_log.php          <- [POST] Tambah / update log harian pasien
    ├── update_patient.php         <- [POST] Update data pasien / status / soft delete
    ├── get_education.php          <- [GET]  Daftar modul edukasi PDF
    ├── upload_education.php       <- [POST] Upload PDF edukasi baru
    ├── delete_education.php       <- [POST] Hapus modul edukasi PDF
    ├── stream_updates.php         <- [GET]  Server-Sent Events (SSE) & Real-time Polling
    ├── config/
    │   ├── database.php           <- Koneksi PDO Singleton & Error Handling
    │   ├── db_config.php          <- Konfigurasi Nama DB, User, dan Password MySQL
    │   └── cors.php               <- Header CORS, Hash Bcrypt, & Utilitas JSON
    └── uploads/
        ├── .htaccess              <- Proteksi eksekusi skrip di folder upload
        ├── pdfs/                  <- Berkas file PDF edukasi
        ├── covers/                <- Cover modul edukasi
        └── photos/                <- Foto perkembangan bayi harian
```

---

### 🚀 Langkah-Langkah Deployment ke cPanel Niagahoster

#### 1. Buat Database MySQL di cPanel
1. Masuk ke **cPanel Niagahoster** Anda.
2. Cari menu **MySQL® Databases** (atau **MySQL Database Wizard**).
3. Buat database baru, contoh: `u1234567_nspc_db`.
4. Buat user database baru, contoh: `u1234567_user`, beri password yang kuat.
5. Hubungkan user ke database dengan mencentang **ALL PRIVILEGES** (Semua Hak Akses).

#### 2. Import Skema Tabel via phpMyAdmin
1. Di cPanel, buka menu **phpMyAdmin**.
2. Klik nama database yang baru dibuat (`u1234567_nspc_db`) di panel sebelah kiri.
3. Klik tab **Import** pada menu atas.
4. Klik **Choose File** / **Pilih Berkas**, pilih file `schema.sql` dari folder `api/`.
5. Klik tombol **Go** / **Kirim** di bagian bawah.
6. Seluruh 6 tabel (`patients`, `nakes_users`, `nakes_login_logs`, `daily_logs`, `education_pdfs`, `system_events`) beserta akun Admin awal otomatis terbuat.

#### 3. Upload File API ke `public_html/api/`
1. Di cPanel, buka **File Manager**.
2. Masuk ke folder `public_html/`.
3. Buat folder baru bernama `api` (sehingga jalurnya `public_html/api/`).
4. Upload seluruh isi folder `api/` ke dalam folder tersebut (atau upload file `.zip` lalu ekstrak di File Manager).
5. Pastikan folder `uploads/`, `uploads/pdfs/`, `uploads/covers/`, dan `uploads/photos/` memiliki permission **755** (dapat ditulisi oleh PHP).

#### 4. Sesuaikan Konfigurasi Database
1. Buka file `public_html/api/config/db_config.php` menggunakan **Code Editor** di cPanel File Manager.
2. Masukkan informasi database Anda:
   ```php
   return [
       'host'     => 'localhost',
       'port'     => '3306',
       'database' => 'u1234567_nspc_db', // Ganti dengan nama database Anda
       'username' => 'u1234567_user',    // Ganti dengan username database Anda
       'password' => 'PasswordAnda123!',  // Ganti dengan password database Anda
       'charset'  => 'utf8mb4',
       'timezone' => '+08:00', // WITA (Palu)
       
       'upload_dir' => dirname(__DIR__) . '/uploads/',
       'base_url'   => 'https://domain-anda.com/api/' // Ganti dengan domain Anda
   ];
   ```
3. Klik **Save Changes**.

---

### 📑 Ringkasan Endpoint REST API

| Metode | Endpoint | Deskripsi | Parameter Utama |
|---|---|---|---|
| **POST** | `/api/login.php` | Otentikasi Nakes & Orang Tua | `username` / `pin` (Nakes) atau `nickname` / `password` (Orang Tua) |
| **POST** | `/api/register_patient.php` | Pendaftaran Pasien Baru + Auto Kredensial | `baby_name`, `gender`, `birth_date`, `admission_date`, dll. |
| **GET**  | `/api/get_patients.php` | Daftar seluruh pasien NICU | `status`, `search`, `include_deleted` |
| **GET**  | `/api/get_patient_logs.php` | Riwayat log harian bayi | `patient_id` |
| **POST** | `/api/add_daily_log.php` | Tambah/Update log harian & TTV | `patient_id`, `weight_gram`, `date`, `vital_signs`, `drinking_ability` |
| **POST** | `/api/update_patient.php` | Update data pasien / status / soft delete | `id`, `status`, `is_deleted`, `milestones`, dll. |
| **GET**  | `/api/get_education.php` | Daftar file PDF edukasi | `patient_id` (opsional), `category` (opsional) |
| **POST** | `/api/upload_education.php` | Upload materi edukasi PDF | `title`, `pdf_file` (multipart) atau `file_data_url` (base64) |
| **POST** | `/api/delete_education.php` | Hapus materi PDF permanen | `id` |
| **GET**  | `/api/stream_updates.php` | Stream SSE / Polling Real-Time | `mode=stream` (SSE) atau `mode=poll` (JSON) |

---

### 🔐 Fitur Keamanan Bawaan
- **Prepared Statements PDO:** Mencegah serangan SQL Injection pada semua query.
- **Password Hashing Bcrypt:** Kredensial disimpan dengan `password_hash()` dan diverifikasi dengan `password_verify()`.
- **CORS Protection:** Mendukung akses lintas domain aman dari frontend React / Web App.
- **Directory Protection:** `.htaccess` mencegah eksekusi skrip jahat di direktori `uploads/`.
