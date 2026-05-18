const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Seed v2 — Category-only.
 *
 * Sản phẩm hoàn toàn đến từ crawler Accesstrade (sprint at-source-of-truth).
 * Seed này chỉ tạo:
 *   1. 12 Category (niche) làm presentation layer — admin onboard campaign vào Category.
 *   2. PromptTemplate hệ thống (default-parser cho extraction, article-buying-guide & article-review cho blog AI).
 *   3. Dọn legacy product IDs từ seed v1 (hardcoded a1000001-* / b2000001-*).
 *
 * KHÔNG seed Product / ClickLog / ConversionWebhook. Data đó phát sinh tự nhiên từ crawler + user click.
 */

const CATEGORIES = [
  {
    slug: "robot-hut-bui-lau-nha",
    name: "Robot hút bụi - lau nhà",
    schemaConfig: {
      suctionPower: "number",
      batteryMinutes: "number",
      maxArea: "number",
      mopFunction: "boolean",
      selfEmpty: "boolean",
      mapping: "string",
      appControl: "boolean"
    }
  },
  {
    slug: "may-loc-khong-khi",
    name: "Máy lọc không khí",
    schemaConfig: {
      coverageArea: "number",
      cadr: "number",
      filterType: "string",
      noiseDbMax: "number",
      smartControl: "boolean",
      sensors: "string"
    }
  },
  {
    slug: "may-loc-nuoc",
    name: "Máy lọc nước",
    schemaConfig: {
      filterStages: "number",
      capacityLph: "number",
      filterType: "string",
      waterTankL: "number",
      hotColdFunction: "boolean",
      smartControl: "boolean"
    }
  },
  {
    slug: "noi-chien-khong-dau",
    name: "Nồi chiên không dầu",
    schemaConfig: {
      capacityL: "number",
      wattage: "number",
      maxTempC: "number",
      presetCount: "number",
      digitalControl: "boolean",
      nonStickCoating: "boolean"
    }
  },
  {
    slug: "may-giat",
    name: "Máy giặt",
    schemaConfig: {
      capacityKg: "number",
      type: "string",
      spinRpm: "number",
      inverter: "boolean",
      energyClass: "string",
      smartControl: "boolean"
    }
  },
  {
    slug: "tu-lanh",
    name: "Tủ lạnh",
    schemaConfig: {
      capacityL: "number",
      doorType: "string",
      inverter: "boolean",
      energyClass: "string",
      waterDispenser: "boolean",
      smartControl: "boolean"
    }
  },
  {
    slug: "dieu-hoa",
    name: "Điều hoà",
    schemaConfig: {
      btu: "number",
      inverter: "boolean",
      energyClass: "string",
      wifiControl: "boolean",
      starRating: "number"
    }
  },
  {
    slug: "tivi",
    name: "Tivi",
    schemaConfig: {
      screenInches: "number",
      resolution: "string",
      refreshRateHz: "number",
      hdr: "boolean",
      platform: "string",
      smartHome: "boolean"
    }
  },
  {
    slug: "laptop",
    name: "Laptop",
    schemaConfig: {
      cpu: "string",
      ramGb: "number",
      storageGb: "number",
      screenInches: "number",
      gpu: "string",
      batteryHours: "number",
      weightKg: "number"
    }
  },
  {
    slug: "tai-nghe-tws",
    name: "Tai nghe true wireless",
    schemaConfig: {
      anc: "boolean",
      batteryHours: "number",
      bluetoothVersion: "string",
      waterproofIp: "string",
      codec: "string",
      driverSizeMm: "number"
    }
  },
  {
    slug: "dong-ho-thong-minh",
    name: "Đồng hồ thông minh",
    schemaConfig: {
      screenInches: "number",
      batteryDays: "number",
      heartRate: "boolean",
      spo2: "boolean",
      gps: "boolean",
      waterproofMeters: "number",
      ecg: "boolean"
    }
  },
  {
    slug: "my-pham-duong-da",
    name: "Mỹ phẩm dưỡng da",
    schemaConfig: {
      skinType: "string",
      volumeMl: "number",
      keyIngredients: "string",
      spf: "number",
      fragranceFree: "boolean"
    }
  }
];

/**
 * Xoá sạch các Product hardcoded từ seed v1 (cùng ClickLog + ConversionWebhook cascade).
 * Match theo id list cố định — UUID column không filter được bằng startsWith,
 * và idempotent (chạy nhiều lần OK vì delete không-tồn-tại sẽ chỉ trả count=0).
 */
const LEGACY_SEEDED_PRODUCT_IDS = [
  "a1000001-0000-0000-0000-000000000001",
  "a1000001-0000-0000-0000-000000000002",
  "a1000001-0000-0000-0000-000000000003",
  "a1000001-0000-0000-0000-000000000004",
  "b2000001-0000-0000-0000-000000000001",
  "b2000001-0000-0000-0000-000000000002",
  "b2000001-0000-0000-0000-000000000003",
  "b2000001-0000-0000-0000-000000000004"
];

