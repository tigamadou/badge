import { afterEach, describe, expect, it } from "vitest";
import { discoverPages } from "../../page-docs/paths";
import { makeRepo, removeRepo } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

describe("discoverPages", () => {
  it("découvre les pages des quatre espaces, triées, en ignorant le reste", () => {
    root = makeRepo({
      "src/app/org/[orgId]/events/new/page.tsx": "",
      "src/app/org/[orgId]/page.tsx": "",
      "src/app/org/[orgId]/docs/page.tsx": "",
      "src/app/org/[orgId]/docs/[...slug]/page.tsx": "",
      "src/app/platform/page.tsx": "",
      "src/app/platform/(groupe)/users/page.tsx": "",
      "src/app/platform/docs/page.tsx": "",
      "src/app/event/[eventId]/registrations/page.tsx": "",
      "src/app/event/[eventId]/docs/page.tsx": "",
      "src/app/account/page.tsx": "",
      "src/app/account/docs/page.tsx": "",
      "src/app/account/layout.tsx": "",
      "src/app/api/foo/page.tsx": "",
      "src/app/(marketing)/page.tsx": "",
      "src/app/e/[slug]/page.tsx": "",
      "src/app/login/page.tsx": "",
    });
    expect(discoverPages(root)).toEqual([
      { route: "/account", space: "account", file: "src/app/account/page.tsx" },
      { route: "/event/[eventId]/registrations", space: "event", file: "src/app/event/[eventId]/registrations/page.tsx" },
      { route: "/org/[orgId]", space: "org", file: "src/app/org/[orgId]/page.tsx" },
      { route: "/org/[orgId]/events/new", space: "org", file: "src/app/org/[orgId]/events/new/page.tsx" },
      { route: "/platform", space: "platform", file: "src/app/platform/page.tsx" },
      { route: "/platform/users", space: "platform", file: "src/app/platform/(groupe)/users/page.tsx" },
    ]);
  });

  it("renvoie une liste vide sans dossier src/app", () => {
    root = makeRepo({ "README.md": "" });
    expect(discoverPages(root)).toEqual([]);
  });
});
