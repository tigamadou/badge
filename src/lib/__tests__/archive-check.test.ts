import { describe, it, expect } from "vitest";
import { checkArchiveFile } from "../archive-check";

describe("checkArchiveFile", () => {
  const max = 10 * 1024 * 1024;
  it("accepte un .zip sous la borne", () => {
    expect(checkArchiveFile({ name: "t.ZIP", size: 1000 }, max)).toBeNull();
  });
  it("refuse une autre extension", () => {
    expect(checkArchiveFile({ name: "t.pdf", size: 1000 }, max)).toBe("Seules les archives .zip sont acceptées.");
  });
  it("refuse une archive trop lourde", () => {
    expect(checkArchiveFile({ name: "t.zip", size: max + 1 }, max)).toBe("Archive trop lourde : 10 Mo au plus.");
  });
});