async function purgeLegacySeededProducts() {
  const legacy = await prisma.product.findMany({
    where: { id: { in: LEGACY_SEEDED_PRODUCT_IDS } },
    select: { id: true }
  });
  if (legacy.length === 0) return;
  const legacyIds = legacy.map((p) => p.id);

  const clickLogs = await prisma.clickLog.findMany({
    where: { productId: { in: legacyIds } },
    select: { trackingCode: true }
  });
  const trackingCodes = clickLogs.map((c) => c.trackingCode);
  if (trackingCodes.length > 0) {
    await prisma.conversionWebhook.deleteMany({
      where: { trackingCode: { in: trackingCodes } }
    });
  }
  const result = await prisma.product.deleteMany({ where: { id: { in: legacyIds } } });
  console.log(`[seed] Purged ${result.count} legacy seeded product(s).`);
}

async function cleanupRemovedCategories(keepSlugs) {
  const stale = await prisma.category.findMany({
    where: { slug: { notIn: keepSlugs } },
    select: { id: true, slug: true }
  });
  if (stale.length === 0) return;
  const staleIds = stale.map((c) => c.id);
  const staleProducts = await prisma.product.findMany({
    where: { categoryId: { in: staleIds } },
    select: { id: true }
  });
  const staleProductIds = staleProducts.map((p) => p.id);
  if (staleProductIds.length > 0) {
    const staleClickIds = await prisma.clickLog.findMany({
      where: { productId: { in: staleProductIds } },
      select: { trackingCode: true }
    });
    const trackingCodes = staleClickIds.map((c) => c.trackingCode);
    if (trackingCodes.length > 0) {
      await prisma.conversionWebhook.deleteMany({
        where: { trackingCode: { in: trackingCodes } }
      });
    }
  }
  const result = await prisma.category.deleteMany({ where: { id: { in: staleIds } } });
  console.log(
    `[seed] Removed ${result.count} stale category(s): ${stale.map((c) => c.slug).join(", ")}`
  );
}

