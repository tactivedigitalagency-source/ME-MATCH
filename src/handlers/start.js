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
      await ctx.reply(`Selamat datang kembali di MassageMatch.\nPelanggan: /browse\nTerapis: /seller\nChat anonim: /rooms\nProfil: /profile`);
      return;
    }

    await ctx.reply(
      `👋 Selamat datang di MassageMatch!\\n\\nTemukan layanan pijat sesuai kota. Ajukan booking melalui bot, lalu chat anonim jika terapis menyetujui.\\n\\nTidak ada tautan website dan identitas pribadi tidak ditampilkan.\\n\\nKhusus usia ${env.MIN_AGE}+; dengan melanjutkan Anda menyetujui ketentuan dan kebijakan privasi.\\n\\nPilih peran:`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Daftar Pelanggan", "register:buyer")],
        [Markup.button.callback("Daftar Terapis", "register:seller")]
      ])
    );
  });
}
