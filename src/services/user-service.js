import { pool } from "../db/pool.js";
import { env } from "../config/env.js";

export async function registerUser({ telegramId, role, username, displayName, ageConfirmed }) {
  if (!["buyer", "seller"].includes(role)) throw new Error("Peran tidak valid.");
  if (!ageConfirmed) throw new Error("Pengguna harus menyatakan berusia minimal 18 tahun.");

  const status = role === "seller" ? "pending" : "active";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users
        (telegram_id, role, username, display_name, age_confirmed, terms_version, terms_accepted_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (telegram_id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()
       RETURNING *`,
      [String(telegramId), role, username || null, displayName || "Pengguna", true, env.TERMS_VERSION, status]
    );
    const user = result.rows[0];

    if (user.role !== role) throw new Error("Akun sudah terdaftar dengan peran berbeda.");

    if (role === "seller") {
      await client.query(
        `INSERT INTO seller_profiles
           (user_id, city, public_username, commission_bps, commission_terms_accepted_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, "Belum diatur", username || null, env.COMMISSION_BPS]
      );
    }
    await client.query("COMMIT");
    return user;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
