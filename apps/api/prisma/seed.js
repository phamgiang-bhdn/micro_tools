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
