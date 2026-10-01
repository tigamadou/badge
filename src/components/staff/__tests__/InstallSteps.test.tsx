import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallFileStep } from "../InstallFileStep";
import { InstallSummaryStep, type InstallSummary } from "../InstallSummaryStep";

const noop = () => {};
const max = 10 * 1024 * 1024;

describe("InstallFileStep", () => {
  it("propose la zone de depot au repos", () => {
    const html = renderToStaticMarkup(
      <InstallFileStep maxBytes={max} file={null} progress={0} phase="idle" errors={[]} onFile={noop} onReset={noop} />,
    );
    expect(html).toContain("Déposer une archive .zip ou cliquer");
    expect(html).toContain("10 Mo");
  });

  it("montre le fichier et la progression pendant l'envoi", () => {
    const html = renderToStaticMarkup(
      <InstallFileStep maxBytes={max} file={{ name: "ex-304v.zip", size: 2048 }} progress={40} phase="uploading" errors={[]} onFile={noop} onReset={noop} />,
    );
    expect(html).toContain("ex-304v.zip");
    expect(html).toContain("40");
  });

  it("montre le loader d'analyse", () => {
    const html = renderToStaticMarkup(
      <InstallFileStep maxBytes={max} file={{ name: "a.zip", size: 1 }} progress={100} phase="analysing" errors={[]} onFile={noop} onReset={noop} />,
    );
    expect(html).toContain("Analyse du paquet…");
  });

  it("liste les erreurs et propose un autre fichier", () => {
    const html = renderToStaticMarkup(
      <InstallFileStep maxBytes={max} file={{ name: "a.zip", size: 1 }} progress={100} phase="error" errors={["boom"]} onFile={noop} onReset={noop} />,
    );
    expect(html).toContain("boom");
    expect(html).toContain("Choisir un autre fichier");
  });
});

const summary: InstallSummary = {
  family: "ex-304v",
  label: "Badge EX-304V",
  pages: 2,
  nextVersion: 3,
  preview: null,
  contractVariables: [{ name: "participant.firstName", kind: "text", label: "Prénom" }],
  options: [{ name: "showColorBar", kind: "boolean", label: "Bandeau tricolore" }],
};

describe("InstallSummaryStep", () => {
  const props = { progress: 0, errors: [], installedVersion: null, onInstall: noop, onRetry: noop, onReset: noop, onClose: noop };

  it("recapitule donnees et options", () => {
    const html = renderToStaticMarkup(<InstallSummaryStep summary={summary} phase="summary" {...props} />);
    expect(html).toContain("Badge EX-304V");
    expect(html).toContain("version 3");
    expect(html).toContain("Données de badge (1)");
    expect(html).toContain("Options du template (1)");
    expect(html).toContain("réglée par événement dans les paramètres de l&#x27;événement");
    expect(html).toContain("Installer");
    expect(html).toContain("booléen");
    expect(html).not.toContain(">boolean<");
  });

  it("libelles francais des types d'options, type inconnu tel quel", () => {
    const kinds = ["text", "image", "boolean", "date", "color", "list", "mystere"];
    const options = kinds.map((kind) => ({ name: kind, kind, label: `L-${kind}` }));
    const html = renderToStaticMarkup(<InstallSummaryStep summary={{ ...summary, options }} phase="summary" {...props} />);
    for (const fr of ["texte", "image", "booléen", "date", "couleur", "liste", "mystere"]) {
      expect(html).toContain(`>${fr}</span>`);
    }
  });

  it("n'affiche pas le groupe options sans option", () => {
    const html = renderToStaticMarkup(<InstallSummaryStep summary={{ ...summary, options: [] }} phase="summary" {...props} />);
    expect(html).not.toContain("Options du template");
  });

  it("montre le loader puis le succes", () => {
    expect(renderToStaticMarkup(<InstallSummaryStep summary={summary} phase="installing" {...props} progress={100} />)).toContain(
      "Installation et rendu d&#x27;épreuve…",
    );
    const done = renderToStaticMarkup(<InstallSummaryStep summary={summary} phase="done" {...props} installedVersion={3} />);
    expect(done).toContain("Template installé (version 3)");
    expect(done).toContain("Fermer");
  });

  it("en echec : erreurs, Reessayer et Choisir un autre fichier", () => {
    const html = renderToStaticMarkup(<InstallSummaryStep summary={summary} phase="error" {...props} errors={["rendu KO"]} />);
    expect(html).toContain("rendu KO");
    expect(html).toContain("Réessayer");
    expect(html).toContain("Choisir un autre fichier");
  });
});
