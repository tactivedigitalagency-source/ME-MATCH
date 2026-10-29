const buckets = new Map();

export function rateLimit({ limit = 20, windowMs = 60_000 } = {}) {
  return async (ctx, next) => {
    const id = String(ctx.from?.id || "unknown");
    const now = Date.now();
    const bucket = buckets.get(id);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets.set(id, { startedAt: now, count: 1 });
      return next();
    }
    if (bucket.count >= limit) {
      await ctx.reply("Terlalu banyak permintaan. Silakan coba lagi sebentar.");
      return;
    }
    bucket.count += 1;
    return next();
  };
}
