// src/lib/generate-id.ts

interface GenerateIdOptions {
  categoryNumber: number; // numéro 0-999
  date: string;           // format ISO "YYYY-MM-DD"
  sequentialNumber: number; // compteur auto-incrémenté par catégorie
}

export function generateId({ categoryNumber, date, sequentialNumber }: GenerateIdOptions): string {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const datePart = `${yy}${mm}${dd}`;
  const spacer = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  const seq = String(sequentialNumber).padStart(3, "0");
  const lastDigit = categoryNumber % 10;

  return `${lastDigit}${datePart}${spacer}${lastDigit}${seq}`;
}
