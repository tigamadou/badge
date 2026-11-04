import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Alert, EmptyState, ProgressBar, Spinner, SuccessRing } from "../Feedback";

describe("Feedback", () => {
  it("Alert err porte role=alert et le ton rose", () => {
    const html = renderToStaticMarkup(<Alert tone="err">Identifiants incorrects</Alert>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Identifiants incorrects");
    expect(html).toContain("bg-rose-50");
  });

  it("Alert : tons de la palette", () => {
    const info = renderToStaticMarkup(<Alert tone="info">i</Alert>);
    expect(info).toContain("bg-mist");
    expect(info).toContain("text-navy");
    const warn = renderToStaticMarkup(<Alert tone="warn">w</Alert>);
    expect(warn).toContain("bg-warn-soft");
    expect(warn).toContain("text-warn");
    const ok = renderToStaticMarkup(<Alert tone="success">s</Alert>);
    expect(ok).toContain("bg-turquoise-soft");
    expect(ok).toContain("text-turquoise-strong");
  });

  it("spinner, progression et icône de succès en palette", () => {
    expect(renderToStaticMarkup(<Spinner />)).toContain("border-t-navy");
    expect(renderToStaticMarkup(<ProgressBar pct={40} />)).toContain("bg-navy");
    const ring = renderToStaticMarkup(<SuccessRing>ok</SuccessRing>);
    expect(ring).toContain("bg-turquoise-soft");
    expect(ring).toContain("text-turquoise-strong");
  });

  it("EmptyState montre titre et description", () => {
    const html = renderToStaticMarkup(<EmptyState icon="inbox" title="Aucune inscription" description="Rien ici" />);
    expect(html).toContain("Aucune inscription");
    expect(html).toContain("Rien ici");
  });

  it("ProgressBar clampe a 100", () => {
    expect(renderToStaticMarkup(<ProgressBar pct={150} />)).toContain("width:100%");
    expect(renderToStaticMarkup(<ProgressBar pct={-5} />)).toContain("width:0%");
  });

  it("Spinner et SuccessRing rendent", () => {
    expect(renderToStaticMarkup(<Spinner />)).toContain('role="status"');
    expect(renderToStaticMarkup(<SuccessRing>ok</SuccessRing>)).toContain("ok");
  });
});
