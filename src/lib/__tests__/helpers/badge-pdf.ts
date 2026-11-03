// PDF de badge minimal pour les tests de composition (pdf-lib).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mmToPt } from "@/lib/print-sheets/units";

export async function makeBadgePdf(opts: {
  widthMm: number;
  heightMm: number;
  pages: 1 | 2;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedStandardFont(StandardFonts.Helvetica);
  const w = mmToPt(opts.widthMm);
  const h = mmToPt(opts.heightMm);
  for (let i = 0; i < opts.pages; i++) {
    const page = doc.addPage([w, h]);
    // Une marque differente par page : fond + libelle.
    page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.9, 0.9, i === 0 ? 0.9 : 0.6) });
    page.drawText(i === 0 ? "RECTO" : "VERSO", { x: 10, y: h / 2, size: 20, font });
  }
  return doc.save();
}
