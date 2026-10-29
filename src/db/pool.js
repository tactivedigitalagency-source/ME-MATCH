import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: "massagematch-bot"
});

pool.on("error", (err) => {
  console.error("Unexpected idle PostgreSQL client error", err.message);
});
