import { describe, it, expect } from "vitest";
import { registrationVerifyUrl, parseRegistrationQr } from "@/lib/registration-qr";

describe("registrationVerifyUrl", () => {
  it("retire le slash final et encode l'ID", () => {
    expect(registrationVerifyUrl("https://badge.example/", "EV-1/2")).toBe(
      "https://badge.example/verify/EV-1%2F2",
    );
  });
  it("conserve une base sans slash final", () => {
    expect(registrationVerifyUrl("https://badge.example", "A1")).toBe("https://badge.example/verify/A1");
  });
});

describe("parseRegistrationQr", () => {
  it("extrait l'ID d'une URL de vérification", () => {
    expect(parseRegistrationQr("https://badge.example/verify/C01-20261115-0007")).toBe("C01-20261115-0007");
  });
  it("accepte un ID brut avec espaces", () => {
    expect(parseRegistrationQr("  C01-20261115-0007 ")).toBe("C01-20261115-0007");
  });
});
