// Sambungan Telegram Bot API (long polling, tidak butuh URL publik). Aktif bila TELEGRAM_BOT_TOKEN diisi.
import type { Kirim, PesanMasuk } from './bot.ts';

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

export function kirimTelegram(token: string): Kirim {
  return async (chatId, teks, tombol) => {
    const res = await fetch(api(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: teks,
        reply_markup: tombol?.length
          ? { inline_keyboard: tombol.map((t) => [t.url ? { text: t.teks, url: t.url } : { text: t.teks, callback_data: t.data }]) }
          : undefined,
      }),
    });
    if (!res.ok) console.error('[telegram] sendMessage gagal', res.status, await res.text().catch(() => ''));
  };
}

type Update = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
};

/** Loop getUpdates; satu pesan gagal tidak menghentikan bot. */
export async function jalankanPolling(token: string, tangani: (pesan: PesanMasuk) => Promise<void>) {
  let offset = 0;
  for (;;) {
    try {
      const res = await fetch(api(token, 'getUpdates') + `?timeout=30&offset=${offset}`);
      const body = (await res.json()) as { ok: boolean; result?: Update[]; description?: string };
      if (!body.ok) throw new Error(body.description ?? `HTTP ${res.status}`);
      for (const u of body.result ?? []) {
        offset = u.update_id + 1;
        try {
          if (u.message?.text) await tangani({ chatId: String(u.message.chat.id), teks: u.message.text });
          else if (u.callback_query?.message) {
            await fetch(api(token, 'answerCallbackQuery'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: u.callback_query.id }),
            });
            await tangani({ chatId: String(u.callback_query.message.chat.id), data: u.callback_query.data });
          }
        } catch (err) {
          console.error('[telegram] gagal memproses pesan', err);
        }
      }
    } catch (err) {
      console.error('[telegram] polling gagal, coba lagi 5 detik.', err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
