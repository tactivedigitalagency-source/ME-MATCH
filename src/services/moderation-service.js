import { pool } from "../db/pool.js";

export async function listPendingSellers() {
  const result = await pool.query(
    `SELECT u.id, u.telegram_id, u.display_name, u.username, sp.city, sp.category
     FROM users u JOIN seller_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'seller' AND u.status = 'active'
       AND sp.moderation_status = 'pending'
     ORDER BY u.created_at ASC LIMIT 50`
  );
  return result.rows;
}

export async function moderateSeller(adminId, telegramId, status, reason = "") {
  if (!["approved", "rejected"].includes(status)) throw new Error("Status moderasi tidak valid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      `SELECT u.id, u.telegram_id FROM users u
       WHERE u.telegram_id = $1 AND u.role = 'seller'`,
      [String(telegramId)]
    );
    if (!target.rowCount) throw new Error("Seller tidak ditemukan.");
    await client.query(
      `UPDATE seller_profiles SET moderation_status = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [target.rows[0].id, status]
    );
    await client.query(
      `INSERT INTO admin_audit_log(admin_user_id, action, target_telegram_id, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId, `seller_${status}`, String(telegramId), reason || null]
    );
    await client.query("COMMIT");
    return target.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function setUserStatus(adminId, telegramId, status, reason = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE users SET status = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING id",
      [String(telegramId), status]
    );
    if (!result.rowCount) throw new Error("Pengguna tidak ditemukan.");
    await client.query(
      `INSERT INTO admin_audit_log(admin_user_id, action, target_telegram_id, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId, `user_${status}`, String(telegramId), reason || null]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listOpenReports() {
  const result = await pool.query(
    `SELECT r.*, reporter.telegram_id AS reporter_telegram_id,
            target.telegram_id AS target_telegram_id
     FROM reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     LEFT JOIN users target ON target.id = r.target_user_id
     WHERE r.status IN ('open', 'reviewing')
     ORDER BY r.created_at ASC LIMIT 30`
  );
  return result.rows;
}
