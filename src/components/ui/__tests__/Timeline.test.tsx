import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline, TimelineItem } from "../Timeline";

describe("Timeline", () => {
  it("rend des items avec titre et meta", () => {
    const html = renderToStaticMarkup(
      <Timeline>
        <TimelineItem tone="ok" title="Organisation creee" meta="Marie Dubois - il y a 2 h" />
      </Timeline>,
    );
    expect(html).toContain("Organisation creee");
    expect(html).toContain("Marie Dubois - il y a 2 h");
    expect(html).toContain("bg-green-600");
  });

  it("applique la tonalite danger sur le dot", () => {
    const html = renderToStaticMarkup(<TimelineItem tone="danger" title="Rejet" meta="hier" />);
    expect(html).toContain("border-rose-600");
  });
});
