import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageDocButton } from "../PageDocButton";

describe("PageDocButton", () => {
  it("ne rend rien (ancrage remplacé par le lot 4a)", () => {
    expect(PageDocButton()).toBeNull();
    expect(renderToStaticMarkup(<PageDocButton />)).toBe("");
  });
});
