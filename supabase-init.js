// =====================================================
// Supabase Configuration & Helper Functions
// EduKas — SMP Masyithoh Kroya
// =====================================================

'use strict';

const EDUKAS_SUPABASE_CONFIG = window.EDUKAS_SUPABASE_CONFIG || {};

// Cadangan bila Environment Variables berisi URL yang salah
// (mis. masih ada /rest/v1/ atau URL halaman Vercel).
const FALLBACK_SUPABASE_URL = 'https://dphhvssjzsilemepruvp.supabase.co';

function resolveSupabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '');

  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value)) {
    return value;
  }

  console.warn(
    'SUPABASE_URL tidak valid (' + value + '). Memakai URL cadangan: ' + FALLBACK_SUPABASE_URL
  );
  return FALLBACK_SUPABASE_URL;
}

const RESOLVED_SUPABASE_URL = resolveSupabaseUrl(EDUKAS_SUPABASE_CONFIG.url);

const SUPABASE_READY = Boolean(
  RESOLVED_SUPABASE_URL &&
  EDUKAS_SUPABASE_CONFIG.anonKey &&
  !EDUKAS_SUPABASE_CONFIG.anonKey.includes('GANTI-')
);

let supabaseClient = null;

if (SUPABASE_READY) {
  // window.supabase adalah library dari CDN @supabase/supabase-js
  supabaseClient = window.supabase.createClient(
    RESOLVED_SUPABASE_URL,
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
    classId: row.class_id,
    memberId: row.member_id || null,
    dueId: row.due_id || null,
    studentName: row.student_name,
    parentName: row.parent_name,
    purpose: row.purpose,
    amount: Number(row.amount) || 0,
    method: row.method,
    note: row.note || '',
    proofUrl: row.proof_url || '',
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
    hasPassword: Boolean(row.has_password),
    cashPeriod: row.cash_period || 'bulan',
    cashAmount: Number(row.cash_amount) || 0,
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
    cash_period: cls.cashPeriod || 'bulan',
    cash_amount: Number(cls.cashAmount) || 0,
    updated_at: new Date().toISOString()
  };
}

function mapMemberRow(row) {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    studentName: row.student_name,
    parentName: row.parent_name || '',
    createdAt: row.created_at
  };
}

function mapDueRow(row) {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    amount: Number(row.amount) || 0,
    periodType: row.period_type || 'sekali',
    periodLabel: row.period_label || '',
    dueDate: row.due_date || '',
    createdAt: row.created_at
  };
}

function mapDuePaymentRow(row) {
  return {
    id: row.id,
    dueId: row.due_id,
    classId: row.class_id,
    memberId: row.member_id,
    userId: row.user_id,
    status: row.status || 'UNPAID',
    amount: Number(row.amount) || 0,
    proofUrl: row.proof_url || '',
    note: row.note || '',
    verifiedAt: row.verified_at,
    updatedAt: row.updated_at
  };
}

function mapNotificationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    classId: row.class_id || '',
    title: row.title,
    body: row.body || '',
    kind: row.kind || 'info',
    isRead: Boolean(row.is_read),
    createdAt: row.created_at
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

// Muat seluruh data tambahan (anggota, iuran, status bayar, notifikasi)
async function loadAppData(userId) {
  const client = requireSupabase();
  const notificationsQuery = userId
    ? client.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    : client.from('notifications').select('*').order('created_at', { ascending: false });

  const [classes, membersResult, duesResult, paymentsResult, notificationsResult] = await Promise.all([
    loadAllClasses(),
    client.from('class_members').select('*').order('created_at', { ascending: true }),
    client.from('dues').select('*').order('created_at', { ascending: false }),
    client.from('due_payments').select('*').order('created_at', { ascending: false }),
    notificationsQuery
  ]);

  if (membersResult.error) throw membersResult.error;
  if (duesResult.error) throw duesResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  return {
    classes,
    members: (membersResult.data || []).map(mapMemberRow),
    dues: (duesResult.data || []).map(mapDueRow),
    duePayments: (paymentsResult.data || []).map(mapDuePaymentRow),
    notifications: (notificationsResult.data || []).map(mapNotificationRow)
  };
}

// -----------------------------------------------------
// CRUD kelas (admin)
// -----------------------------------------------------
async function createClassWithPassword(payload) {
  const client = requireSupabase();
  const { error } = await client.rpc('create_class_with_password', {
    p_id: payload.id,
    p_grade: payload.grade,
    p_name: payload.name,
    p_homeroom: payload.homeroom,
    p_bank_name: payload.bankName,
    p_bank_number: payload.bankNumber,
    p_bank_holder: payload.bankHolder,
    p_password: payload.password,
    p_cash_period: payload.cashPeriod || 'bulan',
    p_cash_amount: Number(payload.cashAmount) || 0
  });
  if (error) throw error;
}

