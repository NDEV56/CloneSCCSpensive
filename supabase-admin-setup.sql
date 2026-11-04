-- =====================================================
-- EduKas — Setup Akun Admin
-- =====================================================
-- Jalankan SETELAH supabase-schema.sql.
--
-- LANGKAH 1 — Buat user lewat Dashboard Supabase:
--   1. Authentication > Users > Add user
--   2. Email    : bebas, contoh admin@edukas.app
--                 (boleh memakai email lain yang kamu mau)
--   3. Password : Admin
--      Jika ditolak karena minimal 6 karakter, buka
--      Authentication > Sign In / Providers > Email >
--      Minimum password length, turunkan ke 5,
--      atau gunakan password Admin123.
--   4. Centang "Auto Confirm User"
--   5. Klik Create user
--
-- LANGKAH 2 — Cek email user yang baru dibuat.
-- Jalankan query ini dulu:
--
--   select id, email, created_at
--   from auth.users
--   order by created_at desc;
--
-- LANGKAH 3 — Ganti 'ISI_EMAIL_ADMIN_DI_SINI' di bawah
-- dengan email yang muncul di langkah 2, lalu Run.
--
-- CATATAN LOGIN:
--   - Kalau email admin = admin@edukas.app, kamu bisa login
--     memakai username "Admin" atau email tersebut.
--   - Kalau email admin berbeda, login memakai email itu
--     (bukan username "Admin"), kecuali email Auth-nya
--     diubah menjadi admin@edukas.app di Dashboard.
-- =====================================================

do $$
declare
  v_email text := 'adminscc@gmail.com';
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(v_email))
  limit 1;

  if v_user_id is null then
    raise exception 'User dengan email % tidak ditemukan. Cek Authentication > Users.', v_email;
  end if;

  insert into public.profiles (id, role, name, child_name, identity)
  values (v_user_id, 'guru', 'Admin', '', 'Admin')
  on conflict (id) do update
  set
    role = 'guru',
    name = 'Admin',
    identity = 'Admin';

  raise notice 'Berhasil: % sekarang ber-role guru (Admin).', v_email;
end $$;

-- Verifikasi: daftar semua akun admin/guru.
select p.id, u.email, p.role, p.name
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'guru';
