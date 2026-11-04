// =====================================================
// Data Default untuk Seed Awal ke Database Firestore
// (Hanya digunakan saat Firestore masih kosong)
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
// (Data kelas akan di-load dari Firestore saat init)
// =====================================================
const state = {
  authRole: 'guru',
  authMode: 'login',
  currentUser: null,
  selectedClassId: 'VIII-A',
  classes: [...DEFAULT_CLASSES],
  firebaseReady: false
};

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
// 1. LOGIKA LOGIN & REGISTRASI (FIREBASE AUTH)
// =========================================================
function setAuthRole(role) {
  state.authRole = role;
  const tabGuru = document.getElementById('tabRoleGuru');
  const tabOrtu = document.getElementById('tabRoleOrtu');
  const banner = document.getElementById('authRoleBanner');
  const submitBtn = document.getElementById('authSubmitBtn');
  const regNameLabel = document.getElementById('regNameLabel');

  if (role === 'guru') {
    tabGuru.className = 'portal-tab active-guru';
    tabOrtu.className = 'portal-tab';
    banner.className = 'role-banner banner-guru';
    banner.innerHTML = '<strong>Akses Portal Guru (Admin)</strong><p>Kelola rekening wali kelas, verifikasi transfer jarak jauh, dan catat pembukuan kas kelas.</p>';
    submitBtn.className = 'glass-btn btn-primary-guru full-width';
    regNameLabel.textContent = 'Nama Lengkap Guru & Gelar';
  } else {
    tabGuru.className = 'portal-tab';
    tabOrtu.className = 'portal-tab active-ortu';
    banner.className = 'role-banner banner-ortu';
    banner.innerHTML = '<strong>Akses Portal Orang Tua (Wali Murid)</strong><p>Pantau transparansi kas kelas dan kirim dana tabungan/iuran dari jarak jauh ke rekening wali kelas.</p>';
    submitBtn.className = 'glass-btn btn-primary-ortu full-width';
    regNameLabel.textContent = 'Nama Lengkap Orang Tua / Wali';
  }
  updateAuthFormUI();
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.getElementById('modeLoginBtn').classList.toggle('active', mode === 'login');
  document.getElementById('modeRegBtn').classList.toggle('active', mode === 'register');
  updateAuthFormUI();
}

function updateAuthFormUI() {
  const isReg = state.authMode === 'register';
  const isOrtu = state.authRole === 'ortu';

  document.getElementById('regNameGroup').classList.toggle('hidden', !isReg);
  document.getElementById('regChildGroup').classList.toggle('hidden', !(isReg && isOrtu));

  const roleText = state.authRole === 'guru' ? 'Portal Guru' : 'Portal Orang Tua';
  const actionText = isReg ? 'Daftar & Pilih Kelas di ' : 'Masuk ke ';
  document.getElementById('authSubmitBtn').textContent = actionText + roleText + ' →';
}

