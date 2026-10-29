import { pool } from "../db/pool.js";

export async function updateSellerProfile(userId, data) {
  const result = await pool.query(
    `UPDATE seller_profiles sp
     SET bio = $2, photo_file_id = COALESCE($3, sp.photo_file_id),
         category = $4, city = $5, address_text = $6,
         public_username = $7, availability = $8,
         moderation_status = 'pending', updated_at = NOW()
     FROM users u
     WHERE sp.user_id = u.id AND sp.user_id = $1
       AND u.role = 'seller' AND u.status = 'active'
     RETURNING sp.*`,
    [userId, data.bio, data.photoFileId || null, data.category, data.city,
      data.addressText || null, data.publicUsername || null, data.availability || "unknown"]
  );
  if (!result.rowCount) throw new Error("Profil seller tidak ditemukan atau akun tidak aktif.");
  return result.rows[0];
}

export async function addService(sellerId, data) {
  const result = await pool.query(
    `INSERT INTO services (seller_id, name, description, duration_minutes, price_idr)
     SELECT $1, $2, $3, $4, $5
     WHERE EXISTS (
       SELECT 1 FROM users WHERE id = $1 AND role = 'seller' AND status = 'active'
     )
     RETURNING *`,
    [sellerId, data.name, data.description || null, data.durationMinutes, data.priceIdr]
  );
  if (!result.rowCount) throw new Error("Akun seller tidak aktif.");
  await pool.query("UPDATE seller_profiles SET moderation_status = 'pending', updated_at = NOW() WHERE user_id = $1", [sellerId]);
  return result.rows[0];
}

export async function listOwnServices(sellerId) {
  const result = await pool.query(
    "SELECT * FROM services WHERE seller_id = $1 ORDER BY created_at DESC",
    [sellerId]
  );
  return result.rows;
}

export async function setServiceActive(sellerId, serviceId, active) {
  const result = await pool.query(
    `UPDATE services SET active = $3, updated_at = NOW()
     WHERE id = $1 AND seller_id = $2 RETURNING id`,
    [serviceId, sellerId, active]
  );
  return result.rowCount > 0;
}
