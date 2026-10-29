import { pool } from "../db/pool.js";

export async function addFavorite(buyerId, sellerId) {
  if (String(buyerId) === String(sellerId)) throw new Error("Tidak dapat memfavoritkan diri sendiri.");
  await pool.query(
    `INSERT INTO favorites(buyer_id, seller_id)
     SELECT $1, $2
     WHERE EXISTS (
       SELECT 1 FROM users u JOIN seller_profiles sp ON sp.user_id = u.id
       WHERE u.id = $2 AND u.role = 'seller' AND u.status = 'active'
         AND sp.moderation_status = 'approved'
     )
     ON CONFLICT DO NOTHING`,
    [buyerId, sellerId]
  );
}

export async function blockUser(blockerId, blockedId) {
  if (String(blockerId) === String(blockedId)) throw new Error("Tidak dapat memblokir diri sendiri.");
  await pool.query(
    `INSERT INTO blocks(blocker_id, blocked_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
}

export async function reportUser({ reporterId, targetUserId, reason, details }) {
  if (String(reporterId) === String(targetUserId)) throw new Error("Tidak dapat melaporkan akun sendiri.");
  const result = await pool.query(
    `INSERT INTO reports(reporter_id, target_user_id, reason, details)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [reporterId, targetUserId, reason, details || null]
  );
  return result.rows[0].id;
}

export async function recordContact({ buyerId, sellerId, serviceId }) {
  if (String(buyerId) === String(sellerId)) throw new Error("Tidak dapat menghubungi diri sendiri.");
  const result = await pool.query(
    `INSERT INTO contact_events(buyer_id, seller_id, service_id)
     SELECT $1, $2, $3
     WHERE EXISTS (
       SELECT 1 FROM users u JOIN seller_profiles sp ON sp.user_id = u.id
       WHERE u.id = $2 AND u.role = 'seller' AND u.status = 'active'
         AND sp.moderation_status = 'approved'
     )
     AND NOT EXISTS (
       SELECT 1 FROM blocks b
       WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
          OR (b.blocker_id = $2 AND b.blocked_id = $1)
     )
     RETURNING id`,
    [buyerId, sellerId, serviceId || null]
  );
  if (!result.rowCount) throw new Error("Seller tidak tersedia atau kontak diblokir.");
  return result.rows[0].id;
}
