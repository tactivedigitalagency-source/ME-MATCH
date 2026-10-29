import { adminIds } from "../config/env.js";
import { pool } from "../db/pool.js";
import { listPendingSellers, moderateSeller, setUserStatus, listOpenReports } from "../services/moderation-service.js";
import { recordCommission } from "../services/booking-service.js";

function isAdmin(ctx) {
  return adminIds.has(String(ctx.from?.id));
}

async function ensureAdminUser(ctx) {
  const result = await pool.query(
    "SELECT id FROM users WHERE telegram_id = $1",
    [String(ctx.from.id)]
  );
  if (result.rowCount) return result.rows[0].id;
  const inserted = await pool.query(
    `INSERT INTO users(telegram_id, role, username, display_name, age_confirmed, status)
     VALUES ($1, 'admin', $2, $3, TRUE, 'active')
     ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin'
     RETURNING id`,
    [String(ctx.from.id), ctx.from.username || null, ctx.from.first_name || "Admin"]
  );
  return inserted.rows[0].id;
}

export function registerAdminHandlers(bot) {
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    await ensureAdminUser(ctx);
    await ctx.reply("Menu admin:\n/admin_pending\n/admin_reports\n/admin_help");
  });

  bot.command("admin_help", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    await ctx.reply(
      "Perintah admin:\n" +
      "/admin_pending — seller menunggu moderasi\n" +
      "/admin_approve <telegram_id>\n" +
      "/admin_reject <telegram_id> <alasan>\n" +
      "/admin_suspend <telegram_id> <alasan>\n" +
      "/admin_unsuspend <telegram_id>\n" +
      "/admin_reports — laporan terbuka\n" +
      "/admin_commission <booking_id> <amount_idr> <catatan>"
    );
  });

  bot.command("admin_pending", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const rows = await listPendingSellers();
    if (!rows.length) return ctx.reply("Tidak ada seller pending.");
    for (const r of rows) {
      await ctx.reply(
        `Nama: ${r.display_name || "-"}\nTelegram ID: ${r.telegram_id}\nUsername: @${r.username || "-"}\nKota: ${r.city}\nKategori: ${r.category || "-"}\n\nApprove: /admin_approve ${r.telegram_id}\nReject: /admin_reject ${r.telegram_id} alasan`
      );
    }
  });

  bot.command("admin_approve", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const id = ctx.message.text.split(/\s+/)[1];
    if (!id || !/^\d+$/.test(id)) return ctx.reply("Format: /admin_approve <telegram_id>");
    try {
      const adminId = await ensureAdminUser(ctx);
      await moderateSeller(adminId, id, "approved");
      await ctx.reply("Profil seller disetujui dan dapat muncul dalam pencarian jika memiliki layanan aktif.");
    } catch (err) {
      await ctx.reply(err.message || "Gagal menyetujui seller.");
    }
  });

  bot.command("admin_reject", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const [, id, ...reason] = ctx.message.text.split(/\s+/);
    if (!id || !/^\d+$/.test(id)) return ctx.reply("Format: /admin_reject <telegram_id> <alasan>");
    try {
      const adminId = await ensureAdminUser(ctx);
      await moderateSeller(adminId, id, "rejected", reason.join(" "));
      await ctx.reply("Profil ditolak.");
    } catch (err) {
      await ctx.reply(err.message || "Gagal menolak profil.");
    }
  });

  bot.command("admin_suspend", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const [, id, ...reason] = ctx.message.text.split(/\s+/);
    if (!id || !/^\d+$/.test(id)) return ctx.reply("Format: /admin_suspend <telegram_id> <alasan>");
    try {
      const adminId = await ensureAdminUser(ctx);
      await setUserStatus(adminId, id, "suspended", reason.join(" "));
      await ctx.reply("Akun ditangguhkan.");
    } catch (err) {
      await ctx.reply(err.message || "Gagal menangguhkan akun.");
    }
  });

  bot.command("admin_unsuspend", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const id = ctx.message.text.split(/\s+/)[1];
    if (!id || !/^\d+$/.test(id)) return ctx.reply("Format: /admin_unsuspend <telegram_id>");
    try {
      const adminId = await ensureAdminUser(ctx);
      await setUserStatus(adminId, id, "active", "Unsuspended by admin");
      await ctx.reply("Akun diaktifkan kembali. Seller yang profilnya belum approved tetap tidak akan tampil.");
    } catch (err) {
      await ctx.reply(err.message || "Gagal mengaktifkan akun.");
    }
  });

  bot.command("admin_reports", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const rows = await listOpenReports();
    if (!rows.length) return ctx.reply("Tidak ada laporan terbuka.");
    for (const r of rows) {
      await ctx.reply(`#${r.id} · ${r.reason}\nPelapor: ${r.reporter_telegram_id}\nTarget: ${r.target_telegram_id || "-"}\nDetail: ${r.details || "-"}\nStatus: ${r.status}`);
    }
  });

  bot.command("admin_commission", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("Akses ditolak.");
    const [, bookingId, amount, ...note] = ctx.message.text.split(/\s+/);
    if (!/^\d+$/.test(bookingId || "") || !/^\d+$/.test(amount || "")) {
      return ctx.reply("Format: /admin_commission <booking_id> <amount_idr> <catatan>");
    }
    try {
      const adminId = await ensureAdminUser(ctx);
      const result = await recordCommission({
        adminId,
        bookingId: Number(bookingId),
        amountIdr: Number(amount),
        note: note.join(" ")
      });
      await ctx.reply(`Komisi dicatat: omzet Rp${result.gross.toLocaleString("id-ID")}; tarif ${result.bps / 100}%; komisi Rp${result.commission.toLocaleString("id-ID")}. Status: due. Ini bukan bukti pembayaran komisi.`);
    } catch (err) {
      await ctx.reply(err.message || "Gagal mencatat komisi.");
    }
  });
}
