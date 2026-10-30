import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { tanggalJakarta } from './dates.ts';

test('startup server otomatis membuat tagihan bulan WIB berjalan dan restart tidak menggandakan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kos-gopi-startup-'));
  const path = join(dir, 'test.db');
  process.env.DB_PATH = path;
  const { db, migrate } = await import('./db.ts');
  migrate();
  db.prepare("INSERT INTO kamar (nomor, tipe, harga) VALUES ('STARTUP', 'AC', 1200000)").run();
  db.prepare("INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk) VALUES ('Otomatis', '081234567890', 1, ?)").run(tanggalJakarta());
  db.close();

  const startAndStop = async () => {
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fileURLToPath(new URL('./index.ts', import.meta.url))], {
      env: { ...process.env, DB_PATH: path, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    let output = '';
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Startup timeout: ${output}`)), 10000);
        child.once('error', (err) => { clearTimeout(timeout); reject(err); });
        child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server berhenti (${code}): ${output}`)); });
        child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
          if (output.includes('Kos Gopi API jalan')) { clearTimeout(timeout); resolve(); }
        });
      });
    } finally { child.kill(); await closed; }
  };

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await startAndStop();
      const check = new DatabaseSync(path);
      try {
        const bills = check.prepare('SELECT bulan, nominal FROM tagihan').all();
        assert.equal(bills.length, 1);
        assert.equal(bills[0].bulan, tanggalJakarta().slice(0, 7));
        assert.equal(bills[0].nominal, 1200000);
      } finally { check.close(); }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
