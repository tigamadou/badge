import { describe, it, expect, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
    })),
  },
}));

// Set env before importing
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.SMTP_FROM = "test@test.com";

import { sendRegistrationConfirmation, sendStatusNotification } from "../mail";

describe("mail", () => {
  it("sendRegistrationConfirmation sends an email", async () => {
    await expect(
      sendRegistrationConfirmation("user@test.com", "Jean Dupont")
    ).resolves.not.toThrow();
  });

  it("sendStatusNotification sends approval email", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "APPROVED")
    ).resolves.not.toThrow();
  });

  it("sendStatusNotification sends rejection email", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "REJECTED")
    ).resolves.not.toThrow();
  });

  it("sendBadgePrintedNotification sends email with contact info", async () => {
    const { sendBadgePrintedNotification } = await import("../mail");
    await expect(
      sendBadgePrintedNotification(
        "user@test.com",
        "Jean Dupont",
        "contact@event.com",
        "+229 97 00 00 00"
      )
    ).resolves.not.toThrow();
  });
});
