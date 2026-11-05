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
-- 8. SEED DATA AWAL (3 KELAS, SALDO AWAL 0)
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
    0,
    '[]'::jsonb,
    '[]'::jsonb
  ),
  (
    'VIII-A',
    'VIII',
    'Kelas VIII-A',
    'Budi Santoso, S.Pd.',
    'BANK MANDIRI',
    '139-00-2849102-4',
    'Budi Santoso (Wali Kelas VIII-A)',
    0,
    '[]'::jsonb,
    '[]'::jsonb
  ),
  (
    'IX-A',
    'IX',
    'Kelas IX-A',
    'H. Rahmat Hidayat, S.Pd.I.',
    'BANK BCA',
    '7420-8819-21',
    'H. Rahmat Hidayat (Wali Kelas IX-A)',
    0,
    '[]'::jsonb,
    '[]'::jsonb
  )
on conflict (id) do nothing;

-- Catatan:
-- Seed di atas hanya berlaku untuk database baru. Jika kelas sudah ada,
-- saldo dan riwayat lamanya TIDAK diubah (on conflict do nothing).
-- Untuk memulai semua kelas dari nol (opsional, hati-hati), jalankan manual:
-- update public.classes set balance = 0, bills = '[]'::jsonb, cash_history = '[]'::jsonb;

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

-- =====================================================
-- 10. UPDATE FITUR: SANDI KELAS, ANGGOTA, IURAN,
--     CHECKLIST PEMBAYARAN & INBOX NOTIFIKASI
-- =====================================================
-- Jalankan seluruh blok ini di SQL Editor Supabase.
-- Aman dijalankan berulang (idempotent).

-- -----------------------------------------------------
-- 10a. Kolom tambahan pada tabel classes
-- -----------------------------------------------------
alter table public.classes add column if not exists has_password boolean not null default false;
alter table public.classes add column if not exists cash_period text not null default 'bulan';
alter table public.classes add column if not exists cash_amount bigint not null default 0;

