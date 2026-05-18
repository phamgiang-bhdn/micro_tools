"use client";

import * as React from "react";
import { z } from "zod";
import { Trash2, Pencil, Plus } from "lucide-react";
import { FormProvider, useFormContext, useWatch } from "react-hook-form";
import {
  AdminButton,
  ControlledNumberField,
  ControlledSelectField,
  ControlledTextField,
  ControlledTextareaField,
  Dialog,
  DialogContent,
  DialogFooter,
  FormDialog,
  StatusPill,
  useAdminForm
} from "../../../components/admin/ui";
import {
  DEFAULT_FILTER_RULES,
  STATUS_DISCOUNT_OPTIONS,
  slugifyVi,
  summarizeFilterRules
} from "../../../lib/admin/filter-rules.schema";
import {
  createCampaignAssignment,
  deleteCampaignAssignment,
  updateCampaignAssignment,
  type AssignmentInput,
  type AssignmentUpdateInput
} from "../actions";
import { notifyError, notifySuccess } from "../../../lib/admin/notify";

const DEFAULT_SCHEMA_CONFIG = JSON.stringify(
  {
    price: "number",
    originalPrice: "number",
    image: "string",
    description: "string",
    highlights: "string[]"
  },
  null,
  2
);

const SLUG_RE = /^[a-z0-9-]+$/;

export interface AssignmentRow {
  id: string;
  priority: number;
  filterRules: unknown;
  niche: { id: string; name: string; slug: string };
}

// ───── Form schemas ─────

export const addAssignmentFormSchema = z
  .object({
    mode: z.enum(["existing", "new"]),
    nicheId: z.string().uuid().nullable().optional(),
    newNicheName: z.string().nullable().optional(),
    newNicheSlug: z.string().nullable().optional(),
    newNicheSchemaConfig: z.string().nullable().optional(),
    priority: z.number().int().min(0).max(10000).default(100),
    minDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
    maxDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
    priceMin: z.number().min(0).nullable().optional(),
    priceMax: z.number().min(0).nullable().optional(),
    salePriceMin: z.number().min(0).nullable().optional(),
    salePriceMax: z.number().min(0).nullable().optional(),
    discountAmountMin: z.number().min(0).nullable().optional(),
    discountAmountMax: z.number().min(0).nullable().optional(),
    updateLookbackDays: z.number().int().min(1).max(365).nullable().optional(),
    statusDiscount: z.enum(["", "0", "1"]).optional(),
    domainsCsv: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.mode === "existing") {
      if (!data.nicheId) {
        ctx.addIssue({ code: "custom", path: ["nicheId"], message: "Chọn niche" });
      }
      return;
    }
    if (!data.newNicheName || data.newNicheName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["newNicheName"],
        message: "Tên niche tối thiểu 2 ký tự"
      });
    }
    if (!data.newNicheSlug) {
      ctx.addIssue({ code: "custom", path: ["newNicheSlug"], message: "Slug bắt buộc" });
    } else if (!SLUG_RE.test(data.newNicheSlug)) {
      ctx.addIssue({
        code: "custom",
        path: ["newNicheSlug"],
        message: "Slug chỉ chứa a-z, 0-9, dấu gạch"
      });
    }
    if (data.newNicheSchemaConfig) {
      try {
        const parsed: unknown = JSON.parse(data.newNicheSchemaConfig);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed) ||
          Object.keys(parsed as object).length === 0
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["newNicheSchemaConfig"],
            message: "schemaConfig cần ít nhất 1 field"
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["newNicheSchemaConfig"],
          message: "JSON không hợp lệ"
        });
      }
    }
  });

export type AddAssignmentFormValues = z.infer<typeof addAssignmentFormSchema>;

export const editAssignmentFormSchema = z.object({
  priority: z.number().int().min(0).max(10000),
  minDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
  maxDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
  priceMin: z.number().min(0).nullable().optional(),
  priceMax: z.number().min(0).nullable().optional(),
  salePriceMin: z.number().min(0).nullable().optional(),
  salePriceMax: z.number().min(0).nullable().optional(),
  discountAmountMin: z.number().min(0).nullable().optional(),
  discountAmountMax: z.number().min(0).nullable().optional(),
  updateLookbackDays: z.number().int().min(1).max(365).nullable().optional(),
  statusDiscount: z.enum(["", "0", "1"]).optional(),
  domainsCsv: z.string().optional()
});

export type EditAssignmentFormValues = z.infer<typeof editAssignmentFormSchema>;

