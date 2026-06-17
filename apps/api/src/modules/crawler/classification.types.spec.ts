import { deriveKeywords, matchByKeyword, NicheMatcher, normalizeText } from "./classification.types";

describe("normalizeText", () => {
  it("bỏ dấu tiếng Việt + lowercase", () => {
    expect(normalizeText("Robot Hút Bụi Lau Nhà")).toBe("robot hut bui lau nha");
    expect(normalizeText("Máy Lọc Nước")).toBe("may loc nuoc");
    expect(normalizeText("Kem chống nắng SPF50+")).toBe("kem chong nang spf50");
  });

  it("đổi đ/Đ → d", () => {
    expect(normalizeText("Đèn thông minh")).toBe("den thong minh");
  });
});

describe("deriveKeywords", () => {
  it("tách segment từ name + gộp keyword admin", () => {
    const kws = deriveKeywords("Robot hút bụi - lau nhà", "robot-hut-bui-lau-nha", ["hút bụi tự động"]);
    expect(kws).toContain("robot hut bui");
    expect(kws).toContain("lau nha");
    expect(kws).toContain("hut bui tu dong");
  });

  it("dùng được khi chưa set keyword admin", () => {
    const kws = deriveKeywords("Máy lọc nước", "may-loc-nuoc", []);
    expect(kws).toContain("may loc nuoc");
  });
});

function matcher(id: string, slug: string, name: string, keywords: string[] = []): NicheMatcher {
  return { id, slug, keywords: deriveKeywords(name, slug, keywords) };
}

describe("matchByKeyword", () => {
  const robot = matcher("n1", "robot-hut-bui-lau-nha", "Robot hút bụi - lau nhà");
  const locNuoc = matcher("n2", "may-loc-nuoc", "Máy lọc nước");
  const skincare = matcher("n3", "kem-chong-nang", "Kem chống nắng", ["sunscreen", "chong nang"]);
  const matchers = [robot, locNuoc, skincare];

  it("gán đúng niche khi title chứa cụm đặc trưng", () => {
    const hay = normalizeText("Robot hút bụi lau nhà Xiaomi S10 kết nối app chính hãng");
    const km = matchByKeyword(hay, matchers);
    expect(km.best?.slug).toBe("robot-hut-bui-lau-nha");
    expect(km.ambiguous).toBe(false);
  });

  it("offer không thuộc niche nào → best null (quarantine)", () => {
    const hay = normalizeText("Bánh quy socola hộp 200g nhập khẩu");
    const km = matchByKeyword(hay, matchers);
    expect(km.best).toBeNull();
    expect(km.candidates).toHaveLength(0);
  });

  it("khớp keyword admin (sunscreen) dù name không xuất hiện nguyên văn", () => {
    const hay = normalizeText("Anessa Perfect UV Sunscreen Skin Care Milk SPF50");
    const km = matchByKeyword(hay, matchers);
    expect(km.best?.slug).toBe("kem-chong-nang");
  });
});
