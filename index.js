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
    balance: 1450000,
    bills: [
      { id: 'b1', title: 'Kas Kelas Bulanan', amount: 25000 },
      { id: 'b2', title: 'Tabungan Outing Class & Ziarah', amount: 100000 }
    ],
    cashHistory: [
      { id: 'c1', type: 'IN', desc: 'Saldo Awal Semester Ganjil', amount: 1500000, date: '01 Okt 2026' },
      { id: 'c2', type: 'OUT', desc: 'Pembelian Alat Kebersihan & Spidol Kelas', amount: 50000, date: '05 Okt 2026' }
    ],
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
    balance: 2350000,
    bills: [
      { id: 'b3', title: 'Iuran Kas Kelas Bulanan', amount: 30000 },
      { id: 'b4', title: 'Tabungan Kunjungan Belajar', amount: 150000 },
      { id: 'b5', title: 'Dana Sosial & Santunan Siswa', amount: 50000 }
    ],
    cashHistory: [
      { id: 'c3', type: 'IN', desc: 'Kas Kelas Kolektif Bulan Oktober', amount: 2500000, date: '10 Okt 2026' },
      { id: 'c4', type: 'OUT', desc: 'Cetak Modul & Papan Informasi Kelas', amount: 150000, date: '14 Okt 2026' }
    ],
    transfers: [
      {
        id: 'tf-101',
        studentName: 'Raka Pratama',
        parentName: 'Bpk. Hendra (Wali Raka)',
        purpose: 'Tabungan Kunjungan Belajar',
        amount: 150000,
        method: 'BRImo (BRI)',
        note: 'Setoran tabungan tahap 1 Raka',
        date: 'Hari ini, 09:15',
        status: 'PENDING'
      }
    ]
  },
  {
    id: 'IX-A',
    grade: 'IX',
    name: 'Kelas IX-A',
    homeroom: 'H. Rahmat Hidayat, S.Pd.I.',
    bankName: 'BANK BCA',
    bankNumber: '7420-8819-21',
    bankHolder: 'H. Rahmat Hidayat (Wali Kelas IX-A)',
    balance: 3120000,
    bills: [
      { id: 'b6', title: 'Kas Kelas IX & Persiapan Wisuda', amount: 100000 }
    ],
    cashHistory: [
      { id: 'c5', type: 'IN', desc: 'Dana Awal Kas Kelas IX-A', amount: 3120000, date: '02 Okt 2026' }
    ],
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
  supabaseReady: false,
  adminVerified: false,
  adminAttempts: 0,
  pendingRecoveryCode: '',
  recoveryContinueAction: 'classSelect',
  lastActiveView: 'viewClassSelect'
};

// Channel real-time Supabase (dipakai untuk auto-refresh UI)
let realtimeChannel = null;

// Format Rupiah
function formatRp(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
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

    if (classes.length > 0) {
      state.classes = classes;
      state.supabaseReady = true;
    } else {
      state.classes = [...DEFAULT_CLASSES];
      state.supabaseReady = false;
      showToast('Tabel classes masih kosong. Jalankan seed data di supabase-schema.sql.');
    }

    console.log('✅ Data kelas dimuat dari Supabase:', state.classes.length, 'kelas');
    return state.classes;
  } catch (error) {
    console.error('❌ Gagal memuat data Supabase:', error);
    state.classes = [...DEFAULT_CLASSES];
    state.supabaseReady = false;
    showToast('Gagal memuat Supabase: ' + error.message);
    return state.classes;
  }
}

async function refreshClassesFromSupabase() {
  const classes = await loadAllClasses();
  if (classes.length > 0) {
    state.classes = classes;
    state.supabaseReady = true;
  }
  return state.classes;
}

