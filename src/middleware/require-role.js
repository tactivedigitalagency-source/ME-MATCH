export function requireRole(...roles) {
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user || !roles.includes(user.role)) {
      await ctx.reply("Fitur ini tidak tersedia untuk akun Anda.");
      return;
    }
    return next();
  };
}
