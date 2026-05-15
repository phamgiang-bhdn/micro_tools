"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, X } from "lucide-react";
import {
  AdminButton,
  DatePicker,
  SectionCard
} from "../../../../components/admin/ui";
import { scheduleArticleAction } from "../../actions";

interface ScheduleFormProps {
  articleId: string;
  scheduledAt: string | null;
}

export function ScheduleForm({ articleId, scheduledAt }: ScheduleFormProps): React.ReactElement {
  const router = useRouter();
  const [value, setValue] = React.useState<string | null>(
    scheduledAt ? scheduledAt.slice(0, 10) : null
  );
  const [pending, setPending] = React.useState(false);

  const save = async () => {
    const fd = new FormData();
    fd.set("id", articleId);
    if (value) fd.set("scheduledAt", value);
    setPending(true);
    try {
      await scheduleArticleAction(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const clear = async () => {
    const fd = new FormData();
    fd.set("id", articleId);
    setPending(true);
    try {
      await scheduleArticleAction(fd);
      setValue(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Hẹn giờ"
      title="Đặt lịch đăng tự động"
      description="Cron job sẽ tự đăng bài khi tới ngày. Trống = không hẹn lịch."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <DatePicker value={value} onChange={setValue} placeholder="Chọn ngày đăng..." />
        </div>
        <AdminButton
          size="md"
          iconLeft={<Calendar />}
          onClick={save}
          loading={pending}
          loadingLabel="Đang lưu..."
          disabled={!value || value === (scheduledAt ? scheduledAt.slice(0, 10) : null)}
        >
          {scheduledAt ? "Cập nhật lịch" : "Đặt lịch"}
        </AdminButton>
        {scheduledAt ? (
          <AdminButton
            variant="outline"
            size="md"
            iconLeft={<X />}
            onClick={clear}
            loading={pending}
            loadingLabel="Đang xoá..."
          >
            Huỷ lịch
          </AdminButton>
        ) : null}
        {scheduledAt ? (
          <span className="text-xs text-admin-mute">
            Hiện đang lên lịch:{" "}
            <span className="font-semibold text-admin-ink">
              {new Date(scheduledAt).toLocaleDateString("vi-VN")}
            </span>
          </span>
        ) : null}
      </div>
    </SectionCard>
  );
}
