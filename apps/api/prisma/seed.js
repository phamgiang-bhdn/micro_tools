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
    slug: "credit-card-compare",
    name: "Thẻ tín dụng",
    schemaConfig: {
      bank: "string",
      annualFee: "number",
      cashbackPercent: "string",
      minIncome: "number"
    },
    products: [
      {
        id: "3a571fa4-08f5-4ea6-b101-9c39658b2469",
        name: "Thẻ Example Bank Platinum",
        affiliateUrl: GO("platinum"),
        scrapedData: {
          bank: "Example Bank",
          brand: "Example Bank",
          store: "Example Bank",
          image: IMG("card-platinum"),
          price: 499000,
          originalPrice: 990000,
          currency: "VND",
          description:
            "Hoàn tiền 5% cho mọi chi tiêu online. Miễn phí năm đầu cho hồ sơ thu nhập từ 15 triệu.",
          rating: 4.6,
          reviewCount: 312,
          badge: "Phổ biến nhất",
          cashbackPercent: "5%",
          minIncome: 15000000,
          highlights: ["Hoàn tiền 5% online", "Miễn phí năm đầu", "Bảo hiểm du lịch"]
        }
      },
      {
        id: "c1c1aa18-e3a1-4bcd-9d8a-1a2c0b6f4111",
        name: "Thẻ Neo Bank Cashback World",
        affiliateUrl: GO("neo-cashback"),
        scrapedData: {
          bank: "Neo Bank",
          brand: "Neo Bank",
          store: "Neo Bank",
          image: IMG("card-neo"),
          price: 299000,
          originalPrice: 599000,
          currency: "VND",
          description: "Hoàn tiền 8% cho siêu thị và F&B cuối tuần.",
          rating: 4.8,
          reviewCount: 528,
          cashbackPercent: "8%",
          minIncome: 12000000,
          highlights: ["Hoàn tiền 8% F&B", "Phòng chờ sân bay 4 lượt/năm"]
        }
      },
      {
        id: "9b6f4a23-13ee-46d3-9a8c-2f3d5e87cd02",
        name: "Thẻ Skyline Travel Visa Signature",
        affiliateUrl: GO("skyline-travel"),
        scrapedData: {
          bank: "Skyline",
          brand: "Skyline Bank",
          store: "Skyline Bank",
          image: IMG("card-skyline"),
          price: 1200000,
          originalPrice: 1500000,
          currency: "VND",
          rating: 4.4,
          reviewCount: 187,
          badge: "Cho dân du lịch",
          cashbackPercent: "3%",
          minIncome: 25000000,
          highlights: ["Đổi điểm thưởng → vé máy bay", "Bảo hiểm chuyến bay tới 5 tỷ"]
        }
      }
    ]
  },
  {
    slug: "tech-gadgets",
    name: "Đồ công nghệ",
    schemaConfig: {
      category: "string",
      price: "number",
      originalPrice: "number",
      store: "string"
    },
    products: [
      {
        id: "11111111-aaaa-bbbb-cccc-000000000001",
        name: "Tai nghe Sony WH-1000XM5",
        affiliateUrl: GO("sony-xm5"),
        scrapedData: {
          brand: "Sony",
          store: "Shopee Mall",
          image: IMG("sony-xm5"),
          price: 7290000,
          originalPrice: 9990000,
          currency: "VND",
          description: "Chống ồn chủ động tốt nhất phân khúc, pin 30h, micro thoại đa hướng.",
          rating: 4.9,
          reviewCount: 2140,
          badge: "Bán chạy",
          category: "Audio",
          highlights: ["ANC đỉnh phân khúc", "Pin 30 giờ", "LDAC Hi-Res"]
        }
      },
      {
        id: "11111111-aaaa-bbbb-cccc-000000000002",
        name: "iPad Air M2 11\" 128GB",
        affiliateUrl: GO("ipad-air-m2"),
        scrapedData: {
          brand: "Apple",
          store: "Tiki Trading",
          image: IMG("ipad-air-m2"),
          price: 15490000,
          originalPrice: 17990000,
          currency: "VND",
          description: "Chip Apple M2, màn hình Liquid Retina 11 inch, hỗ trợ Apple Pencil Pro.",
          rating: 4.8,
          reviewCount: 612,
          category: "Máy tính bảng",
          highlights: ["Chip M2", "Hỗ trợ Apple Pencil Pro"]
        }
      },
      {
        id: "11111111-aaaa-bbbb-cccc-000000000003",
        name: "Tai nghe Samsung Galaxy Buds3 Pro",
        affiliateUrl: GO("buds3-pro"),
        scrapedData: {
          brand: "Samsung",
          store: "Lazada",
          image: IMG("buds3-pro"),
          price: 3990000,
          originalPrice: 5490000,
          currency: "VND",
          rating: 4.6,
          reviewCount: 318,
          badge: "Mới ra mắt",
          category: "Audio",
          highlights: ["Hi-Fi 24-bit", "ANC + nhận diện giọng"]
        }
      },
      {
        id: "11111111-aaaa-bbbb-cccc-000000000004",
        name: "Robot hút bụi Roborock Q7 Max+",
        affiliateUrl: GO("roborock-q7"),
        scrapedData: {
          brand: "Roborock",
          store: "Shopee Mall",
          image: IMG("roborock-q7"),
          price: 8990000,
          originalPrice: 12990000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 456,
          category: "Nhà thông minh",
          highlights: ["Lực hút 4200Pa", "Tự đổ rác"]
        }
      },
      {
        id: "11111111-aaaa-bbbb-cccc-000000000005",
        name: "Màn hình LG UltraGear 27GP850",
        affiliateUrl: GO("lg-27gp850"),
        scrapedData: {
          brand: "LG",
          store: "Tiki Trading",
          image: IMG("lg-27gp850"),
          price: 8290000,
          originalPrice: 9990000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 274,
          category: "Màn hình",
          highlights: ["165Hz Nano IPS", "1ms GtG"]
        }
      },
      {
        id: "11111111-aaaa-bbbb-cccc-000000000006",
        name: "Bàn phím Keychron K2 Pro",
        affiliateUrl: GO("keychron-k2-pro"),
        scrapedData: {
          brand: "Keychron",
          store: "Hà Nội Computer",
          image: IMG("keychron-k2-pro"),
          price: 2890000,
          originalPrice: 3490000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 198,
          category: "Phụ kiện",
          highlights: ["Hot-swap", "QMK / VIA"]
        }
      }
    ]
  },
  {
    slug: "home-appliances",
    name: "Gia dụng",
    schemaConfig: {
      category: "string",
      price: "number",
      store: "string"
    },
    products: [
      {
        id: "22222222-aaaa-bbbb-cccc-000000000001",
        name: "Nồi chiên không dầu Philips HD9870",
        affiliateUrl: GO("philips-hd9870"),
        scrapedData: {
          brand: "Philips",
          store: "Điện Máy Xanh",
          image: IMG("philips-airfryer"),
          price: 4490000,
          originalPrice: 6990000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 845,
          badge: "Top doanh số",
          category: "Bếp",
          highlights: ["Dung tích 7.3L", "Hơi nước + chiên"]
        }
      },
      {
        id: "22222222-aaaa-bbbb-cccc-000000000002",
        name: "Máy lọc không khí Xiaomi Pro 4",
        affiliateUrl: GO("mi-pro-4"),
        scrapedData: {
          brand: "Xiaomi",
          store: "Shopee Mall",
          image: IMG("mi-pro4"),
          price: 4290000,
          originalPrice: 5790000,
          currency: "VND",
          rating: 4.6,
          reviewCount: 412,
          category: "Sức khỏe",
          highlights: ["Lọc HEPA H13", "Phòng tới 60m²"]
        }
      },
      {
        id: "22222222-aaaa-bbbb-cccc-000000000003",
        name: "Máy pha cafe DeLonghi Dedica EC685",
        affiliateUrl: GO("delonghi-ec685"),
        scrapedData: {
          brand: "DeLonghi",
          store: "Tiki Trading",
          image: IMG("delonghi-ec685"),
          price: 6990000,
          originalPrice: 8490000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 232,
          category: "Bếp",
          highlights: ["Áp suất 15 bar", "Hâm tách cafe"]
        }
      },
      {
        id: "22222222-aaaa-bbbb-cccc-000000000004",
        name: "Robot lau nhà Dreame L20 Ultra",
        affiliateUrl: GO("dreame-l20"),
        scrapedData: {
          brand: "Dreame",
          store: "Lazada Mall",
          image: IMG("dreame-l20"),
          price: 19990000,
          originalPrice: 26990000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 156,
          badge: "Flagship",
          category: "Nhà thông minh",
          highlights: ["Tự nâng giẻ lau", "Tự rửa & sấy"]
        }
      }
    ]
  },
  {
    slug: "travel-deals",
    name: "Du lịch",
    schemaConfig: {
      destination: "string",
      pricePerNight: "number",
      stars: "number"
    },
    products: [
      {
        id: "33333333-aaaa-bbbb-cccc-000000000001",
        name: "InterContinental Đà Nẵng — 2N1Đ",
        affiliateUrl: GO("intercon-danang"),
        scrapedData: {
          brand: "InterContinental",
          store: "Agoda",
          image: IMG("intercon-danang"),
          price: 6900000,
          originalPrice: 9900000,
          currency: "VND",
          rating: 4.9,
          reviewCount: 1240,
          badge: "Resort 5★",
          category: "Đà Nẵng",
          highlights: ["Buffet sáng 2 người", "Đưa đón sân bay"]
        }
      },
      {
        id: "33333333-aaaa-bbbb-cccc-000000000002",
        name: "Vinpearl Phú Quốc Combo 3N2Đ",
        affiliateUrl: GO("vinpearl-phuquoc"),
        scrapedData: {
          brand: "Vinpearl",
          store: "Booking.com",
          image: IMG("vinpearl-phuquoc"),
          price: 4990000,
          originalPrice: 7490000,
          currency: "VND",
          rating: 4.7,
          reviewCount: 980,
          category: "Phú Quốc",
          highlights: ["Vé VinWonders", "Vé Safari"]
        }
      },
      {
        id: "33333333-aaaa-bbbb-cccc-000000000003",
        name: "Bay khứ hồi SGN ↔ ICN — Vietjet Skyboss",
        affiliateUrl: GO("vj-skyboss-icn"),
        scrapedData: {
          brand: "Vietjet Air",
          store: "Traveloka",
          image: IMG("vj-skyboss-icn"),
          price: 8990000,
          originalPrice: 12490000,
          currency: "VND",
          rating: 4.3,
          reviewCount: 412,
          badge: "Chặng hot",
          category: "Quốc tế"
        }
      }
    ]
  },
  {
    slug: "beauty-skincare",
    name: "Mỹ phẩm",
    schemaConfig: {
      brand: "string",
      price: "number"
    },
    products: [
      {
        id: "44444444-aaaa-bbbb-cccc-000000000001",
        name: "Serum SK-II Facial Treatment Essence 230ml",
        affiliateUrl: GO("skii-230"),
        scrapedData: {
          brand: "SK-II",
          store: "Sephora",
          image: IMG("skii-230"),
          price: 5490000,
          originalPrice: 6990000,
          currency: "VND",
          rating: 4.9,
          reviewCount: 712,
          badge: "Bán chạy",
          category: "Serum"
        }
      },
      {
        id: "44444444-aaaa-bbbb-cccc-000000000002",
        name: "Kem chống nắng Anessa Perfect UV 60ml",
        affiliateUrl: GO("anessa-60"),
        scrapedData: {
          brand: "Anessa",
          store: "Hasaki",
          image: IMG("anessa-60"),
          price: 549000,
          originalPrice: 720000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 3240,
          category: "Chống nắng"
        }
      },
      {
        id: "44444444-aaaa-bbbb-cccc-000000000003",
        name: "Son Dior Rouge 999 Velvet",
        affiliateUrl: GO("dior-999"),
        scrapedData: {
          brand: "Dior",
          store: "Lazmall",
          image: IMG("dior-999"),
          price: 990000,
          originalPrice: 1290000,
          currency: "VND",
          rating: 4.8,
          reviewCount: 945,
          category: "Son"
        }
      }
    ]
  }
];

async function main() {
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

  const sampleProduct = await prisma.product.findUnique({
    where: { id: "3a571fa4-08f5-4ea6-b101-9c39658b2469" }
  });
  if (sampleProduct) {
    const existing = await prisma.productExtraction.findFirst({
      where: { productId: sampleProduct.id, status: ParseStatus.PENDING_REVIEW }
    });
    if (!existing) {
      await prisma.productExtraction.create({
        data: {
          productId: sampleProduct.id,
          rawContent:
            "Example Bank Platinum Card. Annual fee 499000 VND. Cashback 5% for shopping. Minimum salary 15,000,000 VND.",
          aiOutput: {
            bank: "Example Bank",
            annualFee: 499000,
            cashbackPercent: "5%",
            minIncome: 15000000
          },
          status: ParseStatus.PENDING_REVIEW,
          sourceUrl: "https://example.com/card/platinum"
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
          revenue: new Prisma.Decimal("125000.00"),
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
