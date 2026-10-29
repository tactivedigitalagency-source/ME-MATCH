import { pool } from "../db/pool.js";

export async function reportBooking({ reporterId, buyerTelegramId, sellerTelegramId, serviceId, amountIdr, notes }) {
  if (!Number.isSafeInteger(Number(amountIdr)) || Number(amountIdr) < 0) {
    throw new Error("Nominal booking tidak valid.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = await client.query(
      `SELECT id, telegram_id, role FROM users
       WHERE telegram_id = ANY($1::bigint[])`,
      [[String(buyerTelegramId), String(sellerTelegramId)]]
    );
    const buyer = ids.rows.find((u) => String(u.telegram_id) === String(buyerTelegramId) && u.role === "buyer");
    const seller = ids.rows.find((u) => String(u.telegram_id) === String(sellerTelegramId) && u.role === "seller");
    if (!buyer || !seller) throw new Error("Buyer atau seller tidak ditemukan dengan peran yang sesuai.");
    if (String(reporterId) !== String(buyer.id) && String(reporterId) !== String(seller.id)) {
      throw new Error("Hanya buyer atau seller yang terlibat yang boleh melaporkan booking ini.");
    }

    const booking = await client.query(
      `INSERT INTO bookings(buyer_id, seller_id, service_id, agreed_price_idr, reported_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [buyer.id, seller.id, serviceId || null, Number(amountIdr), reporterId, notes || null]
    );
    await client.query("COMMIT");
    return booking.rows[0].id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function recordCommission({ adminId, bookingId, amountIdr, note }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const booking = await client.query(
      `SELECT b.id, b.seller_id, b.agreed_price_idr, sp.commission_bps
       FROM bookings b JOIN seller_profiles sp ON sp.user_id = b.seller_id
       WHERE b.id = $1`,
      [bookingId]
    );
    if (!booking.rowCount) throw new Error("Booking tidak ditemukan.");
    const b = booking.rows[0];
    const gross = Number(amountIdr);
    if (!Number.isSafeInteger(gross) || gross < 0) throw new Error("Nominal tidak valid.");
    const commission = Math.round(gross * Number(b.commission_bps) / 10000);
    await client.query(
      `INSERT INTO commission_records
       (booking_id, seller_id, gross_amount_idr, commission_bps, commission_amount_idr,
        status, verification_note, verified_by, verified_at)
       VALUES ($1, $2, $3, $4, $5, 'due', $6, $7, NOW())
       ON CONFLICT (booking_id) DO UPDATE SET
         gross_amount_idr = EXCLUDED.gross_amount_idr,
         commission_bps = EXCLUDED.commission_bps,
         commission_amount_idr = EXCLUDED.commission_amount_idr,
         status = 'due', verification_note = EXCLUDED.verification_note,
         verified_by = EXCLUDED.verified_by, verified_at = NOW()`,
      [b.id, b.seller_id, gross, b.commission_bps, commission, note || null, adminId]
    );
    await client.query("UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1", [bookingId]);
    await client.query("COMMIT");
    return { gross, bps: Number(b.commission_bps), commission };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
