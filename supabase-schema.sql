-- =====================================================
-- EduKas — SMP Masyithoh Kroya
-- Skema Supabase (PostgreSQL) + RLS + Seed Data
-- =====================================================
-- Cara pakai:
-- 1. Buka Supabase Dashboard > SQL Editor > New query
-- 2. Copy seluruh isi file ini
-- 3. Klik "Run"
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- 1. TABEL PROFIL USER
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'ortu' check (role in ('guru', 'ortu')),
  name text not null default 'User',
  child_name text not null default '',
  identity text not null default '',
  recovery_code_hash text,
  recovery_attempts integer not null default 0,
  recovery_locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- Untuk database yang sudah pernah dibuat sebelumnya.
alter table public.profiles add column if not exists recovery_code_hash text;
alter table public.profiles add column if not exists recovery_attempts integer not null default 0;
alter table public.profiles add column if not exists recovery_locked_until timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

grant select on public.profiles to authenticated;

-- =====================================================
-- 2. FUNGSI BANTU: ROLE USER AKTIF
-- =====================================================
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- =====================================================
-- 3. TABEL KELAS
-- =====================================================
create table if not exists public.classes (
  id text primary key,
  grade text not null,
  name text not null,
  homeroom text not null,
  bank_name text not null,
  bank_number text not null,
  bank_holder text not null,
  balance bigint not null default 0,
  bills jsonb not null default '[]'::jsonb,
  cash_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.classes enable row level security;

drop policy if exists "classes_read_authenticated" on public.classes;
create policy "classes_read_authenticated"
  on public.classes for select
  to authenticated
  using (true);

drop policy if exists "classes_insert_guru" on public.classes;
create policy "classes_insert_guru"
  on public.classes for insert
  to authenticated
  with check (public.current_user_role() = 'guru');

drop policy if exists "classes_update_guru" on public.classes;
create policy "classes_update_guru"
  on public.classes for update
  to authenticated
  using (public.current_user_role() = 'guru')
  with check (public.current_user_role() = 'guru');

drop policy if exists "classes_delete_guru" on public.classes;
create policy "classes_delete_guru"
  on public.classes for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, insert, update, delete on public.classes to authenticated;

-- =====================================================
-- 4. TABEL TRANSFER ORANG TUA
-- =====================================================
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  student_name text not null,
  parent_name text not null default 'Wali Murid',
  purpose text not null,
  amount bigint not null check (amount > 0),
  method text not null,
  note text not null default '',
  date_label text not null default 'Baru saja',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists transfers_class_id_idx on public.transfers(class_id);
create index if not exists transfers_status_idx on public.transfers(status);

alter table public.transfers enable row level security;

drop policy if exists "transfers_read_authenticated" on public.transfers;
create policy "transfers_read_authenticated"
  on public.transfers for select
  to authenticated
  using (true);

drop policy if exists "transfers_insert_authenticated" on public.transfers;
create policy "transfers_insert_authenticated"
  on public.transfers for insert
  to authenticated
  with check (created_by = auth.uid() and status = 'PENDING');

drop policy if exists "transfers_update_guru" on public.transfers;
create policy "transfers_update_guru"
  on public.transfers for update
  to authenticated
  using (public.current_user_role() = 'guru')
  with check (public.current_user_role() = 'guru');

drop policy if exists "transfers_delete_guru" on public.transfers;
create policy "transfers_delete_guru"
  on public.transfers for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, insert, update, delete on public.transfers to authenticated;

-- =====================================================
-- 5. OTOMATIS BUAT PROFIL SAAT REGISTRASI
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, child_name, identity)
  values (
    new.id,
    'ortu',
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'child_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'identity', ''), new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 6. FUNGSI: BACA & PASTIKAN PROFIL USER
-- =====================================================

-- Baca profil tanpa membuat profil baru.
-- Dipakai saat login: kalau profil tidak ada, login ditolak.
create or replace function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'role', v_profile.role,
    'name', v_profile.name,
    'child_name', v_profile.child_name,
    'identity', v_profile.identity
  );
end;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

