import { describe, expect, it } from "vitest";

function mayRegister({ ageConfirmed, minimumAge = 18 }) {
  return minimumAge >= 18 && ageConfirmed === true;
}

describe("minimum age policy", () => {
  it("requires explicit adult confirmation", () => {
    expect(mayRegister({ ageConfirmed: true })).toBe(true);
    expect(mayRegister({ ageConfirmed: false })).toBe(false);
  });

  it("does not allow configuration below 18", () => {
    expect(mayRegister({ ageConfirmed: true, minimumAge: 17 })).toBe(false);
  });
});
