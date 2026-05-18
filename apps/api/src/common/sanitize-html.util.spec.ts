import { sanitizeCouponHtml } from "./sanitize-html.util";

describe("sanitizeCouponHtml", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(sanitizeCouponHtml(null)).toBe("");
    expect(sanitizeCouponHtml(undefined)).toBe("");
    expect(sanitizeCouponHtml("")).toBe("");
  });

  it("strips <script> tags entirely", () => {
    const out = sanitizeCouponHtml("<p>OK</p><script>alert(1)</script>");
    expect(out).toContain("<p>OK</p>");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("strips <iframe> tags", () => {
    const out = sanitizeCouponHtml('<iframe src="https://evil"></iframe><p>hi</p>');
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips javascript: hrefs but keeps https links", () => {
    const evil = sanitizeCouponHtml('<a href="javascript:alert(1)">click</a>');
    expect(evil.toLowerCase()).not.toContain("javascript:");

    const safe = sanitizeCouponHtml('<a href="https://shopee.vn/promo">click</a>');
    expect(safe).toContain('href="https://shopee.vn/promo"');
  });

  it('forces rel="nofollow noopener" and target="_blank" on anchors', () => {
    const out = sanitizeCouponHtml('<a href="https://shopee.vn">link</a>');
    expect(out).toContain('rel="nofollow noopener"');
    expect(out).toContain('target="_blank"');
  });

  it("preserves common formatting tags untouched", () => {
    const out = sanitizeCouponHtml("<p><strong>bold</strong> and <em>em</em></p>");
    expect(out).toBe("<p><strong>bold</strong> and <em>em</em></p>");
  });

  it("strips inline event handlers like onclick", () => {
    const out = sanitizeCouponHtml('<p onclick="alert(1)">x</p>');
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out).toContain("x");
  });
});
