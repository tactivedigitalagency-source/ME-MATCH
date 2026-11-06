-- Add request/approval statuses without removing legacy reported bookings.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('requested','rejected','reported','confirmed','completed','cancelled','disputed'));

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS relay_closed_at TIMESTAMPTZ;
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS public_alias VARCHAR(40);

-- At most one selected booking per person, persisted across bot restarts.
CREATE TABLE IF NOT EXISTS chat_focus (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_seller_requests
  ON bookings (seller_id, created_at DESC) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_relay
  ON bookings (buyer_id, created_at DESC) WHERE status IN ('requested', 'confirmed');
