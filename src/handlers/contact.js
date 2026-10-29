import { requireActiveUser } from "../middleware/require-user.js";
import { recordContact } from "../services/safety-service.js";
import { telegramProfileUrl } from "../utils/telegram-links.js";
import { pool } from "../db/pool.js";
import { reportBooking } from "../services/booking-service.js";

export function registerContactHandlers(bot) {

  bot.command("report_booking", requireActiveUser, async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const buyerTelegramId = parts[1];
    const sellerTelegramId = parts[2];
    const amountIdr = Number(parts[3]);
    const notes = parts.slice(4).join(" ");
    if (!/^\d+$/.test(buyerTelegramId || "") ||
        !/^\d+$/.test(sellerTelegramId || "") ||
        !Number.isSafeInteger(amountIdr) || amountIdr < 0) {
      await ctx.reply("Format: /report_booking <buyer_telegram_id> <seller_telegram_id> <amount_idr> [catatan]");
      return;
    }
    try {
      const bookingId = await reportBooking({
        reporterId: ctx.state.user.id,
        buyerTelegramId,
        sellerTelegramId,
        amountIdr,
        notes
      });
      await ctx.reply(`Booking #${bookingId} dilaporkan. Statusnya masih reported dan perlu verifikasi admin sebelum komisi ditetapkan.`);
    } catch (err) {
      await ctx.reply(err.message || "Gagal melaporkan booking.");
    }
  });

  bot.command("contact", requireActiveUser, async (ctx) => {
    await ctx.reply("Untuk menghubungi seller, buka /browse, pilih profil, lalu tekan Hubungi di Telegram.");
  });

  // The contact URL button itself cannot be reliably observed as clicked by the bot.
  // This command is an optional explicit event tracker: /contact_seller <seller_user_id> [service_id]
  bot.command("contact_seller", requireActiveUser, async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const sellerId = Number(parts[1]);
    const serviceId = parts[2] ? Number(parts[2]) : null;
    if (!Number.isSafeInteger(sellerId) || sellerId <= 0) {
      await ctx.reply("Format: /contact_seller <seller_user_id> [service_id]");
      return;
    }
    if (ctx.state.user.role !== "buyer") {
      await ctx.reply("Hanya buyer yang dapat mencatat permintaan kontak.");
      return;
    }
    try {
      await recordContact({ buyerId: ctx.state.user.id, sellerId, serviceId });
      const result = await pool.query(
        `SELECT sp.public_username FROM seller_profiles sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.user_id = $1 AND u.status = 'active'
           AND sp.moderation_status = 'approved'`,
        [sellerId]
      );
      const url = telegramProfileUrl(result.rows[0]?.public_username);
      await ctx.reply(url ? `Buka DM seller: ${url}\nCatatan: ini mencatat permintaan kontak, bukan bukti percakapan.` : "Seller belum memiliki username Telegram publik.");
    } catch (err) {
      await ctx.reply(err.message || "Kontak tidak dapat diproses.");
    }
  });
}
