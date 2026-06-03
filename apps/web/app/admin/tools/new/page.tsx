import type React from "react";
import Link from "next/link";
import { adminGet } from "../../../../components/admin/ui";
import { ToolForm } from "../tool-form";

export const dynamic = "force-dynamic";

export default async function NewToolPage(): Promise<React.ReactElement> {
  const niches = await adminGet<{ id: string; slug: string; name: string; status: string }[]>(
    "/admin/niches"
  );

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link href="/admin/tools" className="text-sm text-admin-mute hover:text-admin-ink">
        ← Tool builder
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-admin-ink">Tạo Tool mới</h1>
      <p className="mt-1 text-sm text-admin-mute">
        Default template = quiz chọn máy lọc nước (4 câu, scoring rules sẵn). Sửa cho phù hợp niche
        của bạn.
      </p>

      <div className="mt-6 rounded-2xl border border-admin-line bg-admin-surface p-6">
        <ToolForm niches={niches} />
      </div>
    </div>
  );
}
