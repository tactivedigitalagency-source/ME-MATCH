import { Markup } from "telegraf";
import { pool } from "../db/pool.js";
import { requireActiveUser } from "../middleware/require-user.js";
import { requireRole } from "../middleware/require-role.js";

const asId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const rupiah = (value) => Number(value).toLocaleString("id-ID");
const contactPattern = /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[a-z0-9_]{4,}|\+?\d[\d\s().-]{7,}\d)/i;

async function activeRoom(userId, roomId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.buyer_id, b.seller_id, buyer.telegram_id AS buyer_chat,
            seller.telegram_id AS seller_chat
     FROM bookings b
     JOIN users buyer ON buyer.id = b.buyer_id
     JOIN users seller ON seller.id = b.seller_id
     JOIN seller_profiles sp ON sp.user_id = seller.id
     WHERE b.id = $1 AND (b.buyer_id = $2 OR b.seller_id = $2)
       AND b.status = 'confirmed'
       AND b.relay_approved_at IS NOT NULL AND b.relay_closed_at IS NULL
       AND buyer.status = 'active' AND seller.status = 'active'
       AND sp.moderation_status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM blocks bl
         WHERE (bl.blocker_id = b.buyer_id AND bl.blocked_id = b.seller_id)
            OR (bl.blocker_id = b.seller_id AND bl.blocked_id = b.buyer_id)
       )`,
    [roomId, userId]
  );
  return rows[0] || null;
}

export function registerRelayHandlers(bot) {
  bot.action(/^relay_request:(\d+)$/, requireActiveUser, requireRole("buyer"), async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.chat?.type !== "private") return ctx.reply("Buka chat pribadi bot untuk booking.");
    const serviceId = asId(ctx.match[1]);
    const client = await pool.connect();
    let request;
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [ctx.state.user.id]);
      const service = await client.query(
        `SELECT s.id, s.name, s.price_idr, s.seller_id,
                seller.telegram_id AS seller_chat
         FROM services s
         JOIN users seller ON seller.id = s.seller_id
         JOIN seller_profiles sp ON sp.user_id = seller.id
         WHERE s.id = $1 AND s.active = TRUE
           AND seller.role = 'seller' AND seller.status = 'active'
           AND sp.moderation_status = 'approved' AND sp.availability <> 'unavailable'
           AND NOT EXISTS (
             SELECT 1 FROM blocks bl
             WHERE (bl.blocker_id = $2 AND bl.blocked_id = s.seller_id)
                OR (bl.blocker_id = s.seller_id AND bl.blocked_id = $2)
           )`, [serviceId, ctx.state.user.id]
      );
      if (!service.rowCount) throw Error("Layanan tidak tersedia atau terblokir.");
      const quota = await client.query(
        `SELECT count(*)::int AS total FROM bookings
         WHERE buyer_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
         AND status IN ('requested', 'confirmed', 'rejected')`,
        [ctx.state.user.id]
      );
      if (quota.rows[0].total >= 5) throw Error("Maksimal 5 permintaan dalam 24 jam.");
      const s = service.rows[0];
      const duplicate = await client.query(
        `SELECT 1 FROM bookings WHERE buyer_id=$1 AND seller_id=$2
         AND service_id=$3 AND status IN ('requested','confirmed')
         AND relay_closed_at IS NULL LIMIT 1`,
        [ctx.state.user.id, s.seller_id, serviceId]
      );
      if (duplicate.rowCount) throw Error("Booking layanan ini masih menunggu atau aktif.");
      const added = await client.query(
        `INSERT INTO bookings(buyer_id, seller_id, service_id, agreed_price_idr, status, reported_by)
         VALUES($1,$2,$3,$4,'requested',$1) RETURNING id`,
        [ctx.state.user.id, s.seller_id, serviceId, s.price_idr]
      );
      request = { roomId: added.rows[0].id, chat: s.seller_chat, name: s.name, price: s.price_idr };
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      return ctx.reply(err.message || "Permintaan gagal dibuat.");
    } finally {
      client.release();
    }
    try {
      await bot.telegram.sendMessage(request.chat,
        `Ada permintaan booking #${request.roomId}\nLayanan: ${request.name}\nHarga: Rp${rupiah(request.price)}\nIdentitas pemesan dirahasiakan.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Terima", `relay_decide:${request.roomId}:yes`),
           Markup.button.callback("❌ Tolak", `relay_decide:${request.roomId}:no`)]
        ])
      );
      await ctx.reply(`Permintaan #${request.roomId} sudah dikirim ke terapis. Chat hanya terbuka setelah diterima.`);
    } catch {
      await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1 AND status='requested'", [request.roomId]);
      await ctx.reply("Terapis belum dapat menerima pesan bot. Permintaan dibatalkan, silakan pilih terapis lain.");
    }
  });

  bot.action(/^relay_decide:(\d+):(yes|no)$/, requireActiveUser, requireRole("seller"), async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.chat?.type !== "private") return ctx.reply("Gunakan chat pribadi bot.");
    const roomId = asId(ctx.match[1]), approved = ctx.match[2] === "yes";
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      const q = await client.query(
        `SELECT b.id, b.buyer_id, b.seller_id, b.status,
                buyer.telegram_id AS buyer_chat, sp.moderation_status
         FROM bookings b
         JOIN users buyer ON buyer.id=b.buyer_id
         JOIN users seller ON seller.id=b.seller_id
         JOIN seller_profiles sp ON sp.user_id=seller.id
         WHERE b.id=$1 AND b.seller_id=$2
           AND buyer.status='active' AND seller.status='active'
         FOR UPDATE OF b`, [roomId, ctx.state.user.id]
      );
      if (!q.rowCount || q.rows[0].status !== "requested") throw Error("Permintaan tidak tersedia atau sudah diproses.");
      result = q.rows[0];
      if (approved && result.moderation_status !== "approved") throw Error("Profil terapis belum disetujui.");
      const blocked = await client.query(
        `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2)
          OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1`, [result.buyer_id, result.seller_id]
      );
      if (approved && blocked.rowCount) throw Error("Permintaan diblokir.");
      await client.query(
        `UPDATE bookings SET status=$2,
         relay_approved_at=CASE WHEN $3 THEN NOW() ELSE NULL END,
         updated_at=NOW() WHERE id=$1`,
        [roomId, approved ? "confirmed" : "rejected", approved]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      return ctx.reply(err.message || "Gagal memproses.");
    } finally {
      client.release();
    }
    await ctx.reply(approved
      ? `Permintaan #${roomId} diterima. Buka /rooms untuk masuk ke chat anonim.`
      : `Permintaan #${roomId} ditolak.`);
    try {
      await bot.telegram.sendMessage(result.buyer_chat, approved
        ? `Terapis menerima permintaan #${roomId}. Buka /rooms untuk mulai chat anonim.`
        : `Terapis menolak permintaan #${roomId}. Silakan cari layanan lain lewat /browse.`);
    } catch { /* Recipient may have blocked the bot. Never reveal their identity. */ }
  });

  bot.command("rooms", requireActiveUser, async (ctx) => {
    if (ctx.chat?.type !== "private") return ctx.reply("Gunakan chat pribadi bot.");
    const { rows } = await pool.query(
      `SELECT b.id, s.name AS service_name, b.status, b.relay_closed_at,
              sp.public_alias
       FROM bookings b
       LEFT JOIN services s ON s.id=b.service_id
       JOIN seller_profiles sp ON sp.user_id=b.seller_id
       WHERE b.buyer_id=$1 OR b.seller_id=$1
       ORDER BY b.created_at DESC LIMIT 15`, [ctx.state.user.id]
    );
    if (!rows.length) return ctx.reply("Belum ada permintaan. Pelanggan: /browse.");
    for (const room of rows) {
      const active = await activeRoom(ctx.state.user.id, room.id);
      const text = `Booking #${room.id}\nLayanan: ${room.service_name || "Layanan"}\nStatus: ${room.relay_closed_at ? "ditutup" : room.status}`;
      await ctx.reply(text, active
        ? Markup.inlineKeyboard([[Markup.button.callback("💬 Buka chat anonim", `relay_focus:${room.id}`)],
            [Markup.button.callback("🔒 Tutup chat", `relay_close:${room.id}`)]])
        : undefined);
    }
  });

  bot.action(/^relay_focus:(\d+)$/, requireActiveUser, async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.chat?.type !== "private") return ctx.reply("Gunakan chat pribadi bot.");
    const roomId = asId(ctx.match[1]);
    if (!await activeRoom(ctx.state.user.id, roomId)) return ctx.reply("Room tidak aktif atau belum disetujui.");
    await pool.query(
      `INSERT INTO chat_focus(user_id,booking_id) VALUES($1,$2)
       ON CONFLICT(user_id) DO UPDATE SET booking_id=EXCLUDED.booking_id, updated_at=NOW()`,
      [ctx.state.user.id, roomId]
    );
    await ctx.reply(`Chat anonim #${roomId} aktif. Kirim pesan teks di sini. Gunakan /rooms untuk pindah atau menutup chat. Jangan membagikan kontak pribadi.`);
  });

  bot.action(/^relay_close:(\d+)$/, requireActiveUser, async (ctx) => {
    await ctx.answerCbQuery();
    const roomId = asId(ctx.match[1]);
    const { rows } = await pool.query(
      `UPDATE bookings SET relay_closed_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)
         AND status='confirmed' AND relay_approved_at IS NOT NULL
         AND relay_closed_at IS NULL
       RETURNING buyer_id, seller_id`, [roomId, ctx.state.user.id]
    );
    if (!rows.length) return ctx.reply("Chat sudah ditutup atau tidak ditemukan.");
    await pool.query("DELETE FROM chat_focus WHERE booking_id=$1", [roomId]);
    await ctx.reply(`Chat #${roomId} ditutup.`);
    const otherId = rows[0].buyer_id === ctx.state.user.id ? rows[0].seller_id : rows[0].buyer_id;
    const other = await pool.query("SELECT telegram_id FROM users WHERE id=$1", [otherId]);
    if (other.rowCount) {
      try { await bot.telegram.sendMessage(other.rows[0].telegram_id, `Chat #${roomId} telah ditutup.`); }
      catch { /* Participant unavailable */ }
    }
  });

  // Use fresh bot messages, never forwardMessage: forwarding may expose Telegram identities.
  // Text-only MVP: no photos, documents, contact cards, or forwarded content are relayed.
  bot.on("text", async (ctx, next) => {
    if (ctx.chat?.type !== "private" || ctx.message.text.startsWith("/")) return next();
    const userResult = await pool.query(
      "SELECT id FROM users WHERE telegram_id=$1 AND status='active'",
      [String(ctx.from?.id || "")]
    );
    if (!userResult.rowCount) return next();
    const userId = userResult.rows[0].id;
    const focus = await pool.query("SELECT booking_id FROM chat_focus WHERE user_id=$1", [userId]);
    if (!focus.rowCount) return next();
    const roomId = focus.rows[0].booking_id;
    const room = await activeRoom(userId, roomId);
    if (!room) {
      await pool.query("DELETE FROM chat_focus WHERE user_id=$1", [userId]);
      return ctx.reply("Sesi chat sudah tidak aktif. Gunakan /rooms.");
    }
    const body = ctx.message.text.trim();
    if (!body || body.length > 1000) return ctx.reply("Kirim pesan teks maksimal 1000 karakter.");
    if (contactPattern.test(body)) return ctx.reply("Demi privasi, jangan kirim nomor, username, atau tautan.");
    const recipient = String(room.buyer_id) === String(userId) ? room.seller_chat : room.buyer_chat;
    try {
      await bot.telegram.sendMessage(recipient, `💬 Chat #${roomId}\n${body}`);
      await ctx.reply("✓ Pesan dikirim.");
    } catch {
      await ctx.reply("Pesan belum terkirim; penerima mungkin menonaktifkan bot.");
    }
  });
}
