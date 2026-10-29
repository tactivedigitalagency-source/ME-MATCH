import { describe, expect, it } from "vitest";

function commission(amountIdr, bps) {
  if (!Number.isSafeInteger(amountIdr) || amountIdr < 0) throw new Error("invalid amount");
  if (!Number.isInteger(bps) || bps < 0 || bps > 5000) throw new Error("invalid bps");
  return Math.round(amountIdr * bps / 10000);
}

describe("commission calculation", () => {
  it("calculates default 10 percent", () => {
    expect(commission(150000, 1000)).toBe(15000);
  });

  it("supports zero commission", () => {
    expect(commission(150000, 0)).toBe(0);
  });

  it("rejects invalid amount and rate", () => {
    expect(() => commission(-1, 1000)).toThrow();
    expect(() => commission(100, 6000)).toThrow();
  });
});