async function updateClassDetails(payload) {
  const client = requireSupabase();
  const { error } = await client
    .from('classes')
    .update({
      grade: payload.grade,
      name: payload.name,
      homeroom: payload.homeroom,
      bank_name: payload.bankName,
      bank_number: payload.bankNumber,
      bank_holder: payload.bankHolder,
      cash_period: payload.cashPeriod || 'bulan',
      cash_amount: Number(payload.cashAmount) || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.id);
  if (error) throw error;
}

// Edit data inti kelas saja; pengaturan kas tetap berada di halaman kelas.
async function updateClassInfo(payload) {
  const client = requireSupabase();
  const { error } = await client
    .from('classes')
    .update({
      grade: payload.grade,
      name: payload.name,
      homeroom: payload.homeroom,
      bank_name: payload.bankName,
      bank_number: payload.bankNumber,
      bank_holder: payload.bankHolder,
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.id);
  if (error) throw error;
}

async function deleteClassById(classId) {
  const client = requireSupabase();
  const { error } = await client.from('classes').delete().eq('id', classId);
  if (error) throw error;
}

async function setClassPassword(classId, password) {
  const client = requireSupabase();
  const { error } = await client.rpc('set_class_password', {
    p_class_id: classId,
    p_password: password
  });
  if (error) throw error;
}

async function verifyClassManagerPassword(password) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('verify_class_manager_password', {
    p_password: password
  });
  if (error) throw error;
  return Boolean(data);
}

async function setClassManagerPassword(currentPassword, newPassword) {
  const client = requireSupabase();
  const { error } = await client.rpc('set_class_manager_password', {
    p_current_password: currentPassword,
    p_new_password: newPassword
  });
  if (error) throw error;
}

async function joinClassWithPassword(classId, password, studentName) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('join_class_with_password', {
    p_class_id: classId,
    p_password: password,
    p_student_name: studentName
  });
  if (error) throw error;
  return data;
}

// -----------------------------------------------------
// Iuran, checklist, notifikasi
// -----------------------------------------------------
async function createDue(payload) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_due', {
    p_class_id: payload.classId,
    p_title: payload.title,
    p_amount: Number(payload.amount) || 0,
    p_period_type: payload.periodType || 'sekali',
    p_period_label: payload.periodLabel || '',
    p_due_date: payload.dueDate || null
  });
  if (error) throw error;
  return data;
}

async function deleteDueById(dueId) {
  const client = requireSupabase();
  const { error } = await client.from('dues').delete().eq('id', dueId);
  if (error) throw error;
}

async function setDuePaymentPending(payload) {
  const client = requireSupabase();
  const { error } = await client
    .from('due_payments')
    .upsert({
      due_id: payload.dueId,
      class_id: payload.classId,
      member_id: payload.memberId,
      user_id: payload.userId,
      status: 'PENDING',
      amount: Number(payload.amount) || 0,
      proof_url: payload.proofUrl || '',
      note: payload.note || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'due_id,member_id' });
  if (error) throw error;
}

async function adminMarkDuePayment(dueId, memberId, paid) {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_mark_due_payment', {
    p_due_id: dueId,
    p_member_id: memberId,
    p_paid: Boolean(paid)
  });
  if (error) throw error;
}

async function notifyClassMembers(classId, title, body, kind) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('notify_class_members', {
    p_class_id: classId,
    p_title: title,
    p_body: body,
    p_kind: kind || 'info'
  });
  if (error) throw error;
  return Number(data) || 0;
}

async function notifyUnpaidMembers(classId, dueId, title, body) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('notify_unpaid_members', {
    p_class_id: classId,
    p_due_id: dueId,
    p_title: title,
    p_body: body
  });
  if (error) throw error;
  return Number(data) || 0;
}

async function markNotificationRead(notificationId) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

async function markAllNotificationsRead(userId) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

// -----------------------------------------------------
// Upload bukti pembayaran (foto) ke Supabase Storage
// -----------------------------------------------------
async function uploadPaymentProof(file) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user?.id) throw new Error('Sesi login tidak ditemukan.');

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = userData.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;

  const { error } = await client.storage
    .from('payment-proofs')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = client.storage.from('payment-proofs').getPublicUrl(path);
  return { path, url: data.publicUrl };
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
      member_id: payload.memberId || null,
      due_id: payload.dueId || null,
      student_name: payload.studentName,
      parent_name: payload.parentName || 'Wali Murid',
      purpose: payload.purpose,
      amount: Number(payload.amount) || 0,
      method: payload.method,
      note: payload.note || '',
      proof_url: payload.proofUrl || '',
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

// Real-time listener: kelas, transfer, iuran, checklist & notifikasi berubah
// → minta aplikasi memuat ulang data.
function listenToClasses(callback) {
  const client = requireSupabase();
  let refreshTimer = null;

  const tables = ['classes', 'transfers', 'class_members', 'dues', 'due_payments', 'notifications'];

  const refresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Gagal memuat data real-time:', error);
      }
    }, 250);
  };

  let channel = client.channel('edukas-realtime');

  tables.forEach(table => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      refresh
    );
  });

  return channel.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      console.log('Real-time Supabase terhubung.');
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('Real-time Supabase gagal terhubung. Data tetap tersimpan, tetapi UI tidak otomatis refresh.');
    }
  });
}