-- Kompatibilitas: tetap buat profil untuk akun lama yang belum punya profil.
-- Akun baru selalu dibuat sebagai 'ortu'; admin hanya dipromosikan lewat SQL/dashboard.
create or replace function public.ensure_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan';
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.profiles (id, role, name, child_name, identity)
  values (
    auth.uid(),
    'ortu',
    coalesce(nullif(v_user.raw_user_meta_data->>'name', ''), split_part(coalesce(v_user.email, ''), '@', 1)),
    coalesce(v_user.raw_user_meta_data->>'child_name', ''),
    coalesce(nullif(v_user.raw_user_meta_data->>'identity', ''), v_user.email, '')
  )
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'id', v_profile.id,
    'role', v_profile.role,
    'name', v_profile.name,
    'child_name', v_profile.child_name,
    'identity', v_profile.identity
  );
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

-- =====================================================
-- 6b. KODE PEMULIHAN & RESET SANDI TANPA EMAIL
-- =====================================================

-- Simpan hash kode pemulihan milik user yang sedang login.
create or replace function public.set_my_recovery_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan';
  end if;

  if length(coalesce(p_code, '')) < 12 then
    raise exception 'Kode pemulihan minimal 12 karakter';
  end if;

  update public.profiles
  set
    recovery_code_hash = crypt(p_code, gen_salt('bf', 10)),
    recovery_attempts = 0,
    recovery_locked_until = null
  where id = auth.uid();

  if not found then
    raise exception 'Profil tidak ditemukan';
  end if;
end;
$$;

revoke all on function public.set_my_recovery_code(text) from public;
grant execute on function public.set_my_recovery_code(text) to authenticated;

