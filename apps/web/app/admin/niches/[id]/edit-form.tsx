"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider } from "react-hook-form";
import { AlertTriangle, Save } from "lucide-react";
import {
  AdminButton,
  ControlledTextField,
  ControlledSelectField,
  ControlledTextareaField,
  SectionCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useAdminForm
} from "../../../../components/admin/ui";
import { NICHE_STATUS_OPTIONS } from "../../../../lib/admin/constants";
import {
  nicheUpdateSchema,
  type NicheUpdateInput
} from "../../../../lib/admin/schemas";
import { updateNicheAction } from "../../actions";

interface NicheDetail {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface EditFormProps {
  niche: NicheDetail;
}

export function NicheEditForm({ niche }: EditFormProps): React.ReactElement {
  const router = useRouter();

  const defaults: NicheUpdateInput = {
    id: niche.id,
    name: niche.name,
    slug: niche.slug,
    status: niche.status,
    schemaConfig: JSON.stringify(niche.schemaConfig ?? {}, null, 2),
    seoTitle: niche.seoTitle,
    seoDescription: niche.seoDescription
  };

  const { form, submit, error, isSubmitting } = useAdminForm<NicheUpdateInput>({
    schema: nicheUpdateSchema,
    defaultValues: defaults,
    onSubmit: async (data) => {
      const fd = new FormData();
      fd.set("id", niche.id);
      if (data.name) fd.set("name", data.name);
      if (data.slug) fd.set("slug", data.slug);
      if (data.status) fd.set("status", data.status);
      if (data.schemaConfig !== undefined) fd.set("schemaConfig", data.schemaConfig);
      if (data.seoTitle !== undefined) fd.set("seoTitle", data.seoTitle ?? "");
      if (data.seoDescription !== undefined)
        fd.set("seoDescription", data.seoDescription ?? "");
      await updateNicheAction(fd);
      router.refresh();
      return { ok: true };
    }
  });

  return (
    <>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-admin-danger-soft bg-admin-danger-soft/40 p-3 text-sm text-admin-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      <FormProvider {...form}>
        <form onSubmit={submit} className="space-y-6">
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="schema">schemaConfig</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <SectionCard title="Thông tin cơ bản">
                <div className="admin-form-grid">
                  <ControlledTextField<NicheUpdateInput>
                    name="name"
                    label="Tên hiển thị"
                    required
                  />
                  <ControlledTextField<NicheUpdateInput>
                    name="slug"
                    label="Slug"
                    mono
                    required
                    hint="Đổi slug → 308 redirect cho URL cũ. Cẩn thận với SEO."
                  />
                  <ControlledSelectField<NicheUpdateInput>
                    name="status"
                    label="Trạng thái"
                    options={NICHE_STATUS_OPTIONS}
                  />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="seo">
              <SectionCard
                title="SEO meta"
                description="Hiển thị trên Google search + OG card khi share. Để trống = dùng giá trị mặc định."
              >
                <div className="grid gap-3">
                  <ControlledTextField<NicheUpdateInput>
                    name="seoTitle"
                    label="SEO title"
                    placeholder="Top robot hút bụi lau nhà 2026 — so sánh chi tiết"
                    maxLength={180}
                    hint="≤ 180 ký tự. Google cắt ~60 ký tự."
                  />
                  <ControlledTextareaField<NicheUpdateInput>
                    name="seoDescription"
                    label="SEO description"
                    placeholder="Cẩm nang chọn robot 2026 — phân tích, so sánh, deal tốt nhất..."
                    rows={3}
                    maxLength={320}
                    hint="≤ 320 ký tự. Google cắt ~155 ký tự."
                  />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="schema">
              <SectionCard
                title="schemaConfig (JSON)"
                description="Định nghĩa các field AI sẽ bóc tách cho sản phẩm trong niche này. Sửa chỉ ảnh hưởng sản phẩm mới — sản phẩm cũ giữ scrapedData hiện tại."
              >
                <ControlledTextareaField<NicheUpdateInput>
                  name="schemaConfig"
                  label=""
                  mono
                  rows={20}
                  fullRow
                />
              </SectionCard>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2">
            <AdminButton
              type="submit"
              size="md"
              iconLeft={<Save />}
              loading={isSubmitting}
              loadingLabel="Đang lưu..."
            >
              Lưu thay đổi
            </AdminButton>
          </div>
        </form>
      </FormProvider>
    </>
  );
}