function startRealtimeListener() {
  if (realtimeChannel || !isSupabaseConfigured()) return;

  try {
    realtimeChannel = listenToClasses((updatedClasses) => {
      if (updatedClasses.length > 0) {
        state.classes = updatedClasses;
        state.supabaseReady = true;
      }

      // Re-render halaman yang sedang terbuka
      const activeView = document.querySelector('.view-section.active');
      if (activeView) {
        if (activeView.id === 'viewGuru') {
          renderGuruDashboard();
        } else if (activeView.id === 'viewOrtu') {
          renderOrtuPortal();
        } else if (activeView.id === 'viewClassSelect') {
          renderClassCards();
        }
      }
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
    const matchText = cls.name.toLowerCase().includes(query) || cls.homeroom.toLowerCase().includes(query);
    return matchGrade && matchText;
  });

  container.innerHTML = filtered.map(cls => `
    <div class="glass-card class-card" onclick="selectClassAndEnter('${cls.id}')">
      <div class="class-card-top">
        <span class="class-name">${cls.name}</span>
        <span class="badge ${state.authRole === 'guru' ? 'badge-indigo' : 'badge-emerald'}">Tingkat ${cls.grade}</span>
      </div>
      <div class="class-meta">
        <div>👨‍🏫 <strong>Wali Kelas:</strong> ${cls.homeroom}</div>
        <div>🏦 <strong>Rekening:</strong> ${cls.bankName} (${cls.bankNumber})</div>
        <div>💰 <strong>Saldo Kas:</strong> ${formatRp(cls.balance)}</div>
      </div>
      <button type="button" class="glass-btn ${state.authRole === 'guru' ? 'btn-primary-guru' : 'btn-primary-ortu'} full-width">
        Masuk ke ${cls.name} →
      </button>
    </div>
  `).join('');
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

  state.selectedClassId = classId;
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
// 3. LOGIKA PORTAL GURU / WALI KELAS (ADMIN)
// =========================================================
function renderGuruDashboard() {
  if (state.currentUser?.role === 'guru' && !state.adminVerified) {
    showAdminKeyView();
    return;
  }

  const cls = getActiveClass();
  const pendingTransfers = cls.transfers.filter(t => t.status === 'PENDING');

  document.getElementById('guruClassTitle').textContent = cls.name;
  document.getElementById('guruTeacherLabel').textContent = 'Wali Kelas: ' + cls.homeroom;
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
          <strong>${tf.studentName} — ${formatRp(tf.amount)}</strong>
          <div style="font-size:0.8rem; color:#cbd5e1;">${tf.purpose} • Via ${tf.method}</div>
          <small style="color:#94a3b8;">Catatan: "${tf.note}" (${tf.date})</small>
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
  historyContainer.innerHTML = cls.cashHistory.map(item => `
    <div class="glass-item">
      <div>
        <strong>${item.desc}</strong>
        <div style="font-size:0.76rem; color:#94a3b8;">${item.date}</div>
      </div>
      <strong class="${item.type === 'IN' ? 'text-emerald' : 'text-amber'}">
        ${item.type === 'IN' ? '+' : '-'} ${formatRp(item.amount)}
      </strong>
    </div>
  `).join('');
}

async function handleUpdateBank(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  const next = {
    ...cls,
    bankName: document.getElementById('inputBankName').value.trim(),
    bankNumber: document.getElementById('inputBankNumber').value.trim(),
    bankHolder: document.getElementById('inputBankHolder').value.trim()
  };
  next.homeroom = next.bankHolder;

  try {
    // Simpan ke Supabase
    await saveClassToSupabase(next);
    Object.assign(cls, next);

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
  const tf = cls.transfers.find(item => item.id === transferId);
  if (!tf) return;

  try {
    // Verifikasi atomik di Supabase (status + saldo + riwayat kas)
    await reviewTransfer(transferId, isApproved);

    // Update tampilan lokal dulu agar responsif
    tf.status = isApproved ? 'APPROVED' : 'REJECTED';
    if (isApproved) {
      cls.balance += tf.amount;
      cls.cashHistory.unshift({
        id: 'c-' + Date.now(),
        type: 'IN',
        desc: `Transfer ${tf.purpose} (${tf.studentName})`,
        amount: tf.amount,
        date: 'Baru saja'
      });
    }

    // Sinkronkan ulang dengan data asli dari Supabase
    try {
      await refreshClassesFromSupabase();
    } catch (refreshError) {
      console.warn('Gagal refresh setelah verifikasi:', refreshError.message);
    }

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
  const type = document.getElementById('cashType').value;
  const amount = Number(document.getElementById('cashAmount').value);
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

async function handleAddBill(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  const title = document.getElementById('billTitleInput').value.trim();
  const amount = Number(document.getElementById('billNominalInput').value);

  if (!title || !amount || amount <= 0) {
    showToast('Nama iuran dan nominal harus valid!');
    return;
  }

  const next = {
    ...cls,
    bills: [
      ...cls.bills,
      {
        id: 'b-' + Date.now(),
        title: title,
        amount: amount
      }
    ]
  };

  try {
    // Simpan ke Supabase
    await saveClassToSupabase(next);
    Object.assign(cls, next);

    e.target.reset();
    showToast('Program iuran baru berhasil ditambahkan ke halaman Orang Tua!');
  } catch (error) {
    console.error('Gagal menambah program iuran:', error);
    showToast('Gagal menambah program iuran: ' + error.message);
  }
}

// =========================================================
// 4. LOGIKA PORTAL ORANG TUA & HALAMAN TRANSFER (+)
// =========================================================
function renderOrtuPortal() {
  const cls = getActiveClass();

  document.getElementById('ortuClassTitle').textContent = cls.name + ' (Wali: ' + cls.homeroom + ')';
  document.getElementById('ortuStudentLabel').textContent =
    'Siswa: ' + (state.currentUser?.childName || 'Raka Pratama');

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

  // Daftar Program Iuran Kelas
  const billList = document.getElementById('ortuBillList');
  billList.innerHTML = cls.bills.map(b => `
    <div class="glass-item">
      <div>
        <strong>${b.title}</strong>
        <div style="font-size:0.8rem; color:#94a3b8;">Nominal: ${formatRp(b.amount)}</div>
      </div>
      <button type="button" class="glass-btn btn-primary-ortu btn-sm" onclick="openTransferWithBill('${b.title}', ${b.amount})">
        Bayar →
      </button>
    </div>
  `).join('');

  // Dropdown Pilihan Pembayaran di Halaman Transfer (+)
  const purposeSelect = document.getElementById('tfPurpose');
  purposeSelect.innerHTML = cls.bills.map(b =>
    `<option value="${b.title}" data-amount="${b.amount}">${b.title} (${formatRp(b.amount)})</option>`
  ).join('') + `<option value="Tabungan Sukarela Siswa" data-amount="50000">Tabungan Sukarela Siswa</option>`;

  if (state.currentUser?.childName) {
    document.getElementById('tfStudentName').value = state.currentUser.childName;
  }

  // Transparansi Mutasi Kas Kelas (Read-Only)
  document.getElementById('ortuCashHistory').innerHTML = cls.cashHistory.map(item => `
    <div class="glass-item">
      <div>
        <strong>${item.desc}</strong>
        <div style="font-size:0.76rem; color:#94a3b8;">${item.date}</div>
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
            <strong>${tf.purpose} — ${formatRp(tf.amount)}</strong>
            <div style="font-size:0.8rem; color:#cbd5e1;">Siswa: ${tf.studentName} • Via ${tf.method}</div>
            <small style="color:#94a3b8;">${tf.date} — "${tf.note}"</small>
          </div>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </div>
      `;
    }).join('');
  }
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

function openTransferWithBill(title, amount) {
  switchOrtuTab('transfer');
  document.getElementById('tfPurpose').value = title;
  document.getElementById('tfAmount').value = amount;
}

function syncBillAmount() {
  const select = document.getElementById('tfPurpose');
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption && selectedOption.dataset.amount) {
    document.getElementById('tfAmount').value = selectedOption.dataset.amount;
  }
}

function setQuickAmount(val) {
  document.getElementById('tfAmount').value = val;
}

function copyBankNumber() {
  const cls = getActiveClass();
  navigator.clipboard?.writeText(cls.bankNumber);
  showToast(`Nomor rekening ${cls.bankNumber} berhasil disalin!`);
}

async function handleParentTransfer(e) {
  e.preventDefault();
  if (!requireWritableSession()) return;

  const cls = getActiveClass();
  const studentName = document.getElementById('tfStudentName').value.trim();
  const purpose = document.getElementById('tfPurpose').value;
  const amount = Number(document.getElementById('tfAmount').value);
  const method = document.getElementById('tfMethod').value;
  const note = document.getElementById('tfNote').value.trim();

  if (!studentName || !purpose || !amount || amount < 5000) {
    showToast('Nama siswa, keperluan, dan nominal minimal Rp 5.000 wajib diisi!');
    return;
  }

  try {
    // Simpan ke Supabase (tabel transfers)
    const savedTransfer = await createTransfer({
      classId: cls.id,
      studentName: studentName,
      parentName: state.currentUser?.name || 'Wali Murid',
      purpose: purpose,
      amount: amount,
      method: method,
      note: note,
      dateLabel: 'Baru saja'
    });

    cls.transfers.unshift(savedTransfer);

    document.getElementById('tfNote').value = '';
    renderOrtuPortal();
    switchOrtuTab('history');
    showToast('Konfirmasi transfer terkirim! Menunggu verifikasi Wali Kelas.');
  } catch (error) {
    console.error('Gagal mengirim konfirmasi transfer:', error);
    showToast('Gagal mengirim konfirmasi transfer: ' + error.message);
  }
}

// =========================================================
// 5. INISIALISASI SUPABASE & REAL-TIME LISTENER
// =========================================================
window.addEventListener('DOMContentLoaded', async () => {
  setAuthMode('login');

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
