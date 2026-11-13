import { afterEach, describe, expect, it } from "vitest";
import { collectSources } from "../../page-docs/sources";
import { makeRepo, removeRepo } from "./helpers";

let root = "";
afterEach(() => removeRepo(root));

const PAGE = "src/app/org/[orgId]/page.tsx";

describe("collectSources", () => {
  it("suit les imports relatifs, @/ et dynamiques sous src/app et src/components", () => {
    root = makeRepo({
      [PAGE]: `import A from "@/components/A";
import B from "./local";
import type { T } from "../../shared/types";
const C = dynamic(() => import("@/components/C"));
import { x } from "@/lib/util";
import React from "react";
import "@/components/side-effect";`,
      "src/components/A.tsx": `import D from "./sub";`,
      "src/components/sub/index.tsx": `export default 1;`,
      "src/components/C.ts": ``,
      "src/components/side-effect.ts": ``,
      "src/app/org/[orgId]/local.tsx": ``,
      "src/app/shared/types.ts": ``,
      "src/lib/util.ts": ``,
    });
    expect(collectSources(root, PAGE)).toEqual([
      "src/app/org/[orgId]/local.tsx",
      PAGE,
      "src/app/shared/types.ts",
      "src/components/A.tsx",
      "src/components/C.ts",
      "src/components/side-effect.ts",
      "src/components/sub/index.tsx",
    ]);
  });

  it("s'arrête à 3 niveaux, sans doublon ni boucle", () => {
    root = makeRepo({
      [PAGE]: `import "@/components/n1";`,
      "src/components/n1.tsx": `import "@/components/n2"; import "@/components/n1";`,
      "src/components/n2.tsx": `import "@/components/n3"; import "@/components/n1";`,
      "src/components/n3.tsx": `import "@/components/n4";`,
      "src/components/n4.tsx": ``,
    });
    expect(collectSources(root, PAGE)).toEqual([
      PAGE,
      "src/components/n1.tsx",
      "src/components/n2.tsx",
      "src/components/n3.tsx",
    ]);
  });

  it("ignore un import non résolu et un fichier de page absent", () => {
    root = makeRepo({ [PAGE]: `import "@/components/absent"; import "./nope";` });
    expect(collectSources(root, PAGE)).toEqual([PAGE]);
    expect(collectSources(root, "src/app/org/absent/page.tsx")).toEqual(["src/app/org/absent/page.tsx"]);
  });
});
