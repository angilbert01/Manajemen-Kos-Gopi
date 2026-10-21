import { createApp } from './app.ts';
import { DB_PATH, migrate } from './db.ts';

const applied = migrate();
if (applied.length) console.log(`[db] migration dijalankan: ${applied.join(', ')}`);

const PORT = Number(process.env.PORT ?? 3001);
createApp().listen(PORT, () => {
  console.log(`[api] Kos Gopi API jalan di http://localhost:${PORT} (db: ${DB_PATH})`);
});
