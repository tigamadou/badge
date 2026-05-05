// src/lib/__tests__/qrcode.test.ts
import { describe, it, expect } from "vitest";
import { generateQRCodeDataURL } from "../qrcode";

describe("generateQRCodeDataURL", () => {
  it("returns a base64 PNG data URL", async () => {
    const dataUrl = await generateQRCodeDataURL("1260524A7F3B2");
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns a non-empty image", async () => {
    const dataUrl = await generateQRCodeDataURL("1260524A7F3B2");
    const base64Part = dataUrl.split(",")[1];
    expect(base64Part.length).toBeGreaterThan(100);
  });

  it("produces different images for different inputs", async () => {
    const a = await generateQRCodeDataURL("AAA");
    const b = await generateQRCodeDataURL("BBB");
    expect(a).not.toBe(b);
  });
});
