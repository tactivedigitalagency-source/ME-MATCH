import { pool } from "../db/pool.js";

export async function searchSellers({ city, category, maxPrice, offset = 0, buyerId }) {
  const values = [buyerId];
  const where = [
    "u.role = 'seller'",
    "u.status = 'active'",
    "sp.moderation_status = 'approved'",
    "sp.availability <> 'unavailable'",
    `NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = $1)
    )`
  ];

  if (city) {
    values.push(`%${city}%`);
    where.push(`sp.city ILIKE $${values.length}`);
  }
  if (category) {
    values.push(`%${category}%`);
    where.push(`sp.category ILIKE $${values.length}`);
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    values.push(maxPrice);
    where.push(`EXISTS (
      SELECT 1 FROM services s
      WHERE s.seller_id = u.id AND s.active = TRUE AND s.price_idr <= $${values.length}
    )`);
  }

  values.push(20, Math.max(0, Number(offset) || 0));
  const limitParam = values.length - 1;
  const offsetParam = values.length;

  const result = await pool.query(
    `SELECT u.id AS user_id, u.telegram_id, u.display_name, u.username,
            sp.bio, sp.photo_file_id, sp.category, sp.city, sp.public_username,
            sp.availability,
            (SELECT COUNT(*) FROM services s WHERE s.seller_id = u.id AND s.active = TRUE) AS service_count
     FROM users u
     JOIN seller_profiles sp ON sp.user_id = u.id
     WHERE ${where.join(" AND ")}
     ORDER BY sp.updated_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );
  return result.rows;
}

export async function getSellerDetails(sellerId, buyerId) {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.telegram_id, u.display_name, sp.*
     FROM users u JOIN seller_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1 AND u.status = 'active'
       AND u.role = 'seller' AND sp.moderation_status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $2 AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = $2)
       )`,
    [sellerId, buyerId]
  );
  return result.rows[0] || null;
}

export async function listServicesForSeller(sellerId) {
  const result = await pool.query(
    `SELECT id, name, description, duration_minutes, price_idr
     FROM services WHERE seller_id = $1 AND active = TRUE ORDER BY price_idr ASC`,
    [sellerId]
  );
  return result.rows;
}
