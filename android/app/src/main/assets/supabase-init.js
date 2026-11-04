// =====================================================
// Supabase Configuration & Helper Functions
// EduKas — SMP Masyithoh Kroya
// =====================================================

'use strict';

const EDUKAS_SUPABASE_CONFIG = window.EDUKAS_SUPABASE_CONFIG || {};

const SUPABASE_READY = Boolean(
  EDUKAS_SUPABASE_CONFIG.url &&
  EDUKAS_SUPABASE_CONFIG.anonKey &&
  !EDUKAS_SUPABASE_CONFIG.url.includes('GANTI-') &&
  !EDUKAS_SUPABASE_CONFIG.anonKey.includes('GANTI-')
);

let supabaseClient = null;

if (SUPABASE_READY) {
  // window.supabase adalah library dari CDN @supabase/supabase-js
  supabaseClient = window.supabase.createClient(
    EDUKAS_SUPABASE_CONFIG.url,
    EDUKAS_SUPABASE_CONFIG.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );
} else {
  console.warn('Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.');
}

// =====================================================
// Helper: cek konfigurasi & ambil client
// =====================================================
function isSupabaseConfigured() {
  return SUPABASE_READY && Boolean(supabaseClient);
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase belum dikonfigurasi. Isi url dan anonKey di supabase-config.js.');
  }
  return supabaseClient;
}

// =====================================================
// Helper: Konversi identitas fleksibel ke format email
// (No. HP / Username → tambahkan @edukas.app)
// =====================================================
function normalizeEmail(identity) {
  identity = String(identity || '').trim().toLowerCase();
  // Jika sudah mengandung '@', anggap email asli.
  if (identity.includes('@')) return identity;
  // Nomor HP atau username → konversi ke email internal
  return identity.replace(/[^a-z0-9]/g, '') + '@edukas.app';
}

// =====================================================
// Helper: buat UUID (fallback untuk WebView lama)
// =====================================================
function generateUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

// =====================================================
// Helper: pesan error yang ramah pengguna
// =====================================================
function getAuthErrorMessage(error) {
  const message = String(error?.message || error || 'Terjadi kesalahan.');
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Akun tidak ditemukan atau kata sandi salah. Coba lagi atau pilih "Sign Up".';
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'Akun sudah terdaftar. Silakan pilih "Masuk".';
  }
  if (lower.includes('password should be at least')) {
    return 'Kata sandi terlalu lemah! Minimal 8 karakter.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Cek kotak masuk/spam, lalu login kembali.';
  }
  if (lower.includes('rate limit') || lower.includes('only request this after')) {
    return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Tidak bisa terhubung ke Supabase. Periksa koneksi internet dan konfigurasi.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Akses ditolak oleh aturan database (RLS). Pastikan akun memiliki role yang benar.';
  }

  return 'Error: ' + message;
}

// =====================================================
// Mapping baris database (snake_case) → objek aplikasi (camelCase)
// =====================================================
function mapTransferRow(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    parentName: row.parent_name,
    purpose: row.purpose,
    amount: Number(row.amount) || 0,
    method: row.method,
    note: row.note || '',
    date: row.date_label || 'Baru saja',
    status: row.status
  };
}

function mapClassRow(row, transfers) {
  return {
    id: row.id,
    grade: row.grade,
    name: row.name,
    homeroom: row.homeroom,
    bankName: row.bank_name,
    bankNumber: row.bank_number,
    bankHolder: row.bank_holder,
    balance: Number(row.balance) || 0,
    bills: Array.isArray(row.bills) ? row.bills : [],
    cashHistory: Array.isArray(row.cash_history) ? row.cash_history : [],
    transfers: transfers || []
  };
}

function classToRow(cls) {
  return {
    id: cls.id,
    grade: cls.grade,
    name: cls.name,
    homeroom: cls.homeroom,
    bank_name: cls.bankName,
    bank_number: cls.bankNumber,
    bank_holder: cls.bankHolder,
    balance: Number(cls.balance) || 0,
    bills: cls.bills || [],
    cash_history: cls.cashHistory || [],
    updated_at: new Date().toISOString()
  };
}

// =====================================================
// CRUD Supabase
// =====================================================

