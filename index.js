// =====================================================
// Data Default untuk Seed Awal ke Database Supabase
// (Hanya digunakan saat tabel classes masih kosong)
// =====================================================
const DEFAULT_CLASSES = [
  {
    id: 'VII-A',
    grade: 'VII',
    name: 'Kelas VII-A',
    homeroom: 'Dra. Siti Aminah',
    bankName: 'BANK BRI',
    bankNumber: '0029-01-011223-50-1',
    bankHolder: 'Siti Aminah (Wali Kelas VII-A)',
    balance: 0,
    bills: [],
    cashHistory: [],
    hasPassword: false,
    cashPeriod: 'bulanan',
    cashAmount: 0,
    transfers: []
  },
  {
    id: 'VIII-A',
    grade: 'VIII',
    name: 'Kelas VIII-A',
    homeroom: 'Budi Santoso, S.Pd.',
    bankName: 'BANK MANDIRI',
    bankNumber: '139-00-2849102-4',
    bankHolder: 'Budi Santoso (Wali Kelas VIII-A)',
    balance: 0,
    bills: [],
    cashHistory: [],
    hasPassword: false,
    cashPeriod: 'bulanan',
    cashAmount: 0,
    transfers: []
  },
  {
    id: 'IX-A',
    grade: 'IX',
    name: 'Kelas IX-A',
    homeroom: 'H. Rahmat Hidayat, S.Pd.I.',
    bankName: 'BANK BCA',
    bankNumber: '7420-8819-21',
    bankHolder: 'H. Rahmat Hidayat (Wali Kelas IX-A)',
    balance: 0,
    bills: [],
    cashHistory: [],
    hasPassword: false,
    cashPeriod: 'bulanan',
    cashAmount: 0,
    transfers: []
  }
];

// =====================================================
// State Utama Aplikasi EduKas
// (Data kelas akan di-load dari Supabase saat init)
// =====================================================
const state = {
  authRole: 'ortu',
  authMode: 'login',
  currentUser: null,
  selectedClassId: 'VIII-A',
  classes: [...DEFAULT_CLASSES],
  members: [],
  dues: [],
  duePayments: [],
  notifications: [],
  pendingJoinClassId: '',
  proofFile: null,
  proofUrl: '',
  selectedDueId: '',
  supabaseReady: false,
  adminVerified: false,
  adminAttempts: 0,
  pendingRecoveryCode: '',
  recoveryContinueAction: 'classSelect',
  classManagerUnlocked: false,
  joinClassMode: 'join',
  lastActiveView: 'viewClassSelect'
};

// Channel real-time Supabase (dipakai untuk auto-refresh UI)
let realtimeChannel = null;

// Format Rupiah
function formatRp(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

// =====================================================
// Input Rupiah: tampilkan 1.000 / 100.000 / 1.000.000
// =====================================================
function formatRupiahDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseRupiah(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function setRupiahValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const digits = String(value ?? '').replace(/\D/g, '');
  input.value = digits ? formatRupiahDigits(digits) : '';
}

function setupRupiahInputs() {
  document.querySelectorAll('[data-rupiah]').forEach((input) => {
    if (input.dataset.rupiahReady === 'true') return;
    input.dataset.rupiahReady = 'true';

    input.addEventListener('input', () => {
      const caretFromEnd = input.value.length - (input.selectionStart ?? input.value.length);
      input.value = formatRupiahDigits(input.value);

      const position = Math.max(0, input.value.length - caretFromEnd);
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(position, position);
      }
    });

    if (input.value) {
      input.value = formatRupiahDigits(input.value);
    }
  });
}

// =====================================================
// Tampilkan / sembunyikan kata sandi (ikon mata)
// =====================================================
const PASSWORD_EYE_SVG =
  '<svg class="icon-eye" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

const PASSWORD_EYE_OFF_SVG =
  '<svg class="icon-eye-off" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.8 20.8 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.8 20.8 0 0 1-3.16 4.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';

  if (button) {
    button.classList.toggle('is-visible', show);
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  }

  input.focus({ preventScroll: true });
}

function setupPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.passwordToggleReady === 'true') return;
    input.dataset.passwordToggleReady = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-toggle';
    button.setAttribute('aria-label', 'Tampilkan kata sandi');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = PASSWORD_EYE_SVG + PASSWORD_EYE_OFF_SVG;
    button.addEventListener('click', () => togglePasswordVisibility(input.id, button));
    wrapper.appendChild(button);
  });
}

// =====================================================
// Label periode & helper data
// =====================================================
const PERIOD_LABELS = {
  harian: 'hari',
  mingguan: 'minggu',
  bulanan: 'bulan',
  kuartalan: 'kuartal',
  semesteran: 'semester',
  tahunan: 'tahun',
  sekali: 'sekali bayar'
};