-- Reset sandi memakai username + kode pemulihan + sandi baru.
-- Tidak memakai email. Dibatasi 5 percobaan, lalu terkunci 15 menit.
create or replace function public.reset_password_with_recovery(
  p_identity text,
  p_recovery_code text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_user_id uuid;
  v_profile public.profiles;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'Kata sandi baru minimal 8 karakter';
  end if;

  if length(coalesce(p_recovery_code, '')) < 8 then
    raise exception 'Username atau kode pemulihan salah';
  end if;

  v_email := lower(trim(coalesce(p_identity, '')));
  if position('@' in v_email) = 0 then
    v_email := regexp_replace(v_email, '[^a-z0-9]', '', 'g') || '@edukas.app';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'Username atau kode pemulihan salah';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found or v_profile.recovery_code_hash is null then
    raise exception 'Username atau kode pemulihan salah';
  end if;

  if v_profile.recovery_locked_until is not null
     and v_profile.recovery_locked_until > now() then
    raise exception 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.';
  end if;

  if crypt(p_recovery_code, v_profile.recovery_code_hash) <> v_profile.recovery_code_hash then
    update public.profiles
    set
      recovery_attempts = recovery_attempts + 1,
      recovery_locked_until = case
        when recovery_attempts + 1 >= 5 then now() + interval '15 minutes'
        else recovery_locked_until
      end
    where id = v_user_id;

    raise exception 'Username atau kode pemulihan salah';
  end if;

  update auth.users
  set
    encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
    updated_at = now()
  where id = v_user_id;

  update public.profiles
  set
    recovery_attempts = 0,
    recovery_locked_until = null
  where id = v_user_id;
end;
$$;

revoke all on function public.reset_password_with_recovery(text, text, text) from public;
grant execute on function public.reset_password_with_recovery(text, text, text) to anon, authenticated;

-- =====================================================
-- 7. FUNGSI: VERIFIKASI / TOLAK TRANSFER (OLEH GURU)
-- Atomik: ubah status transfer + tambah saldo & riwayat kas
-- =====================================================
create or replace function public.review_transfer(p_transfer_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.transfers;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya guru/wali kelas yang dapat memverifikasi transfer';
  end if;

  select * into v_transfer
  from public.transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Data transfer tidak ditemukan';
  end if;

  if v_transfer.status <> 'PENDING' then
    return;
  end if;

  if p_approve then
    update public.transfers
    set status = 'APPROVED'
    where id = p_transfer_id;

    update public.classes
    set
      balance = balance + v_transfer.amount,
      cash_history = jsonb_build_array(
        jsonb_build_object(
          'id', 'c-' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
          'type', 'IN',
          'desc', 'Transfer ' || v_transfer.purpose || ' (' || v_transfer.student_name || ')',
          'amount', v_transfer.amount,
          'date', 'Baru saja'
        )
      ) || cash_history,
      updated_at = now()
    where id = v_transfer.class_id;
  else
    update public.transfers
    set status = 'REJECTED'
    where id = p_transfer_id;
  end if;
end;
$$;

revoke all on function public.review_transfer(uuid, boolean) from public;
grant execute on function public.review_transfer(uuid, boolean) to authenticated;

-- =====================================================
-- 8. SEED DATA AWAL (3 KELAS + 1 TRANSFER CONTOH)
-- =====================================================
insert into public.classes
  (id, grade, name, homeroom, bank_name, bank_number, bank_holder, balance, bills, cash_history)
values
  (
    'VII-A',
    'VII',
    'Kelas VII-A',
    'Dra. Siti Aminah',
    'BANK BRI',
    '0029-01-011223-50-1',
    'Siti Aminah (Wali Kelas VII-A)',
    1450000,
    '[{"id":"b1","title":"Kas Kelas Bulanan","amount":25000},{"id":"b2","title":"Tabungan Outing Class & Ziarah","amount":100000}]'::jsonb,
    '[{"id":"c1","type":"IN","desc":"Saldo Awal Semester Ganjil","amount":1500000,"date":"01 Okt 2026"},{"id":"c2","type":"OUT","desc":"Pembelian Alat Kebersihan & Spidol Kelas","amount":50000,"date":"05 Okt 2026"}]'::jsonb
  ),
  (
    'VIII-A',
    'VIII',
    'Kelas VIII-A',
    'Budi Santoso, S.Pd.',
    'BANK MANDIRI',
    '139-00-2849102-4',
    'Budi Santoso (Wali Kelas VIII-A)',
    2350000,
    '[{"id":"b3","title":"Iuran Kas Kelas Bulanan","amount":30000},{"id":"b4","title":"Tabungan Kunjungan Belajar","amount":150000},{"id":"b5","title":"Dana Sosial & Santunan Siswa","amount":50000}]'::jsonb,
    '[{"id":"c3","type":"IN","desc":"Kas Kelas Kolektif Bulan Oktober","amount":2500000,"date":"10 Okt 2026"},{"id":"c4","type":"OUT","desc":"Cetak Modul & Papan Informasi Kelas","amount":150000,"date":"14 Okt 2026"}]'::jsonb
  ),
  (
    'IX-A',
    'IX',
    'Kelas IX-A',
    'H. Rahmat Hidayat, S.Pd.I.',
    'BANK BCA',
    '7420-8819-21',
    'H. Rahmat Hidayat (Wali Kelas IX-A)',
    3120000,
    '[{"id":"b6","title":"Kas Kelas IX & Persiapan Wisuda","amount":100000}]'::jsonb,
    '[{"id":"c5","type":"IN","desc":"Dana Awal Kas Kelas IX-A","amount":3120000,"date":"02 Okt 2026"}]'::jsonb
  )
on conflict (id) do nothing;

insert into public.transfers
  (id, class_id, student_name, parent_name, purpose, amount, method, note, date_label, status)
values
  (
    '11111111-1111-1111-1111-111111111101',
    'VIII-A',
    'Raka Pratama',
    'Bpk. Hendra (Wali Raka)',
    'Tabungan Kunjungan Belajar',
    150000,
    'BRImo (BRI)',
    'Setoran tabungan tahap 1 Raka',
    'Hari ini, 09:15',
    'PENDING'
  )
on conflict (id) do nothing;

-- =====================================================
-- 9. AKTIFKAN REALTIME UNTUK KELAS & TRANSFER
-- =====================================================
alter table public.classes replica identity full;
alter table public.transfers replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'classes'
  ) then
    execute 'alter publication supabase_realtime add table public.classes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transfers'
  ) then
    execute 'alter publication supabase_realtime add table public.transfers';
  end if;
end $$;
