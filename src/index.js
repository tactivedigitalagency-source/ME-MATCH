import "dotenv/config";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { createBot } from "./bot.js";
import { logger } from "./utils/logger.js";

const bot = createBot();
let stopping = false;

async function main() {
  await pool.query("SELECT 1");
  await bot.launch();
  logger.info({ mode: env.BOT_MODE }, "LC Companion bot started");
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Shutting down");
  bot.stop(signal);
  await pool.end();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  logger.error({ err: err.message }, "Startup failed");
  process.exit(1);
});