// =====================================================
// Login / Register menggunakan Firebase Authentication
// =====================================================
async function handleAuthSubmit(e) {
  e.preventDefault();

  const identity = document.getElementById('authIdentity').value.trim();
  const password = document.getElementById('authPassword').value;
  const fullName = document.getElementById('regFullName').value.trim();
  const childName = document.getElementById('regChildName').value.trim();

  if (!identity || !password) {
    showToast('Mohon isi identitas dan kata sandi!');
    return;
  }

  if (password.length < 6) {
    showToast('Kata sandi minimal 6 karakter!');
    return;
  }

  // Konversi identitas ke format email untuk Firebase Auth
  const email = normalizeEmail(identity);

  // Tampilkan loading
  const submitBtn = document.getElementById('authSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Memproses...';
  submitBtn.disabled = true;

  try {
    let userCredential;

    if (state.authMode === 'register') {
      // REGISTRASI: Buat akun baru
      userCredential = await auth.createUserWithEmailAndPassword(email, password);

      // Simpan profil ke Firestore
      const profileData = {
        role: state.authRole,
        name: fullName || (state.authRole === 'guru' ? 'Guru' : 'Wali Murid'),
        childName: state.authRole === 'ortu' ? (childName || '') : '',
        identity: identity,
        createdAt: new Date().toISOString()
      };
      await saveUserProfile(userCredential.user.uid, profileData);

      state.currentUser = {
        uid: userCredential.user.uid,
        role: state.authRole,
        identity: identity,
        name: profileData.name,
        childName: profileData.childName
      };

      showToast('Registrasi berhasil! Silakan pilih kelas.');

    } else {
      // LOGIN: Masuk ke akun yang sudah ada
      userCredential = await auth.signInWithEmailAndPassword(email, password);

      // Muat profil dari Firestore
      const profile = await loadUserProfile(userCredential.user.uid);

      state.currentUser = {
        uid: userCredential.user.uid,
        role: profile?.role || state.authRole,
        identity: profile?.identity || identity,
        name: profile?.name || 'User',
        childName: profile?.childName || ''
      };
      state.authRole = state.currentUser.role;

      showToast('Berhasil masuk! Silakan pilih kelas.');
    }

    goToClassSelect();

  } catch (error) {
    console.error('Auth error:', error);

    // Pesan error yang ramah pengguna
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        showToast('Akun tidak ditemukan atau kata sandi salah. Coba lagi atau pilih "Daftar Baru".');
        break;
      case 'auth/wrong-password':
        showToast('Kata sandi salah! Coba lagi.');
        break;
      case 'auth/email-already-in-use':
        showToast('Akun sudah terdaftar. Silakan pilih "Masuk Akun".');
        break;
      case 'auth/weak-password':
        showToast('Kata sandi terlalu lemah! Minimal 6 karakter.');
        break;
      case 'auth/too-many-requests':
        showToast('Terlalu banyak percobaan. Coba lagi beberapa menit.');
        break;
      case 'auth/network-request-failed':
        showToast('Tidak ada koneksi internet. Periksa jaringan Anda.');
        break;
      default:
        showToast('Error: ' + error.message);
    }
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

// Fitur Simulasi Cepat di Bar Atas (tanpa Firebase Auth)
function quickDemo(role) {
  state.authRole = role;
  state.currentUser = {
    role: role,
    name: role === 'guru' ? 'Budi Santoso, S.Pd.' : 'Bpk. Hendra (Wali Raka)',
    childName: 'Raka Pratama'
  };
  goToClassSelect();
}

// Logout — hapus sesi Firebase Auth
function logout() {
  auth.signOut().catch(err => console.error('Logout error:', err));
  state.currentUser = null;
  showView('viewAuth');
}

// =========================================================
// 2. LOGIKA PEMILIHAN KELAS (SEBELUM MASUK DASHBOARD)
// =========================================================
function goToClassSelect() {
  const badge = document.getElementById('classSelectRoleBadge');
  const greeting = document.getElementById('classSelectGreeting');

  if (state.authRole === 'guru') {
    badge.className = 'badge badge-indigo';
    badge.textContent = 'PORTAL GURU (ADMIN)';
    greeting.textContent = 'Pilih Kelas yang Anda Ampu';
  } else {
    badge.className = 'badge badge-emerald';
    badge.textContent = 'PORTAL ORANG TUA';
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

function handleUpdateBank(e) {
  e.preventDefault();
  const cls = getActiveClass();
  cls.bankName = document.getElementById('inputBankName').value.trim();
  cls.bankNumber = document.getElementById('inputBankNumber').value.trim();
  cls.bankHolder = document.getElementById('inputBankHolder').value.trim();
  cls.homeroom = cls.bankHolder;

  // Simpan ke Firestore
  saveClassToFirestore(cls);

  renderGuruDashboard();
  showToast('Rekening Wali Kelas berhasil diperbarui untuk Portal Orang Tua!');
}

function verifyTransfer(transferId, isApproved) {
  const cls = getActiveClass();
  const tf = cls.transfers.find(item => item.id === transferId);
  if (!tf) return;

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
    showToast(`Dana ${formatRp(tf.amount)} dari ${tf.studentName} berhasil diverifikasi!`);
  } else {
    showToast(`Transfer dari ${tf.studentName} ditolak.`);
  }

  // Simpan ke Firestore
  saveClassToFirestore(cls);

  renderGuruDashboard();
}

function handleGuruAddCash(e) {
  e.preventDefault();
  const cls = getActiveClass();
  const type = document.getElementById('cashType').value;
  const amount = Number(document.getElementById('cashAmount').value);
  const desc = document.getElementById('cashDesc').value.trim();

  if (type === 'OUT' && amount > cls.balance) {
    showToast('Saldo kas kelas tidak mencukupi untuk pengeluaran ini!');
    return;
  }

  cls.balance += type === 'IN' ? amount : -amount;
  cls.cashHistory.unshift({
    id: 'c-' + Date.now(),
    type: type,
    desc: desc,
    amount: amount,
    date: 'Baru saja'
  });

  // Simpan ke Firestore
  saveClassToFirestore(cls);

  e.target.reset();
  renderGuruDashboard();
  showToast('Mutasi kas berhasil dicatat!');
}

function handleAddBill(e) {
  e.preventDefault();
  const cls = getActiveClass();
  const title = document.getElementById('billTitleInput').value.trim();
  const amount = Number(document.getElementById('billNominalInput').value);

  cls.bills.push({
    id: 'b-' + Date.now(),
    title: title,
    amount: amount
  });

  // Simpan ke Firestore
  saveClassToFirestore(cls);

  e.target.reset();
  showToast('Program iuran baru berhasil ditambahkan ke Portal Orang Tua!');
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

function handleParentTransfer(e) {
  e.preventDefault();
  const cls = getActiveClass();
  const studentName = document.getElementById('tfStudentName').value.trim();
  const purpose = document.getElementById('tfPurpose').value;
  const amount = Number(document.getElementById('tfAmount').value);
  const method = document.getElementById('tfMethod').value;
  const note = document.getElementById('tfNote').value.trim();

  cls.transfers.unshift({
    id: 'tf-' + Date.now(),
    studentName: studentName,
    parentName: state.currentUser?.name || 'Wali Murid',
    purpose: purpose,
    amount: amount,
    method: method,
    note: note,
    date: 'Baru saja',
    status: 'PENDING'
  });

  // Simpan ke Firestore
  saveClassToFirestore(cls);

  document.getElementById('tfNote').value = '';
  renderOrtuPortal();
  switchOrtuTab('history');
  showToast('Konfirmasi transfer terkirim! Menunggu verifikasi Wali Kelas.');
}

// =========================================================
// 5. INISIALISASI FIREBASE & REAL-TIME LISTENER
// =========================================================
window.addEventListener('DOMContentLoaded', async () => {
  setAuthRole('guru');

  // Muat data kelas dari Firestore (atau seed data awal)
  try {
    state.classes = await seedClassesIfEmpty(DEFAULT_CLASSES);
    state.firebaseReady = true;
    console.log('✅ Data berhasil dimuat dari Firestore:', state.classes.length, 'kelas');
  } catch (error) {
    console.error('❌ Gagal koneksi Firestore:', error);
    state.classes = [...DEFAULT_CLASSES];
    showToast('Mode offline — data belum tersimpan ke database.');
  }

  // Real-time listener: otomatis update saat data berubah di Firestore
  // (misalnya guru approve transfer → langsung muncul di portal orang tua)
  try {
    listenToClasses((updatedClasses) => {
      if (updatedClasses.length > 0) {
        state.classes = updatedClasses;
        // Re-render dashboard aktif jika sedang terbuka
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
      }
    });
    console.log('✅ Real-time listener aktif');
  } catch (error) {
    console.error('Listener error:', error);
  }

  // Cek apakah user sudah login sebelumnya (auto-login)
  auth.onAuthStateChanged(async (user) => {
    if (user && !state.currentUser) {
      try {
        const profile = await loadUserProfile(user.uid);
        if (profile) {
          state.currentUser = {
            uid: user.uid,
            role: profile.role,
            name: profile.name,
            childName: profile.childName || '',
            identity: profile.identity
          };
          state.authRole = profile.role;
          console.log('✅ Auto-login:', profile.name, '(' + profile.role + ')');
          goToClassSelect();
        }
      } catch (error) {
        console.error('Auto-login error:', error);
      }
    }
  });
});
