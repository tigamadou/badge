import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("PENDING : or", () => {
    const html = renderToStaticMarkup(<StatusBadge status="PENDING" />);
    expect(html).toContain("En attente");
    expect(html).toContain("bg-gold-soft");
    expect(html).toContain("text-gold-strong");
  });

  it("APPROVED : turquoise", () => {
    const html = renderToStaticMarkup(<StatusBadge status="APPROVED" />);
    expect(html).toContain("Validé");
    expect(html).toContain("bg-turquoise-soft text-turquoise-strong");
  });

  it("REJECTED : rouge inchangé", () => {
    const html = renderToStaticMarkup(<StatusBadge status="REJECTED" />);
    expect(html).toContain("Rejeté");
    expect(html).toContain("bg-rose-50 text-rose-700");
  });
});
