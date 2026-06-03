import type React from "react";
import { Icon } from "../ui/icon";

interface TrustItem {
  icon: "shield-check" | "tag" | "clock" | "trending-up" | "spark";
  title: string;
  description: string;
}

const ITEMS: TrustItem[] = [
  {
    icon: "tag",
    title: "Giá đối chiếu rõ ràng",
    description: "Giá gốc — giá ưu đãi — mức tiết kiệm hiển thị trên từng deal."
  },
  {
    icon: "shield-check",
    title: "Chỉ chọn nguồn chính hãng",
    description: "Shopee Mall, Lazada Mall, gian hàng chính hãng — không hàng trôi nổi."
  },
  {
    icon: "clock",
    title: "Cập nhật mỗi giờ",
    description: "Bot quét liên tục, ưu đãi tăng giảm được làm mới gần thời gian thực."
  },
  {
    icon: "spark",
    title: "Cẩm nang cùng deal",
    description: "Mỗi danh mục có guide chọn mua viết bởi đội biên tập."
  }
];

/**
 * Strip 4 điểm tin cậy đặt giữa hero và danh sách sản phẩm trên home.
 * Mục tiêu UX: nhanh chóng trấn an user mới (Vietnam market quen affiliate spam).
 */
export function TrustStrip(): React.ReactElement {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map((item) => (
        <li
          key={item.title}
          className="flex gap-3 rounded-xl border border-line bg-card/70 p-3 backdrop-blur"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700">
            <Icon name={item.icon} size="md" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
