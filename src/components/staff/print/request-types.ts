import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";

// Forme de GET /api/platform/print/requests/{id} (dates sérialisées en ISO).
export type DetailLine = {
  id: string;
  kind: "PRODUCT" | "SERVICE" | "DISCOUNT" | "CUSTOM";
  label: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  addedBy: string;
  priceOverridden: boolean;
  quantityOverridden: boolean;
};

export type DetailItem = {
  registrationId: string;
  position: number;
  firstName: string;
  lastName: string;
  categoryName: string;
  status: string;
  badgePrinted: boolean;
};

export type DetailGeneration = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  badgeCount: number;
  sheetCount: number | null;
  fileKey: string | null;
  createdAt: string;
};

export type RequestDetailData = {
  onsiteTemplate: "OK" | "UNSUITABLE" | "NOT_APPLICABLE";
  request: {
    id: string;
    reference: string;
    type: PrintRequestType;
    status: PrintRequestStatus;
    delivery: "PICKUP" | "DELIVERY" | null;
    deliveryAddress: string | null;
    deliveryContactName: string | null;
    deliveryContactPhone: string | null;
    wantedBy: string | null;
    estimatedQuantity: number | null;
    onsiteSchedule: unknown;
    onsiteLocation: string | null;
    onsiteContactName: string | null;
    onsiteContactPhone: string | null;
    notes: string | null;
    quoteVersion: number;
    total: number;
    submittedAt: string | null;
  };
  event: {
    id: string;
    title: string;
    date: string | null;
    endDate: string | null;
    location: string | null;
    org: { id: string; name: string; contactEmail: string | null; contactPhone: string | null };
  };
  template: {
    id: string;
    label: string;
    widthPx: number;
    heightPx: number;
    pages: number;
    proofPath: string | null;
  } | null;
  items: DetailItem[];
  lines: DetailLine[];
  generations: DetailGeneration[];
};

export type ProductOption = { id: string; name: string; basePrice: number };
