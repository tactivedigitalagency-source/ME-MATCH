import { Telegraf } from "telegraf";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { registerStartHandlers } from "./handlers/start.js";
import { registerRegistrationHandlers } from "./handlers/registration.js";
import { registerSellerHandlers } from "./handlers/seller.js";
import { registerBuyerHandlers } from "./handlers/buyer.js";
import { registerContactHandlers } from "./handlers/contact.js";
import { registerAdminHandlers } from "./handlers/admin.js";

export function createBot() {
  const bot = new Telegraf(env.BOT_TOKEN);
  bot.use(rateLimit({ limit: 30, windowMs: 60_000 }));

  registerStartHandlers(bot);
  registerRegistrationHandlers(bot);
  registerSellerHandlers(bot);
  registerBuyerHandlers(bot);
  registerContactHandlers(bot);
  registerAdminHandlers(bot);

  bot.catch((err, ctx) => {
    logger.error({ updateId: ctx.update?.update_id, err: err.message }, "Telegram handler failed");
  });

  return bot;
}
