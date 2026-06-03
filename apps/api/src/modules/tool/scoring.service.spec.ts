import { ToolScoringService } from "./scoring.service";
import { ToolQuizSchema, ToolScoringRules } from "./scoring.types";

describe("ToolScoringService", () => {
  const service = new ToolScoringService();

  const quizSchema: ToolQuizSchema = {
    questions: [
      {
        id: "household_size",
        question: "Nhà bạn có mấy người dùng?",
        type: "single",
        required: true,
        options: [
          { value: "1-2", label: "1-2" },
          { value: "3-4", label: "3-4" },
          { value: "5+", label: "5+" }
        ],
        weight: 10
      },
      {
        id: "budget_max",
        question: "Ngân sách tối đa (VND)?",
        type: "number",
        required: true,
        weight: 8
      },
      {
        id: "water_source",
        question: "Nguồn nước nhà bạn?",
        type: "single",
        required: true,
        options: [
          { value: "tap", label: "Nước máy" },
          { value: "well", label: "Giếng khoan" },
          { value: "unknown", label: "Không rõ" }
        ],
        weight: 9
      }
    ]
  };

  const scoringRules: ToolScoringRules = {
    rules: [
      {
        userAttribute: "household_size",
        productAttributePath: "scrapedData.recommendedHouseholdSize",
        weight: 10,
        matchType: "range_overlap"
      },
      {
        userAttribute: "budget_max",
        productAttributePath: "scrapedData.priceVnd",
        weight: 8,
        matchType: "lte"
      },
      {
        userAttribute: "water_source",
        productAttributePath: "scrapedData.supportedSources",
        weight: 9,
        matchType: "tag_match"
      }
    ],
    hardFilters: [
      {
        productAttributePath: "scrapedData.inventoryStatus",
        matchType: "neq",
        value: "OOS"
      }
    ]
  };

  const products = [
    {
      id: "p1",
      name: "Karofi 4-người tầm trung",
      scrapedData: {
        recommendedHouseholdSize: "3-5",
        priceVnd: 7500000,
        supportedSources: ["tap"],
        inventoryStatus: "IN_STOCK"
      }
    },
    {
      id: "p2",
      name: "AO Smith RO mini 1-2 người",
      scrapedData: {
        recommendedHouseholdSize: "1-2",
        priceVnd: 4900000,
        supportedSources: ["tap", "well"],
        inventoryStatus: "IN_STOCK"
      }
    },
    {
      id: "p3",
      name: "Karofi cao cấp 6+",
      scrapedData: {
        recommendedHouseholdSize: "5-8",
        priceVnd: 14990000,
        supportedSources: ["tap", "well"],
        inventoryStatus: "IN_STOCK"
      }
    },
    {
      id: "p4",
      name: "Sunhouse hết hàng",
      scrapedData: {
        recommendedHouseholdSize: "3-4",
        priceVnd: 5500000,
        supportedSources: ["tap"],
        inventoryStatus: "OOS"
      }
    }
  ];

  it("ranks product khớp household + budget cao nhất", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 8000000, water_source: "tap" },
      products
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.productId).toBe("p1"); // 3-4 trong 3-5, dưới 8tr, tap match
  });

  it("loại product OOS qua hard filter", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 8000000, water_source: "tap" },
      products
    });
    const ids = result.map((r) => r.productId);
    expect(ids).not.toContain("p4");
  });

  it("\"Không rõ\" không penalty score (skip rule)", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 8000000, water_source: "unknown" },
      products
    });
    // Score chỉ tính trên household + budget. p1 vẫn top.
    expect(result[0]?.productId).toBe("p1");
    // matchedCriteria không chứa water_source vì skipped.
    expect(result[0]?.matchedCriteria.find((c) => c.attribute === "water_source")).toBeUndefined();
  });

  it("budget thấp lọc bỏ con đắt", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "1-2", budget_max: 5000000, water_source: "tap" },
      products
    });
    expect(result[0]?.productId).toBe("p2"); // 1-2 match + 4.9tr <= 5tr
    // p3 (14.9tr) không match lte budget — vẫn xuất hiện nhưng matched=false.
    const p3 = result.find((r) => r.productId === "p3");
    if (p3) {
      const budgetCrit = p3.matchedCriteria.find((c) => c.attribute === "budget_max");
      expect(budgetCrit?.matched).toBe(false);
    }
  });

  it("confidence label đúng theo threshold", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 8000000, water_source: "tap" },
      products
    });
    const top = result[0];
    expect(top?.confidenceLabel).toBe("Rất phù hợp");
  });

  it("tag_match khớp khi user value trong product array", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 20000000, water_source: "well" },
      products
    });
    // p1 không match well (chỉ tap), p2 và p3 match well.
    const p1 = result.find((r) => r.productId === "p1");
    const waterCrit = p1?.matchedCriteria.find((c) => c.attribute === "water_source");
    expect(waterCrit?.matched).toBe(false);
  });

  it("topN respect resultTemplate", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      resultTemplate: { topN: 2 },
      userAttributes: { household_size: "3-4", budget_max: 20000000, water_source: "tap" },
      products
    });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("trả empty khi không product nào pass hard filter", () => {
    const result = service.scoreProducts({
      quizSchema,
      scoringRules,
      userAttributes: { household_size: "3-4", budget_max: 8000000, water_source: "tap" },
      products: [
        {
          id: "oos1",
          name: "All OOS",
          scrapedData: { inventoryStatus: "OOS", priceVnd: 1000000 }
        }
      ]
    });
    expect(result.length).toBe(0);
  });
});
