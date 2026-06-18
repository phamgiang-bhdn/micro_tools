// 6 niche ưu tiên cho homepage. Slug phải match `apps/api/prisma/seed.js` Niche.slug.
// Order chỉnh được mà không deploy. Nếu sau cần per-environment override → move sang DB
// column `Niche.homepageOrder` (xem STORY-04 niche editorial admin upload).
//
// Image path `/public/niches/<slug>.jpg` — operator upload sau. Khi chưa có ảnh, component
// fallback gradient + icon Lucide (xem [[curated-niche-grid]]).

import { type LucideIcon, Laptop, Headphones, Disc3, Wind, Watch, Droplet } from "lucide-react";
import type { NicheItem } from "./types";

export interface CuratedNiche {
  slug: string;
  displayName: string;
  pitch: string;
  image: string;
  /** Icon Lucide đại diện niche (fallback khi chưa có ảnh thật). */
  Icon: LucideIcon;
}

export interface CuratedNicheTile extends CuratedNiche {
  productCount: number;
  /**
   * STORY 1-2: đích link theo trạng thái niche — ACTIVE → `/categories/<slug>`,
   * chưa ra mắt (không nằm trong list ACTIVE) → `/coming-soon/<slug>` (tránh click ra 404).
   */
  href: string;
}

/**
 * STORY 1-2: dựng tile curated từ list niche ACTIVE (kết quả `fetchNiches()`). Đây là CHỖ DUY
 * NHẤT giữ quy tắc routing tile → mọi surface (home, niche-empty fallback, …) gọi hàm này,
 * tránh copy-paste ternary ở nhiều page rồi lệch nhau khiến tile lại link ra 404.
 */
export function buildCuratedTiles(activeNiches: NicheItem[], excludeSlug?: string): CuratedNicheTile[] {
  const activeBySlug = new Map(activeNiches.map((n) => [n.slug, n]));
  return CURATED_NICHES.filter((c) => c.slug !== excludeSlug).map((curated) => {
    const matched = activeBySlug.get(curated.slug);
    return {
      ...curated,
      productCount: matched?._count?.products ?? 0,
      href: matched ? `/categories/${curated.slug}` : `/coming-soon/${curated.slug}`
    };
  });
}

export const CURATED_NICHES: CuratedNiche[] = [
  {
    slug: "laptop",
    displayName: "Laptop",
    pitch: "Gaming, văn phòng, sinh viên",
    image: "/niches/laptop.jpg",
    Icon: Laptop
  },
  {
    slug: "tai-nghe-tws",
    displayName: "Tai nghe TWS",
    pitch: "AirPods, Sony, Galaxy Buds",
    image: "/niches/tai-nghe.jpg",
    Icon: Headphones
  },
  {
    slug: "robot-hut-bui-lau-nha",
    displayName: "Robot hút bụi",
    pitch: "Roborock, Dreame, Ecovacs",
    image: "/niches/robot.jpg",
    Icon: Disc3
  },
  {
    slug: "may-loc-khong-khi",
    displayName: "Máy lọc không khí",
    pitch: "Lọc PM2.5 cho mùa hanh",
    image: "/niches/loc-khi.jpg",
    Icon: Wind
  },
  {
    slug: "dong-ho-thong-minh",
    displayName: "Đồng hồ thông minh",
    pitch: "Apple, Garmin, Galaxy Watch",
    image: "/niches/dong-ho.jpg",
    Icon: Watch
  },
  {
    slug: "my-pham-duong-da",
    displayName: "Mỹ phẩm dưỡng da",
    pitch: "Skincare Nhật, Hàn, dược mỹ phẩm",
    image: "/niches/skincare.jpg",
    Icon: Droplet
  }
];
