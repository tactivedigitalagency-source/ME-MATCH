import { requireActiveUser } from "../middleware/require-user.js";
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

  // Legacy outbound contact commands intentionally disabled for anonymity.
  for (const command of ["contact", "contact_seller"]) {
    bot.command(command, requireActiveUser, async (ctx) => {
      await ctx.reply("Kontak langsung dinonaktifkan. Gunakan /browse, pilih layanan, lalu ajukan booking. Setelah terapis setuju, buka /rooms untuk chat anonim.");
    });
  }
}
