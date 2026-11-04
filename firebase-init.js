// =====================================================
// Firebase Configuration & Helper Functions
// EduKas — SMP Masyithoh Kroya
// =====================================================

// ⚠️ Konfigurasi Firebase — dari Firebase Console project "EdukasMasyithoh"
// Jika ada error koneksi, cek ulang nilai-nilai di bawah dengan yang ada di
// Firebase Console > Project Settings > Your apps > Web app > Config
const firebaseConfig = {
  apiKey: "AIzaSyBN9bK3LtDD0pTrxwAiVXUKFbTYIug4TqQ3",
  authDomain: "edukasmasyithoh.firebaseapp.com",
  projectId: "edukasmasyithoh",
  storageBucket: "edukasmasyithoh.firebasestorage.app",
  messagingSenderId: "5264343267",
  appId: "1:5264343262:web:dbfc01cf1f14bc006c24f",
  measurementId: "G-F24MDDVJGD7"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Aktifkan offline persistence (data tetap bisa diakses tanpa internet)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence gagal: beberapa tab terbuka bersamaan.');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence tidak didukung di browser ini.');
  }
});

// =====================================================
// Helper: Konversi identitas fleksibel ke format email
// (No. HP / Username → tambahkan @edukas.app)
// =====================================================
function normalizeEmail(identity) {
  identity = identity.trim().toLowerCase();
  // Jika sudah format email, gunakan langsung
  if (identity.includes('@') && identity.includes('.')) return identity;
  // Nomor HP atau username → konversi ke email
  return identity.replace(/[^a-z0-9]/g, '') + '@edukas.app';
}

// =====================================================
// Firestore CRUD Helpers
// =====================================================

// Simpan data kelas ke Firestore
function saveClassToFirestore(cls) {
  return db.collection('classes').doc(cls.id).set(cls)
    .catch(err => console.error('Gagal simpan kelas:', err));
}

// Muat semua data kelas dari Firestore
async function loadAllClasses() {
  const snapshot = await db.collection('classes').get();
  const classes = [];
  snapshot.forEach(doc => classes.push(doc.data()));
  return classes;
}

// Seed data awal ke Firestore jika kosong
async function seedClassesIfEmpty(defaultClasses) {
  const snapshot = await db.collection('classes').get();
  if (snapshot.empty) {
    const batch = db.batch();
    defaultClasses.forEach(cls => {
      batch.set(db.collection('classes').doc(cls.id), cls);
    });
    await batch.commit();
    console.log('Data awal berhasil di-seed ke Firestore.');
    return [...defaultClasses];
  }
  const classes = [];
  snapshot.forEach(doc => classes.push(doc.data()));
  return classes;
}

// Simpan profil user ke Firestore
function saveUserProfile(uid, data) {
  return db.collection('users').doc(uid).set(data, { merge: true })
    .catch(err => console.error('Gagal simpan profil:', err));
}

// Muat profil user dari Firestore
async function loadUserProfile(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? doc.data() : null;
}

// Real-time listener untuk semua kelas
function listenToClasses(callback) {
  return db.collection('classes').onSnapshot(snapshot => {
    const classes = [];
    snapshot.forEach(doc => classes.push(doc.data()));
    callback(classes);
  }, err => {
    console.error('Listener error:', err);
  });
}

