import { describe, it, expect } from "vitest";
import { readWorkerConfig } from "@/lib/jobs/config";

describe("readWorkerConfig", () => {
  it("reads defaults when env is empty", () =>
    expect(readWorkerConfig({})).toEqual({ pollIntervalMs: 2000, emailConcurrency: 5 }));

  it("reads valid overrides", () =>
    expect(
      readWorkerConfig({ JOB_POLL_INTERVAL_MS: "500", JOB_EMAIL_CONCURRENCY: "2" }),
    ).toEqual({ pollIntervalMs: 500, emailConcurrency: 2 }));

  it.each(["0", "-3", "abc", "1.5", ""])("falls back to defaults on invalid value %s", (v) =>
    expect(readWorkerConfig({ JOB_POLL_INTERVAL_MS: v, JOB_EMAIL_CONCURRENCY: v })).toEqual({
      pollIntervalMs: 2000,
      emailConcurrency: 5,
    }));
});
