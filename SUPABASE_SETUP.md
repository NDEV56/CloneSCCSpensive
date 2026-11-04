# Setup Supabase — EduKas SMP Masyithoh Kroya

Panduan ini mengganti database lama dengan **Supabase**.
Semua input dari web (rekening, kas, iuran, transfer orang tua) akan disimpan ke Supabase.

> **Tidak perlu install Supabase di komputer.** Supabase adalah database cloud.
> Yang perlu dibuat hanya akun + project di https://supabase.com.

---

## 1. Buat akun & project Supabase

1. Buka https://supabase.com lalu klik **Start your project**.
2. Login dengan GitHub/Google/email.
3. Klik **New project**.
4. Isi:
   - **Name**: `edukas-masyithoh`
   - **Database Password**: buat password kuat, simpan baik-baik
   - **Region**: pilih yang paling dekat, misalnya **Singapore**
5. Klik **Create new project** dan tunggu sampai selesai (± 2 menit).

---

## 2. Jalankan skema database

1. Di dashboard project, buka menu **SQL Editor**.
2. Klik **New query**.
3. Buka file `supabase-schema.sql` di project ini.
4. Copy **seluruh isi file**, paste ke SQL Editor.
5. Klik **Run**.

File itu otomatis membuat:

| Tabel | Isi |
|---|---|
| `profiles` | Profil user (admin/guru / orang tua) + hash kode pemulihan |
| `classes` | Data kelas, rekening, saldo, iuran, riwayat kas |
| `transfers` | Konfirmasi transfer dari orang tua |

Sekaligus membuat:
- Row Level Security (RLS)
- Fungsi verifikasi transfer yang atomik
- Fungsi profil, kode pemulihan, dan reset sandi tanpa email
- Seed 3 kelas contoh + 1 transfer contoh
- Realtime untuk tabel `classes` dan `transfers`

> **Pendaftaran baru selalu menjadi orang tua (`ortu`).**
> Akun admin hanya bisa dibuat lewat Dashboard Supabase (lihat bagian 4b).

---

## 3. Ambil URL & anon key → simpan ke `.env`

1. Buka **Project Settings** (ikon gear) → **API**.
2. Copy dua nilai ini:
   - **Project URL** → contoh: `https://abcdefghijk.supabase.co`
   - **anon public** key → key panjang yang diawali `eyJ...`
3. Di terminal, dari folder project, jalankan:

```bat
copy .env.example .env
notepad .env
```

4. Isi file `.env`:

```env
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
ADMIN_ACCESS_KEY=KunciAdmin-9f2b7c41e8a6
```

`ADMIN_ACCESS_KEY` adalah **kunci izin admin langkah ke-2**. Buat acak minimal 12 karakter,
jangan sama dengan sandi admin. Kunci ini hanya dipakai untuk memverifikasi akses admin,
bukan untuk login.

5. Generate file config yang dibaca browser:

```bat
node scripts/generate-supabase-config.js
```

Perintah itu mengubah `.env` menjadi `supabase-config.js` yang dipakai oleh `index.html`.
`ADMIN_ACCESS_KEY` dienkripsi dengan **AES-256-GCM** dan kunci turunannya memakai
**PBKDF2-SHA256 (210.000 iterasi)**; yang masuk ke browser hanya ciphertext,
bukan kunci aslinya.

> **Penting:** gunakan **anon public key**, bukan `service_role`.
> `service_role` tidak boleh ditaruh di frontend.
>
> `.env` dan `supabase-config.js` sudah masuk `.gitignore`, jadi tidak ikut ter-commit.
>
> Saat deploy di Vercel, file `.env` tidak ikut ke GitHub. Kredensial dibaca dari
> **Environment Variables Vercel** (lihat bagian 7).

---

## 4. Atur Authentication

1. Buka menu **Authentication** → **Sign In / Providers**.
2. Pastikan provider **Email** aktif.
3. **Wajib untuk aplikasi ini:** matikan **Confirm email**.
   - Buka **Authentication** → **Sign In / Providers** → **Email**.
   - Matikan toggle **Confirm email**, lalu klik **Save**.
   - Alasannya: aplikasi ini mengizinkan login memakai nomor HP/username yang otomatis diubah menjadi email `@edukas.app`. Email itu tidak nyata, jadi link konfirmasi tidak akan pernah bisa dibuka.
4. Kalau nanti ingin memakai **Confirm email**:
   - Semua user wajib mendaftar dengan email asli.
   - Atur **Authentication** → **URL Configuration** → **Site URL** ke alamat web Anda.