-- -----------------------------------------------------
-- 10b. Sandi kelas disimpan terpisah + hash bcrypt
-- -----------------------------------------------------
create table if not exists public.class_secrets (
  class_id text primary key references public.classes(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.class_secrets enable row level security;
-- Sengaja TIDAK ada policy select/insert/update/delete.
-- Hanya fungsi security definer di bawah yang boleh mengakses.

-- Atur / ganti sandi kelas (khusus admin/guru)
create or replace function public.set_class_password(p_class_id text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat mengatur sandi kelas';
  end if;

  if length(coalesce(p_password, '')) < 4 then
    raise exception 'Sandi kelas minimal 4 karakter';
  end if;

  if not exists (select 1 from public.classes where id = p_class_id) then
    raise exception 'Kelas tidak ditemukan';
  end if;

  insert into public.class_secrets (class_id, password_hash, updated_at)
  values (p_class_id, crypt(p_password, gen_salt('bf', 10)), now())
  on conflict (class_id) do update
    set password_hash = excluded.password_hash,
        updated_at = now();

  update public.classes
  set has_password = true
  where id = p_class_id;
end;
$$;

revoke all on function public.set_class_password(text, text) from public;
grant execute on function public.set_class_password(text, text) to authenticated;

-- Buat kelas baru sekaligus sandinya. Saldo awal selalu 0.
create or replace function public.create_class_with_password(
  p_id text,
  p_grade text,
  p_name text,
  p_homeroom text,
  p_bank_name text,
  p_bank_number text,
  p_bank_holder text,
  p_password text,
  p_cash_period text default 'bulan',
  p_cash_amount bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat menambah kelas';
  end if;

  if length(trim(coalesce(p_id, ''))) = 0 or length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Kode dan nama kelas wajib diisi';
  end if;

  if length(coalesce(p_password, '')) < 4 then
    raise exception 'Sandi kelas minimal 4 karakter';
  end if;

  insert into public.classes (
    id, grade, name, homeroom, bank_name, bank_number, bank_holder,
    balance, bills, cash_history, has_password, cash_period, cash_amount
  ) values (
    trim(p_id), trim(p_grade), trim(p_name), trim(p_homeroom),
    trim(p_bank_name), trim(p_bank_number), trim(p_bank_holder),
    0, '[]'::jsonb, '[]'::jsonb, true,
    coalesce(nullif(trim(p_cash_period), ''), 'bulan'),
    greatest(coalesce(p_cash_amount, 0), 0)
  );

  insert into public.class_secrets (class_id, password_hash)
  values (trim(p_id), crypt(p_password, gen_salt('bf', 10)));
end;
$$;

revoke all on function public.create_class_with_password(text, text, text, text, text, text, text, text, text, bigint) from public;
grant execute on function public.create_class_with_password(text, text, text, text, text, text, text, text, text, bigint) to authenticated;

-- -----------------------------------------------------
-- 10c. Anggota kelas (orang tua yang sudah bergabung)
-- -----------------------------------------------------
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  parent_name text not null default '',
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create index if not exists class_members_class_idx on public.class_members(class_id);
create index if not exists class_members_user_idx on public.class_members(user_id);

alter table public.class_members enable row level security;

drop policy if exists "class_members_read" on public.class_members;
create policy "class_members_read"
  on public.class_members for select
  to authenticated
  using (public.current_user_role() = 'guru' or user_id = auth.uid());

drop policy if exists "class_members_update" on public.class_members;
create policy "class_members_update"
  on public.class_members for update
  to authenticated
  using (public.current_user_role() = 'guru' or user_id = auth.uid())
  with check (public.current_user_role() = 'guru' or user_id = auth.uid());

drop policy if exists "class_members_delete_guru" on public.class_members;
create policy "class_members_delete_guru"
  on public.class_members for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, update, delete on public.class_members to authenticated;

-- Gabung kelas dengan sandi. Sandi hanya diminta sekali saat pertama gabung.
create or replace function public.join_class_with_password(
  p_class_id text,
  p_password text,
  p_student_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member public.class_members;
  v_hash text;
  v_parent text;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan';
  end if;

  -- Sandi selalu diverifikasi, baik untuk membuka kelas maupun untuk bergabung pertama kali.
  select password_hash into v_hash
  from public.class_secrets
  where class_id = p_class_id;

  if v_hash is null then
    raise exception 'Kelas ini belum memiliki sandi. Hubungi admin/wali kelas.';
  end if;

  if crypt(coalesce(p_password, ''), v_hash) <> v_hash then
    raise exception 'Sandi kelas salah';
  end if;

  select * into v_member
  from public.class_members
  where class_id = p_class_id and user_id = auth.uid();

  if found then
    update public.class_members
    set student_name = coalesce(nullif(trim(p_student_name), ''), student_name)
    where id = v_member.id
    returning * into v_member;

    return jsonb_build_object(
      'id', v_member.id,
      'class_id', v_member.class_id,
      'user_id', v_member.user_id,
      'student_name', v_member.student_name,
      'parent_name', v_member.parent_name
    );
  end if;

  if length(trim(coalesce(p_student_name, ''))) < 2 then
    raise exception 'Nama siswa wajib diisi minimal 2 karakter';
  end if;

  select coalesce(nullif(name, ''), 'Orang Tua')
  into v_parent
  from public.profiles
  where id = auth.uid();

  insert into public.class_members (class_id, user_id, student_name, parent_name)
  values (p_class_id, auth.uid(), trim(p_student_name), coalesce(v_parent, 'Orang Tua'))
  returning * into v_member;

  return jsonb_build_object(
    'id', v_member.id,
    'class_id', v_member.class_id,
    'user_id', v_member.user_id,
    'student_name', v_member.student_name,
    'parent_name', v_member.parent_name
  );
end;
$$;

revoke all on function public.join_class_with_password(text, text, text) from public;
grant execute on function public.join_class_with_password(text, text, text) to authenticated;

-- -----------------------------------------------------
-- 10d. Program iuran / tagihan per kelas
-- -----------------------------------------------------
create table if not exists public.dues (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  title text not null,
  amount bigint not null check (amount >= 0),
  period_type text not null default 'sekali',
  period_label text not null default '',
  due_date date,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists dues_class_idx on public.dues(class_id);

alter table public.dues enable row level security;

drop policy if exists "dues_read" on public.dues;
create policy "dues_read"
  on public.dues for select
  to authenticated
  using (
    public.current_user_role() = 'guru'
    or exists (
      select 1 from public.class_members m
      where m.class_id = dues.class_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "dues_insert_guru" on public.dues;
create policy "dues_insert_guru"
  on public.dues for insert
  to authenticated
  with check (public.current_user_role() = 'guru');

drop policy if exists "dues_update_guru" on public.dues;
create policy "dues_update_guru"
  on public.dues for update
  to authenticated
  using (public.current_user_role() = 'guru')
  with check (public.current_user_role() = 'guru');

drop policy if exists "dues_delete_guru" on public.dues;
create policy "dues_delete_guru"
  on public.dues for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, insert, update, delete on public.dues to authenticated;

-- Buat iuran + otomatis kirim notifikasi ke semua anggota kelas.
create or replace function public.create_due(
  p_class_id text,
  p_title text,
  p_amount bigint,
  p_period_type text default 'sekali',
  p_period_label text default '',
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_id uuid;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat menambah iuran';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Nama iuran wajib diisi';
  end if;

  insert into public.dues (class_id, title, amount, period_type, period_label, due_date)
  values (
    p_class_id, trim(p_title), greatest(coalesce(p_amount, 0), 0),
    coalesce(nullif(trim(p_period_type), ''), 'sekali'),
    coalesce(p_period_label, ''), p_due_date
  )
  returning id into v_due_id;

  insert into public.notifications (user_id, class_id, title, body, kind)
  select
    m.user_id,
    p_class_id,
    'Iuran baru: ' || trim(p_title),
    'Nominal Rp ' || replace(to_char(greatest(coalesce(p_amount, 0), 0), 'FM999G999G999G999G999'), ',', '.')
      || coalesce(' • ' || nullif(trim(p_period_label), ''), '')
      || '. Silakan buka menu pembayaran untuk mengirim bukti foto.',
    'due'
  from public.class_members m
  where m.class_id = p_class_id;

  return v_due_id;
end;
$$;

revoke all on function public.create_due(text, text, bigint, text, text, date) from public;
grant execute on function public.create_due(text, text, bigint, text, text, date) to authenticated;

-- -----------------------------------------------------
-- 10e. Status pembayaran per orang tua / siswa
-- -----------------------------------------------------
create table if not exists public.due_payments (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references public.dues(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  member_id uuid not null references public.class_members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'UNPAID' check (status in ('UNPAID', 'PENDING', 'PAID')),
  amount bigint not null default 0,
  proof_url text,
  note text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (due_id, member_id)
);

create index if not exists due_payments_due_idx on public.due_payments(due_id);
create index if not exists due_payments_member_idx on public.due_payments(member_id);
create index if not exists due_payments_user_idx on public.due_payments(user_id);

alter table public.due_payments enable row level security;

drop policy if exists "due_payments_read" on public.due_payments;
create policy "due_payments_read"
  on public.due_payments for select
  to authenticated
  using (public.current_user_role() = 'guru' or user_id = auth.uid());

drop policy if exists "due_payments_insert_own" on public.due_payments;
create policy "due_payments_insert_own"
  on public.due_payments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status in ('UNPAID', 'PENDING')
    and exists (
      select 1 from public.class_members m
      where m.id = due_payments.member_id
        and m.user_id = auth.uid()
        and m.class_id = due_payments.class_id
    )
  );

drop policy if exists "due_payments_update_own" on public.due_payments;
create policy "due_payments_update_own"
  on public.due_payments for update
  to authenticated
  using (user_id = auth.uid() and status in ('UNPAID', 'PENDING'))
  with check (
    user_id = auth.uid()
    and status in ('UNPAID', 'PENDING')
    and exists (
      select 1 from public.class_members m
      where m.id = due_payments.member_id
        and m.user_id = auth.uid()
        and m.class_id = due_payments.class_id
    )
  );

drop policy if exists "due_payments_update_guru" on public.due_payments;
create policy "due_payments_update_guru"
  on public.due_payments for update
  to authenticated
  using (public.current_user_role() = 'guru')
  with check (public.current_user_role() = 'guru');

drop policy if exists "due_payments_delete_guru" on public.due_payments;
create policy "due_payments_delete_guru"
  on public.due_payments for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, insert, update, delete on public.due_payments to authenticated;

-- Admin menandai lunas / belum lunas secara manual dari tabel checklist.
create or replace function public.admin_mark_due_payment(
  p_due_id uuid,
  p_member_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due public.dues;
  v_member public.class_members;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat mengubah checklist';
  end if;

  select * into v_due from public.dues where id = p_due_id;
  select * into v_member from public.class_members where id = p_member_id;

  if v_due.id is null or v_member.id is null then
    raise exception 'Data iuran atau anggota tidak ditemukan';
  end if;

  if v_due.class_id <> v_member.class_id then
    raise exception 'Iuran dan anggota bukan dari kelas yang sama';
  end if;

  insert into public.due_payments (due_id, class_id, member_id, user_id, status, amount, verified_at)
  values (
    p_due_id, v_due.class_id, p_member_id, v_member.user_id,
    case when p_paid then 'PAID' else 'UNPAID' end,
    v_due.amount,
    case when p_paid then now() else null end
  )
  on conflict (due_id, member_id) do update
    set status = excluded.status,
        amount = excluded.amount,
        verified_at = excluded.verified_at,
        updated_at = now();
end;
$$;

revoke all on function public.admin_mark_due_payment(uuid, uuid, boolean) from public;
grant execute on function public.admin_mark_due_payment(uuid, uuid, boolean) to authenticated;

-- -----------------------------------------------------
-- 10f. Bukti foto pada transfer + tautan ke iuran
-- -----------------------------------------------------
alter table public.transfers add column if not exists member_id uuid references public.class_members(id) on delete set null;
alter table public.transfers add column if not exists due_id uuid references public.dues(id) on delete set null;
alter table public.transfers add column if not exists proof_url text;

create index if not exists transfers_member_idx on public.transfers(member_id);
create index if not exists transfers_due_idx on public.transfers(due_id);

-- Orang tua hanya boleh membaca transfer miliknya; admin melihat semua.
drop policy if exists "transfers_read_authenticated" on public.transfers;
drop policy if exists "transfers_read_own_or_guru" on public.transfers;
create policy "transfers_read_own_or_guru"
  on public.transfers for select
  to authenticated
  using (public.current_user_role() = 'guru' or created_by = auth.uid());

-- Wajib sudah bergabung ke kelas sebelum mengirim transfer.
drop policy if exists "transfers_insert_authenticated" on public.transfers;
create policy "transfers_insert_authenticated"
  on public.transfers for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status = 'PENDING'
    and exists (
      select 1 from public.class_members m
      where m.class_id = transfers.class_id and m.user_id = auth.uid()
    )
    and (
      member_id is null
      or exists (
        select 1 from public.class_members m
        where m.id = transfers.member_id
          and m.user_id = auth.uid()
          and m.class_id = transfers.class_id
      )
    )
    and (
      due_id is null
      or exists (
        select 1 from public.dues d
        where d.id = transfers.due_id and d.class_id = transfers.class_id
      )
    )
  );

-- Verifikasi transfer: status + saldo + riwayat kas + checklist iuran.
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

    if v_transfer.due_id is not null and v_transfer.member_id is not null then
      insert into public.due_payments (due_id, class_id, member_id, user_id, status, amount, proof_url, verified_at)
      select
        v_transfer.due_id, v_transfer.class_id, v_transfer.member_id,
        m.user_id, 'PAID', v_transfer.amount, v_transfer.proof_url, now()
      from public.class_members m
      where m.id = v_transfer.member_id
      on conflict (due_id, member_id) do update
        set status = 'PAID',
            amount = excluded.amount,
            proof_url = coalesce(excluded.proof_url, due_payments.proof_url),
            verified_at = now(),
            updated_at = now();
    end if;
  else
    update public.transfers
    set status = 'REJECTED'
    where id = p_transfer_id;

    if v_transfer.due_id is not null and v_transfer.member_id is not null then
      update public.due_payments
      set status = 'UNPAID', verified_at = null, updated_at = now()
      where due_id = v_transfer.due_id and member_id = v_transfer.member_id;
    end if;
  end if;
end;
$$;

revoke all on function public.review_transfer(uuid, boolean) from public;
grant execute on function public.review_transfer(uuid, boolean) to authenticated;

-- -----------------------------------------------------
-- 10g. Inbox notifikasi orang tua
-- -----------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id text references public.classes(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'info',
  is_read boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_unread_idx on public.notifications(user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'guru');

drop policy if exists "notifications_insert_guru" on public.notifications;
create policy "notifications_insert_guru"
  on public.notifications for insert
  to authenticated
  with check (public.current_user_role() = 'guru');

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete_guru" on public.notifications;
create policy "notifications_delete_guru"
  on public.notifications for delete
  to authenticated
  using (public.current_user_role() = 'guru');

grant select, insert, update, delete on public.notifications to authenticated;

-- Orang tua hanya boleh mengubah status baca, bukan isi pesan.
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Kirim pengumuman manual ke semua anggota kelas.
create or replace function public.notify_class_members(
  p_class_id text,
  p_title text,
  p_body text,
  p_kind text default 'info'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat mengirim notifikasi';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Judul notifikasi wajib diisi';
  end if;

  insert into public.notifications (user_id, class_id, title, body, kind)
  select m.user_id, p_class_id, trim(p_title), coalesce(p_body, ''), coalesce(nullif(p_kind, ''), 'info')
  from public.class_members m
  where m.class_id = p_class_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_class_members(text, text, text, text) from public;
grant execute on function public.notify_class_members(text, text, text, text) to authenticated;

-- Kirim pengingat hanya ke anggota yang belum lunas pada iuran tertentu.
create or replace function public.notify_unpaid_members(
  p_class_id text,
  p_due_id uuid,
  p_title text,
  p_body text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya admin/wali kelas yang dapat mengirim notifikasi';
  end if;

  insert into public.notifications (user_id, class_id, title, body, kind)
  select m.user_id, p_class_id, trim(p_title), coalesce(p_body, ''), 'reminder'
  from public.class_members m
  left join public.due_payments dp
    on dp.due_id = p_due_id and dp.member_id = m.id
  where m.class_id = p_class_id
    and coalesce(dp.status, 'UNPAID') <> 'PAID';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_unpaid_members(text, uuid, text, text) from public;
grant execute on function public.notify_unpaid_members(text, uuid, text, text) to authenticated;

-- -----------------------------------------------------
-- 10h. Storage bukti pembayaran (foto)
-- -----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

drop policy if exists "payment_proofs_insert_authenticated" on storage.objects;
create policy "payment_proofs_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-proofs');

drop policy if exists "payment_proofs_update_authenticated" on storage.objects;
create policy "payment_proofs_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'payment-proofs' and owner = auth.uid())
  with check (bucket_id = 'payment-proofs' and owner = auth.uid());

-- -----------------------------------------------------
-- 10i. Realtime untuk tabel baru
-- -----------------------------------------------------
alter table public.class_members replica identity full;
alter table public.dues replica identity full;
alter table public.due_payments replica identity full;
alter table public.notifications replica identity full;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['class_members', 'dues', 'due_payments', 'notifications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

-- =====================================================
-- 11. SANDI MANAJEMEN KELAS (KHUSUS MANAGER SEKOLAH)
-- =====================================================
-- Database menyimpan hash bcrypt sandi manajemen kelas.
-- Sandi ini dipakai untuk membuka popup "Manajemen Kelas" dari halaman admin.
-- Sandi awal bawaan: Manager123. WAJIB diganti setelah login pertama.

create table if not exists public.class_manager_settings (
  id boolean primary key default true check (id),
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.class_manager_settings enable row level security;
-- Sengaja tidak ada policy. Hanya RPC di bawah yang boleh mengakses tabel ini.

insert into public.class_manager_settings (id, password_hash)
values (true, crypt('Manager123', gen_salt('bf', 10)))
on conflict (id) do nothing;

create or replace function public.verify_class_manager_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_locked_until timestamptz;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya manager/admin sekolah yang dapat membuka manajemen kelas';
  end if;

  select password_hash, locked_until
  into v_hash, v_locked_until
  from public.class_manager_settings
  where id = true;

  if v_hash is null then
    raise exception 'Sandi manajemen belum diatur. Jalankan skema terbaru atau atur lewat SQL.';
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Terlalu banyak percobaan. Coba lagi setelah %', to_char(v_locked_until, 'YYYY-MM-DD HH24:MI:SS');
  end if;

  if crypt(coalesce(p_password, ''), v_hash) = v_hash then
    update public.class_manager_settings
    set failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where id = true;
    return true;
  end if;

  update public.class_manager_settings
  set
    failed_attempts = failed_attempts + 1,
    locked_until = case
      when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
      else locked_until
    end,
    updated_at = now()
  where id = true;

  return false;
end;
$$;

revoke all on function public.verify_class_manager_password(text) from public;
grant execute on function public.verify_class_manager_password(text) to authenticated;

create or replace function public.set_class_manager_password(p_current_password text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if public.current_user_role() is distinct from 'guru' then
    raise exception 'Hanya manager/admin sekolah yang dapat mengganti sandi manajemen';
  end if;

  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'Sandi manajemen baru minimal 8 karakter';
  end if;

  select password_hash into v_hash
  from public.class_manager_settings
  where id = true;

  if v_hash is null then
    raise exception 'Sandi manajemen belum diatur';
  end if;

  if crypt(coalesce(p_current_password, ''), v_hash) <> v_hash then
    raise exception 'Sandi manajemen lama salah';
  end if;

  update public.class_manager_settings
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.set_class_manager_password(text, text) from public;
grant execute on function public.set_class_manager_password(text, text) to authenticated;

