import sanitizeHtml = require("sanitize-html");

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "h4",
  "span",
  "div",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th"
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "width", "height"],
  span: ["class"],
  div: ["class"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"]
};

export function sanitizeCouponHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" })
    },
    disallowedTagsMode: "discard"
  });
}
