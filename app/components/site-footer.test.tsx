import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("shows the copyright line for the year it is given", () => {
    const html = renderToStaticMarkup(<SiteFooter year={2031} />);

    expect(html).toContain("<footer");
    expect(html).toContain("© 2031 Cadence");
  });
});
