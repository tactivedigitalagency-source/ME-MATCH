import { Markup } from "telegraf";
import { registerUser } from "../services/user-service.js";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";

export function registerRegistrationHandlers(bot) {
  bot.action(/^register:(buyer|seller)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const role = ctx.match[1];
    const existing = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [String(ctx.from.id)]);
    if (existing.rowCount) {
      await ctx.reply("Akun Telegram ini sudah terdaftar. Gunakan /profile untuk membuka menu.");
      return;
    }
    await ctx.reply(
      `Konfirmasi pendaftaran sebagai ${role === "buyer" ? "Buyer" : "Seller"}.\n\n` +
      `Layanan hanya untuk pendampingan sosial nonseksual. Hormati batasan dan persetujuan setiap orang. Dengan menekan Setuju, Anda menyatakan berusia minimal ${env.MIN_AGE} tahun dan menyetujui ketentuan penggunaan serta kebijakan privasi. ` +
      (role === "seller" ? `Anda juga menyetujui komisi platform sebesar ${(env.COMMISSION_BPS / 100).toFixed(2)}% atas transaksi yang terverifikasi. Profil seller harus disetujui admin sebelum tampil.` : ""),
      Markup.inlineKeyboard([
        [Markup.button.callback("Setuju & lanjut", `register_confirm:${role}`)],
        [Markup.button.callback("Batal", "register_cancel")]
      ])
    );
  });

  bot.action(/^register_confirm:(buyer|seller)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const role = ctx.match[1];
    try {
      const user = await registerUser({
        telegramId: ctx.from.id,
        role,
        username: ctx.from.username || null,
        displayName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ").slice(0, 100),
        ageConfirmed: true
      });
      if (role === "seller") {
        await ctx.reply("Pendaftaran seller diterima. Profil Anda belum tampil sampai disetujui admin. Gunakan /seller untuk melengkapi profil.");
      } else {
        await ctx.reply("Pendaftaran buyer berhasil. Gunakan /browse untuk mencari seller.");
      }
    } catch (err) {
      await ctx.reply(err.message || "Pendaftaran gagal. Silakan coba lagi.");
    }
  });

  bot.action("register_cancel", async (ctx) => {
    await ctx.answerCbQuery("Dibatalkan");
    await ctx.editMessageText("Pendaftaran dibatalkan. Gunakan /start untuk mencoba lagi.");
  });
}
