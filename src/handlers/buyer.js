import { Markup } from "telegraf";
import { requireActiveUser } from "../middleware/require-user.js";
import { requireRole } from "../middleware/require-role.js";
import { searchSellers, listServicesForSeller, getSellerDetails } from "../services/search-service.js";
import { addFavorite, blockUser, reportUser } from "../services/safety-service.js";
import { telegramProfileUrl } from "../utils/telegram-links.js";
import { pool } from "../db/pool.js";

const searchState = new Map();

export function registerBuyerHandlers(bot) {
  bot.command("browse", requireActiveUser, requireRole("buyer"), async (ctx) => {
    searchState.set(String(ctx.from.id), { offset: 0, city: null, category: null, maxPrice: null });
    await ctx.reply(
      "Pilih cara mencari seller:",
      Markup.inlineKeyboard([
        [Markup.button.callback("Semua seller", "browse:all")],
        [Markup.button.callback("Filter kota", "browse:city")],
        [Markup.button.callback("Filter kategori", "browse:category")],
        [Markup.button.callback("Filter harga maks.", "browse:price")]
      ])
    );
  });

  bot.action("browse:all", requireActiveUser, requireRole("buyer"), async (ctx) => {
    await ctx.answerCbQuery();
    const state = searchState.get(String(ctx.from.id)) || { offset: 0 };
    state.offset = 0;
    searchState.set(String(ctx.from.id), state);
    await showResults(ctx, state);
  });

  for (const field of ["city", "category", "price"]) {
    bot.action(`browse:${field}`, requireActiveUser, requireRole("buyer"), async (ctx) => {
      await ctx.answerCbQuery();
      searchState.set(String(ctx.from.id), { ...(searchState.get(String(ctx.from.id)) || {}), waitingFor: field, offset: 0 });
      await ctx.reply(field === "price" ? "Kirim harga maksimum dalam Rupiah (angka saja)." : `Kirim ${field === "city" ? "kota" : "kategori"} yang ingin dicari.`);
    });
  }

  bot.command("profile", requireActiveUser, async (ctx) => {
    const u = ctx.state.user;
    await ctx.reply(`Profil akun\nNama: ${u.display_name || "-"}\nPeran: ${u.role}\nStatus: ${u.status}\nUsia minimum 18+: dikonfirmasi saat daftar.`);
  });

  bot.action(/^seller_view:(\d+)$/, requireActiveUser, requireRole("buyer"), async (ctx) => {
    await ctx.answerCbQuery();
    const sellerId = Number(ctx.match[1]);
    const seller = await getSellerDetails(sellerId, ctx.state.user.id);
    if (!seller) return ctx.reply("Profil seller tidak tersedia.");
    const services = await listServicesForSeller(sellerId);
    const url = telegramProfileUrl(seller.public_username);
    const lines = [
      `Seller: ${seller.display_name || "Seller"}`,
      `Kategori: ${seller.category || "-"}`,
      `Kota: ${seller.city}`,
      `Ketersediaan: ${seller.availability}`,
      `Bio: ${seller.bio || "-"}`,
      "",
      "Layanan:"
    ];
    for (const s of services) {
      lines.push(`#${s.id} ${s.name} — ${s.duration_minutes} menit — Rp${Number(s.price_idr).toLocaleString("id-ID")}`);
      if (s.description) lines.push(s.description);
    }
    lines.push("", "Alamat lengkap dibagikan setelah kedua pihak menyepakati layanan.");
    const buttons = [
      [Markup.button.callback("Favorit", `favorite:${sellerId}`)],
      [Markup.button.callback("Laporkan", `report:${sellerId}`)],
      [Markup.button.callback("Blokir", `block:${sellerId}`)]
    ];
    if (url) buttons.unshift([Markup.button.url("Hubungi di Telegram", url)]);
    await ctx.reply(lines.join("\n"), Markup.inlineKeyboard(buttons));
  });

  bot.action(/^favorite:(\d+)$/, requireActiveUser, requireRole("buyer"), async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await addFavorite(ctx.state.user.id, Number(ctx.match[1]));
      await ctx.reply("Seller ditambahkan ke favorit.");
    } catch (err) {
      await ctx.reply(err.message || "Tidak dapat menambahkan favorit.");
    }
  });

  bot.action(/^block:(\d+)$/, requireActiveUser, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await blockUser(ctx.state.user.id, Number(ctx.match[1]));
      await ctx.reply("Akun diblokir dan tidak akan ditampilkan kembali pada hasil pencarian Anda.");
    } catch (err) {
      await ctx.reply(err.message || "Gagal memblokir akun.");
    }
  });

  bot.action(/^report:(\d+)$/, requireActiveUser, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const id = await reportUser({
        reporterId: ctx.state.user.id,
        targetUserId: Number(ctx.match[1]),
        reason: "profile_concern",
        details: "Dilaporkan melalui tombol profil."
      });
      await ctx.reply(`Laporan #${id} diterima. Admin akan meninjau laporan ini.`);
    } catch (err) {
      await ctx.reply(err.message || "Gagal membuat laporan.");
    }
  });

  bot.on("text", async (ctx, next) => {
    const state = searchState.get(String(ctx.from.id));
    if (!state?.waitingFor || ctx.message.text.startsWith("/")) return next();
    const field = state.waitingFor;
    const text = ctx.message.text.trim();
    if (field === "city") state.city = text.slice(0, 100);
    if (field === "category") state.category = text.slice(0, 80);
    if (field === "price") {
      const n = Number(text);
      if (!Number.isSafeInteger(n) || n < 0) {
        await ctx.reply("Harga maksimum tidak valid. Kirim angka Rupiah saja.");
        return;
      }
      state.maxPrice = n;
    }
    state.waitingFor = null;
    state.offset = 0;
    searchState.set(String(ctx.from.id), state);
    await showResults(ctx, state);
  });
}

async function showResults(ctx, state) {
  const userRes = await pool.query("SELECT id FROM users WHERE telegram_id = $1", [String(ctx.from.id)]);
  if (!userRes.rowCount) return ctx.reply("Silakan daftar terlebih dahulu.");
  const rows = await searchSellers({
    city: state.city,
    category: state.category,
    maxPrice: state.maxPrice,
    offset: state.offset || 0,
    buyerId: userRes.rows[0].id
  });
  if (!rows.length) {
    await ctx.reply("Belum ada seller yang cocok. Coba ubah filter atau kembali lagi nanti.");
    return;
  }
  for (const seller of rows) {
    const services = await listServicesForSeller(seller.user_id);
    const price = services.length ? `Mulai Rp${Math.min(...services.map((s) => Number(s.price_idr))).toLocaleString("id-ID")}` : "Belum ada layanan aktif";
    const text = `${seller.display_name || "Seller"}\n${seller.category || "Kategori belum diatur"}\nKota: ${seller.city}\n${price}\nKetersediaan: ${seller.availability}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Lihat profil & layanan", `seller_view:${seller.user_id}`)]
    ]);
    if (seller.photo_file_id) {
      await ctx.replyWithPhoto(seller.photo_file_id, { caption: text, ...keyboard });
    } else {
      await ctx.reply(text, keyboard);
    }
  }
}