// Muat semua kelas + transfer dari Supabase
async function loadAllClasses() {
  const client = requireSupabase();

  const [classesResult, transfersResult] = await Promise.all([
    client.from('classes').select('*').order('id', { ascending: true }),
    client.from('transfers').select('*').order('created_at', { ascending: false })
  ]);

  if (classesResult.error) throw classesResult.error;
  if (transfersResult.error) throw transfersResult.error;

  const transfersByClass = {};
  (transfersResult.data || []).forEach(row => {
    if (!transfersByClass[row.class_id]) transfersByClass[row.class_id] = [];
    transfersByClass[row.class_id].push(mapTransferRow(row));
  });

  return (classesResult.data || []).map(row =>
    mapClassRow(row, transfersByClass[row.id] || [])
  );
}

// Simpan seluruh data kelas (rekening, saldo, iuran, riwayat kas)
async function saveClassToSupabase(cls) {
  const client = requireSupabase();
  const { error } = await client
    .from('classes')
    .upsert(classToRow(cls), { onConflict: 'id' });

  if (error) throw error;
}

// Seed data kelas awal jika tabel masih kosong (dijalankan oleh akun guru)
async function seedClassesIfEmpty(defaultClasses) {
  const client = requireSupabase();

  const { count, error } = await client
    .from('classes')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  if (count && count > 0) return loadAllClasses();

  const classRows = defaultClasses.map(classToRow);
  const { error: classError } = await client.from('classes').insert(classRows);
  if (classError) throw classError;

  const transferRows = [];
  defaultClasses.forEach(cls => {
    (cls.transfers || []).forEach(tf => {
      transferRows.push({
        id: generateUuid(),
        class_id: cls.id,
        student_name: tf.studentName,
        parent_name: tf.parentName || 'Wali Murid',
        purpose: tf.purpose,
        amount: Number(tf.amount) || 0,
        method: tf.method,
        note: tf.note || '',
        date_label: tf.date || 'Baru saja',
        status: tf.status || 'PENDING'
      });
    });
  });

  if (transferRows.length > 0) {
    const { error: transferError } = await client.from('transfers').insert(transferRows);
    if (transferError) console.warn('Seed transfer gagal:', transferError);
  }

  return loadAllClasses();
}

// Baca profil user tanpa membuat profil baru.
async function getMyProfile() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_profile');
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    role: data.role,
    name: data.name,
    childName: data.child_name || '',
    identity: data.identity || ''
  };
}

// Pastikan profil user ada, lalu kembalikan profilnya
async function ensureMyProfile() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('ensure_my_profile');
  if (error) throw error;
  if (!data) return null;

  return {
    role: data.role,
    name: data.name,
    childName: data.child_name || '',
    identity: data.identity || ''
  };
}

// Simpan hash kode pemulihan (kode asli tidak pernah disimpan di database)
async function setMyRecoveryCode(code) {
  const client = requireSupabase();
  const { error } = await client.rpc('set_my_recovery_code', { p_code: code });
  if (error) throw error;
}

// Reset sandi tanpa email: username + kode pemulihan + sandi baru
async function resetPasswordWithRecovery(identity, recoveryCode, newPassword) {
  const client = requireSupabase();
  const { error } = await client.rpc('reset_password_with_recovery', {
    p_identity: identity,
    p_recovery_code: recoveryCode,
    p_new_password: newPassword
  });
  if (error) throw error;
}

// Kirim konfirmasi transfer dari halaman Orang Tua
async function createTransfer(payload) {
  const client = requireSupabase();

  const { data, error } = await client
    .from('transfers')
    .insert({
      class_id: payload.classId,
      student_name: payload.studentName,
      parent_name: payload.parentName || 'Wali Murid',
      purpose: payload.purpose,
      amount: Number(payload.amount) || 0,
      method: payload.method,
      note: payload.note || '',
      date_label: payload.dateLabel || 'Baru saja',
      status: 'PENDING'
    })
    .select()
    .single();

  if (error) throw error;
  return mapTransferRow(data);
}

// Verifikasi transfer oleh guru (atomik: ubah status + saldo + riwayat kas)
async function reviewTransfer(transferId, isApproved) {
  const client = requireSupabase();
  const { error } = await client.rpc('review_transfer', {
    p_transfer_id: transferId,
    p_approve: Boolean(isApproved)
  });

  if (error) throw error;
}

// Real-time listener: kelas & transfer berubah → muat ulang data
function listenToClasses(callback) {
  const client = requireSupabase();
  let refreshTimer = null;

  const refresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        callback(await loadAllClasses());
      } catch (error) {
        console.error('Gagal memuat data real-time:', error);
      }
    }, 200);
  };

  return client
    .channel('edukas-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, refresh)
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('Real-time Supabase terhubung.');
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('Real-time Supabase gagal terhubung. Data tetap tersimpan, tetapi UI tidak otomatis refresh.');
      }
    });
}