async function main() {
  await purgeLegacySeededProducts();
  await cleanupRemovedCategories(CATEGORIES.map((c) => c.slug));

  for (const categorySpec of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: categorySpec.slug },
      update: {
        name: categorySpec.name,
        schemaConfig: categorySpec.schemaConfig,
        status: "ACTIVE"
      },
      create: {
        slug: categorySpec.slug,
        name: categorySpec.name,
        status: "ACTIVE",
        schemaConfig: categorySpec.schemaConfig
      }
    });
  }
  console.log(`[seed] Upserted ${CATEGORIES.length} category(ies).`);

  await prisma.promptTemplate.upsert({
    where: { name: "default-parser" },
    update: {
      content:
        "You are a strict extraction engine. Return only valid JSON that matches provided schema. Never return markdown.",
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "default-parser",
      content:
        "You are a strict extraction engine. Return only valid JSON that matches provided schema. Never return markdown.",
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  const blockSchemaSpec = [
    "OUTPUT 'blocks' là 1 mảng các object có 'type'. 9 loại block cho phép:",
    "",
    "1. { type: 'hero_quote', text: string, attribution?: string }",
    "   → Mở bài bằng câu chuyện/quote mạnh. text ≤ 50 từ.",
    "",
    "2. { type: 'criteria_grid', title?: string, items: [{ icon, title, body }] }",
    "   → 4-6 tiêu chí. icon ∈ ['battery','filter','noise','smart','size','money','shield','sparkle','clock','wifi']. body ≤ 40 từ.",
    "",
    "3. { type: 'product_spotlight', productId: REF, angle: string, pros?: string[], cons?: string[] }",
    "   → Spotlight 1 sản phẩm. productId ĐIỀN REF (P1/P2.../D1/D2...) từ [candidates] hoặc discoveredProducts — KHÔNG điền UUID, hệ thống tự thay.",
    "",
    "4. { type: 'callout', tone: 'info'|'warning'|'tip'|'success', title: string, body: string }",
    "   → Hộp nhấn. body ≤ 60 từ. TỐI ĐA 2 callout/bài.",
    "",
    "5. { type: 'prose', markdown: string }",
    "   → Đoạn văn dài. Cắt thành 2-3 prose ngắn xen kẽ các block khác hơn 1 prose dài.",
    "",
    "6. { type: 'comparison', productIds: REF[] }",
    "   → ≥ 2 ref (vd ['P1','P3','D1']).",
    "",
    "7. { type: 'pros_cons', pros: string[], cons: string[] }",
    "   → Mỗi list 3-5 items, mỗi item ≤ 15 từ.",
    "",
    "8. { type: 'faq', items: [{ q, a }] }",
    "   → 3-5 Q&A. answer 2-3 câu.",
    "",
    "9. { type: 'verdict', summary: string, bestFor?: string[], notFor?: string[] }",
    "   → Kết luận cuối. summary 2-3 câu.",
    "",
    "QUY TẮC:",
    "- Mỗi bài chọn 6-10 block. KHÔNG dùng hết tất cả loại.",
    "- KHÔNG dùng template cứng giữa các bài — flex thứ tự + chọn loại khác nhau.",
    "- KHÔNG đặt 2 block cùng type liền nhau (trừ prose, cố gắng xen visual).",
    "- Mọi ref trong productId/productIds phải có trong [candidates] hoặc trong discoveredProducts mà chính bạn liệt kê.",
    "- selectedRefs phải liệt kê toàn bộ ref đã dùng (cả P và D)."
  ].join("\n");

  const buyingGuidePrompt = [
    "Bạn là editor + writer chuyên xếp bài blog cho dealvault (site affiliate Việt Nam).",
    "Viết 1 BUYING GUIDE bằng tiếng Việt về chủ đề được cung cấp, dưới dạng STRUCTURED BLOCKS.",
    "",
    blockSchemaSpec,
    "",
    "GỢI Ý FLOW CHO BUYING_GUIDE (linh hoạt, không bắt buộc):",
    "- hero_quote hoặc prose ngắn mở bài (nỗi đau người mua)",
    "- criteria_grid (4-6 tiêu chí chọn mua)",
    "- 1-2 callout (vd warning: đừng tin lực hút quảng cáo)",
    "- 2-3 product_spotlight (phân khúc tiết kiệm/tầm trung/cao cấp)",
    "- comparison (nếu ≥ 2 sản phẩm)",
    "- faq",
    "- verdict",
    "",
    "RÀNG BUỘC:",
    "- Tone thân thiện, chuyên môn, KHÔNG sáo rỗng",
    "- Viết như đã trải nghiệm thật (dB ồn, thời gian sạc, app có lag không, mùi nhựa mới)",
    "- KHÔNG bao giờ tự nhận là AI",
    "- Tổng prose + criteria + faq ≥ 800 từ",
    "- Số liệu kỹ thuật cụ thể, ĐỪNG dùng giá/spec từ trí nhớ — chỉ trích từ [candidates] hoặc từ web search nguồn nằm trong [allowedDomains]",
    "- Nếu thị trường vừa có sản phẩm mới đáng đề cập mà KHÔNG nằm trong [candidates] → thêm vào discoveredProducts (ref D1, D2...) và DÙNG ref đó trong block",
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (60-70 ký tự)",',
    '  "slug": "string (kebab-case, không dấu, ≤ 80 ký tự)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)",',
    '  "selectedRefs": ["P1","P3","D1"],',
    '  "discoveredProducts": [{ "ref": "D1", "name": "...", "sourceUrl": "https://...", "reason": "..." }]',
    "}"
  ].join("\n");

  await prisma.promptTemplate.upsert({
    where: { name: "article-buying-guide" },
    update: {
      content: buyingGuidePrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "article-buying-guide",
      content: buyingGuidePrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });

  const reviewPrompt = [
    "Bạn là editor + writer chuyên review sản phẩm cho dealvault.",
    "Viết 1 REVIEW CHI TIẾT bằng tiếng Việt cho 1 sản phẩm cụ thể (contextProducts[0]), dưới dạng STRUCTURED BLOCKS.",
    "",
    blockSchemaSpec,
    "",
    "GỢI Ý FLOW CHO REVIEW (linh hoạt):",
    "- product_spotlight cho sản phẩm chính (mở đầu hoặc gần đầu)",
    "- prose 'cảm nhận chung sau khi dùng' — kể tình huống đời thường",
    "- criteria_grid (các tiêu chí đánh giá: pin, ồn, app, vệ sinh...)",
    "- pros_cons (BẮT BUỘC có cả pros và cons thật — không toàn ưu điểm)",
    "- 1 callout (warning hoặc tip)",
    "- comparison (nếu contextProducts có ≥ 2 — so với đối thủ)",
    "- verdict (kết luận: phù hợp ai, không phù hợp ai)",
    "",
    "RÀNG BUỘC:",
    "- NGÔI THỨ NHẤT — như người đã dùng vài tuần/tháng",
    "- Chi tiết cảm giác cụ thể: dB ồn ban đêm, độ ấm tay cầm, mùi nhựa mới, độ phản hồi app",
    "- BẮT BUỘC có ≥ 2 điểm yếu (cons / notFor) — KHÔNG có review toàn ưu điểm",
    "- KHÔNG bao giờ tự nhận là AI",
    "- Tổng nội dung ≥ 600 từ",
    "- KHÔNG dùng giá/spec từ trí nhớ — chỉ trích từ [candidates] hoặc web search từ [allowedDomains]",
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (có tên sản phẩm)",',
    '  "slug": "string (kebab-case)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)",',
    '  "selectedRefs": ["P1"],',
    '  "discoveredProducts": []',
    "}"
  ].join("\n");

  await prisma.promptTemplate.upsert({
    where: { name: "article-review" },
    update: {
      content: reviewPrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date()
    },
    create: {
      name: "article-review",
      content: reviewPrompt,
      isActive: true,
      version: 1,
      activatedAt: new Date(),
      createdBy: "seed"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
