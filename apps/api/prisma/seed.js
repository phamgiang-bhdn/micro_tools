const { PrismaClient, ParseStatus, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

const IMG = (id) => `https://picsum.photos/seed/${id}/600/450`;
const GO = (id) => `https://example.com/go?id=${id}`;

function slugify(input) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const TOOLS = [
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
    },
    products: [
      {
        id: "a1000001-0000-0000-0000-000000000001",
        name: "Robot hút bụi lau nhà Dreame L20 Ultra",
        affiliateUrl: GO("dreame-l20-ultra"),
        scrapedData: {
          brand: "Dreame",
          store: "Lazada Mall",
          image: IMG("dreame-l20-ultra"),
          price: 19990000,
          originalPrice: 26990000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 412,
          badge: "Flagship",
          category: "Robot lau nhà",
          suctionPower: 7000,
          batteryMinutes: 260,
          maxArea: 350,
          mopFunction: true,
          selfEmpty: true,
          mapping: "LiDAR",
          appControl: true,
          highlights: [
            "Tự nâng giẻ lau khi gặp thảm",
            "Trạm đa năng: tự rửa & sấy giẻ",
            "Bản đồ 3D LiDAR + AI tránh vật cản"
          ]
        }
      },
      {
        id: "a1000001-0000-0000-0000-000000000002",
        name: "Robot hút bụi Roborock Q7 Max+",
        affiliateUrl: GO("roborock-q7-max-plus"),
        scrapedData: {
          brand: "Roborock",
          store: "Shopee Mall",
          image: IMG("roborock-q7-max-plus"),
          price: 8990000,
          originalPrice: 12990000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 1245,
          badge: "Best seller",
          category: "Robot hút bụi",
          suctionPower: 4200,
          batteryMinutes: 180,
          maxArea: 240,
          mopFunction: true,
          selfEmpty: true,
          mapping: "LiDAR",
          appControl: true,
          highlights: [
            "Trạm tự đổ rác 7 tuần",
            "Lực hút 4200Pa",
            "Bản đồ đa tầng"
          ]
        }
      },
      {
        id: "a1000001-0000-0000-0000-000000000003",
        name: "Robot hút bụi Xiaomi Robot Vacuum X10+",
        affiliateUrl: GO("xiaomi-x10-plus"),
        scrapedData: {
          brand: "Xiaomi",
          store: "Tiki Trading",
          image: IMG("xiaomi-x10-plus"),
          price: 11990000,
          originalPrice: 14990000,
          currency: "VND",
          rating: 4.6,
          reviewCount: 528,
          category: "Robot hút bụi",
          suctionPower: 4000,
          batteryMinutes: 180,
          maxArea: 250,
          mopFunction: true,
          selfEmpty: true,
          mapping: "LiDAR",
          appControl: true,
          highlights: [
            "Trạm tự rửa giẻ + nước nóng",
            "Tích hợp Mi Home",
            "AI nhận diện vật cản"
          ]
        }
      },
      {
        id: "a1000001-0000-0000-0000-000000000004",
        name: "Robot lau nhà Ecovacs Deebot T20 Omni",
        affiliateUrl: GO("deebot-t20-omni"),
        scrapedData: {
          brand: "Ecovacs",
          store: "Shopee Mall",
          image: IMG("deebot-t20-omni"),
          price: 17990000,
          originalPrice: 22990000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 312,
          badge: "Mới",
          category: "Robot lau nhà",
          suctionPower: 6000,
          batteryMinutes: 260,
          maxArea: 320,
          mopFunction: true,
          selfEmpty: true,
          mapping: "LiDAR",
          appControl: true,
          highlights: [
            "Giẻ lau nước nóng 55°C",
            "Trạm Omni 4-trong-1",
            "Tự nâng giẻ khi gặp thảm"
          ]
        }
      }
    ]
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
    },
    products: [
      {
        id: "b2000001-0000-0000-0000-000000000001",
        name: "Máy lọc không khí Xiaomi Smart Air Purifier 4 Pro",
        affiliateUrl: GO("xiaomi-air-4-pro"),
        scrapedData: {
          brand: "Xiaomi",
          store: "Shopee Mall",
          image: IMG("xiaomi-air-4-pro"),
          price: 5990000,
          originalPrice: 7990000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 845,
          badge: "Bán chạy",
          category: "Máy lọc không khí",
          coverageArea: 60,
          cadr: 500,
          filterType: "HEPA H13",
          noiseDbMax: 66,
          smartControl: true,
          sensors: "PM2.5, nhiệt độ, độ ẩm",
          highlights: [
            "CADR 500 m³/h, phòng tới 60m²",
            "HEPA H13 + than hoạt tính",
            "OLED hiển thị PM2.5 realtime",
            "Tích hợp Mi Home + Google Home"
          ]
        }
      },
      {
        id: "b2000001-0000-0000-0000-000000000002",
        name: "Máy lọc không khí Sharp FP-J60E-W",
        affiliateUrl: GO("sharp-fp-j60e"),
        scrapedData: {
          brand: "Sharp",
          store: "Điện Máy Xanh",
          image: IMG("sharp-fp-j60e"),
          price: 6490000,
          originalPrice: 8990000,
          currency: "VND",
          rating: 4.6,
          reviewCount: 412,
          category: "Máy lọc không khí",
          coverageArea: 50,
          cadr: 396,
          filterType: "HEPA + Plasmacluster",
          noiseDbMax: 51,
          smartControl: false,
          sensors: "PM2.5, mùi",
          highlights: [
            "Công nghệ ion Plasmacluster diệt khuẩn",
            "Vận hành êm 21 dB ở mức thấp",
            "Phòng tới 50m²"
          ]
        }
      },
      {
        id: "b2000001-0000-0000-0000-000000000003",
        name: "Máy lọc không khí Coway AP-1512HH",
        affiliateUrl: GO("coway-ap-1512hh"),
        scrapedData: {
          brand: "Coway",
          store: "Lazada Mall",
          image: IMG("coway-ap-1512hh"),
          price: 7490000,
          originalPrice: 9990000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 1024,
          badge: "Top Wirecutter",
          category: "Máy lọc không khí",
          coverageArea: 33,
          cadr: 416,
          filterType: "HEPA H13 + Carbon",
          noiseDbMax: 53,
          smartControl: false,
          sensors: "PM2.5, đèn báo chất lượng",
          highlights: [
            "Bestseller Mỹ nhiều năm",
            "Auto eco mode tiết kiệm điện",
            "Đèn báo chất lượng không khí 4 màu"
          ]
        }
      },
      {
        id: "b2000001-0000-0000-0000-000000000004",
        name: "Máy lọc không khí Levoit Core 300S",
        affiliateUrl: GO("levoit-core-300s"),
        scrapedData: {
          brand: "Levoit",
          store: "Tiki Trading",
          image: IMG("levoit-core-300s"),
          price: 3290000,
          originalPrice: 4290000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 678,
          badge: "Giá tốt",
          category: "Máy lọc không khí",
          coverageArea: 20,
          cadr: 230,
          filterType: "HEPA H13",
          noiseDbMax: 50,
          smartControl: true,
          sensors: "PM2.5",
          highlights: [
            "App VeSync + Alexa/Google",
            "Hợp phòng ngủ ≤ 20m²",
            "Chế độ Sleep 24 dB"
          ]
        }
      }
    ]
  }
];

