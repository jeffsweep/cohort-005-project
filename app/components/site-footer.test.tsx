import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("shows the copyright line", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toContain("<footer");
    expect(html).toContain("© 2026 Cadence");
  });
});
