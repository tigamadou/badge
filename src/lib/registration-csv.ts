export type RegistrationCsvRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  categoryName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  idDocumentType: string;
  idDocumentNumber: string;
  badgePrinted: boolean;
  allAccessGranted: boolean;
  createdAt: Date;
};

const HEADER = [
  "id",
  "firstName",
  "lastName",
  "email",
  "structure",
  "category",
  "status",
  "idDocumentType",
  "idDocumentNumber",
  "badgePrinted",
  "allAccess",
  "createdAt",
];

export function escapeCsvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toRegistrationCsv(rows: RegistrationCsvRow[]): string {
  const out: string[] = [HEADER.join(",")];
  for (const r of rows) {
    out.push(
      [
        escapeCsvField(r.id),
        escapeCsvField(r.firstName),
        escapeCsvField(r.lastName),
        escapeCsvField(r.email),
        escapeCsvField(r.structure),
        escapeCsvField(r.categoryName),
        escapeCsvField(r.status),
        escapeCsvField(r.idDocumentType),
        escapeCsvField(r.idDocumentNumber),
        escapeCsvField(r.badgePrinted),
        escapeCsvField(r.allAccessGranted),
        escapeCsvField(r.createdAt.toISOString()),
      ].join(","),
    );
  }
  return out.join("\n");
}
