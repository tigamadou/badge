import { describe, it, expect, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import HomePage from "../page";

describe("page d'accueil marketing", () => {
  it("mentionne les rôles personnalisés selon l'organisation", async () => {
    const stream = await renderToReadableStream(await HomePage());
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain("rôles personnalisés selon votre organisation");
  });
});
