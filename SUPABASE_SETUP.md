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
| `classes` | Data kelas, rekening, saldo, riwayat kas, periode & nominal kas |
| `class_secrets` | Hash bcrypt sandi tiap kelas (tidak bisa dibaca langsung) |
| `class_members` | Orang tua/siswa yang sudah bergabung ke kelas |
| `dues` | Program iuran/tagihan per kelas |
| `due_payments` | Checklist lunas/belum per orang tua + bukti foto |
| `notifications` | Inbox notifikasi orang tua (read/unread) |
| `transfers` | Konfirmasi transfer + tautan anggota/iuran + bukti foto |
| `class_manager_settings` | Hash bcrypt sandi manajemen kelas (akses hanya via RPC) |

Sekaligus membuat:
- Row Level Security (RLS) untuk semua tabel
- Fungsi verifikasi transfer yang atomik (sekaligus update checklist iuran)
- Fungsi sandi kelas: `set_class_password`, `create_class_with_password`, `join_class_with_password`
- Fungsi sandi manajemen: `verify_class_manager_password`, `set_class_manager_password`
- Fungsi iuran/checklist: `create_due`, `admin_mark_due_payment`
- Fungsi notifikasi: `notify_class_members`, `notify_unpaid_members`
- Fungsi profil, kode pemulihan, dan reset sandi tanpa email
- Bucket Storage `payment-proofs` untuk foto bukti pembayaran
- Seed 3 kelas contoh dengan **saldo awal Rp 0**
- Realtime untuk `classes`, `transfers`, `class_members`, `dues`, `due_payments`, `notifications`

> **Pendaftaran baru selalu menjadi orang tua (`ortu`).**
> Akun admin hanya bisa dibuat lewat Dashboard Supabase (lihat bagian 4b).
>
> **Pembaruan fitur:** jika database sudah pernah dibuat sebelum fitur sandi kelas/iuran/inbox,
> jalankan ulang **seluruh** `supabase-schema.sql`. Blok nomor 10 dan 11 bersifat idempotent
> (aman dijalankan berulang) dan akan menambahkan kolom/tabel/fungsi baru tanpa menghapus data.
>
> Setelah skema dijalankan, admin perlu membuka **ikon/ tombol Manajemen Kelas di navbar → Sandi**
> untuk mengatur sandi pada kelas lama. Kelas tanpa sandi tidak bisa dimasuki orang tua.
>
> Sandi manajemen awal bawaan database adalah **Manager123**. Segera ganti setelah login pertama
> lewat popup **Manajemen Kelas → Ganti Sandi Manajemen**.

---

## 2b. Manajemen Kelas & sandi manajemen (wajib diketahui)

Struktur akses:

- **Guru/wali kelas** mengelola kelas yang sedang dibuka dari dalam halaman kelas:
  rekening, kas, iuran, checklist, anggota, dan notifikasi.
- **Manager sekolah** mengelola daftar kelas dari tombol **🏫 Manajemen Kelas** di navbar admin.
  Popup hanya berisi tambah/ubah/hapus kelas, wali kelas, rekening awal, dan sandi kelas.
- Popup terbuka hanya setelah memasukkan **sandi manajemen** yang disimpan di tabel
  `class_manager_settings` sebagai hash bcrypt.

Sandi manajemen bawaan:

```text
Manager123
```

**Wajib langsung diganti** setelah login pertama:

1. Login sebagai admin/guru.
2. Klik **🏫 Manajemen Kelas** di navbar.
3. Masukkan `Manager123`.
4. Di dalam popup, cari **Ganti Sandi Manajemen**, isi sandi lama dan sandi baru minimal 8 karakter.
5. Popup otomatis terkunci lagi; gunakan sandi baru untuk membuka berikutnya.

Aturan keamanan:

- Salah memasukkan sandi manajemen 5 kali → terkunci 15 menit.
- Tabel `class_manager_settings` tidak memiliki policy baca/tulis langsung.
- Akses hanya lewat RPC `verify_class_manager_password` dan `set_class_manager_password`.
- Orang tua tidak dapat mengakses popup ini karena RPC hanya mengizinkan role `guru`.
- Orang tua wajib memasukkan sandi kelas setiap kali membuka kelas, bukan hanya saat pertama bergabung.

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
2. Pastikan tabel `classes`, `transfers`, `class_members`, `dues`, `due_payments`, dan
   `notifications` ada di publikasi `supabase_realtime`.