async function cleanupRemovedTools(keepSlugs) {
  const stale = await prisma.tool.findMany({
    where: { slug: { notIn: keepSlugs } },
    select: { id: true, slug: true }
  });
  if (stale.length === 0) return;
  const staleIds = stale.map((t) => t.id);
  const staleProducts = await prisma.product.findMany({
    where: { toolId: { in: staleIds } },
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
  const result = await prisma.tool.deleteMany({ where: { id: { in: staleIds } } });
  console.log(
    `[seed] Removed ${result.count} stale tool(s): ${stale.map((t) => t.slug).join(", ")}`
  );
}

async function main() {
  await cleanupRemovedTools(TOOLS.map((t) => t.slug));

  for (const toolSpec of TOOLS) {
    const tool = await prisma.tool.upsert({
      where: { slug: toolSpec.slug },
      update: { name: toolSpec.name, schemaConfig: toolSpec.schemaConfig, status: "ACTIVE" },
      create: {
        slug: toolSpec.slug,
        name: toolSpec.name,
        status: "ACTIVE",
        schemaConfig: toolSpec.schemaConfig
      }
    });

    for (const productSpec of toolSpec.products) {
      const slug = slugify(productSpec.name);
      await prisma.product.upsert({
        where: { id: productSpec.id },
        update: {
          name: productSpec.name,
          slug,
          affiliateUrl: productSpec.affiliateUrl,
          scrapedData: productSpec.scrapedData
        },
        create: {
          id: productSpec.id,
          toolId: tool.id,
          network: "ACCESSTRADE",
          name: productSpec.name,
          slug,
          affiliateUrl: productSpec.affiliateUrl,
          scrapedData: productSpec.scrapedData
        }
      });
    }
  }

  const sampleProductId = "a1000001-0000-0000-0000-000000000001";
  const sampleProduct = await prisma.product.findUnique({ where: { id: sampleProductId } });
  if (sampleProduct) {
    const existing = await prisma.productExtraction.findFirst({
      where: { productId: sampleProduct.id, status: ParseStatus.PENDING_REVIEW }
    });
    if (!existing) {
      await prisma.productExtraction.create({
        data: {
          productId: sampleProduct.id,
          rawContent:
            "Dreame L20 Ultra robot vacuum, suction 7000Pa, battery 260 minutes, mop function with self-rinse station, LiDAR mapping, supports app control. Coverage up to 350m².",
          aiOutput: {
            suctionPower: 7000,
            batteryMinutes: 260,
            maxArea: 350,
            mopFunction: true,
            selfEmpty: true,
            mapping: "LiDAR",
            appControl: true
          },
          status: ParseStatus.PENDING_REVIEW,
          sourceUrl: "https://example.com/robot/dreame-l20-ultra"
        }
      });
    }
  }

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
    "3. { type: 'product_spotlight', productId: uuid, angle: string, pros?: string[], cons?: string[] }",
    "   → Spotlight 1 sản phẩm. productId PHẢI có thật trong contextProducts. angle là 1 câu (vd 'Bản tiết kiệm cho phòng ngủ').",
    "",
    "4. { type: 'callout', tone: 'info'|'warning'|'tip'|'success', title: string, body: string }",
    "   → Hộp nhấn. body ≤ 60 từ. TỐI ĐA 2 callout/bài.",
    "",
    "5. { type: 'prose', markdown: string }",
    "   → Đoạn văn dài. Cắt thành 2-3 prose ngắn xen kẽ các block khác hơn 1 prose dài.",
    "",
    "6. { type: 'comparison', productIds: uuid[] }",
    "   → ≥ 2 productIds có thật trong contextProducts.",
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
    "- Mỗi bài chọn 5-9 block. KHÔNG dùng hết tất cả loại.",
    "- KHÔNG dùng template cứng giữa các bài — flex thứ tự + chọn loại khác nhau.",
    "- KHÔNG đặt 2 block cùng type liền nhau (trừ prose).",
    "- Mọi productId đều phải có thật trong contextProducts đầu vào."
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
    "- Số liệu kỹ thuật cụ thể",
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (60-70 ký tự)",',
    '  "slug": "string (kebab-case, không dấu, ≤ 80 ký tự)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)"',
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
    "",
    "OUTPUT JSON, không markdown bọc:",
    "{",
    '  "title": "string (có tên sản phẩm)",',
    '  "slug": "string (kebab-case)",',
    '  "excerpt": "string (140-160 ký tự)",',
    '  "blocks": [Block, Block, ...],',
    '  "metaTitle": "string (≤ 60 ký tự)",',
    '  "metaDescription": "string (≤ 160 ký tự)"',
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

  if (sampleProduct) {
    const existingHash = await prisma.clickLog.findFirst({ where: { ipHash: "seeded-hash" } });
    if (!existingHash) {
      const click = await prisma.clickLog.create({
        data: {
          productId: sampleProduct.id,
          trackingCode: `seed-${Date.now()}`,
          ipHash: "seeded-hash",
          userAgent: "Mozilla/5.0"
        }
      });
      await prisma.conversionWebhook.create({
        data: {
          trackingCode: click.trackingCode,
          revenue: new Prisma.Decimal("899000.00"),
          status: "success",
          payload: { source: "seed" }
        }
      });
    }
  }
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
