// =====================================================
// Generate supabase-config.js dari environment variable atau file .env
// =====================================================
// Lokal:
//   node scripts/generate-supabase-config.js
//
// Vercel / CI:
//   Set SUPABASE_URL dan SUPABASE_ANON_KEY di Environment Variables,
//   lalu jalankan: npm run build
// =====================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const ADMIN_GATE_PLAINTEXT = 'EDUKAS_ADMIN_ACCESS_OK_V1';

function parseEnv(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;

    const separatorIndex = withoutExport.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = withoutExport.slice(0, separatorIndex).trim();
    let value = withoutExport.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function resolveConfig({ envFile } = {}) {
  const envPath = envFile
    ? path.resolve(process.cwd(), envFile)
    : path.join(projectRoot, '.env');

  let fileEnv = {};
  const hasEnvFile = fs.existsSync(envPath);
  if (hasEnvFile) {
    fileEnv = parseEnv(fs.readFileSync(envPath, 'utf8'));
  }

  // Environment variable (Vercel/CI) diprioritaskan, lalu fallback ke .env.
  const urlFromEnv = Boolean(process.env.SUPABASE_URL);
  const anonKeyFromEnv = Boolean(process.env.SUPABASE_ANON_KEY);
  const adminKeyFromEnv = Boolean(process.env.ADMIN_ACCESS_KEY);
  const url = String(process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || '').trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || '').trim();
  const adminAccessKey = String(process.env.ADMIN_ACCESS_KEY || fileEnv.ADMIN_ACCESS_KEY || '').trim();

  let source = envPath;
  if (urlFromEnv && anonKeyFromEnv && adminKeyFromEnv) {
    source = 'Environment Variables (Vercel/CI)';
  } else if (urlFromEnv || anonKeyFromEnv || adminKeyFromEnv) {
    source = `Environment Variables + file ${envPath}`;
  }

  return { url, anonKey, adminAccessKey, envPath, hasEnvFile, source };
}

function createAdminGate(adminAccessKey) {
  const salt = crypto.randomBytes(16);
  const iterations = 210000;
  const key = crypto.pbkdf2Sync(adminAccessKey, salt, iterations, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(ADMIN_GATE_PLAINTEXT, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function validateConfig({ url, anonKey, adminAccessKey, envPath, hasEnvFile }) {
  const source = hasEnvFile
    ? `file ${envPath}`
    : 'Environment Variables (SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_ACCESS_KEY)';

  if (!url || !anonKey || !adminAccessKey) {
    throw new Error(
      `SUPABASE_URL, SUPABASE_ANON_KEY, atau ADMIN_ACCESS_KEY belum diisi.\n` +
      `Sumber yang dibaca: ${source}.\n` +
      `Lokal: isi file .env. Vercel: isi Project Settings > Environment Variables.`
    );
  }

  if (
    url.includes('GANTI-') ||
    anonKey.includes('GANTI-') ||
    adminAccessKey.includes('GANTI-')
  ) {
    throw new Error(
      'Nilai konfigurasi masih placeholder.\n' +
      'Ganti SUPABASE_URL, SUPABASE_ANON_KEY, dan ADMIN_ACCESS_KEY dengan nilai asli.'
    );
  }

  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new Error(
      'Format SUPABASE_URL tidak valid.\n' +
      'Contoh yang benar: https://abcdefghijk.supabase.co'
    );
  }

  if (adminAccessKey.length < 12) {
    throw new Error(
      'ADMIN_ACCESS_KEY terlalu pendek. Gunakan minimal 12 karakter acak.\n' +
      'Contoh: ADMIN_ACCESS_KEY=KunciAdmin-9f2b7c41e8a6'
    );
  }
}

function renderConfig({ url, anonKey, adminAccessKey }) {
  return `// =====================================================
// FILE INI DI-GENERATE OTOMATIS DARI .env / ENVIRONMENT VARIABLE
// Jangan edit langsung.
//
// Lokal:
//   1. Edit file .env
//   2. Jalankan: node scripts/generate-supabase-config.js
//
// Vercel:
//   Atur SUPABASE_URL, SUPABASE_ANON_KEY, dan ADMIN_ACCESS_KEY
//   di Environment Variables, lalu build otomatis:
//   npm run build
// =====================================================
window.EDUKAS_SUPABASE_CONFIG = ${JSON.stringify({
    url,
    anonKey,
    adminGate: createAdminGate(adminAccessKey),
  }, null, 2)};
`;
}

function generate({ envFile, outputPath } = {}) {
  const config = resolveConfig({ envFile });
  validateConfig(config);

  const targetPath = outputPath
    ? path.resolve(process.cwd(), outputPath)
    : path.join(projectRoot, 'supabase-config.js');

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, renderConfig(config), 'utf8');

  return {
    url: config.url,
    anonKey: config.anonKey,
    outputPath: targetPath,
    source: config.source,
  };
}

if (require.main === module) {
  try {
    const result = generate({
      envFile: process.argv[2],
      outputPath: process.env.SUPABASE_CONFIG_OUT,
    });

    console.log('✅ supabase-config.js berhasil dibuat');
    console.log('   Sumber  :', result.source);
    console.log('   Output  :', result.outputPath);
    console.log('   URL     :', result.url);
    console.log('   anon key:', result.anonKey.slice(0, 12) + '...');
    console.log('');
    console.log('Untuk Android, jalankan: sync_to_android.bat');
  } catch (error) {
    console.error('❌ ' + error.message);
    process.exit(1);
  }
}

module.exports = { generate, parseEnv, resolveConfig, validateConfig, renderConfig, createAdminGate };