// ───── Helpers ─────

interface FilterRulesShape extends Partial<typeof DEFAULT_FILTER_RULES> {
  domains?: string[];
}

function rulesToFormValues(rules: FilterRulesShape): {
  minDiscountPercent: number | null;
  maxDiscountPercent: number | null;
  priceMin: number | null;
  priceMax: number | null;
  salePriceMin: number | null;
  salePriceMax: number | null;
  discountAmountMin: number | null;
  discountAmountMax: number | null;
  updateLookbackDays: number | null;
  statusDiscount: "" | "0" | "1";
  domainsCsv: string;
} {
  const sd = rules.status_discount === 0 ? "0" : rules.status_discount === 1 ? "1" : "";
  return {
    minDiscountPercent: rules.minDiscountPercent ?? null,
    maxDiscountPercent: rules.maxDiscountPercent ?? null,
    priceMin: rules.priceMin ?? null,
    priceMax: rules.priceMax ?? null,
    salePriceMin: rules.salePriceMin ?? null,
    salePriceMax: rules.salePriceMax ?? null,
    discountAmountMin: rules.discountAmountMin ?? null,
    discountAmountMax: rules.discountAmountMax ?? null,
    updateLookbackDays: rules.updateLookbackDays ?? null,
    statusDiscount: sd,
    domainsCsv: rules.domains?.join(", ") ?? ""
  };
}

function formValuesToFilterRules(values: {
  minDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  salePriceMin?: number | null;
  salePriceMax?: number | null;
  discountAmountMin?: number | null;
  discountAmountMax?: number | null;
  updateLookbackDays?: number | null;
  statusDiscount?: "" | "0" | "1";
  domainsCsv?: string;
}): Record<string, unknown> {
  const filterRules: Record<string, unknown> = {};
  if (typeof values.minDiscountPercent === "number") {
    filterRules.minDiscountPercent = values.minDiscountPercent;
  }
  if (typeof values.maxDiscountPercent === "number") {
    filterRules.maxDiscountPercent = values.maxDiscountPercent;
  }
  if (typeof values.priceMin === "number") filterRules.priceMin = values.priceMin;
  if (typeof values.priceMax === "number") filterRules.priceMax = values.priceMax;
  if (typeof values.salePriceMin === "number") filterRules.salePriceMin = values.salePriceMin;
  if (typeof values.salePriceMax === "number") filterRules.salePriceMax = values.salePriceMax;
  if (typeof values.discountAmountMin === "number") filterRules.discountAmountMin = values.discountAmountMin;
  if (typeof values.discountAmountMax === "number") filterRules.discountAmountMax = values.discountAmountMax;
  if (typeof values.updateLookbackDays === "number") filterRules.updateLookbackDays = values.updateLookbackDays;
  if (values.statusDiscount === "0") filterRules.status_discount = 0;
  if (values.statusDiscount === "1") filterRules.status_discount = 1;
  const domains = (values.domainsCsv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (domains.length > 0) filterRules.domains = domains;
  return filterRules;
}

const MODE_OPTIONS = [
  { value: "existing", label: "Chọn niche có sẵn" },
  { value: "new", label: "Tạo niche mới" }
];

// ───── ManageAssignmentsDialog ─────
//
// Dialog 2 phần:
//  1. List assignments hiện tại (compact list, action sửa/xoá)
//  2. Form thêm assignment dùng FormProvider + Controlled* fields — đồng nhất với
//     mọi FormDialog khác (label/input/typography/spacing/error).

export interface ManageAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  campaign: {
    id: string;
    name: string;
    atCampaignId: string | null;
    assignments: AssignmentRow[];
  };
  niches: Array<{ id: string; name: string; slug: string }>;
}