function periodTypeLabel(type) {
  return PERIOD_LABELS[type] || type || 'periode';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMyMember(classId) {
  if (!state.currentUser?.uid) return null;
  return state.members.find(
    member => member.classId === classId && member.userId === state.currentUser.uid
  ) || null;
}

function getClassMembers(classId) {
  return state.members.filter(member => member.classId === classId);
}

function getClassDues(classId) {
  return state.dues.filter(due => due.classId === classId);
}

function getDuePayment(dueId, memberId) {
  if (!memberId) return null;
  return state.duePayments.find(payment => payment.dueId === dueId && payment.memberId === memberId) || null;
}

function buildClassId(grade, name) {
  const suffix = String(name || '')
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return suffix || (grade + '-' + Date.now());
}

// Notifikasi Toast
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// Navigasi Antar View Utama
function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Ambil Data Kelas Aktif
function getActiveClass() {
  return state.classes.find(c => c.id === state.selectedClassId) || state.classes[0];
}

// =========================================================
// 1. LOGIKA LOGIN, DAFTAR, ADMIN GATE & KATA SANDI
// =========================================================
function setAuthMode(mode) {
  state.authMode = mode === 'register' ? 'register' : 'login';
  const isReg = state.authMode === 'register';

  document.getElementById('authFormTitle').textContent = isReg ? 'Daftar Akun Baru' : 'Masuk ke Akun';
  document.getElementById('authFormSubtitle').textContent = isReg
    ? 'Daftar sebagai orang tua/wali. Akun admin hanya dibuat oleh pengelola sekolah.'
    : 'Gunakan username, nomor HP, atau email yang terdaftar.';

  document.getElementById('regNameGroup').classList.toggle('hidden', !isReg);
  document.getElementById('regChildGroup').classList.toggle('hidden', !isReg);
  document.getElementById('regConfirmPasswordGroup').classList.toggle('hidden', !isReg);

  const submitBtn = document.getElementById('authSubmitBtn');
  submitBtn.textContent = isReg ? 'Daftar Akun →' : 'Masuk →';
  submitBtn.className = 'glass-btn full-width ' + (isReg ? 'btn-primary-guru' : 'btn-primary-ortu');

  document.getElementById('authSwitchPrompt').textContent = isReg
    ? 'Sudah punya akun?'
    : 'Belum punya akun?';
  document.getElementById('authSwitchBtn').textContent = isReg ? 'Masuk' : 'Sign Up';

  document.getElementById('authPassword').setAttribute(
    'autocomplete',
    isReg ? 'new-password' : 'current-password'
  );

  if (!isReg) {
    document.getElementById('regConfirmPassword').value = '';
  }
}

function toggleAuthMode() {
  setAuthMode(state.authMode === 'login' ? 'register' : 'login');
}

function updateAuthFormUI() {
  setAuthMode(state.authMode);
}

function backToLogin() {
  setAuthMode('login');
  showView('viewAuth');
}


// =====================================================
// Helper: muat data & real-time Supabase
// =====================================================
async function loadDataFromSupabase() {
  try {
    let classes = await loadAllClasses();

    // Jika tabel masih kosong dan user adalah guru, seed data awal.
    if (classes.length === 0 && state.currentUser?.role === 'guru') {
      classes = await seedClassesIfEmpty(DEFAULT_CLASSES);
    }

    const data = await loadAppData(state.currentUser?.uid);
    applyAppData(data);

    if (state.classes.length === 0) {
      state.classes = [...DEFAULT_CLASSES];
      state.supabaseReady = false;
      showToast('Tabel classes masih kosong. Jalankan seed data di supabase-schema.sql.');
    } else {
      state.supabaseReady = true;
    }

    console.log('✅ Data dimuat dari Supabase:', state.classes.length, 'kelas,', state.members.length, 'anggota,', state.dues.length, 'iuran');
    return state.classes;
  } catch (error) {
    console.error('❌ Gagal memuat data Supabase:', error);
    state.classes = [...DEFAULT_CLASSES];
    state.members = [];
    state.dues = [];
    state.duePayments = [];
    state.notifications = [];
    state.supabaseReady = false;
    showToast('Gagal memuat Supabase: ' + error.message);
    return state.classes;
  }
}

function applyAppData(data) {
  state.classes = data.classes || [];
  state.members = data.members || [];
  state.dues = data.dues || [];
  state.duePayments = data.duePayments || [];
  state.notifications = data.notifications || [];

  if (state.classes.length > 0 && !state.classes.some(cls => cls.id === state.selectedClassId)) {
    state.selectedClassId = state.classes[0].id;
  }

  if (!state.selectedDueId || !state.dues.some(due => due.id === state.selectedDueId)) {
    const classDues = getClassDues(state.selectedClassId);
    state.selectedDueId = classDues[0]?.id || '';
  }
}

async function refreshAllData() {
  if (!isSupabaseConfigured()) return;
  const data = await loadAppData(state.currentUser?.uid);
  applyAppData(data);
  rerenderActiveView();
}

function rerenderActiveView() {
  const activeView = document.querySelector('.view-section.active');
  if (!activeView) return;

  if (activeView.id === 'viewGuru') {
    renderGuruDashboard();
  } else if (activeView.id === 'viewOrtu') {
    renderOrtuPortal();
  } else if (activeView.id === 'viewClassSelect') {
    renderClassCards();
  }
}

async function refreshClassesFromSupabase() {
  await refreshAllData();
  return state.classes;
}

function startRealtimeListener() {
  if (realtimeChannel || !isSupabaseConfigured()) return;

  try {
    realtimeChannel = listenToClasses(async () => {
      await refreshAllData();
    });
  } catch (error) {
    console.error('Listener error:', error);
  }
}

function stopRealtimeListener() {
  if (realtimeChannel && supabaseClient) {
    supabaseClient.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

function requireWritableSession() {
  if (!isSupabaseConfigured()) {
    showToast('Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.');
    return false;
  }
  if (!state.currentUser?.uid) {
    showToast('Login terlebih dahulu agar data tersimpan ke Supabase.');
    setAuthMode('login');
    showView('viewAuth');
    return false;
  }
  if (state.currentUser.role === 'guru' && !state.adminVerified) {
    showToast('Akses admin belum terverifikasi. Masukkan kunci izin admin.');
    showAdminKeyView();
    return false;
  }
  return true;
}

// =====================================================
// Login / Register menggunakan Supabase Authentication
// =====================================================
async function handleAuthSubmit(e) {
  e.preventDefault();

  if (!isSupabaseConfigured()) {
    showToast('Supabase belum dikonfigurasi. Isi url dan anonKey di supabase-config.js.');
    return;
  }

  const isReg = state.authMode === 'register';
  const identity = document.getElementById('authIdentity').value.trim();
  const password = document.getElementById('authPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const fullName = document.getElementById('regFullName').value.trim();
  const childName = document.getElementById('regChildName').value.trim();

  if (!identity || !password) {
    showToast('Mohon isi username dan kata sandi!');
    return;
  }

  if (isReg) {
    const normalizedUsername = identity.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['admin', 'administrator', 'adminsekolah'].includes(normalizedUsername)) {
      showToast('Username ini dikhususkan untuk admin sekolah. Gunakan username lain.');
      return;
    }

    if (fullName.length < 2) {
      showToast('Nama lengkap wajib diisi!');
      return;
    }
    if (password.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter!');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Ulangi kata sandi belum sama!');
      return;
    }
  }

  const email = normalizeEmail(identity);
  const submitBtn = document.getElementById('authSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Memproses...';
  submitBtn.disabled = true;

  try {
    if (isReg) {
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            role: 'ortu',
            name: fullName,
            child_name: childName,
            identity: identity
          }
        }
      });

      if (error) throw error;

      if (!data.session) {
        showToast('Registrasi berhasil! Cek email untuk konfirmasi, lalu login.');
        setAuthMode('login');
        return;
      }

      const profile = await getMyProfile();
      if (!profile) {
        await supabaseClient.auth.signOut();
        throw new Error('Profil akun belum terbentuk. Jalankan ulang supabase-schema.sql lalu coba lagi.');
      }

      state.currentUser = {
        uid: data.user.id,
        role: profile.role,
        identity: profile.identity || identity,
        name: profile.name || fullName,
        childName: profile.childName || childName
      };
      state.authRole = profile.role;
      state.adminVerified = false;

      const recoveryCode = generateRecoveryCode();
      try {
        await setMyRecoveryCode(recoveryCode);
      } catch (recoveryError) {
        console.error('Gagal menyimpan kode pemulihan:', recoveryError);
        showToast('Akun dibuat, tetapi kode pemulihan gagal disimpan. Buka Ganti Sandi setelah login untuk membuatnya.');
        setAuthMode('login');
        await enterApp();
        return;
      }

      setAuthMode('login');
      showRecoveryCodeView(recoveryCode, 'classSelect');
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    const profile = await getMyProfile();
    if (!profile) {
      await supabaseClient.auth.signOut();
      showToast('Akun belum terdaftar di database. Silakan login ulang atau hubungi admin sekolah.');
      return;
    }

    state.currentUser = {
      uid: data.user.id,
      role: profile.role,
      identity: profile.identity || identity,
      name: profile.name || 'User',
      childName: profile.childName || ''
    };
    state.authRole = profile.role;
    state.adminVerified = profile.role !== 'guru';

    // Admin wajib melewati langkah 2: kunci izin admin.
    if (profile.role === 'guru') {
      showAdminKeyView();
      showToast('Langkah 2: masukkan kunci izin admin.');
      return;
    }

    await enterApp();
    showToast('Berhasil masuk. Silakan pilih kelas.');
  } catch (error) {
    console.error('Auth error:', error);
    showToast(getAuthErrorMessage(error));
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// Setelah login/daftar berhasil, muat data lalu masuk ke pemilihan kelas.
async function enterApp() {
  await loadDataFromSupabase();
  startRealtimeListener();
  goToClassSelect();
}

// =====================================================
// KODE PEMULIHAN
// =====================================================
function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(16);

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let raw = '';
  for (let i = 0; i < bytes.length; i += 1) {
    raw += alphabet[bytes[i] % alphabet.length];
  }

  return raw.match(/.{1,4}/g).join('-');
}

// Terima kode pemulihan dengan/tanpa tanda hubung dan huruf kecil.
function normalizeRecoveryCodeInput(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (raw.length === 16) {
    return raw.match(/.{1,4}/g).join('-');
  }

  return raw;
}

function showRecoveryCodeView(code, nextAction) {
  state.pendingRecoveryCode = code;
  state.recoveryContinueAction = nextAction || 'classSelect';
  document.getElementById('recoveryCodeDisplay').textContent = code;
  showView('viewRecoveryCode');
}

function finishRecoveryCode() {
  const nextAction = state.recoveryContinueAction;
  state.pendingRecoveryCode = '';

  if (nextAction === 'dashboard') {
    if (state.authRole === 'guru') {
      if (!state.adminVerified) {
        showAdminKeyView();
        return;
      }
      renderGuruDashboard();
      showView('viewGuru');
    } else {
      renderOrtuPortal();
      switchOrtuTab('dashboard');
      showView('viewOrtu');
    }
    return;
  }

  enterApp();
}

function copyRecoveryCode() {
  const code = state.pendingRecoveryCode;
  if (!code) return;

  navigator.clipboard?.writeText(code);
  showToast('Kode pemulihan disalin. Simpan di tempat aman!');
}

async function createNewRecoveryCode() {
  if (!requireWritableSession()) return;

  const code = generateRecoveryCode();

  try {
    await setMyRecoveryCode(code);
    showRecoveryCodeView(code, 'dashboard');
    showToast('Kode pemulihan baru dibuat. Kode lama tidak berlaku lagi.');
  } catch (error) {
    console.error('Gagal membuat kode pemulihan:', error);
    showToast('Gagal membuat kode pemulihan: ' + error.message);
  }
}

// =====================================================
// VERIFIKASI KUNCI IZIN ADMIN (AES-256-GCM)
// =====================================================
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyAdminAccessKey(input) {
  const gate = window.EDUKAS_SUPABASE_CONFIG?.adminGate;

  if (!gate || !window.crypto?.subtle) {
    throw new Error('Verifikasi aman tidak didukung di perangkat ini. Gunakan browser modern atau hubungi pengelola.');
  }

  const encoder = new TextEncoder();
  const salt = base64ToBytes(gate.salt);
  const iterations = Number(gate.iterations) || 210000;

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(input),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256
  );

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = base64ToBytes(gate.iv);
  const tag = base64ToBytes(gate.tag);
  const data = base64ToBytes(gate.data);
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      combined
    );

    return new TextDecoder().decode(decrypted) === 'EDUKAS_ADMIN_ACCESS_OK_V1';
  } catch (error) {
    // GCM authentication gagal = kunci salah. Jangan bocorkan detail.
    return false;
  }
}

function showAdminKeyView() {
  if (state.authRole !== 'guru') {
    goToClassSelect();
    return;
  }

  state.adminVerified = false;
  state.adminAttempts = 0;

  const input = document.getElementById('adminAccessKey');
  const submitBtn = document.getElementById('adminKeySubmitBtn');
  const gateReady = Boolean(window.EDUKAS_SUPABASE_CONFIG?.adminGate);

  input.value = '';
  submitBtn.disabled = !gateReady;
  showView('viewAdminKey');

  if (!gateReady) {
    showToast('Kunci izin admin belum diatur. Isi ADMIN_ACCESS_KEY lalu build ulang.');
  } else {
    setTimeout(() => input.focus(), 80);
  }
}