Realtime membuat:
- Guru menyimpan data → halaman Orang Tua langsung update.
- Orang tua mengirim transfer → antrean guru langsung muncul.
- Iuran/notifikasi baru → inbox orang tua langsung bertambah.

Kalau realtime belum aktif, data tetap tersimpan. Hanya UI yang tidak auto-refresh.

---

## 5b. Storage foto bukti pembayaran

Skema SQL sudah membuat bucket **`payment-proofs`** (public) beserta policy upload untuk user login.
Tidak perlu membuat bucket manual. Jika pernah menghapus bucket, jalankan ulang blok 10h di
`supabase-schema.sql`, atau buat manual:

1. Buka **Storage** → **New bucket** → nama `payment-proofs` → centang **Public bucket**.
2. Tambahkan policy **INSERT** untuk role `authenticated` dengan `bucket_id = 'payment-proofs'`.
3. Batas foto di aplikasi: hanya gambar (JPG/PNG/WebP) dan maksimal **5 MB**.

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
4. Pilih kelas `VIII-A` → masukkan **sandi kelas** dari wali kelas + nama siswa.
   (Sandi diminta setiap kali membuka kelas, bukan hanya saat pertama bergabung.)
5. Buka menu transfer → pilih iuran → lampirkan **foto bukti** (wajib) → kirim.
6. Buka **Supabase Dashboard** → **Table Editor** → tabel `transfers` dan `due_payments`,
   pastikan datanya masuk (status `PENDING`).
7. Buka **Inbox** → jumlah badge belum dibaca berkurang saat pesan dibuka.

Tes admin:

1. Logout → login memakai akun admin (`adminscc@gmail.com` / sandi admin).
2. Masukkan **Kunci Izin Admin** (`ADMIN_ACCESS_KEY`).
3. Klik **🏫 Manajemen Kelas** di navbar → masukkan **Sandi Manajemen** (`Manager123` bila belum diganti).
4. Di popup, tambah/ubah/hapus kelas dan atur sandi kelas.
5. Pilih kelas → atur periode & nominal kas, tambah iuran, checklist, anggota, atau kirim notifikasi.
6. Tambah program iuran → notifikasi otomatis masuk ke inbox orang tua.
7. Buka **Checklist Pembayaran** → centang lunas/belum per orang tua.
8. Setujui transfer orang tua di **Antrean Verifikasi** → saldo kas bertambah dan
   checklist iuran otomatis menjadi **Lunas**.
9. Pastikan data orang tua yang bergabung muncul di **Anggota Kelas**.

Tes keamanan:

1. Login admin dengan kunci izin yang salah 3 kali → sesi otomatis berakhir.
2. Login orang tua → tidak ada permintaan kunci izin dan tidak bisa membuka dashboard admin.
3. Coba gabung kelas dengan sandi salah → ditolak.
3b. Klik **Manajemen Kelas** dengan sandi manajemen salah 5 kali → terkunci 15 menit.
3c. Orang tua klik kelas yang sudah pernah dimasuki → tetap diminta sandi kelas.
4. Buka **Lupa kata sandi** → isi username + kode pemulihan + sandi baru → login dengan sandi baru.
5. Coba kode pemulihan salah 5 kali → reset terkunci 15 menit.

---

## 9. Cara kerja sinkronisasi

| Aksi di web | Tabel Supabase |
|---|---|
| Daftar / login | `auth.users` + `profiles` |
| Ubah rekening / periode kas | `classes` |
| Catat kas masuk/keluar | `classes.balance` + `classes.cash_history` |
| Buat / hapus kelas | `classes` + `class_secrets` |
| Buka manajemen kelas | `class_manager_settings` via RPC |
| Gabung/buka kelas dengan sandi | `class_members` via RPC `join_class_with_password` |
| Tambah program iuran | `dues` + `notifications` |
| Kirim transfer orang tua | `transfers` + `due_payments` |
| Upload foto bukti | Storage `payment-proofs` + `transfers.proof_url` |
| Guru terima/tolak transfer | `transfers.status` + `classes.balance` + `classes.cash_history` + `due_payments` |
| Checklist manual admin | `due_payments` |
| Kirim notifikasi / pengingat | `notifications` |
| Orang tua membaca inbox | `notifications.is_read` |