---

## 4b. Membuat akun admin (manual, aman)

Akun admin **tidak bisa** dibuat lewat halaman Sign Up. Halaman Sign Up selalu membuat akun orang tua.

1. Buka **Authentication** → **Users** → **Add user**.
2. Isi:
   - **Email**: bebas, misalnya `admin@edukas.app` atau email Anda sendiri
   - **Password**: `Admin`
   - Centang **Auto Confirm User**
3. Klik **Create user**.

> Supabase secara default mewajibkan sandi minimal 6 karakter. Jika `Admin` ditolak,
> buka **Authentication** → **Sign In / Providers** → **Email**, turunkan
> **Minimum password length** menjadi `5` (atau gunakan sandi `Admin123` dan login dengan sandi itu).
> Sandi login admin bisa diganti kapan saja lewat menu **Ganti Sandi**.

4. Cek email user yang baru dibuat:
   ```sql
   select id, email, created_at
   from auth.users
   order by created_at desc;
   ```
5. Buka **SQL Editor** → **New query**, copy seluruh isi file `supabase-admin-setup.sql`.
6. Ganti teks `ISI_EMAIL_ADMIN_DI_SINI` dengan email yang muncul di langkah 4 (pakai tanda kutip tunggal, contoh `'emailku@gmail.com'`), lalu **Run**.

File itu mengubah profil user tersebut menjadi role `guru` (ditampilkan sebagai **Admin**).
Di akhir file ada query verifikasi; pastikan hasilnya menampilkan `role = guru`.

### Cara login admin

- **Kalau email Auth = `admin@edukas.app`** → bisa login dengan identitas `Admin` atau `admin@edukas.app`.
- **Kalau email Auth berbeda** (misalnya `emailku@gmail.com`) → login memakai **email lengkap itu**.
  Username `Admin` hanya otomatis berubah menjadi `admin@edukas.app`, jadi tidak akan cocok
  dengan email lain.
- Kalau tetap ingin login dengan username `Admin`, ubah email user di
  **Authentication → Users → pilih user → Edit** menjadi `admin@edukas.app`.

Setelah email cocok:

- Sistem akan meminta **Kunci Izin Admin** (`ADMIN_ACCESS_KEY`) sebagai langkah ke-2.
- Ganti sandi admin lewat menu **Ganti Sandi** setelah login, atau lewat
  **Authentication → Users** di Dashboard Supabase.

> Jika lupa sandi admin dan belum punya kode pemulihan:
> reset langsung dari **Authentication → Users → pilih admin → Reset password**.

---

## 4c. Kode pemulihan & ganti sandi

- Saat pertama kali Sign Up, aplikasi menampilkan **kode pemulihan sekali**.
  Kode ini disimpan sebagai hash di tabel `profiles`; kode aslinya tidak disimpan.
- **Lupa sandi** = username/nomor HP/email + kode pemulihan + sandi baru.
  Tidak memakai email. Percobaan dibatasi 5 kali, lalu terkunci 15 menit.
- Setelah login, gunakan **Ganti Sandi** untuk mengganti sandi memakai sandi lama.
- Di halaman yang sama, tombol **Buat Kode Pemulihan Baru** mengganti kode lama.
- Jika kode pemulihan hilang, reset akun lewat Dashboard Supabase
  (**Authentication → Users → Reset password**).

---

## 5. Aktifkan Realtime (biasanya sudah otomatis)

Skema SQL sudah menambahkan tabel ke publikasi realtime.
Untuk memastikan:

1. Buka **Database** → **Replication** (atau **Realtime**).
2. Pastikan tabel `classes` dan `transfers` ada di publikasi `supabase_realtime`.

Realtime membuat:
- Guru menyimpan data → halaman Orang Tua langsung update.
- Orang tua mengirim transfer → antrean guru langsung muncul.

Kalau realtime belum aktif, data tetap tersimpan. Hanya UI yang tidak auto-refresh.

---

## 6. Jalankan web

Cara paling aman, jalankan lewat local server (bukan double-click `index.html`):

### Opsi A — Python
```bash
cd D:\SccSpensive\SCCSpensive
python -m http.server 5500
```
Buka http://localhost:5500

### Opsi B — VS Code
Install extension **Live Server** → klik kanan `index.html` → **Open with Live Server**.

### Opsi C — Node.js
```bash
npx serve .
```

---

## 7. Deploy ke Vercel (dari GitHub)

