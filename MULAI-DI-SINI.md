# LC Companion — pendamping sosial nonseksual

Versi ini untuk teman karaoke, ngobrol, dan pendamping acara. Bukan layanan seksual. Akses 18+ berupa pernyataan pengguna, belum pemeriksaan identitas. Admin wajib memeriksa profil dan layanan sebelum menyetujuinya. Persetujuan dan batasan pribadi wajib dihormati.

## Pemasangan pertama
1. Sediakan VPS dengan Docker Engine, Docker Compose, dan Node.js 22+. Berkas ini tidak membeli atau menghubungkan server otomatis.
2. Buat bot melalui akun Telegram resmi @BotFather, perintah /newbot. Simpan token secara pribadi.
3. Siapkan Telegram ID angka milik admin.
4. Buka terminal di folder proyek lalu jalankan `node scripts/setup.mjs`. Isi dua pertanyaan. Password database dibuat otomatis.
5. Jalankan `bash start.sh`. Database disiapkan dahulu, migration dijalankan, kemudian bot diaktifkan.
6. Buka bot di Telegram, kirim `/start`. Admin gunakan `/admin` dan `/admin_help`.

Jangan jalankan dua salinan bot dengan token yang sama. Pengaturan harga masih Rupiah; perlu penyesuaian mata uang sebelum dipakai di negara lain. Komisi awal 10%, ubah COMMISSION_BPS dalam .env bila perlu. Komisi dicatat manual, belum menerima pembayaran otomatis.

## Penggunaan
Penyedia mendaftar sebagai Seller, mengisi /setprofile dan /addservice. Kategori: Teman karaoke, Teman ngobrol, Pendamping acara. Penambahan layanan meminta moderasi ulang. Admin memakai /admin_pending, memeriksa profil dan layanan, lalu /admin_approve ID. Pelanggan mendaftar sebagai Buyer dan memakai /browse. Hanya kota yang boleh diisi dalam profil publik; gunakan tempat pertemuan yang disepakati kedua pihak.

## Operasional
- Lihat status: `docker compose ps`
- Lihat error: `docker compose logs --tail=50 bot`
- Hentikan: `docker compose stop`
- Jalankan kembali: `docker compose up -d`
- Cadangkan: `docker compose exec -T db pg_dump -U app massage_match > backup.sql`
- Jangan gunakan `docker compose down -v`: volume database akan dihapus.

## Batasan versi
Belum diuji dengan akun Telegram dan PostgreSQL hidup dalam sesi pembuatan ini. Belum ada verifikasi identitas, pembayaran otomatis, penjadwalan bentrok, atau pelokalan mata uang. Tidak ada bot/server yang sudah aktif. Perlu pemeriksaan isi layanan oleh admin; teks kebijakan tidak otomatis memfilter seluruh pelanggaran.
