import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TableFrame } from "../TableFrame";

describe("TableFrame", () => {
  it("rend ses enfants avec un defilement horizontal et sans overflow-hidden", () => {
    const html = renderToStaticMarkup(
      <TableFrame>
        <table>
          <tbody>
            <tr>
              <td>contenu</td>
            </tr>
          </tbody>
        </table>
      </TableFrame>,
    );
    expect(html).toContain("contenu");
    expect(html).toContain("overflow-x-auto");
    expect(html).not.toContain("rounded-xl");
    expect(html).not.toContain("overflow-hidden");
  });

  it("ajoute la className supplementaire", () => {
    const html = renderToStaticMarkup(<TableFrame className="mt-4">x</TableFrame>);
    expect(html).toContain("mt-4");
  });
});
