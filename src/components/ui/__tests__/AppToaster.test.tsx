import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppToaster } from "../AppToaster";

describe("AppToaster", () => {
  it("monte la région des toasts avec un libellé français", () => {
    expect(renderToStaticMarkup(<AppToaster />)).toContain('aria-label="Messages');
  });
});
