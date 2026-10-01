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
