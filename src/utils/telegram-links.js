export function telegramProfileUrl(username) {
  const clean = String(username || "").replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{5,32}$/.test(clean)) return null;
  return `https://t.me/${clean}`;
}