async function handleAdminKeySubmit(e) {
  e.preventDefault();

  const input = document.getElementById('adminAccessKey');
  const submitBtn = document.getElementById('adminKeySubmitBtn');
  const key = input.value;

  if (!key) {
    showToast('Masukkan kunci izin admin!');
    return;
  }

  if (!window.EDUKAS_SUPABASE_CONFIG?.adminGate) {
    showToast('Kunci izin admin belum diatur di Environment Variables.');
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Memverifikasi...';
  submitBtn.disabled = true;

  try {
    const isValid = await verifyAdminAccessKey(key);

    if (isValid) {
      state.adminVerified = true;
      state.adminAttempts = 0;
      input.value = '';
      await enterApp();
      showToast('Akses admin terverifikasi. Selamat bekerja!');
      return;
    }

    state.adminAttempts += 1;

    if (state.adminAttempts >= 3) {
      showToast('Kunci izin salah 3 kali. Sesi diakhiri demi keamanan.');
      await logout();
      return;
    }

    showToast(`Kunci izin salah. Sisa percobaan ${3 - state.adminAttempts}.`);
    input.select();
  } catch (error) {
    console.error('Verifikasi admin error:', error);
    showToast('Gagal memverifikasi: ' + error.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = !window.EDUKAS_SUPABASE_CONFIG?.adminGate;
  }
}

// =====================================================
// LUPA & GANTI KATA SANDI
// =====================================================
function openForgotPassword() {
  document.getElementById('forgotIdentity').value = document.getElementById('authIdentity').value.trim();
  document.getElementById('forgotRecoveryCode').value = '';
  document.getElementById('forgotNewPassword').value = '';
  document.getElementById('forgotConfirmPassword').value = '';
  showView('viewForgotPassword');
}

async function handleForgotPassword(e) {
  e.preventDefault();

  if (!isSupabaseConfigured()) {
    showToast('Supabase belum dikonfigurasi.');
    return;
  }

  const identity = document.getElementById('forgotIdentity').value.trim();
  const recoveryCode = normalizeRecoveryCodeInput(document.getElementById('forgotRecoveryCode').value);
  const newPassword = document.getElementById('forgotNewPassword').value;
  const confirmPassword = document.getElementById('forgotConfirmPassword').value;
  const submitBtn = document.getElementById('forgotSubmitBtn');

  if (!identity || !recoveryCode) {
    showToast('Username dan kode pemulihan wajib diisi!');
    return;
  }
  if (newPassword.length < 8) {
    showToast('Kata sandi baru minimal 8 karakter!');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Ulangi kata sandi baru belum sama!');
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Menyimpan...';
  submitBtn.disabled = true;

  try {
    await resetPasswordWithRecovery(identity, recoveryCode, newPassword);
    document.getElementById('forgotRecoveryCode').value = '';
    document.getElementById('forgotNewPassword').value = '';
    document.getElementById('forgotConfirmPassword').value = '';
    setAuthMode('login');
    showView('viewAuth');
    showToast('Kata sandi berhasil diganti. Silakan login dengan sandi baru.');
  } catch (error) {
    console.error('Reset sandi error:', error);
    showToast(error.message || 'Gagal mengganti kata sandi.');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function openChangePassword() {
  if (!state.currentUser?.uid) {
    showToast('Silakan login terlebih dahulu.');
    setAuthMode('login');
    showView('viewAuth');
    return;
  }

  if (state.authRole === 'guru' && !state.adminVerified) {
    showToast('Verifikasi kunci izin admin terlebih dahulu.');
    showAdminKeyView();
    return;
  }

  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
  showView('viewChangePassword');
}

async function handleChangePassword(e) {
  e.preventDefault();

  if (!isSupabaseConfigured() || !state.currentUser?.uid) {
    showToast('Sesi login tidak ditemukan. Silakan login ulang.');
    return;
  }

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  const submitBtn = document.getElementById('changePasswordSubmitBtn');

  if (!currentPassword) {
    showToast('Masukkan kata sandi lama!');
    return;
  }
  if (newPassword.length < 8) {
    showToast('Kata sandi baru minimal 8 karakter!');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Ulangi kata sandi baru belum sama!');
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Menyimpan...';
  submitBtn.disabled = true;

  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!userData.user?.email) throw new Error('Email akun tidak ditemukan.');

    const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword
    });
    if (verifyError) throw new Error('Kata sandi lama salah.');

    const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;

    showToast('Kata sandi berhasil diganti.');
    backFromChangePassword();
  } catch (error) {
    console.error('Ganti sandi error:', error);
    showToast(error.message || 'Gagal mengganti kata sandi.');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function backFromChangePassword() {
  if (state.authRole === 'guru') {
    if (!state.adminVerified) {
      showAdminKeyView();
      return;
    }
    renderGuruDashboard();
    showView('viewGuru');
  } else if (state.currentUser?.uid) {
    renderOrtuPortal();
    switchOrtuTab('dashboard');
    showView('viewOrtu');
  } else {
    backToLogin();
  }
}


// Logout — hapus sesi Supabase Auth dan seluruh status keamanan
async function logout() {
  stopRealtimeListener();

  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
    }
  } catch (error) {
    console.error('Logout error:', error);
  }

  state.currentUser = null;
  state.supabaseReady = false;
  state.authRole = 'ortu';
  state.adminVerified = false;
  state.adminAttempts = 0;
  state.pendingRecoveryCode = '';
  state.recoveryContinueAction = 'classSelect';
  state.members = [];
  state.dues = [];
  state.duePayments = [];
  state.notifications = [];
  state.selectedDueId = '';
  state.pendingJoinClassId = '';
  state.classManagerUnlocked = false;
  clearProofFile();
  closeJoinClassModal();
  closeInbox();
  closeClassManagerModal();
  setAuthMode('login');

  const form = document.getElementById('authForm');
  if (form) {
    form.reset();
    setAuthMode('login');
  }

  document.getElementById('authPassword').value = '';
  showView('viewAuth');
}

// =========================================================
// 2. LOGIKA PEMILIHAN KELAS (SEBELUM MASUK DASHBOARD)
// =========================================================
function goToClassSelect() {
  if (!state.currentUser?.uid) {
    showToast('Silakan login terlebih dahulu.');
    setAuthMode('login');
    showView('viewAuth');
    return;
  }

  if (state.currentUser.role === 'guru' && !state.adminVerified) {
    showAdminKeyView();
    return;
  }

  const badge = document.getElementById('classSelectRoleBadge');
  const greeting = document.getElementById('classSelectGreeting');

  if (state.authRole === 'guru') {
    badge.className = 'badge badge-indigo';
    badge.textContent = 'ADMIN • WALI KELAS';
    greeting.textContent = 'Pilih Kelas yang Anda Ampu';
  } else {
    badge.className = 'badge badge-emerald';
    badge.textContent = 'ORANG TUA / WALI MURID';
    greeting.textContent = 'Pilih Kelas Anak Anda';
  }

  renderClassCards();
  showView('viewClassSelect');
}

function renderClassCards() {
  const query = document.getElementById('searchClassInput').value.toLowerCase();
  const grade = document.getElementById('gradeFilterSelect').value;
  const container = document.getElementById('classGridContainer');

  const filtered = state.classes.filter(cls => {
    const matchGrade = grade === 'ALL' || cls.grade === grade;
    const matchText =
      String(cls.name || '').toLowerCase().includes(query) ||
      String(cls.homeroom || '').toLowerCase().includes(query);
    return matchGrade && matchText;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="glass-card"><p class="section-desc">Belum ada kelas yang cocok. Admin dapat menambahkan kelas baru dari dashboard.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(cls => {
    const member = state.authRole === 'ortu' ? getMyMember(cls.id) : null;
    const joined = Boolean(member);
    const passwordBadge = cls.hasPassword
      ? `<span class="badge badge-emerald">🔐 Bersandi</span>`
      : `<span class="badge badge-amber">⚠️ Sandi belum diatur</span>`;
    const joinBadge = state.authRole === 'ortu' && joined
      ? `<span class="badge badge-cyan">✅ Sudah bergabung</span>`
      : '';

    let actionLabel = 'Masuk ke ' + escapeHtml(cls.name) + ' →';
    if (state.authRole === 'ortu') {
      if (joined || cls.hasPassword) {
        actionLabel = 'Masukkan Sandi & Buka →';
      } else {
        actionLabel = 'Sandi Belum Diatur — Hubungi Admin';
      }
    }

    return `
      <div class="glass-card class-card" onclick="selectClassAndEnter('${escapeHtml(cls.id)}')">
        <div class="class-card-top">
          <span class="class-name">${escapeHtml(cls.name)}</span>
          <span class="badge ${state.authRole === 'guru' ? 'badge-indigo' : 'badge-emerald'}">Tingkat ${escapeHtml(cls.grade)}</span>
        </div>
        <div class="class-meta">
          <div>👨‍🏫 <strong>Wali Kelas:</strong> ${escapeHtml(cls.homeroom)}</div>
          <div>🏦 <strong>Rekening:</strong> ${escapeHtml(cls.bankName)} (${escapeHtml(cls.bankNumber)})</div>
          <div>💰 <strong>Saldo Kas:</strong> ${formatRp(cls.balance)}</div>
          <div>📅 <strong>Kas:</strong> ${formatRp(cls.cashAmount)} / ${periodTypeLabel(cls.cashPeriod)}</div>
        </div>
        <div class="class-badges">${passwordBadge}${joinBadge}</div>
        <button type="button" class="glass-btn ${state.authRole === 'guru' ? 'btn-primary-guru' : 'btn-primary-ortu'} full-width">
          ${actionLabel}
        </button>
      </div>
    `;
  }).join('');

  // Tombol Manajemen Kelas hanya untuk guru, diletakkan di luar halaman kelas (halaman pemilihan kelas).
  const btnMgr = document.getElementById('btnClassManager');
  if (btnMgr) {
    btnMgr.style.display = state.authRole === 'guru' ? 'inline-block' : 'none';
  }
}

function selectClassAndEnter(classId) {
  if (!state.currentUser?.uid) {
    showToast('Silakan login terlebih dahulu.');
    setAuthMode('login');
    showView('viewAuth');
    return;
  }

  if (state.currentUser.role === 'guru' && !state.adminVerified) {
    showToast('Akses admin belum terverifikasi.');
    showAdminKeyView();
    return;
  }

  const cls = state.classes.find(item => item.id === classId);
  if (!cls) {
    showToast('Kelas tidak ditemukan.');
    return;
  }

  if (state.authRole === 'ortu') {
    // Orang tua wajib memasukkan sandi kelas setiap kali membuka kelas.
    const member = getMyMember(classId);
    state.currentUser.childName = member?.studentName || state.currentUser.childName;
    openJoinClassModal(classId);
    return;
  }

  state.selectedClassId = classId;
  state.selectedDueId = getClassDues(classId)[0]?.id || '';

  if (state.authRole === 'guru') {
    renderGuruDashboard();
    showView('viewGuru');
  } else {
    renderOrtuPortal();
    switchOrtuTab('dashboard');
    showView('viewOrtu');
  }
}

// =========================================================
// MODAL SANDI KELAS (ORANG TUA)
// =========================================================
function openJoinClassModal(classId) {
  const cls = state.classes.find(item => item.id === classId);
  if (!cls) return;

  if (!cls.hasPassword) {
    showToast('Kelas ini belum memiliki sandi. Hubungi admin/wali kelas terlebih dahulu.');
    return;
  }

  const member = getMyMember(classId);
  const isUnlockMode = Boolean(member);
  const studentGroup = document.getElementById('joinStudentGroup');
  const studentInput = document.getElementById('joinStudentName');
  const title = document.getElementById('joinClassTitle');
  const submitBtn = document.getElementById('joinClassSubmit');

  state.pendingJoinClassId = classId;
  state.joinClassMode = isUnlockMode ? 'unlock' : 'join';

  studentGroup.classList.toggle('hidden', isUnlockMode);
  studentInput.required = !isUnlockMode;
  studentInput.value = member?.studentName || state.currentUser?.childName || '';

  if (isUnlockMode) {
    title.textContent = '🔐 Buka Kelas';
    document.getElementById('joinClassDesc').innerHTML =
      'Masukkan sandi untuk membuka <strong>' + escapeHtml(cls.name) +
      '</strong>. Sandi diminta setiap kali membuka kelas.';
    submitBtn.textContent = 'Buka Kelas →';
  } else {
    title.textContent = '🔐 Gabung Kelas';
    document.getElementById('joinClassDesc').innerHTML =
      'Masukkan nama siswa dan sandi untuk bergabung ke <strong>' + escapeHtml(cls.name) + '</strong>.';
    submitBtn.textContent = 'Gabung Kelas →';
  }

  document.getElementById('joinClassPassword').value = '';
  document.getElementById('joinClassModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('joinClassPassword').focus(), 60);
}

function closeJoinClassModal() {
  state.pendingJoinClassId = '';
  state.joinClassMode = 'join';
  document.getElementById('joinClassModal').classList.add('hidden');
}

async function handleJoinClass(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const classId = state.pendingJoinClassId;
  const studentInput = document.getElementById('joinStudentName');
  const password = document.getElementById('joinClassPassword').value;
  const submitBtn = document.getElementById('joinClassSubmit');
  const isUnlockMode = state.joinClassMode === 'unlock';
  const member = classId ? getMyMember(classId) : null;

  if (!classId) {
    showToast('Pilih kelas terlebih dahulu.');
    return;
  }

  const studentName = isUnlockMode ? (member?.studentName || '') : studentInput.value.trim();

  if (!isUnlockMode && studentName.length < 2) {
    showToast('Nama siswa wajib diisi minimal 2 karakter.');
    return;
  }
  if (!password) {
    showToast('Masukkan sandi kelas.');
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Memeriksa sandi...';
  submitBtn.disabled = true;

  try {
    await joinClassWithPassword(classId, password, studentName);
    await refreshAllData();

    const joinedMember = getMyMember(classId);
    if (joinedMember) state.currentUser.childName = joinedMember.studentName;

    state.selectedClassId = classId;
    state.selectedDueId = getClassDues(classId)[0]?.id || '';
    closeJoinClassModal();
    renderOrtuPortal();
    switchOrtuTab('dashboard');
    showView('viewOrtu');
    showToast(isUnlockMode ? 'Sandi benar. Kelas berhasil dibuka.' : 'Berhasil bergabung ke kelas. Data Anda sudah masuk ke tabel admin.');
  } catch (error) {
    console.error('Gagal membuka/bergabung kelas:', error);
    showToast('Gagal membuka kelas: ' + (error.message || 'Sandi kelas salah.'));
    document.getElementById('joinClassPassword').select();
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// =========================================================
// MANAJEMEN KELAS (POPUP DI LUAR HALAMAN KELAS)
// =========================================================
function openClassManagerModal() {
  if (state.currentUser?.role !== 'guru' || !state.adminVerified) {
    showToast('Manajemen kelas hanya untuk admin/manager sekolah.');
    return;
  }

  state.classManagerUnlocked = false;
  showClassManagerGate();
  document.getElementById('classManagerModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('classManagerPassword').focus(), 60);
}

function closeClassManagerModal() {
  state.classManagerUnlocked = false;
  cancelEditClass();
  document.getElementById('classManagerModal').classList.add('hidden');
  document.getElementById('classManagerPassword').value = '';
}

function showClassManagerGate() {
  document.getElementById('classManagerGate').classList.remove('hidden');
  document.getElementById('classManagerPanel').classList.add('hidden');
}

function showClassManagerPanel() {
  state.classManagerUnlocked = true;
  document.getElementById('classManagerGate').classList.add('hidden');
  document.getElementById('classManagerPanel').classList.remove('hidden');
  document.getElementById('classManagerPassword').value = '';
  renderClassManagement();
}

function lockClassManager() {
  state.classManagerUnlocked = false;
  cancelEditClass();
  showClassManagerGate();
}

async function handleClassManagerUnlock(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const input = document.getElementById('classManagerPassword');
  const submitBtn = document.getElementById('classManagerUnlockBtn');
  const password = input.value;

  if (!password || password.length < 8) {
    showToast('Sandi manajemen minimal 8 karakter.');
    return;
  }

  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Memeriksa...';
  submitBtn.disabled = true;

  try {
    const isValid = await verifyClassManagerPassword(password);
    if (isValid) {
      showClassManagerPanel();
      showToast('Manajemen kelas berhasil dibuka.');
      return;
    }

    showToast('Sandi manajemen salah.');
    input.select();
  } catch (error) {
    console.error('Gagal membuka manajemen kelas:', error);
    showToast(error.message || 'Gagal memverifikasi sandi manajemen.');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function handleClassManagerPasswordChange(e) {
  e.preventDefault();
  if (!state.classManagerUnlocked || !requireWritableSession()) return;

  const currentPassword = document.getElementById('classManagerCurrentPassword').value;
  const newPassword = document.getElementById('classManagerNewPassword').value;
  const confirmPassword = document.getElementById('classManagerConfirmPassword').value;

  if (newPassword.length < 8) {
    showToast('Sandi manajemen baru minimal 8 karakter.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Ulangi sandi manajemen baru belum sama.');
    return;
  }

  try {
    await setClassManagerPassword(currentPassword, newPassword);
    document.getElementById('classManagerCurrentPassword').value = '';
    document.getElementById('classManagerNewPassword').value = '';
    document.getElementById('classManagerConfirmPassword').value = '';
    lockClassManager();
    showToast('Sandi manajemen berhasil diganti. Popup dikunci kembali.');
  } catch (error) {
    console.error('Gagal mengganti sandi manajemen:', error);
    showToast('Gagal mengganti sandi manajemen: ' + error.message);
    document.getElementById('classManagerCurrentPassword').select();
  }
}

// =========================================================
// 3. LOGIKA PORTAL GURU / WALI KELAS (ADMIN)
// =========================================================
function renderGuruDashboard() {
  if (state.currentUser?.role === 'guru' && !state.adminVerified) {
    showAdminKeyView();
    return;
  }

  const cls = getActiveClass();
  if (!cls) {
    showToast('Belum ada kelas. Tambahkan kelas baru dari dashboard admin.');
    return;
  }

  const pendingTransfers = cls.transfers.filter(t => t.status === 'PENDING');

  document.getElementById('guruClassTitle').textContent = cls.name;
  document.getElementById('guruTeacherLabel').textContent = 'Wali Kelas: ' + cls.homeroom;
  document.getElementById('guruCashPeriodInfo').textContent =
    'Kas kelas: ' + formatRp(cls.cashAmount || 0) + ' / ' + periodTypeLabel(cls.cashPeriod);
  document.getElementById('guruStatBalance').textContent = formatRp(cls.balance);
  document.getElementById('guruStatPending').textContent = pendingTransfers.length + ' Kiriman';
  document.getElementById('guruStatBank').textContent = cls.bankName + ' • ' + cls.bankNumber;
  document.getElementById('guruStatHolder').textContent = 'a.n. ' + cls.bankHolder;

  // Isi Form Edit Rekening
  document.getElementById('inputBankName').value = cls.bankName;
  document.getElementById('inputBankNumber').value = cls.bankNumber;
  document.getElementById('inputBankHolder').value = cls.bankHolder;

  // Render Antrean Verifikasi Transfer
  document.getElementById('pendingCountBadge').textContent = pendingTransfers.length + ' Menunggu';
  const pendingContainer = document.getElementById('guruPendingList');

  if (pendingTransfers.length === 0) {
    pendingContainer.innerHTML = `<div class="glass-item"><span>Belum ada kiriman transfer baru yang menunggu verifikasi.</span></div>`;
  } else {
    pendingContainer.innerHTML = pendingTransfers.map(tf => `
      <div class="glass-item">
        <div>
          <strong>${escapeHtml(tf.studentName)} — ${formatRp(tf.amount)}</strong>
          <div style="font-size:0.8rem; color:#cbd5e1;">${escapeHtml(tf.purpose)} • Via ${escapeHtml(tf.method)}</div>
          <small style="color:#94a3b8;">Catatan: "${escapeHtml(tf.note)}" (${escapeHtml(tf.date)})</small>
          <div class="proof-link-row">
            ${tf.proofUrl
              ? `<a class="link-accent" href="${escapeHtml(tf.proofUrl)}" target="_blank" rel="noopener">📷 Lihat bukti foto</a>`
              : `<span class="text-amber">⚠️ Tanpa bukti foto</span>`}
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="glass-btn btn-primary-ortu btn-sm" onclick="verifyTransfer('${tf.id}', true)">Terima</button>
          <button type="button" class="glass-btn btn-danger btn-sm" onclick="verifyTransfer('${tf.id}', false)">Tolak</button>
        </div>
      </div>
    `).join('');
  }

  // Render Riwayat Kas Kelas
  const historyContainer = document.getElementById('guruCashHistory');
  historyContainer.innerHTML = cls.cashHistory.length === 0
    ? `<div class="glass-item"><span>Belum ada mutasi kas. Saldo awal kelas baru selalu Rp 0.</span></div>`
    : cls.cashHistory.map(item => `
      <div class="glass-item">
        <div>
          <strong>${escapeHtml(item.desc)}</strong>
          <div style="font-size:0.76rem; color:#94a3b8;">${escapeHtml(item.date)}</div>
        </div>
        <strong class="${item.type === 'IN' ? 'text-emerald' : 'text-amber'}">
          ${item.type === 'IN' ? '+' : '-'} ${formatRp(item.amount)}
        </strong>
      </div>
    `).join('');

  renderClassManagement();
  renderCashSetting(cls);
  renderDueHistory();
  renderChecklist();
  renderMemberList();
  renderNotificationDueOptions();
}

// =========================================================
// MANAJEMEN KELAS (ADMIN)
// =========================================================
function renderClassManagement() {
  const container = document.getElementById('guruClassList');
  if (!container) return;

  if (state.classes.length === 0) {
    container.innerHTML = `<div class="glass-item"><span>Belum ada kelas. Tambahkan kelas pertama Anda.</span></div>`;
    return;
  }

  container.innerHTML = state.classes.map(cls => {
    const memberCount = getClassMembers(cls.id).length;
    return `
      <div class="glass-item class-manage-item ${cls.id === state.selectedClassId ? 'is-active' : ''}">
        <div>
          <strong>${escapeHtml(cls.name)}</strong>
          <div class="class-meta-line">Wali: ${escapeHtml(cls.homeroom)} • ${memberCount} orang tua</div>
          <div class="class-meta-line">
            ${cls.hasPassword ? '🔐 Sandi aktif' : '⚠️ Sandi belum diatur'}
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="glass-btn btn-outline btn-sm" onclick="startEditClass('${escapeHtml(cls.id)}')">Ubah</button>
          <button type="button" class="glass-btn btn-accent-yellow btn-sm" onclick="startEditClass('${escapeHtml(cls.id)}', true)">Sandi</button>
          <button type="button" class="glass-btn btn-danger btn-sm" onclick="deleteClass('${escapeHtml(cls.id)}')">Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

function startEditClass(classId, focusPassword) {
  const cls = state.classes.find(item => item.id === classId);
  if (!cls) return;

  const box = document.getElementById('editClassBox');
  document.getElementById('editClassId').value = cls.id;
  document.getElementById('editClassName').value = cls.name;
  document.getElementById('editClassGrade').value = cls.grade;
  document.getElementById('editClassHomeroom').value = cls.homeroom;
  document.getElementById('editClassBankName').value = cls.bankName;
  document.getElementById('editClassBankNumber').value = cls.bankNumber;
  document.getElementById('editClassBankHolder').value = cls.bankHolder;
  document.getElementById('editClassPassword').value = '';

  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (focusPassword) {
    setTimeout(() => document.getElementById('editClassPassword').focus(), 250);
  }
}

function cancelEditClass() {
  document.getElementById('editClassBox').classList.add('hidden');
}

async function handleCreateClass(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const name = document.getElementById('newClassName').value.trim();
  const grade = document.getElementById('newClassGrade').value;
  const homeroom = document.getElementById('newClassHomeroom').value.trim();
  const bankName = document.getElementById('newClassBankName').value.trim();
  const bankNumber = document.getElementById('newClassBankNumber').value.trim();
  const bankHolder = document.getElementById('newClassBankHolder').value.trim();
  const password = document.getElementById('newClassPassword').value;

  if (!name || !homeroom || !bankName || !bankNumber || !bankHolder) {
    showToast('Semua data kelas wajib diisi.');
    return;
  }
  if (password.length < 4) {
    showToast('Sandi kelas minimal 4 karakter.');
    return;
  }

  try {
    await createClassWithPassword({
      id: buildClassId(grade, name),
      grade,
      name,
      homeroom,
      bankName,
      bankNumber,
      bankHolder,
      password,
      cashPeriod: 'bulanan',
      cashAmount: 0
    });

    e.target.reset();
    await refreshAllData();
    renderClassManagement();
    showToast('Kelas baru berhasil dibuat dengan saldo awal Rp 0.');
  } catch (error) {
    console.error('Gagal membuat kelas:', error);
    showToast('Gagal membuat kelas: ' + (error.message || 'Kode kelas mungkin sudah dipakai.'));
  }
}

async function handleSaveClassEdit(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const id = document.getElementById('editClassId').value;
  const name = document.getElementById('editClassName').value.trim();
  const grade = document.getElementById('editClassGrade').value;
  const homeroom = document.getElementById('editClassHomeroom').value.trim();
  const bankName = document.getElementById('editClassBankName').value.trim();
  const bankNumber = document.getElementById('editClassBankNumber').value.trim();
  const bankHolder = document.getElementById('editClassBankHolder').value.trim();
  const newPassword = document.getElementById('editClassPassword').value;

  if (!id || !name || !homeroom) {
    showToast('Nama kelas dan wali kelas wajib diisi.');
    return;
  }
  if (newPassword && newPassword.length < 4) {
    showToast('Sandi kelas baru minimal 4 karakter.');
    return;
  }

  try {
    await updateClassInfo({
      id, name, grade, homeroom, bankName, bankNumber, bankHolder
    });

    if (newPassword) {
      await setClassPassword(id, newPassword);
    }

    cancelEditClass();
    await refreshAllData();
    renderClassManagement();
    showToast('Data kelas berhasil diperbarui.');
  } catch (error) {
    console.error('Gagal mengubah kelas:', error);
    showToast('Gagal mengubah kelas: ' + error.message);
  }
}

async function deleteClass(classId) {
  if (!requireWritableSession()) return;

  const cls = state.classes.find(item => item.id === classId);
  if (!cls) return;

  const confirmed = window.confirm(
    'Hapus ' + cls.name + '?\n\nSeluruh anggota, iuran, dan riwayat transfer kelas ini juga akan dihapus. Tindakan ini tidak bisa dibatalkan.'
  );
  if (!confirmed) return;

  try {
    await deleteClassById(classId);
    if (state.selectedClassId === classId) {
      state.selectedClassId = '';
      state.selectedDueId = '';
    }
    await refreshAllData();
    renderClassManagement();
    showToast('Kelas ' + cls.name + ' berhasil dihapus.');
  } catch (error) {
    console.error('Gagal menghapus kelas:', error);
    showToast('Gagal menghapus kelas: ' + error.message);
  }
}

// =========================================================
// PENGATURAN KAS & PROGRAM IURAN
// =========================================================
function renderCashSetting(cls) {
  if (!cls) return;
  document.getElementById('cashPeriodSelect').value = cls.cashPeriod || 'bulanan';
  setRupiahValue('cashPeriodAmount', cls.cashAmount || 0);
  document.getElementById('guruCashPeriodBadge').textContent =
    formatRp(cls.cashAmount || 0) + ' / ' + periodTypeLabel(cls.cashPeriod);
  document.getElementById('guruCashSettingInfo').textContent =
    'Kas kelas ' + cls.name + ' ditagih ' + formatRp(cls.cashAmount || 0) +
    ' setiap ' + periodTypeLabel(cls.cashPeriod) + '.';
}

async function handleSaveCashSetting(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const cashPeriod = document.getElementById('cashPeriodSelect').value;
  const cashAmount = parseRupiah(document.getElementById('cashPeriodAmount').value);

  try {
    await updateClassDetails({
      id: cls.id,
      grade: cls.grade,
      name: cls.name,
      homeroom: cls.homeroom,
      bankName: cls.bankName,
      bankNumber: cls.bankNumber,
      bankHolder: cls.bankHolder,
      cashPeriod,
      cashAmount
    });
    await refreshAllData();
    renderGuruDashboard();
    showToast('Pengaturan kas kelas berhasil disimpan.');
  } catch (error) {
    console.error('Gagal menyimpan pengaturan kas:', error);
    showToast('Gagal menyimpan pengaturan kas: ' + error.message);
  }
}

function renderDueHistory() {
  const container = document.getElementById('guruDueHistory');
  if (!container) return;

  const dues = getClassDues(state.selectedClassId);
  if (dues.length === 0) {
    container.innerHTML = `<div class="glass-item"><span>Belum ada program iuran untuk kelas ini.</span></div>`;
    return;
  }

  container.innerHTML = dues.map(due => `
    <div class="glass-item">
      <div>
        <strong>${escapeHtml(due.title)}</strong>
        <div class="class-meta-line">
          ${formatRp(due.amount)} • ${periodTypeLabel(due.periodType)}
          ${due.periodLabel ? ' • ' + escapeHtml(due.periodLabel) : ''}
        </div>
        <small style="color:#94a3b8;">
          ${due.dueDate ? 'Jatuh tempo: ' + escapeHtml(due.dueDate) : 'Tanpa jatuh tempo'}
        </small>
      </div>
      <div class="item-actions">
        <button type="button" class="glass-btn btn-outline btn-sm" onclick="selectChecklistDue('${due.id}')">Checklist</button>
        <button type="button" class="glass-btn btn-danger btn-sm" onclick="deleteDue('${due.id}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

async function handleAddDue(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const title = document.getElementById('dueTitleInput').value.trim();
  const amount = parseRupiah(document.getElementById('dueAmountInput').value);
  const periodType = document.getElementById('duePeriodType').value;
  const periodLabel = document.getElementById('duePeriodLabel').value.trim();
  const dueDate = document.getElementById('dueDateInput').value || null;

  if (!title || amount <= 0) {
    showToast('Nama iuran dan nominal harus valid.');
    return;
  }

  try {
    await createDue({
      classId: cls.id,
      title,
      amount,
      periodType,
      periodLabel,
      dueDate
    });
    e.target.reset();
    await refreshAllData();
    renderGuruDashboard();
    showToast('Program iuran ditambahkan. Notifikasi otomatis dikirim ke inbox orang tua.');
  } catch (error) {
    console.error('Gagal menambah iuran:', error);
    showToast('Gagal menambah iuran: ' + error.message);
  }
}

async function deleteDue(dueId) {
  if (!requireWritableSession()) return;

  const due = state.dues.find(item => item.id === dueId);
  if (!due) return;

  if (!window.confirm('Hapus program iuran "' + due.title + '" beserta status pembayarannya?')) return;

  try {
    await deleteDueById(dueId);
    if (state.selectedDueId === dueId) state.selectedDueId = '';
    await refreshAllData();
    renderGuruDashboard();
    showToast('Program iuran berhasil dihapus.');
  } catch (error) {
    console.error('Gagal menghapus iuran:', error);
    showToast('Gagal menghapus iuran: ' + error.message);
  }
}

function selectChecklistDue(dueId) {
  state.selectedDueId = dueId;
  renderChecklist();
  document.getElementById('checklistDueSelect').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =========================================================
// CHECKLIST PEMBAYARAN PER ORANG TUA
// =========================================================
function renderChecklist() {
  const select = document.getElementById('checklistDueSelect');
  const container = document.getElementById('guruChecklistContainer');
  if (!select || !container) return;

  const dues = getClassDues(state.selectedClassId);
  if (dues.length === 0) {
    select.innerHTML = `<option value="">Belum ada iuran</option>`;
    container.innerHTML = `<div class="glass-item"><span>Buat program iuran terlebih dahulu.</span></div>`;
    return;
  }

  if (!dues.some(due => due.id === state.selectedDueId)) {
    state.selectedDueId = dues[0].id;
  }

  select.innerHTML = dues.map(due =>
    `<option value="${due.id}" ${due.id === state.selectedDueId ? 'selected' : ''}>${escapeHtml(due.title)} — ${formatRp(due.amount)}</option>`
  ).join('');

  const members = getClassMembers(state.selectedClassId);
  if (members.length === 0) {
    container.innerHTML = `<div class="glass-item"><span>Belum ada orang tua yang bergabung ke kelas ini.</span></div>`;
    return;
  }

  const rows = members.map((member, index) => {
    const payment = getDuePayment(state.selectedDueId, member.id);
    const status = payment?.status || 'UNPAID';
    let statusHtml = `<span class="status-chip status-unpaid">❌ Belum Bayar</span>`;
    if (status === 'PAID') statusHtml = `<span class="status-chip status-paid">✅ Lunas</span>`;
    if (status === 'PENDING') statusHtml = `<span class="status-chip status-pending">⏳ Menunggu Verifikasi</span>`;

    const proof = payment?.proofUrl
      ? `<a class="link-accent" href="${escapeHtml(payment.proofUrl)}" target="_blank" rel="noopener">📷 Lihat Foto</a>`
      : '<span class="text-muted">—</span>';

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(member.parentName || 'Orang Tua')}</td>
        <td>${escapeHtml(member.studentName)}</td>
        <td>${statusHtml}</td>
        <td>${proof}</td>
        <td>
          <button type="button" class="glass-btn ${status === 'PAID' ? 'btn-danger' : 'btn-primary-ortu'} btn-sm"
            onclick="toggleChecklistPayment('${state.selectedDueId}', '${member.id}', ${status !== 'PAID'})">
            ${status === 'PAID' ? 'Batalkan Lunas' : 'Tandai Lunas'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Orang Tua</th>
          <th>Siswa</th>
          <th>Status</th>
          <th>Bukti</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function toggleChecklistPayment(dueId, memberId, paid) {
  if (!requireWritableSession()) return;

  try {
    await adminMarkDuePayment(dueId, memberId, paid);
    await refreshAllData();
    renderGuruDashboard();
    showToast(paid ? 'Status pembayaran ditandai lunas.' : 'Status pembayaran dikembalikan ke belum bayar.');
  } catch (error) {
    console.error('Gagal mengubah checklist:', error);
    showToast('Gagal mengubah checklist: ' + error.message);
  }
}

function renderMemberList() {
  const container = document.getElementById('guruMemberList');
  const badge = document.getElementById('guruMemberCountBadge');
  if (!container || !badge) return;

  const members = getClassMembers(state.selectedClassId);
  badge.textContent = members.length + ' Orang Tua';

  if (members.length === 0) {
    container.innerHTML = `<div class="glass-item"><span>Belum ada orang tua yang bergabung. Bagikan sandi kelas agar mereka bisa masuk.</span></div>`;
    return;
  }

  container.innerHTML = members.map((member, index) => `
    <div class="glass-item">
      <div>
        <strong>${index + 1}. ${escapeHtml(member.parentName || 'Orang Tua')}</strong>
        <div class="class-meta-line">Siswa: ${escapeHtml(member.studentName)}</div>
        <small style="color:#94a3b8;">Bergabung: ${formatDateTime(member.createdAt)}</small>
      </div>
      <span class="badge badge-emerald">✅ Terdaftar</span>
    </div>
  `).join('');
}

// =========================================================
// NOTIFIKASI / INBOX (ADMIN)
// =========================================================
function renderNotificationDueOptions() {
  const select = document.getElementById('notifDueSelect');
  if (!select) return;

  const dues = getClassDues(state.selectedClassId);
  select.innerHTML = dues.length === 0
    ? `<option value="">Belum ada iuran</option>`
    : dues.map(due =>
      `<option value="${due.id}" ${due.id === state.selectedDueId ? 'selected' : ''}>${escapeHtml(due.title)} — ${formatRp(due.amount)}</option>`
    ).join('');

  syncNotifAudience();
}

function syncNotifAudience() {
  const audience = document.getElementById('notifAudience').value;
  document.getElementById('notifDueGroup').classList.toggle('hidden', audience !== 'unpaid');
}

async function handleSendNotification(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const title = document.getElementById('notifTitleInput').value.trim();
  const body = document.getElementById('notifBodyInput').value.trim();
  const audience = document.getElementById('notifAudience').value;
  const dueId = document.getElementById('notifDueSelect').value;

  if (!title || !body) {
    showToast('Judul dan pesan notifikasi wajib diisi.');
    return;
  }

  try {
    let count = 0;
    if (audience === 'unpaid') {
      if (!dueId) {
        showToast('Pilih iuran yang belum dibayar terlebih dahulu.');
        return;
      }
      count = await notifyUnpaidMembers(cls.id, dueId, title, body);
    } else {
      count = await notifyClassMembers(cls.id, title, body, 'info');
    }

    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value = '';
    await refreshAllData();
    showToast('Notifikasi terkirim ke ' + count + ' inbox orang tua.');
  } catch (error) {
    console.error('Gagal mengirim notifikasi:', error);
    showToast('Gagal mengirim notifikasi: ' + error.message);
  }
}

async function sendUnpaidReminder() {
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const due = state.dues.find(item => item.id === state.selectedDueId);
  if (!due) {
    showToast('Pilih program iuran terlebih dahulu.');
    return;
  }

  try {
    const count = await notifyUnpaidMembers(
      cls.id,
      due.id,
      'Pengingat: ' + due.title,
      'Anda belum melakukan pembayaran ' + due.title + ' sebesar ' + formatRp(due.amount) +
        '. Segera kirim bukti pembayaran melalui menu transfer.'
    );
    showToast('Pengingat terkirim ke ' + count + ' orang tua yang belum bayar.');
  } catch (error) {
    console.error('Gagal mengirim pengingat:', error);
    showToast('Gagal mengirim pengingat: ' + error.message);
  }
}

async function handleUpdateBank(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const bankName = document.getElementById('inputBankName').value.trim();
  const bankNumber = document.getElementById('inputBankNumber').value.trim();
  const bankHolder = document.getElementById('inputBankHolder').value.trim();

  try {
    await updateClassDetails({
      id: cls.id,
      grade: cls.grade,
      name: cls.name,
      homeroom: cls.homeroom,
      bankName,
      bankNumber,
      bankHolder,
      cashPeriod: cls.cashPeriod || 'bulanan',
      cashAmount: cls.cashAmount || 0
    });

    await refreshAllData();
    renderGuruDashboard();
    showToast('Rekening Wali Kelas berhasil diperbarui untuk halaman Orang Tua!');
  } catch (error) {
    console.error('Gagal menyimpan rekening:', error);
    showToast('Gagal menyimpan rekening: ' + error.message);
  }
}

async function verifyTransfer(transferId, isApproved) {
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  const tf = cls?.transfers.find(item => item.id === transferId);
  if (!tf) return;

  try {
    // Verifikasi atomik di Supabase (status + saldo + riwayat kas + checklist)
    await reviewTransfer(transferId, isApproved);
    await refreshAllData();

    renderGuruDashboard();

    if (isApproved) {
      showToast(`Dana ${formatRp(tf.amount)} dari ${tf.studentName} berhasil diverifikasi!`);
    } else {
      showToast(`Transfer dari ${tf.studentName} ditolak.`);
    }
  } catch (error) {
    console.error('Gagal verifikasi transfer:', error);
    showToast('Gagal memverifikasi transfer: ' + error.message);
  }
}

async function handleGuruAddCash(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const type = document.getElementById('cashType').value;
  const amount = parseRupiah(document.getElementById('cashAmount').value);
  const desc = document.getElementById('cashDesc').value.trim();

  if (!amount || amount <= 0) {
    showToast('Nominal mutasi tidak valid!');
    return;
  }

  if (type === 'OUT' && amount > cls.balance) {
    showToast('Saldo kas kelas tidak mencukupi untuk pengeluaran ini!');
    return;
  }

  const next = {
    ...cls,
    balance: cls.balance + (type === 'IN' ? amount : -amount),
    cashHistory: [
      {
        id: 'c-' + Date.now(),
        type: type,
        desc: desc,
        amount: amount,
        date: 'Baru saja'
      },
      ...cls.cashHistory
    ]
  };

  try {
    // Simpan ke Supabase
    await saveClassToSupabase(next);
    Object.assign(cls, next);

    e.target.reset();
    renderGuruDashboard();
    showToast('Mutasi kas berhasil dicatat!');
  } catch (error) {
    console.error('Gagal mencatat mutasi kas:', error);
    showToast('Gagal mencatat mutasi kas: ' + error.message);
  }
}

// =========================================================
// 4. LOGIKA PORTAL ORANG TUA & HALAMAN TRANSFER (+)
// =========================================================
function renderOrtuPortal() {
  const cls = getActiveClass();
  if (!cls) {
    showToast('Belum ada kelas. Hubungi admin/wali kelas.');
    return;
  }

  const member = getMyMember(cls.id);
  const studentName = member?.studentName || state.currentUser?.childName || 'Siswa';

  document.getElementById('ortuClassTitle').textContent = cls.name + ' (Wali: ' + cls.homeroom + ')';
  document.getElementById('ortuStudentLabel').textContent = 'Siswa: ' + studentName;
  document.getElementById('ortuCashPeriodInfo').textContent =
    'Iuran kas: ' + formatRp(cls.cashAmount || 0) + ' / ' + periodTypeLabel(cls.cashPeriod);

  // Info Rekening di Dashboard & Halaman Transfer
  document.getElementById('ortuBankName').textContent = cls.bankName;
  document.getElementById('ortuBankNumber').textContent = cls.bankNumber;
  document.getElementById('ortuBankHolder').textContent = cls.bankHolder;

  document.getElementById('tfTargetBank').textContent = cls.bankName + ' — ' + cls.bankNumber;
  document.getElementById('tfTargetHolder').textContent = 'a.n. ' + cls.bankHolder;

  // Saldo Kelas & Total Dana Terverifikasi Orang Tua
  document.getElementById('ortuClassBalance').textContent = formatRp(cls.balance);
  const verifiedTotal = cls.transfers
    .filter(t => t.status === 'APPROVED')
    .reduce((sum, item) => sum + item.amount, 0);
  document.getElementById('ortuMyVerifiedTotal').textContent = formatRp(verifiedTotal);

  // Daftar Program Iuran Kelas + status pembayaran saya
  const dues = getClassDues(cls.id);
  const billList = document.getElementById('ortuBillList');

  if (dues.length === 0) {
    billList.innerHTML = `<div class="glass-item"><span>Belum ada program iuran dari wali kelas.</span></div>`;
  } else {
    billList.innerHTML = dues.map(due => {
      const payment = member ? getDuePayment(due.id, member.id) : null;
      const status = payment?.status || 'UNPAID';
      let statusHtml = `<span class="status-chip status-unpaid">❌ Belum Bayar</span>`;
      let actionHtml = `
        <button type="button" class="glass-btn btn-primary-ortu btn-sm" onclick="openTransferForDue('${due.id}')">
          Bayar →
        </button>`;

      if (status === 'PAID') {
        statusHtml = `<span class="status-chip status-paid">✅ Lunas</span>`;
        actionHtml = `<button type="button" class="glass-btn btn-outline btn-sm" disabled>Sudah Lunas</button>`;
      } else if (status === 'PENDING') {
        statusHtml = `<span class="status-chip status-pending">⏳ Menunggu Verifikasi</span>`;
        actionHtml = `<button type="button" class="glass-btn btn-outline btn-sm" disabled>Menunggu</button>`;
      }

      return `
        <div class="glass-item">
          <div>
            <strong>${escapeHtml(due.title)}</strong>
            <div class="class-meta-line">
              ${formatRp(due.amount)} • ${periodTypeLabel(due.periodType)}
              ${due.periodLabel ? ' • ' + escapeHtml(due.periodLabel) : ''}
            </div>
            <small style="color:#94a3b8;">
              ${due.dueDate ? 'Jatuh tempo: ' + escapeHtml(due.dueDate) : 'Tanpa jatuh tempo'}
            </small>
            <div class="mt-8">${statusHtml}</div>
          </div>
          ${actionHtml}
        </div>
      `;
    }).join('');
  }

  // Dropdown Pilihan Pembayaran di Halaman Transfer (+)
  const purposeSelect = document.getElementById('tfPurpose');
  const previousValue = purposeSelect.value;
  purposeSelect.innerHTML = dues.map(due =>
    `<option value="${due.id}" data-amount="${due.amount}" data-title="${escapeHtml(due.title)}">${escapeHtml(due.title)} (${formatRp(due.amount)})</option>`
  ).join('') + `<option value="sukarela" data-amount="50000" data-title="Tabungan Sukarela Siswa">Tabungan Sukarela Siswa</option>`;

  if (previousValue && Array.from(purposeSelect.options).some(option => option.value === previousValue)) {
    purposeSelect.value = previousValue;
  }

  if (member) {
    document.getElementById('tfStudentName').value = member.studentName;
  } else if (state.currentUser?.childName) {
    document.getElementById('tfStudentName').value = state.currentUser.childName;
  }

  // Transparansi Mutasi Kas Kelas (Read-Only)
  document.getElementById('ortuCashHistory').innerHTML = cls.cashHistory.length === 0
    ? `<div class="glass-item"><span>Belum ada mutasi kas.</span></div>`
    : cls.cashHistory.map(item => `
      <div class="glass-item">
        <div>
          <strong>${escapeHtml(item.desc)}</strong>
          <div style="font-size:0.76rem; color:#94a3b8;">${escapeHtml(item.date)}</div>
        </div>
        <strong class="${item.type === 'IN' ? 'text-emerald' : 'text-amber'}">
          ${item.type === 'IN' ? '+' : '-'} ${formatRp(item.amount)}
        </strong>
      </div>
    `).join('');

  // Riwayat Status Kiriman Transfer Orang Tua
  const tfHistoryContainer = document.getElementById('ortuTransferHistoryList');
  if (cls.transfers.length === 0) {
    tfHistoryContainer.innerHTML = `<div class="glass-item"><span>Anda belum mengirim konfirmasi transfer di kelas ini. Tekan tombol (+) di bawah untuk mengirim dana.</span></div>`;
  } else {
    tfHistoryContainer.innerHTML = cls.transfers.map(tf => {
      let badgeClass = 'badge-amber';
      let statusLabel = 'Menunggu Verifikasi Guru';
      if (tf.status === 'APPROVED') {
        badgeClass = 'badge-emerald';
        statusLabel = 'Disetujui & Masuk Kas';
      } else if (tf.status === 'REJECTED') {
        badgeClass = 'badge-indigo';
        statusLabel = 'Ditolak';
      }
      return `
        <div class="glass-item">
          <div>
            <strong>${escapeHtml(tf.purpose)} — ${formatRp(tf.amount)}</strong>
            <div style="font-size:0.8rem; color:#cbd5e1;">Siswa: ${escapeHtml(tf.studentName)} • Via ${escapeHtml(tf.method)}</div>
            <small style="color:#94a3b8;">${escapeHtml(tf.date)} — "${escapeHtml(tf.note)}"</small>
            <div class="proof-link-row">
              ${tf.proofUrl
                ? `<a class="proof-thumb-link" href="${escapeHtml(tf.proofUrl)}" target="_blank" rel="noopener">
                     <img class="proof-thumb" src="${escapeHtml(tf.proofUrl)}" alt="Bukti pembayaran" />
                   </a>`
                : ''}
            </div>
          </div>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </div>
      `;
    }).join('');
  }

  renderInboxBadge();
}

// Navigasi Sub-Halaman Orang Tua (Dashboard vs Halaman Plus Transfer vs Riwayat)
function switchOrtuTab(tabName) {
  document.querySelectorAll('.ortu-subpage').forEach(el => el.classList.remove('active'));
  document.getElementById('navOrtuDashboard').classList.remove('active');
  document.getElementById('navOrtuHistory').classList.remove('active');

  if (tabName === 'dashboard') {
    document.getElementById('ortuPageDashboard').classList.add('active');
    document.getElementById('navOrtuDashboard').classList.add('active');
  } else if (tabName === 'transfer') {
    document.getElementById('ortuPageTransfer').classList.add('active');
    syncBillAmount();
  } else if (tabName === 'history') {
    document.getElementById('ortuPageHistory').classList.add('active');
    document.getElementById('navOrtuHistory').classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openTransferForDue(dueId) {
  switchOrtuTab('transfer');
  const select = document.getElementById('tfPurpose');
  if (Array.from(select.options).some(option => option.value === dueId)) {
    select.value = dueId;
  }
  syncBillAmount();
  document.getElementById('proofDropzone')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function syncBillAmount() {
  const select = document.getElementById('tfPurpose');
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption && selectedOption.dataset.amount) {
    setRupiahValue('tfAmount', selectedOption.dataset.amount);
  }
  document.getElementById('tfDueId').value =
    selectedOption && selectedOption.value !== 'sukarela' ? selectedOption.value : '';
}

function setQuickAmount(val) {
  setRupiahValue('tfAmount', val);
}

function copyBankNumber() {
  const cls = getActiveClass();
  if (!cls) return;
  navigator.clipboard?.writeText(cls.bankNumber);
  showToast(`Nomor rekening ${cls.bankNumber} berhasil disalin!`);
}

// =========================================================
// BUKTI PEMBAYARAN (FOTO): PILIH / DRAG & DROP / GALERI
// =========================================================
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function isImageProof(file) {
  if (!file) return false;
  if (String(file.type || '').startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || '');
}

function pickProofFile(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target && event.target.id === 'tfProof') return;
  }
  document.getElementById('tfProof').click();
}

function handleProofSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (file) setProofFile(file);
}

function setProofFile(file) {
  if (!isImageProof(file)) {
    showToast('Bukti pembayaran harus berupa foto (JPG/PNG/WebP).');
    return;
  }
  if (file.size > MAX_PROOF_BYTES) {
    showToast('Ukuran foto maksimal 5 MB.');
    return;
  }

  state.proofFile = file;
  const previewWrap = document.getElementById('proofPreviewWrap');
  const emptyState = document.getElementById('proofEmpty');
  const preview = document.getElementById('proofPreview');
  const fileName = document.getElementById('proofFileName');

  if (state.proofUrl && state.proofUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.proofUrl);
  }

  state.proofUrl = URL.createObjectURL(file);
  preview.src = state.proofUrl;
  fileName.textContent = file.name + ' • ' + (file.size / 1024).toFixed(0) + ' KB';
  previewWrap.classList.remove('hidden');
  emptyState.classList.add('hidden');
  document.getElementById('proofDropzone').classList.add('has-file');
}

function clearProofFile() {
  state.proofFile = null;
  if (state.proofUrl && state.proofUrl.startsWith('blob:')) {
    URL.revokeObjectURL(state.proofUrl);
  }
  state.proofUrl = '';

  const input = document.getElementById('tfProof');
  if (input) input.value = '';

  const previewWrap = document.getElementById('proofPreviewWrap');
  const emptyState = document.getElementById('proofEmpty');
  if (previewWrap) previewWrap.classList.add('hidden');
  if (emptyState) emptyState.classList.remove('hidden');
  const zone = document.getElementById('proofDropzone');
  if (zone) zone.classList.remove('has-file');
}

function setupProofDropzone() {
  const zone = document.getElementById('proofDropzone');
  if (!zone || zone.dataset.ready === 'true') return;
  zone.dataset.ready = 'true';

  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove('is-dragover');
    });
  });

  zone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files && event.dataTransfer.files[0];
    if (file) setProofFile(file);
  });
}

async function handleParentTransfer(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  if (!cls) return;

  const member = getMyMember(cls.id);
  if (!member) {
    showToast('Gabung ke kelas terlebih dahulu sebelum mengirim pembayaran.');
    openJoinClassModal(cls.id);
    return;
  }

  const studentName = document.getElementById('tfStudentName').value.trim();
  const purposeSelect = document.getElementById('tfPurpose');
  const selectedOption = purposeSelect.options[purposeSelect.selectedIndex];
  const purpose = selectedOption?.dataset.title || 'Pembayaran Kas Kelas';
  const dueId = selectedOption && selectedOption.value !== 'sukarela' ? selectedOption.value : '';
  const amount = parseRupiah(document.getElementById('tfAmount').value);
  const method = document.getElementById('tfMethod').value;
  const note = document.getElementById('tfNote').value.trim();
  const proofInput = document.getElementById('tfProof');
  const proofFile = state.proofFile || (proofInput.files && proofInput.files[0]);

  if (!studentName || !purpose || !amount || amount < 5000) {
    showToast('Nama siswa, keperluan, dan nominal minimal Rp 5.000 wajib diisi!');
    return;
  }

  if (!proofFile) {
    showToast('Bukti pembayaran wajib berupa foto. Pilih dari file/galeri atau tarik ke area unggah.');
    return;
  }

  if (!isImageProof(proofFile)) {
    showToast('Bukti pembayaran harus berupa foto (JPG/PNG/WebP).');
    return;
  }

  if (proofFile.size > MAX_PROOF_BYTES) {
    showToast('Ukuran foto bukti maksimal 5 MB.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.textContent = 'Mengunggah bukti foto...';
    submitBtn.disabled = true;
  }

  try {
    const uploaded = await uploadPaymentProof(proofFile);

    const savedTransfer = await createTransfer({
      classId: cls.id,
      memberId: member.id,
      dueId: dueId || null,
      studentName: studentName,
      parentName: state.currentUser?.name || 'Wali Murid',
      purpose: purpose,
      amount: amount,
      method: method,
      note: note,
      proofUrl: uploaded.url,
      dateLabel: 'Baru saja'
    });

    if (dueId) {
      try {
        await setDuePaymentPending({
          dueId,
          classId: cls.id,
          memberId: member.id,
          userId: state.currentUser.uid,
          amount,
          proofUrl: uploaded.url,
          note
        });
      } catch (paymentError) {
        console.warn('Transfer tersimpan, tetapi status checklist gagal diperbarui:', paymentError);
      }
    }

    clearProofFile();
    e.target.reset();
    await refreshAllData();
    renderOrtuPortal();
    switchOrtuTab('history');
    showToast('Pembayaran terkirim! Bukti foto Anda menunggu verifikasi Wali Kelas.');
  } catch (error) {
    console.error('Gagal mengirim konfirmasi transfer:', error);
    showToast('Gagal mengirim pembayaran: ' + (error.message || 'Coba lagi.'));
  } finally {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
}

// =========================================================
// INBOX NOTIFIKASI ORANG TUA
// =========================================================
function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getUnreadNotificationCount() {
  return state.notifications.filter(item => !item.isRead).length;
}

function renderInboxBadge() {
  const badge = document.getElementById('ortuInboxBadge');
  if (!badge) return;
  const unread = getUnreadNotificationCount();
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
}

function renderInboxList() {
  const list = document.getElementById('inboxList');
  const summary = document.getElementById('inboxSummary');
  if (!list || !summary) return;

  const unread = getUnreadNotificationCount();
  summary.textContent = state.notifications.length + ' pesan • ' + unread + ' belum dibaca';

  if (state.notifications.length === 0) {
    list.innerHTML = `<div class="glass-item"><span>Belum ada notifikasi. Pengumuman dari wali kelas akan tampil di sini.</span></div>`;
    return;
  }

  list.innerHTML = state.notifications.map(item => `
    <button type="button" class="inbox-item ${item.isRead ? '' : 'unread'}" onclick="markInboxItemRead('${item.id}')">
      <div class="inbox-item-head">
        <strong>${item.isRead ? '' : '<span class="unread-dot"></span>'}${escapeHtml(item.title)}</strong>
        <small>${formatDateTime(item.createdAt)}</small>
      </div>
      <p>${escapeHtml(item.body)}</p>
      <span class="badge ${item.isRead ? 'badge-indigo' : 'badge-amber'}">${item.isRead ? 'Sudah dibaca' : 'Belum dibaca'}</span>
    </button>
  `).join('');
}

function openInbox() {
  renderInboxList();
  document.getElementById('inboxModal').classList.remove('hidden');
}

function closeInbox() {
  document.getElementById('inboxModal').classList.add('hidden');
}

async function markInboxItemRead(notificationId) {
  const item = state.notifications.find(notification => notification.id === notificationId);
  if (!item || item.isRead) return;

  try {
    await markNotificationRead(notificationId);
    item.isRead = true;
    renderInboxBadge();
    renderInboxList();
  } catch (error) {
    console.error('Gagal menandai notifikasi:', error);
    showToast('Gagal menandai notifikasi: ' + error.message);
  }
}

async function markAllInboxRead() {
  if (!state.currentUser?.uid) return;

  try {
    await markAllNotificationsRead(state.currentUser.uid);
    state.notifications.forEach(item => { item.isRead = true; });
    renderInboxBadge();
    renderInboxList();
    showToast('Semua notifikasi ditandai sudah dibaca.');
  } catch (error) {
    console.error('Gagal menandai semua notifikasi:', error);
    showToast('Gagal menandai semua notifikasi: ' + error.message);
  }
}

// =========================================================
// 5. INISIALISASI SUPABASE & REAL-TIME LISTENER
// =========================================================
window.addEventListener('DOMContentLoaded', async () => {
  setupRupiahInputs();
  setupPasswordToggles();
  setupProofDropzone();
  setAuthMode('login');

  // Tutup modal saat klik latar atau tekan Escape
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        if (overlay.id === 'joinClassModal') closeJoinClassModal();
        if (overlay.id === 'inboxModal') closeInbox();
        if (overlay.id === 'classManagerModal') closeClassManagerModal();
      }
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeJoinClassModal();
    closeInbox();
    closeClassManagerModal();
  });

  if (!isSupabaseConfigured()) {
    console.warn('Supabase belum dikonfigurasi. Isi supabase-config.js.');
    state.classes = [...DEFAULT_CLASSES];
    showToast('Supabase belum dikonfigurasi. Isi supabase-config.js lalu muat ulang halaman.');
    return;
  }

  // Cek apakah user sudah login sebelumnya (auto-login)
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      const profile = await getMyProfile();

      if (profile) {
        state.currentUser = {
          uid: data.session.user.id,
          role: profile.role,
          name: profile.name,
          childName: profile.childName || '',
          identity: profile.identity
        };
        state.authRole = profile.role;
        state.adminVerified = false;

        // Admin wajib memasukkan kunci izin setiap sesi baru.
        if (profile.role === 'guru') {
          showAdminKeyView();
          showToast('Akun admin terdeteksi. Masukkan kunci izin admin.');
          return;
        }

        await loadDataFromSupabase();
        startRealtimeListener();

        console.log('✅ Auto-login:', profile.name, '(' + profile.role + ')');
        goToClassSelect();
      } else {
        await supabaseClient.auth.signOut();
      }
    }
  } catch (error) {
    console.error('Auto-login error:', error);
  }

  // Reaksi saat sesi berakhir (logout dari tab lain / token kedaluwarsa)
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      stopRealtimeListener();
      state.currentUser = null;
      state.supabaseReady = false;
      state.adminVerified = false;
      state.adminAttempts = 0;
      state.pendingRecoveryCode = '';
      showView('viewAuth');
    }
  });
});
