"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider } from "react-hook-form";
import { AlertTriangle, Save } from "lucide-react";
import {
  AdminButton,
  ControlledTextField,
  ControlledSelectField,
  ControlledCheckboxField,
  ControlledTextareaField,
  SectionCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useAdminForm
} from "../../../../components/admin/ui";
import {
  NETWORK_OPTIONS,
  type AffiliateNetwork
} from "../../../../lib/admin/constants";
import {
  productUpdateSchema,
  type ProductUpdateInput
} from "../../../../lib/admin/schemas";
import { updateProductAction } from "../../actions";

interface ProductDetail {
  id: string;
  name: string;
  slug: string | null;
  network: AffiliateNetwork;
  isPublic: boolean;
  affiliateUrl: string;
  scrapedData: Record<string, unknown>;
  category: { id: string; slug: string; name: string };
}

interface CategoryLite {
  id: string;
  slug: string;
  name: string;
}

interface EditFormProps {
  product: ProductDetail;
  categories: CategoryLite[];
}

export function ProductEditForm({ product, categories }: EditFormProps): React.ReactElement {
  const router = useRouter();
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const defaults: ProductUpdateInput = {
    id: product.id,
    name: product.name,
    affiliateUrl: product.affiliateUrl,
    categoryId: product.category.id,
    network: product.network,
    isPublic: product.isPublic,
    scrapedData: JSON.stringify(product.scrapedData ?? {}, null, 2)
  };

  const { form, submit, error, isSubmitting } = useAdminForm<ProductUpdateInput>({
    schema: productUpdateSchema,
    defaultValues: defaults,
    onSubmit: async (data) => {
      const fd = new FormData();
      fd.set("id", product.id);
      if (data.name) fd.set("name", data.name);
      if (data.affiliateUrl) fd.set("affiliateUrl", data.affiliateUrl);
      if (data.categoryId) fd.set("categoryId", data.categoryId);
      if (data.network) fd.set("network", data.network);
      if (data.isPublic !== undefined) fd.set("isPublic", data.isPublic ? "true" : "false");
      if (data.scrapedData) fd.set("scrapedData", data.scrapedData);
      await updateProductAction(fd);
      router.refresh();
      return { ok: true };
    }
  });

  return (
    <>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      <FormProvider {...form}>
        <form onSubmit={submit} className="space-y-6">
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">Thông tin chung</TabsTrigger>
              <TabsTrigger value="scraped">scrapedData (JSON)</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <SectionCard title="Thông tin sản phẩm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ControlledTextField<ProductUpdateInput>
                    name="name"
                    label="Tên sản phẩm"
                    required
                    fullRow
                  />
                  <ControlledTextField<ProductUpdateInput>
                    name="affiliateUrl"
                    label="Affiliate URL"
                    type="url"
                    mono
                    required
                    fullRow
                    hint="Đổi URL sẽ phá tracking cũ — chỉ đổi khi merchant đổi link."
                  />
                  <ControlledSelectField<ProductUpdateInput>
                    name="categoryId"
                    label="Danh mục"
                    options={categoryOptions}
                    required
                  />
                  <ControlledSelectField<ProductUpdateInput>
                    name="network"
                    label="Affiliate network"
                    options={NETWORK_OPTIONS}
                    required
                  />
                  <ControlledCheckboxField<ProductUpdateInput>
                    name="isPublic"
                    label="Hiển thị trên storefront công khai"
                    hint="Tắt = ẩn khỏi public, vẫn track click qua admin."
                    fullRow
                  />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="scraped">
              <SectionCard
                title="scrapedData"
                description="Dữ liệu AI bóc tách theo schemaConfig của danh mục. Nhập sai JSON sẽ báo lỗi khi lưu."
              >
                <ControlledTextareaField<ProductUpdateInput>
                  name="scrapedData"
                  label=""
                  mono
                  rows={24}
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
