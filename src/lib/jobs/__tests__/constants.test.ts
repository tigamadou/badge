import { describe, it, expect } from "vitest";
import { computeRetryDelayMs } from "@/lib/jobs/constants";

describe("computeRetryDelayMs", () => {
  it.each([
    [1, 60_000],
    [2, 300_000],
    [3, 1_800_000],
    [4, 7_200_000],
    [9, 7_200_000],
  ])("computeRetryDelayMs(%i) = %i", (a, ms) => expect(computeRetryDelayMs(a)).toBe(ms));

  it("clamps attempts below 1 to the first delay", () =>
    expect(computeRetryDelayMs(0)).toBe(60_000));
});
