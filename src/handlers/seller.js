import { Markup } from "telegraf";
import { pool } from "../db/pool.js";
import { requireActiveUser } from "../middleware/require-user.js";
import { requireRole } from "../middleware/require-role.js";
import { updateSellerProfile, addService, listOwnServices, setServiceActive } from "../services/seller-service.js";

const sessions = new Map();

export function registerSellerHandlers(bot) {
  bot.command("seller", requireActiveUser, requireRole("seller"), async (ctx) => {
    await ctx.reply(
      "Menu Seller:\n/profile untuk profil\n/setprofile untuk mengisi profil\n/addservice untuk menambah layanan\n/myservices untuk daftar layanan\n/availability untuk status tersedia",
      Markup.inlineKeyboard([
        [Markup.button.callback("Status profil", "seller:status")],
        [Markup.button.callback("Set tersedia", "seller:avail:available"),
         Markup.button.callback("Set tidak tersedia", "seller:avail:unavailable")]
      ])
    );
  });

  bot.command("setprofile", requireActiveUser, requireRole("seller"), async (ctx) => {
    sessions.set(String(ctx.from.id), { type: "profile", step: 0, data: {} });
    await ctx.reply("Mari lengkapi profil. Kirim nama kota Anda:");
  });

  bot.command("addservice", requireActiveUser, requireRole("seller"), async (ctx) => {
    sessions.set(String(ctx.from.id), { type: "service", step: 0, data: {} });
    await ctx.reply("Kirim nama layanan, misalnya: Teman karaoke 60 menit.");
  });

  bot.command("myservices", requireActiveUser, requireRole("seller"), async (ctx) => {
    const rows = await listOwnServices(ctx.state.user.id);
    if (!rows.length) {
      await ctx.reply("Belum ada layanan. Gunakan /addservice.");
      return;
    }
    for (const s of rows) {
      await ctx.reply(
        `#${s.id} ${s.name}\n${s.duration_minutes} menit · Rp${Number(s.price_idr).toLocaleString("id-ID")}\n${s.active ? "Aktif" : "Nonaktif"}`,
        Markup.inlineKeyboard([[
          Markup.button.callback(s.active ? "Nonaktifkan" : "Aktifkan", `service_toggle:${s.id}:${!s.active}`)
        ]])
      );
    }
  });

  bot.action("seller:status", requireActiveUser, requireRole("seller"), async (ctx) => {
    await ctx.answerCbQuery();
    const r = await pool.query("SELECT * FROM seller_profiles WHERE user_id = $1", [ctx.state.user.id]);
    if (!r.rowCount) return ctx.reply("Profil belum tersedia. Gunakan /setprofile.");
    const p = r.rows[0];
    await ctx.reply(`Status moderasi: ${p.moderation_status}\nKota: ${p.city}\nKategori: ${p.category || "-"}\nUsername publik: ${p.public_username ? "@" + p.public_username : "belum diatur"}`);
  });

  bot.action(/^seller:avail:(available|unavailable)$/, requireActiveUser, requireRole("seller"), async (ctx) => {
    await ctx.answerCbQuery();
    await pool.query(
      "UPDATE seller_profiles SET availability = $2, updated_at = NOW() WHERE user_id = $1",
      [ctx.state.user.id, ctx.match[1]]
    );
    await ctx.reply("Status ketersediaan diperbarui. Perubahan profil akan memerlukan persetujuan ulang jika detail publik berubah.");
  });

  bot.action(/^service_toggle:(\d+):(true|false)$/, requireActiveUser, requireRole("seller"), async (ctx) => {
    await ctx.answerCbQuery();
    const ok = await setServiceActive(ctx.state.user.id, Number(ctx.match[1]), ctx.match[2] === "true");
    await ctx.reply(ok ? "Status layanan diperbarui." : "Layanan tidak ditemukan atau bukan milik Anda.");
  });

  bot.on("text", async (ctx, next) => {
    const session = sessions.get(String(ctx.from.id));
    if (!session || ctx.message.text.startsWith("/")) return next();
    const userRes = await pool.query("SELECT * FROM users WHERE telegram_id = $1 AND status = 'active'", [String(ctx.from.id)]);
    if (!userRes.rowCount) return next();
    const user = userRes.rows[0];
    if (session.type === "profile" && user.role === "seller") {
      const t = ctx.message.text.trim();
      if (session.step === 0) {
        session.data.city = t.slice(0, 100);
        session.step++;
        await ctx.reply("Kirim kategori layanan, misalnya: Teman karaoke, Teman ngobrol, atau Pendamping acara.");
      } else if (session.step === 1) {
        session.data.category = t.slice(0, 80);
        session.step++;
        await ctx.reply("Kirim bio singkat profil seller.");
      } else if (session.step === 2) {
        session.data.bio = t.slice(0, 1000);
        session.step++;
        await ctx.reply("Kirim username Telegram publik Anda tanpa @ (5–32 karakter). Pastikan username benar agar buyer dapat menghubungi Anda.");
      } else {
        const username = t.replace(/^@/, "");
        if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
          await ctx.reply("Format username tidak valid. Kirim 5–32 huruf, angka, atau underscore.");
          return;
        }
        session.data.publicUsername = username;
        try {
          await updateSellerProfile(user.id, {
            ...session.data,
            addressText: null,
            availability: "unknown"
          });
          sessions.delete(String(ctx.from.id));
          await ctx.reply("Profil tersimpan dan dikirim untuk persetujuan admin. Kota tampil publik; jangan kirim alamat lengkap ke profil publik.");
        } catch (err) {
          await ctx.reply(err.message || "Gagal menyimpan profil.");
        }
      }
      return;
    }

    if (session.type === "service" && user.role === "seller") {
      const t = ctx.message.text.trim();
      if (session.step === 0) {
        session.data.name = t.slice(0, 120);
        session.step++;
        await ctx.reply("Kirim durasi dalam menit (15–480).");
      } else if (session.step === 1) {
        const duration = Number(t);
        if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
          await ctx.reply("Durasi harus angka 15–480 menit.");
          return;
        }
        session.data.durationMinutes = duration;
        session.step++;
        await ctx.reply("Kirim harga dalam Rupiah, angka saja.");
      } else if (session.step === 2) {
        const price = Number(t);
        if (!Number.isSafeInteger(price) || price < 0) {
          await ctx.reply("Harga harus angka Rupiah non-negatif.");
          return;
        }
        session.data.priceIdr = price;
        session.step++;
        await ctx.reply("Kirim deskripsi singkat layanan.");
      } else {
        session.data.description = t.slice(0, 1000);
        try {
          const s = await addService(user.id, session.data);
          sessions.delete(String(ctx.from.id));
          await ctx.reply(`Layanan #${s.id} tersimpan. Profil dikirim untuk peninjauan ulang admin sebelum layanan tampil.`);
        } catch (err) {
          await ctx.reply(err.message || "Gagal menyimpan layanan.");
        }
      }
      return;
    }
    return next();
  });
}
