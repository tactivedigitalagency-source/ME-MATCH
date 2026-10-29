import { Markup } from "telegraf";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";

export function registerStartHandlers(bot) {
  bot.start(async (ctx) => {
    const found = await pool.query(
      "SELECT * FROM users WHERE telegram_id = $1",
      [String(ctx.from.id)]
    );
    if (found.rowCount) {
      const u = found.rows[0];
      if (u.status === "suspended") {
        await ctx.reply("Akun Anda sedang ditangguhkan. Hubungi admin jika perlu peninjauan.");
        return;
      }
      await ctx.reply(`Selamat datang kembali, ${u.display_name || "Pengguna"}.\nGunakan /profile, /browse, atau /seller.`);
      return;
    }

    await ctx.reply(
      `Selamat datang di LC Companion.\n\n` +
      `Layanan pendamping sosial nonseksual: teman karaoke, ngobrol, dan acara. Tidak menerima layanan seksual. Pertemuan harus berdasarkan persetujuan bersama; siapa pun dapat menolak atau mengakhiri layanan.\n\nPlatform ini khusus pengguna berusia ${env.MIN_AGE}+ tahun. Dengan melanjutkan, Anda menyatakan usia Anda memenuhi batas minimum dan menyetujui ketentuan penggunaan serta kebijakan privasi.\n\nPilih peran:`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Daftar sebagai Buyer", "register:buyer")],
        [Markup.button.callback("Daftar sebagai Seller", "register:seller")]
      ])
    );
  });
}
