// 6 niche ưu tiên cho homepage. Slug phải match `apps/api/prisma/seed.js` Niche.slug.
// Order chỉnh được mà không deploy. Nếu sau cần per-environment override → move sang DB
// column `Niche.homepageOrder` (xem STORY-04 niche editorial admin upload).
//
// Image path `/public/niches/<slug>.jpg` — operator upload sau. Khi chưa có ảnh, component
// fallback gradient + iconHint (xem [[curated-niche-grid]]).

export interface CuratedNiche {
  slug: string;
  displayName: string;
  pitch: string;
  image: string;
  iconHint: string;
}

export const CURATED_NICHES: CuratedNiche[] = [
  {
    slug: "laptop",
    displayName: "Laptop",
    pitch: "Gaming, văn phòng, sinh viên",
    image: "/niches/laptop.jpg",
    iconHint: "💻"
  },
  {
    slug: "tai-nghe-tws",
    displayName: "Tai nghe TWS",
    pitch: "AirPods, Sony, Galaxy Buds",
    image: "/niches/tai-nghe.jpg",
    iconHint: "🎧"
  },
  {
    slug: "robot-hut-bui-lau-nha",
    displayName: "Robot hút bụi",
    pitch: "Roborock, Dreame, Ecovacs",
    image: "/niches/robot.jpg",
    iconHint: "🤖"
  },
  {
    slug: "may-loc-khong-khi",
    displayName: "Máy lọc không khí",
    pitch: "Lọc PM2.5 cho mùa hanh",
    image: "/niches/loc-khi.jpg",
    iconHint: "🌬️"
  },
  {
    slug: "dong-ho-thong-minh",
    displayName: "Đồng hồ thông minh",
    pitch: "Apple, Garmin, Galaxy Watch",
    image: "/niches/dong-ho.jpg",
    iconHint: "⌚"
  },
  {
    slug: "my-pham-duong-da",
    displayName: "Mỹ phẩm dưỡng da",
    pitch: "Skincare Nhật, Hàn, dược mỹ phẩm",
    image: "/niches/skincare.jpg",
    iconHint: "🧴"
  }
];
