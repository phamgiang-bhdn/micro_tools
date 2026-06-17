import { classifyPrice, PriceObservation } from "./price-intelligence.types";

const NOW = new Date("2026-06-03T00:00:00.000Z");
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 24 * 3_600_000);

function obs(price: number, dAgo: number, originalPrice: number | null = null): PriceObservation {
  return { price, originalPrice, capturedAt: daysAgo(dAgo) };
}

describe("classifyPrice", () => {
  describe("THIEU_DU_LIEU", () => {
    it("trả THIEU_DU_LIEU khi không có observation", () => {
      const intel = classifyPrice([], NOW);
      expect(intel.verdict).toBe("THIEU_DU_LIEU");
      expect(intel.currentPrice).toBeNull();
      expect(intel.sampleCount).toBe(0);
    });

    it("trả THIEU_DU_LIEU khi chưa đủ sample (1-2 điểm) — không phán oan", () => {
      const intel = classifyPrice([obs(1_000_000, 1, 2_000_000), obs(1_000_000, 0, 2_000_000)], NOW);
      expect(intel.verdict).toBe("THIEU_DU_LIEU");
      // vẫn trả số đã tính được
      expect(intel.currentPrice).toBe(1_000_000);
    });

    it("trả THIEU_DU_LIEU khi span ngày quá ngắn dù đủ sample", () => {
      const sameDay: PriceObservation[] = [
        { price: 500_000, originalPrice: null, capturedAt: new Date(NOW.getTime() - 3_600_000) },
        { price: 500_000, originalPrice: null, capturedAt: new Date(NOW.getTime() - 7_200_000) },
        { price: 500_000, originalPrice: null, capturedAt: new Date(NOW.getTime() - 10_800_000) }
      ];
      expect(classifyPrice(sameDay, NOW).verdict).toBe("THIEU_DU_LIEU");
    });
  });

  describe("GIA_AO — anchor thổi cao", () => {
    it("phát hiện originalPrice thổi cao hơn nhiều so với giá thực từng thấy", () => {
      const series = [
        obs(5_000_000, 20, 9_900_000),
        obs(5_000_000, 12, 9_900_000),
        obs(4_900_000, 5, 9_900_000),
        obs(5_000_000, 0, 9_900_000) // "giảm 50%" từ 9.9tr nhưng thực tế chưa bao giờ trên 5tr
      ];
      expect(classifyPrice(series, NOW).verdict).toBe("GIA_AO");
    });
  });

  describe("DAY_GIA — chạm đáy 90 ngày", () => {
    it("current là thấp nhất trong dải có biến động → DAY_GIA", () => {
      const series = [
        obs(6_000_000, 60),
        obs(5_800_000, 40),
        obs(6_200_000, 20),
        obs(5_200_000, 0) // đáy thực, originalPrice null nên không phải ảo
      ];
      const intel = classifyPrice(series, NOW);
      expect(intel.verdict).toBe("DAY_GIA");
      expect(intel.isAtLowest).toBe(true);
    });
  });

  describe("GIA_TOT — rẻ hơn TB nhưng chưa chạm đáy", () => {
    it("current dưới TB30 ≥5% nhưng không phải đáy 90d", () => {
      const series = [
        obs(4_000_000, 60), // đáy 90d ở xa
        obs(10_000_000, 25),
        obs(10_000_000, 18),
        obs(10_000_000, 10),
        obs(8_800_000, 0) // ~12% dưới TB30 (~9.7tr) nhưng trên đáy 4tr
      ];
      expect(classifyPrice(series, NOW).verdict).toBe("GIA_TOT");
    });
  });

  describe("BINH_THUONG", () => {
    it("giá quanh mức trung bình, không đáy, anchor hợp lý", () => {
      const series = [
        obs(5_000_000, 30, 5_500_000),
        obs(5_050_000, 20, 5_500_000),
        obs(4_980_000, 10, 5_500_000),
        obs(5_020_000, 0, 5_500_000)
      ];
      expect(classifyPrice(series, NOW).verdict).toBe("BINH_THUONG");
    });
  });
});
