import { pool } from "../db/pool.js";

export async function getCurrentUser(ctx) {
  if (!ctx.from?.id) return null;
  const result = await pool.query(
    `SELECT * FROM users WHERE telegram_id = $1 AND status = 'active'`,
    [String(ctx.from.id)]
  );
  return result.rows[0] || null;
}

export async function requireActiveUser(ctx, next) {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply("Silakan jalankan /start dan selesaikan pendaftaran terlebih dahulu.");
    return;
  }
  ctx.state.user = user;
  return next();
}
