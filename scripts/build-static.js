// =====================================================
// Build static site untuk Vercel
// =====================================================
// Menyalin file web ke folder dist/ dan membuat
// supabase-config.js dari Environment Variables.
//
// Jalankan: npm run build
// =====================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { generate } = require('./generate-supabase-config');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const filesToCopy = [
  'index.html',
  'index.js',
  'style.css',
  'supabase-init.js',
];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const file of filesToCopy) {
  const source = path.join(projectRoot, file);
  if (!fs.existsSync(source)) {
    throw new Error(`File wajib tidak ditemukan: ${file}`);
  }
  fs.copyFileSync(source, path.join(distDir, file));
}

const assetsDir = path.join(projectRoot, 'assets');
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, path.join(distDir, 'assets'), { recursive: true });
}

const localConfigPath = path.join(projectRoot, 'supabase-config.js');
const distConfigPath = path.join(distDir, 'supabase-config.js');

let result;

// Prioritaskan supabase-config.js yang sudah di-generate dari .env.
// Ini membuat deploy tetap benar walau Environment Variables Vercel salah.
if (fs.existsSync(localConfigPath)) {
  fs.copyFileSync(localConfigPath, distConfigPath);

  const configText = fs.readFileSync(localConfigPath, 'utf8');
  const urlMatch = configText.match(/"url":\s*"([^"]+)"/);

  result = {
    source: localConfigPath,
    url: urlMatch ? urlMatch[1] : '(tidak terbaca)',
  };
} else {
  result = generate({ outputPath: distConfigPath });
}

console.log('');
console.log('✅ Build selesai. Folder siap deploy: dist/');
console.log('   Sumber config:', result.source);
console.log('   Supabase URL :', result.url);