Project ini sudah disiapkan agar Vercel membuat `supabase-config.js` sendiri saat build.
File `.env` **tidak ikut ke GitHub**, jadi kredensial harus dimasukkan lewat Vercel.

1. Buka project di https://vercel.com → **Settings** → **Environment Variables**.
2. Tambahkan tiga variable:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL Supabase, contoh `https://abcdefghijk.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon public key dari Supabase |
   | `ADMIN_ACCESS_KEY` | kunci izin admin, minimal 12 karakter acak |

3. Centang semua environment (**Production**, **Preview**, **Development**), lalu klik **Save**.
4. Buka tab **Deployments** → deployment paling baru → **Redeploy**.
   - Jangan centang **Use existing build cache** supaya config dibuat ulang.
5. Setelah deploy selesai, buka domain Vercel → login/daftar → cek data masuk ke Supabase.

> Mengganti `ADMIN_ACCESS_KEY` = cukup ubah Environment Variable lalu **Redeploy**.
> Kunci lama otomatis tidak berlaku karena ciphertext di config dibuat ulang.

Cara build-nya:

- `vercel.json` menjalankan `npm run build` dan memakai folder `dist/` sebagai output.
- `scripts/build-static.js` menyalin file web ke `dist/` lalu memanggil generator config.
- `scripts/generate-supabase-config.js` membaca `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan
  `ADMIN_ACCESS_KEY` dari Environment Variables Vercel. Saat lokal, ia membaca dari `.env`.

Kalau build gagal dengan pesan `SUPABASE_URL, SUPABASE_ANON_KEY, atau ADMIN_ACCESS_KEY belum diisi`,
berarti Environment Variables belum ditambahkan atau deployment belum di-redeploy.

---

## 8. Tes sinkronisasi

Tes orang tua:

1. Buka web → klik **Sign Up** (teks di bawah panel login).
2. Daftar dengan username/nomor HP/email + sandi minimal 8 karakter.
3. Simpan **kode pemulihan** yang muncul.
4. Pilih kelas `VIII-A`.
5. Buka menu transfer → kirim konfirmasi transfer.
6. Buka **Supabase Dashboard** → **Table Editor** → tabel `transfers`, pastikan datanya masuk.

Tes admin:

1. Logout → login memakai akun admin (`Admin` / `Admin`).
2. Masukkan **Kunci Izin Admin** (`ADMIN_ACCESS_KEY`).
3. Pilih kelas → ubah rekening, tambah kas, atau tambah iuran.
4. Buka **Supabase Dashboard** → **Table Editor** → tabel `classes`.
5. Pastikan datanya berubah.
6. Setujui transfer orang tua di **Antrean Verifikasi** → saldo kas dan riwayat kas bertambah.

Tes keamanan:

1. Login admin dengan kunci izin yang salah 3 kali → sesi otomatis berakhir.
2. Login orang tua → tidak ada permintaan kunci izin dan tidak bisa membuka dashboard admin.
3. Buka **Lupa kata sandi** → isi username + kode pemulihan + sandi baru → login dengan sandi baru.
4. Coba kode pemulihan salah 5 kali → reset terkunci 15 menit.

---

## 9. Cara kerja sinkronisasi

| Aksi di web | Tabel Supabase |
|---|---|
| Daftar / login | `auth.users` + `profiles` |
| Ubah rekening | `classes` |
| Catat kas masuk/keluar | `classes.balance` + `classes.cash_history` |
| Tambah iuran | `classes.bills` |
| Kirim transfer orang tua | `transfers` |
| Guru terima/tolak transfer | `transfers.status` + `classes.balance` + `classes.cash_history` |

Semua operasi tulis memakai Supabase JS client dan dibatasi RLS:
- **Guru** boleh mengubah data kelas.
- **Orang tua** hanya boleh mengirim transfer baru (status `PENDING`).
- Verifikasi transfer hanya boleh dilakukan guru.

---

## 10. Android

Setelah web berjalan:

1. Pastikan `.env` sudah diisi dan `node scripts/generate-supabase-config.js` sudah dijalankan.
2. Jalankan `sync_to_android.bat`.
3. Script itu menyalin `index.html`, `index.js`, `style.css`, `supabase-config.js`, dan `supabase-init.js` ke folder assets Android.
4. Build ulang aplikasi di Android Studio.

Pastikan HP/emulator punya koneksi internet.

---

## 11. Troubleshooting

