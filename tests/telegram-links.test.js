import { describe, expect, it } from "vitest";
import { telegramProfileUrl } from "../src/utils/telegram-links.js";

describe("telegramProfileUrl", () => {
  it("creates a valid public profile URL", () => {
    expect(telegramProfileUrl("massage_seller")).toBe("https://t.me/massage_seller");
  });

  it("accepts a leading @", () => {
    expect(telegramProfileUrl("@massage_seller")).toBe("https://t.me/massage_seller");
  });

  it("rejects malformed usernames", () => {
    expect(telegramProfileUrl("ab")).toBeNull();
    expect(telegramProfileUrl("bad username")).toBeNull();
    expect(telegramProfileUrl(null)).toBeNull();
  });
});
