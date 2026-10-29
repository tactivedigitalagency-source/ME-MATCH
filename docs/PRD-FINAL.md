# MassageMatch v2.0 — Final PRD

## Product summary
A Telegram marketplace connecting adult buyers directly with massage-service sellers. Sellers self-register but remain invisible until admin approval. Buyers browse approved profiles and contact sellers through Telegram DMs. Full address is shared after both parties agree.

## Product decisions
- Matching: buyer chooses seller and contacts them directly.
- Registration: self-service registration.
- Communication: Telegram DM via public seller username.
- Service location: buyer visits seller; public profile shows city only.
- Age: 18+; MVP uses self-declaration and is not identity-grade age verification.
- Monetization: transaction commission. The MVP does not process payments or observe private DMs, so bookings and commission must be manually reported/verified.
- Platform: Telegram Bot API, Node.js, Telegraf, PostgreSQL, Docker Compose.

## Roles
- Buyer: browse/filter sellers, inspect services, favorite, report, block, contact.
- Seller: manage profile/services/availability; agree to commission terms; share full address after agreement.
- Admin: approve/reject seller profiles, suspend users, inspect reports, record commission after verification.

## P0 scope
- Registration and age/terms acknowledgment.
- Seller profile and service management.
- Seller approval before discovery.
- Buyer search by city/category/maximum price.
- Profile details, public Telegram contact URL.
- Favorites, blocks, reports.
- Admin moderation commands.
- Booking report and commission record commands.
- PostgreSQL migrations, structured logs, Docker deployment and automated tests.

## P1
- Better age assurance and seller verification.
- Automated backup/restore checks and external monitoring.
- Booking confirmation workflow with both-party confirmation.
- Favorites management and analytics dashboard.
- Photo moderation queue and appeal process.

## P2
- Telegram Mini App swipe UI.
- Calendar availability.
- Payment gateway and automated commission settlement.
- Reviews with anti-abuse safeguards.

## Privacy and safety
- Never publish full address in public profile.
- Do not store private DM content.
- Show only active, approved sellers.
- Respect blocks and reports.
- Publish clear terms, privacy policy, commission rules, cancellation/dispute rules, and data-retention policy before public launch.
- Age confirmation is a self-declaration only; stronger assurance may be required before launch.
