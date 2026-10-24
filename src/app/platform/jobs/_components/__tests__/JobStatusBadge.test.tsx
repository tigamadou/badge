import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { JobStatus } from "@prisma/client";
import { JobStatusBadge } from "../JobStatusBadge";

describe("JobStatusBadge", () => {
  it.each([
    ["PENDING", "En attente"],
    ["RUNNING", "En cours"],
    ["SUCCEEDED", "Envoyé"],
    ["FAILED", "En échec"],
    ["CANCELLED", "Annulé"],
  ] as [JobStatus, string][])("renders %s as %s", (status, label) => {
    expect(renderToStaticMarkup(<JobStatusBadge status={status} />)).toContain(label);
  });
});