export function ManageAssignmentsDialog({
  open,
  onOpenChange,
  onChanged,
  campaign,
  niches
}: ManageAssignmentsDialogProps): React.ReactElement {
  const [local, setLocal] = React.useState<AssignmentRow[]>(campaign.assignments);
  const [editing, setEditing] = React.useState<AssignmentRow | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setLocal(campaign.assignments);
  }, [campaign.assignments]);

  const nicheOptions = React.useMemo(
    () => niches.map((c) => ({ value: c.id, label: `${c.name} (${c.slug})` })),
    [niches]
  );

  async function handleDelete(assignmentId: string): Promise<void> {
    if (!window.confirm("Xoá assignment này?")) return;
    setPending(true);
    try {
      await deleteCampaignAssignment(campaign.id, assignmentId);
      setLocal((prev) => prev.filter((a) => a.id !== assignmentId));
      notifySuccess("Đã xoá assignment");
      onChanged?.();
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="2xl"
          title={`Quản lý niche cho "${campaign.name}"`}
          description={
            campaign.atCampaignId
              ? `atCampaignId: ${campaign.atCampaignId}. Mỗi cặp campaign↔niche có filterRules + priority riêng. Crawler route offer theo first-match-wins (priority asc).`
              : "Campaign chưa có atCampaignId — cần Sync từ Accesstrade trước."
          }
          footer={
            <DialogFooter>
              <AdminButton variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Đóng
              </AdminButton>
            </DialogFooter>
          }
        >
          <div className="space-y-6">
            {!campaign.atCampaignId ? (
              <StatusPill tone="warning">
                Cần Sync từ Accesstrade trước khi assign niche.
              </StatusPill>
            ) : null}

            <section className="space-y-2.5">
              <h3 className="admin-section-title">
                Assignments hiện tại · {local.length}
              </h3>
              {local.length === 0 ? (
                <div className="rounded-lg border border-dashed border-admin-line bg-admin-subtle/30 px-4 py-6 text-center text-[12.5px] text-admin-mute">
                  Chưa có niche nào. Thêm bên dưới để crawler bắt đầu route offer.
                </div>
              ) : (
                <ul className="divide-y divide-admin-line/70 overflow-hidden rounded-lg border border-admin-line bg-admin-surface">
                  {[...local]
                    .sort((a, b) => a.priority - b.priority)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-admin-subtle/40"
                      >
                        <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-full bg-admin-accent-soft px-2 font-mono text-[11px] font-semibold text-admin-accent-ink">
                          p{a.priority}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-admin-ink">
                            {a.niche.name}
                          </div>
                          <div className="truncate font-mono text-[11.5px] text-admin-mute">
                            {a.niche.slug}
                          </div>
                        </div>
                        <span className="hidden text-[11.5px] text-admin-mute md:inline">
                          {summarizeFilterRules(a.filterRules as never)}
                        </span>
                        <AdminButton
                          variant="ghost"
                          size="xs"
                          iconLeft={<Pencil />}
                          onClick={() => setEditing(a)}
                          disabled={pending}
                        >
                          Sửa
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          size="xs"
                          iconLeft={<Trash2 />}
                          onClick={() => handleDelete(a.id)}
                          disabled={pending}
                        >
                          Xoá
                        </AdminButton>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="admin-section-title">Thêm niche mới</h3>
              <AddAssignmentForm
                key={local.length /* reset form after add */}
                campaignId={campaign.id}
                nicheOptions={nicheOptions}
                disabled={!campaign.atCampaignId}
                onAdded={() => onChanged?.()}
              />
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {editing ? (
        <EditAssignmentDialog
          open={true}
          onOpenChange={(o) => !o && setEditing(null)}
          campaignId={campaign.id}
          assignment={editing}
          onSaved={(updated) => {
            setLocal((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
            setEditing(null);
            onChanged?.();
          }}
        />
      ) : null}
    </>
  );
}

// ───── Add assignment inline form (uses useAdminForm — same primitives as FormDialog) ─────

interface AddFormProps {
  campaignId: string;
  nicheOptions: Array<{ value: string; label: string }>;
  disabled: boolean;
  onAdded?: () => void;
}

function AddAssignmentForm({
  campaignId,
  nicheOptions,
  disabled,
  onAdded
}: AddFormProps): React.ReactElement {
  const defaults = React.useMemo<AddAssignmentFormValues>(
    () => ({
      mode: "existing",
      nicheId: null,
      newNicheName: "",
      newNicheSlug: "",
      newNicheSchemaConfig: DEFAULT_SCHEMA_CONFIG,
      priority: 100,
      minDiscountPercent: null,
      maxDiscountPercent: null,
      priceMin: null,
      priceMax: null,
      salePriceMin: null,
      salePriceMax: null,
      discountAmountMin: null,
      discountAmountMax: null,
      updateLookbackDays: null,
      statusDiscount: "",
      domainsCsv: ""
    }),
    []
  );

  const { form, submit, error, isSubmitting, reset } = useAdminForm<AddAssignmentFormValues>({
    schema: addAssignmentFormSchema,
    defaultValues: defaults,
    successToast: "Đã thêm niche",
    onSubmit: async (values) => {
      const filterRules = formValuesToFilterRules(values);
      const body: AssignmentInput = { filterRules, priority: values.priority };
      if (values.mode === "new") {
        const schemaConfig = JSON.parse(values.newNicheSchemaConfig ?? "{}") as Record<
          string,
          unknown
        >;
        body.newNiche = {
          name: (values.newNicheName ?? "").trim(),
          slug: (values.newNicheSlug ?? "").trim(),
          schemaConfig
        };
      } else {
        body.nicheId = values.nicheId ?? undefined;
      }
      await createCampaignAssignment(campaignId, body);
    },
    onSuccess: () => {
      reset();
      onAdded?.();
    }
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border border-admin-line bg-admin-surface-2 p-4"
      >
        {error ? (
          <div className="rounded-lg border border-admin-danger/30 bg-admin-danger-soft px-3 py-2 text-[12.5px] text-admin-danger">
            {error}
          </div>
        ) : null}

        <div className="admin-form-grid">
          <ControlledSelectField<AddAssignmentFormValues>
            name="mode"
            label="Chế độ"
            options={MODE_OPTIONS}
          />
          <ControlledNumberField<AddAssignmentFormValues>
            name="priority"
            label="Priority"
            hint="Lower = match trước"
            min={0}
            max={10000}
          />
        </div>

        <ModeBranchFields nicheOptions={nicheOptions} />

        <fieldset className="space-y-3">
          <legend className="admin-section-title pb-1">Filter rules</legend>
          <div className="admin-form-grid">
            <ControlledNumberField<AddAssignmentFormValues>
              name="minDiscountPercent"
              label="Discount tối thiểu (%)"
              min={0}
              max={100}
              placeholder="20"
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="maxDiscountPercent"
              label="Discount tối đa (%)"
              min={0}
              max={100}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="priceMin"
              label="Giá gốc tối thiểu (VND)"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="priceMax"
              label="Giá gốc tối đa (VND)"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="salePriceMin"
              label="Giá sau giảm tối thiểu (VND)"
              hint="Khác giá gốc — lọc theo `discount_from` của AT"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="salePriceMax"
              label="Giá sau giảm tối đa (VND)"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="discountAmountMin"
              label="Số tiền giảm tối thiểu (VND)"
              hint="Vd 500000 = chỉ deal giảm ≥ 500k"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="discountAmountMax"
              label="Số tiền giảm tối đa (VND)"
              min={0}
            />
            <ControlledNumberField<AddAssignmentFormValues>
              name="updateLookbackDays"
              label="Chỉ offer cập nhật trong N ngày qua"
              hint="Incremental sync — vd 7 = chỉ pull offer thay đổi trong 7 ngày"
              min={1}
              max={365}
            />
            <ControlledSelectField<AddAssignmentFormValues>
              name="statusDiscount"
              label="Loại sản phẩm"
              options={STATUS_DISCOUNT_OPTIONS}
              allowEmpty
              emptyLabel="Mọi sản phẩm"
            />
            <ControlledTextField<AddAssignmentFormValues>
              name="domainsCsv"
              label="Domain whitelist (CSV)"
              hint="≥2 domain → filter client-side. 1 domain → push xuống AT."
              placeholder="shopee.vn, lazada.vn"
              fullRow
            />
          </div>
        </fieldset>

        <div className="flex justify-end">
          <AdminButton
            type="submit"
            size="sm"
            iconLeft={<Plus />}
            loading={isSubmitting}
            disabled={disabled || isSubmitting}
            loadingLabel="Đang thêm…"
          >
            Thêm niche
          </AdminButton>
        </div>
      </form>
    </FormProvider>
  );
}

function ModeBranchFields({
  nicheOptions
}: {
  nicheOptions: Array<{ value: string; label: string }>;
}): React.ReactElement {
  const { control, setValue, getValues } = useFormContext<AddAssignmentFormValues>();
  const mode = useWatch({ control, name: "mode" });
  const newName = useWatch({ control, name: "newNicheName" });
  const newSlug = useWatch({ control, name: "newNicheSlug" });

  // Auto-derive slug từ tên khi user chưa chỉnh slug — UX nhỏ nhưng đỡ gõ.
  React.useEffect(() => {
    if (mode === "new" && newName && !newSlug) {
      setValue("newNicheSlug", slugifyVi(newName), { shouldValidate: false });
    }
  }, [mode, newName, newSlug, setValue, getValues]);

  if (mode === "existing") {
    return (
      <ControlledSelectField<AddAssignmentFormValues>
        name="nicheId"
        label="Niche đích"
        placeholder="— Chọn niche —"
        options={nicheOptions}
        required
        fullRow
      />
    );
  }
  return (
    <div className="admin-form-grid">
      <ControlledTextField<AddAssignmentFormValues>
        name="newNicheName"
        label="Tên niche mới"
        placeholder="Robot hút bụi lau nhà"
        required
      />
      <ControlledTextField<AddAssignmentFormValues>
        name="newNicheSlug"
        label="Slug"
        mono
        placeholder="robot-hut-bui-lau-nha"
        required
      />
      <ControlledTextareaField<AddAssignmentFormValues>
        name="newNicheSchemaConfig"
        label="schemaConfig (JSON)"
        mono
        rows={6}
        fullRow
        hint="Field AI bóc tách cho sản phẩm trong niche này."
      />
    </div>
  );
}

// ───── EditAssignmentDialog (mini) ─────

interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  assignment: AssignmentRow;
  onSaved: (updated: AssignmentRow) => void;
}

function EditAssignmentDialog({
  open,
  onOpenChange,
  campaignId,
  assignment,
  onSaved
}: EditDialogProps): React.ReactElement {
  const defaults = React.useMemo<EditAssignmentFormValues>(() => {
    const rules = (assignment.filterRules ?? {}) as FilterRulesShape;
    return {
      priority: assignment.priority,
      ...rulesToFormValues(rules)
    };
  }, [assignment]);

  return (
    <FormDialog<EditAssignmentFormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={`Sửa assignment: ${assignment.niche.name}`}
      description="Cập nhật priority + filterRules. Niche không đổi (xoá rồi thêm lại nếu muốn)."
      size="xl"
      schema={editAssignmentFormSchema}
      defaultValues={defaults}
      resetOnOpen
      submitLabel="Lưu"
      successToast="Đã cập nhật assignment"
      onSubmit={async (values) => {
        const body: AssignmentUpdateInput = {
          priority: values.priority,
          filterRules: formValuesToFilterRules(values)
        };
        await updateCampaignAssignment(campaignId, assignment.id, body);
        onSaved({
          ...assignment,
          priority: values.priority,
          filterRules: body.filterRules
        });
        return { ok: true };
      }}
    >
      <EditFields />
    </FormDialog>
  );
}

function EditFields(): React.ReactElement {
  return (
    <>
      <ControlledNumberField<EditAssignmentFormValues>
        name="priority"
        label="Priority (lower = match trước)"
        min={0}
        max={10000}
        fullRow
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="minDiscountPercent"
        label="Discount tối thiểu (%)"
        min={0}
        max={100}
        placeholder="20"
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="maxDiscountPercent"
        label="Discount tối đa (%)"
        min={0}
        max={100}
      />
      <ControlledNumberField<EditAssignmentFormValues> name="priceMin" label="Giá gốc tối thiểu (VND)" min={0} />
      <ControlledNumberField<EditAssignmentFormValues> name="priceMax" label="Giá gốc tối đa (VND)" min={0} />
      <ControlledNumberField<EditAssignmentFormValues>
        name="salePriceMin"
        label="Giá sau giảm tối thiểu (VND)"
        hint="Khác giá gốc — lọc theo `discount_from` của AT"
        min={0}
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="salePriceMax"
        label="Giá sau giảm tối đa (VND)"
        min={0}
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="discountAmountMin"
        label="Số tiền giảm tối thiểu (VND)"
        hint="Vd 500000 = chỉ deal giảm ≥ 500k"
        min={0}
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="discountAmountMax"
        label="Số tiền giảm tối đa (VND)"
        min={0}
      />
      <ControlledNumberField<EditAssignmentFormValues>
        name="updateLookbackDays"
        label="Chỉ offer cập nhật trong N ngày qua"
        hint="Incremental sync — vd 7 = chỉ pull offer thay đổi trong 7 ngày"
        min={1}
        max={365}
      />
      <ControlledSelectField<EditAssignmentFormValues>
        name="statusDiscount"
        label="Loại sản phẩm"
        options={STATUS_DISCOUNT_OPTIONS}
        allowEmpty
        emptyLabel="Mọi sản phẩm"
      />
      <ControlledTextField<EditAssignmentFormValues>
        name="domainsCsv"
        label="Domain whitelist (CSV)"
        hint="≥2 domain → filter client-side. 1 domain → push xuống AT."
        placeholder="shopee.vn, lazada.vn"
        fullRow
      />
    </>
  );
}