| Masalah | Solusi |
|---|---|
| `Supabase belum dikonfigurasi` | Isi `.env`, lalu jalankan `node scripts/generate-supabase-config.js`. |
| `Supabase belum dikonfigurasi` di Vercel | Tambahkan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `ADMIN_ACCESS_KEY` di **Settings → Environment Variables**, lalu **Redeploy** tanpa build cache. |
| Build Vercel gagal: `... belum diisi` | Environment Variables belum diisi untuk environment yang dipakai (Production/Preview). Isi lalu redeploy. |
| Build Vercel gagal: `ADMIN_ACCESS_KEY terlalu pendek` | Gunakan kunci acak minimal 12 karakter. |
| Build Vercel gagal: `Nilai konfigurasi masih placeholder` | Nilai di Environment Variables masih memakai contoh `GANTI-...`. Ganti dengan kredensial asli. |
| `File .env tidak ditemukan` | Jalankan `copy .env.example .env`, lalu isi nilainya. |
| `.env` masih placeholder | Ganti `GANTI-PROJECT-REF`, `GANTI-DENGAN-ANON-PUBLIC-KEY`, dan `GANTI-KUNCI-ADMIN...` dengan nilai asli. |
| `Invalid login credentials` | Username/sandi salah. Ingat, login bisa memakai username, nomor HP, atau email. |
| `Email not confirmed` | Matikan **Confirm email** di Authentication → Sign In / Providers → Email. |
| Admin tidak diminta kunci izin | Pastikan profil admin ber-role `guru` (jalankan `supabase-admin-setup.sql`). |
| `User dengan email ... tidak ditemukan` saat menjalankan SQL admin | Email di `supabase-admin-setup.sql` belum diganti. Jalankan `select id, email from auth.users order by created_at desc;`, lalu ganti `ISI_EMAIL_ADMIN_DI_SINI` dengan email yang benar. |
| Login username `Admin` gagal padahal user admin sudah dibuat | Email Auth bukan `admin@edukas.app`. Login memakai email lengkap yang dipakai saat membuat user, atau ubah email Auth menjadi `admin@edukas.app`. |
| Setelah login tetap masuk dashboard orang tua | Query admin belum dijalankan atau emailnya tidak cocok. Cek `select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;` dan pastikan role `guru`. |
| `Kunci izin admin belum diatur` | Isi `ADMIN_ACCESS_KEY` di `.env`/Vercel lalu build ulang. |
| Kunci izin admin selalu salah | Pastikan kunci yang diketik sama persis dengan `ADMIN_ACCESS_KEY`, lalu redeploy setelah menggantinya. |
| Lupa sandi tapi tidak punya kode pemulihan | Reset lewat **Authentication → Users → Reset password** di Dashboard Supabase. |
| `Terlalu banyak percobaan. Coba lagi 15 menit lagi.` | Tunggu 15 menit, atau reset kode pemulihan lewat Dashboard Supabase. |
| `relation "public.classes" does not exist` | Belum menjalankan `supabase-schema.sql`. |
| `new row violates row-level security policy` | Role user bukan guru, atau profil belum dibuat. Cek tabel `profiles`. |
| Data tidak muncul di web lain | Cek Realtime sudah aktif untuk `classes` dan `transfers`. |
| Gagal `get_my_profile` / `ensure_my_profile` | Jalankan ulang `supabase-schema.sql` (bagian fungsi). |

---

## 12. Catatan keamanan

- Kredensial disimpan di `.env` (lokal) dan **Environment Variables Vercel** (produksi). File `.env` dan hasil generate `supabase-config.js` sudah masuk `.gitignore`.
- `supabase-config.js` hanya berisi **anon public key** dan **ciphertext** kunci izin admin (AES-256-GCM + PBKDF2-SHA256). Tidak ada kunci admin plaintext di file yang dikirim ke browser.
- Kunci izin admin adalah lapisan UI tambahan. Batas keamanan data yang sebenarnya tetap **RLS Supabase**.
- Admin wajib melewati 2 langkah: sandi akun + kunci izin. Salah 3 kali → sesi diakhiri.
- Pendaftaran publik selalu membuat akun `ortu`; role admin hanya lewat SQL/Dashboard Supabase.
- Kode pemulihan disimpan sebagai hash bcrypt di database. Reset sandi dibatasi 5 percobaan / 15 menit.
- Jangan pernah menaruh **service_role key** di `.env` frontend atau file JavaScript.
- Untuk produksi:
  - Aktifkan kembali **Confirm email** hanya jika semua user memakai email asli.
  - Ganti sandi default `Admin` segera setelah setup.
  - Ganti `ADMIN_ACCESS_KEY` secara berkala, lalu redeploy.
  - Backup database dari **Database** → **Backups**.
