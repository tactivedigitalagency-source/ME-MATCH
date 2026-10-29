import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';
const rl = createInterface({ input: stdin, output: stdout });
try {
  try { await access('.env'); console.log('.env sudah ada. Pengaturan lama dipertahankan.'); process.exitCode = 1; }
  catch {
    console.log('Jalankan hanya di terminal pribadi. Token dimasukkan di perangkat ini; jangan bagikan screenshot.');
    const token = (await rl.question('Token dari BotFather: ')).trim();
    const admins = (await rl.question('Telegram ID admin (angka, pisahkan koma jika lebih dari satu): ')).trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || !/^\d+(,\d+)*$/.test(admins)) throw new Error('Format token atau ID admin tidak valid.');
    const password = randomBytes(32).toString('hex');
    await writeFile('.env', `NODE_ENV=production\nBOT_TOKEN=${token}\nADMIN_IDS=${admins}\nDB_PASSWORD=${password}\nDATABASE_URL=postgresql://app:${password}@db:5432/massage_match\nMIN_AGE=18\nCOMMISSION_BPS=1000\nTERMS_VERSION=lc-social-v1\nBOT_MODE=polling\nLOG_LEVEL=info\n`, { mode: 0o600, flag: 'wx' });
    console.log('Pengaturan tersimpan. Jalankan: bash start.sh');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { rl.close(); }
