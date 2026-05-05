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

  it("sendStatusNotification sends approval email with badge link", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "APPROVED", "abc123")
    ).resolves.not.toThrow();
  });

  it("sendStatusNotification sends rejection email", async () => {
    await expect(
      sendStatusNotification("user@test.com", "Jean Dupont", "REJECTED", "abc123")
    ).resolves.not.toThrow();
  });
});
