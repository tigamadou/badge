// src/lib/generate-id.ts
import { randomBytes } from "crypto";

interface GenerateIdOptions {
  eventType: number;
  date: string; // format ISO "YYYY-MM-DD"
}

export function generateId({ eventType, date }: GenerateIdOptions): string {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const prefix = `${eventType}${yy}${mm}${dd}`;

  const bytes = randomBytes(4);
  const suffix = bytes
    .toString("hex")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");

  return `${prefix}${suffix}`;
}
