"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider } from "react-hook-form";
import { AlertTriangle, Save, ImageOff } from "lucide-react";
import {
  AdminButton,
  ControlledTextField,
  ControlledSelectField,
  ControlledCheckboxField,
  SectionCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useAdminForm,
  adminInputClass,
  adminInputMonoClass
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
import { formatMoney } from "../../../../lib/format";

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

// ───── Structured fields ─────
// Tách scrapedData thành 4 nhóm logic, hiển thị riêng từng nhóm.
const FIELD_GROUPS = [
  {
    label: "Hiển thị",
    fields: [
      { key: "image", type: "text", label: "Image URL", placeholder: "https://...", preview: "image" as const },
      { key: "brand", type: "text", label: "Brand" },
      { key: "store", type: "text", label: "Store / Merchant" },
      { key: "description", type: "textarea", label: "Description" },
      { key: "badge", type: "text", label: "Badge" },
      { key: "promotion", type: "text", label: "Promotion (tặng kèm…)" }
    ]
  },
  {
    label: "Giá & Discount",
    fields: [
      { key: "price", type: "number", label: "Price (giá sau giảm, VND)", money: true },
      { key: "originalPrice", type: "number", label: "Original price (giá gốc, VND)", money: true },
      { key: "salePrice", type: "number", label: "Sale price raw từ AT (VND)", money: true },
      { key: "currency", type: "text", label: "Currency", placeholder: "VND" },
      { key: "discountPercent", type: "number", label: "Discount % (computed)" },
      { key: "discountRate", type: "number", label: "Discount rate raw từ AT (%)" },
      { key: "discountAmount", type: "number", label: "Discount amount (VND)", money: true },
      { key: "statusDiscount", type: "number", label: "status_discount (0|1)" }
    ]
  },
  {
    label: "Phân loại",
    fields: [
      { key: "category", type: "text", label: "Category (free text từ AT)" },
      { key: "atCategorySlug", type: "text", label: "AT category slug (`cate`)" }
    ]
  },
  {
    label: "Identity & metadata (read-only)",
    readonly: true,
    fields: [
      { key: "sourceId", type: "text", label: "AT id (offer ID)" },
      { key: "sourceProductId", type: "text", label: "Merchant product_id" },
      { key: "sku", type: "text", label: "SKU" },
      { key: "sourceNetwork", type: "text", label: "Source network" },
      { key: "merchant", type: "text", label: "Merchant slug" },
      { key: "campaign", type: "text", label: "Campaign name" },
      { key: "updateTime", type: "text", label: "AT update_time" }
    ]
  }
] as const;

type FieldType = "text" | "number" | "textarea";

interface FieldDef {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  money?: boolean;
  preview?: "image";
}

interface GroupDef {
  label: string;
  readonly?: boolean;
  fields: ReadonlyArray<FieldDef>;
}

export function ProductEditForm({ product, categories }: EditFormProps): React.ReactElement {
  const router = useRouter();
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  // Structured state: parsed scrapedData object. Submit sẽ JSON.stringify cái này.
  const [scraped, setScraped] = React.useState<Record<string, unknown>>(
    () => ({ ...(product.scrapedData ?? {}) })
  );
  const [jsonText, setJsonText] = React.useState(() =>
    JSON.stringify(product.scrapedData ?? {}, null, 2)
  );
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  // Tab đang active — để sync chiều JSON → fields khi user chuyển từ tab JSON sang.
  const [activeTab, setActiveTab] = React.useState("basic");

  const defaults: ProductUpdateInput = {
    id: product.id,
    name: product.name,
    affiliateUrl: product.affiliateUrl,
    categoryId: product.category.id,
    network: product.network,
    isPublic: product.isPublic,
    scrapedData: jsonText
  };

  const { form, submit, error, isSubmitting } = useAdminForm<ProductUpdateInput>({
    schema: productUpdateSchema,
    defaultValues: defaults,
    onSubmit: async (data) => {
      // Source of truth là `scraped` state (Fields tab). User có thể đã sửa JSON tab thì sync chiều ngược.
      let toSend = scraped;
      if (activeTab === "json") {
        try {
          toSend = JSON.parse(jsonText) as Record<string, unknown>;
        } catch (e) {
          return { ok: false, error: `JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
      const fd = new FormData();
      fd.set("id", product.id);
      if (data.name) fd.set("name", data.name);
      if (data.affiliateUrl) fd.set("affiliateUrl", data.affiliateUrl);
      if (data.categoryId) fd.set("categoryId", data.categoryId);
      if (data.network) fd.set("network", data.network);
      if (data.isPublic !== undefined) fd.set("isPublic", data.isPublic ? "true" : "false");
      fd.set("scrapedData", JSON.stringify(toSend));
      await updateProductAction(fd);
      router.refresh();
      return { ok: true };
    }
  });

  function setField(key: string, value: string): void {
    setScraped((prev) => {
      const next = { ...prev };
      if (value === "") {
        delete next[key];
      } else {
        const def = findField(key);
        if (def?.type === "number") {
          const n = Number(value);
          if (!Number.isFinite(n)) return prev;
          next[key] = n;
        } else {
          next[key] = value;
        }
      }
      // Đồng bộ JSON text để khi user mở tab JSON thấy cập nhật.
      setJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function onJsonChange(text: string): void {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setScraped(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  }

  // Khi user chuyển từ JSON tab về Fields tab, đảm bảo scraped state khớp với JSON nếu hợp lệ.
  function handleTabChange(value: string): void {
    if (activeTab === "json" && value !== "json" && !jsonError) {
      try {
        setScraped(JSON.parse(jsonText) as Record<string, unknown>);
      } catch {
        // already shown in error state
      }
    }
    setActiveTab(value);
  }

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
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="basic">Cơ bản</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
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

            <TabsContent value="fields">
              <div className="space-y-4">
                {FIELD_GROUPS.map((group) => (
                  <FieldGroup
                    key={group.label}
                    group={group}
                    values={scraped}
                    onChange={setField}
                  />
                ))}
                <ExtraFieldsCard scraped={scraped} />
              </div>
            </TabsContent>

            <TabsContent value="json">
              <SectionCard
                title="scrapedData (JSON)"
                description="Edit thẳng JSON. Tab Fields sẽ auto-sync khi JSON hợp lệ."
              >
                {jsonError ? (
                  <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {jsonError}
                  </div>
                ) : null}
                <textarea
                  value={jsonText}
                  onChange={(e) => onJsonChange(e.target.value)}
                  rows={24}
                  className={adminInputMonoClass}
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
              disabled={Boolean(jsonError)}
            >
              Lưu thay đổi
            </AdminButton>
          </div>
        </form>
      </FormProvider>
    </>
  );
}

// ───────── Field group ─────────

function FieldGroup({
  group,
  values,
  onChange
}: {
  group: GroupDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}): React.ReactElement {
  return (
    <SectionCard title={group.label}>
      <div className="grid gap-3 sm:grid-cols-2">
        {group.fields.map((f) => (
          <SingleField
            key={f.key}
            def={f}
            value={values[f.key]}
            readonly={Boolean(group.readonly)}
            onChange={(v) => onChange(f.key, v)}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function SingleField({
  def,
  value,
  readonly,
  onChange
}: {
  def: FieldDef;
  value: unknown;
  readonly: boolean;
  onChange: (v: string) => void;
}): React.ReactElement {
  const strValue =
    value === undefined || value === null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  const full = def.type === "textarea" || def.preview === "image";
  const helpText =
    def.money && typeof value === "number" ? formatMoney(value, "VND") : undefined;

  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11.5px] font-medium text-admin-mute">{def.label}</span>
      {def.type === "textarea" ? (
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          readOnly={readonly}
          placeholder={def.placeholder}
          className={adminInputClass}
        />
      ) : (
        <input
          type={def.type === "number" ? "number" : "text"}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readonly}
          placeholder={def.placeholder}
          className={adminInputClass}
        />
      )}
      {def.preview === "image" && strValue ? (
        <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-admin-line bg-admin-subtle/30 p-1.5">
          <img
            src={strValue}
            alt=""
            className="size-16 rounded object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-[10.5px] text-admin-mute">Preview</span>
        </div>
      ) : null}
      {!strValue && def.preview === "image" ? (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-admin-mute">
          <ImageOff className="size-3" /> Chưa có ảnh
        </div>
      ) : null}
      {helpText ? (
        <div className="mt-0.5 text-[11px] text-admin-mute">{helpText}</div>
      ) : null}
    </label>
  );
}

/**
 * Hiển thị mọi key trong scrapedData KHÔNG nằm trong FIELD_GROUPS (vd `metadata.atRaw`, `highlights[]`,
 * custom fields theo schemaConfig của Category). Read-only — chỉnh ở tab JSON nếu cần.
 */
function ExtraFieldsCard({
  scraped
}: {
  scraped: Record<string, unknown>;
}): React.ReactElement | null {
  const known = new Set<string>(FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)));
  const extras = Object.entries(scraped).filter(([k]) => !known.has(k));
  if (extras.length === 0) return null;

  return (
    <SectionCard
      title={`Field khác (${extras.length})`}
      description="Field không có trong nhóm chuẩn — bao gồm raw AT response, schemaConfig fields. Read-only ở đây; chỉnh ở tab JSON."
    >
      <div className="space-y-2">
        {extras.map(([key, value]) => (
          <details key={key} className="rounded-md border border-admin-line bg-admin-subtle/20 px-3 py-2">
            <summary className="cursor-pointer font-mono text-[11.5px] text-admin-ink">
              {key}
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto text-[11px] text-admin-ink">
              {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </SectionCard>
  );
}

function findField(key: string): FieldDef | undefined {
  for (const g of FIELD_GROUPS) {
    for (const f of g.fields) {
      if (f.key === key) return f as FieldDef;
    }
  }
  return undefined;
}