Semua operasi tulis memakai Supabase JS client dan dibatasi RLS:
- **Guru** boleh mengelola kelas, iuran, checklist, dan notifikasi.
- **Orang tua** hanya boleh melihat data kelasnya, mengirim transfer baru (status `PENDING`),
  dan menandai notifikasinya sendiri sebagai dibaca.
- Verifikasi transfer, perubahan saldo, dan checklist hanya boleh dilakukan guru lewat RPC.
- Sandi kelas tidak pernah dikirim ke browser; hanya hash bcrypt di `class_secrets`.

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
| `relation "public.class_members" does not exist` (atau `dues`/`due_payments`/`notifications`) | Database lama belum diperbarui. Jalankan ulang **seluruh** `supabase-schema.sql` (blok 10). |
| Kelas tidak bisa dimasuki orang tua | Admin belum mengatur sandi kelas. Buka tombol **🏫 Manajemen Kelas** di navbar → **Sandi**, minimal 4 karakter. |
| Popup **Manajemen Kelas** tidak bisa dibuka | Sandi manajemen salah atau database belum memakai skema terbaru. Sandi bawaan adalah `Manager123`; jalankan seluruh `supabase-schema.sql` dan ganti sandi lewat popup. |
| Popup manajemen terkunci | Salah 5 kali. Tunggu 15 menit atau atur ulang via SQL: `update public.class_manager_settings set failed_attempts = 0, locked_until = null where id = true;` |
| `Sandi kelas salah` | Sandi berbeda dengan yang diatur admin. Minta wali kelas mengatur ulang sandi. |
| Upload bukti gagal / `Bucket not found` | Jalankan blok storage di `supabase-schema.sql`, atau buat bucket public `payment-proofs`. |
| `new row violates row-level security policy` | Role user bukan guru, profil belum dibuat, atau orang tua belum bergabung ke kelas. Cek `profiles` dan `class_members`. |
| Data tidak muncul di web lain | Cek Realtime sudah aktif untuk `classes`, `transfers`, `class_members`, `dues`, `due_payments`, `notifications`. |
| Gagal `get_my_profile` / `ensure_my_profile` | Jalankan ulang `supabase-schema.sql` (bagian fungsi). |

---

## 12. Catatan keamanan

- Kredensial disimpan di `.env` (lokal) dan **Environment Variables Vercel** (produksi). File `.env` dan hasil generate `supabase-config.js` sudah masuk `.gitignore`.
- `supabase-config.js` hanya berisi **anon public key** dan **ciphertext** kunci izin admin (AES-256-GCM + PBKDF2-SHA256). Tidak ada kunci admin plaintext di file yang dikirim ke browser.
- Kunci izin admin adalah lapisan UI tambahan. Batas keamanan data yang sebenarnya tetap **RLS Supabase**.
- Sandi kelas disimpan sebagai hash **bcrypt** di `class_secrets`; tabel itu tidak punya policy baca,
  sehingga browser tidak bisa membaca hash-nya. Verifikasi hanya lewat RPC `join_class_with_password`.
- Sandi manajemen kelas disimpan sebagai hash **bcrypt** di `class_manager_settings`; tabel itu
  juga tidak punya policy baca/tulis langsung dan diverifikasi lewat RPC dengan batas 5 percobaan / 15 menit.
- Foto bukti disimpan di bucket `payment-proofs`. Bucket bersifat public agar admin mudah membuka bukti,
  tetapi nama file memakai UUID user + timestamp acak. Jangan mengunggah dokumen sensitif lain ke bucket ini.
- Admin wajib melewati 2 langkah: sandi akun + kunci izin. Salah 3 kali → sesi diakhiri.
- Pendaftaran publik selalu membuat akun `ortu`; role admin hanya lewat SQL/Dashboard Supabase.
- Kode pemulihan disimpan sebagai hash bcrypt di database. Reset sandi dibatasi 5 percobaan / 15 menit.
- Jangan pernah menaruh **service_role key** di `.env` frontend atau file JavaScript.
- Untuk produksi:
  - Aktifkan kembali **Confirm email** hanya jika semua user memakai email asli.
  - Ganti sandi default `Admin` segera setelah setup.
  - Ganti `ADMIN_ACCESS_KEY` secara berkala, lalu redeploy.
  - Backup database dari **Database** → **Backups**.
