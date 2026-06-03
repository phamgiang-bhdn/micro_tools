"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Eye } from "lucide-react";
import { AdminButton } from "../../../components/admin/ui";
import { adminInputClass } from "../../../components/admin/ui/form-field";
import { createToolAction, updateToolAction } from "../actions";

export interface ToolFormValues {
  slug: string;
  nicheId: string;
  name: string;
  description: string;
  tagline: string;
  quizSchemaJson: string;
  scoringRulesJson: string;
  resultTemplateJson: string;
  seoTitle: string;
  seoDescription: string;
}

interface ToolFormProps {
  niches: { id: string; slug: string; name: string; status: string }[];
  initial?: Partial<ToolFormValues> & { id?: string };
}

const DEFAULT_QUIZ_SCHEMA = `{
  "questions": [
    {
      "id": "household_size",
      "question": "Nhà bạn có mấy người dùng?",
      "type": "single",
      "required": true,
      "weight": 10,
      "options": [
        { "value": "1-2", "label": "1-2 người", "icon": "👤" },
        { "value": "3-4", "label": "3-4 người", "icon": "👨‍👩‍👧" },
        { "value": "5+", "label": "5+ người", "icon": "👨‍👩‍👧‍👦" }
      ],
      "defaultValue": "3-4"
    },
    {
      "id": "water_source",
      "question": "Nguồn nước nhà bạn?",
      "type": "single",
      "required": true,
      "weight": 9,
      "options": [
        { "value": "tap", "label": "Nước máy", "icon": "🚰" },
        { "value": "well", "label": "Giếng khoan", "icon": "⛲" },
        { "value": "unknown", "label": "Không rõ", "icon": "❓" }
      ]
    },
    {
      "id": "budget_max",
      "question": "Ngân sách tối đa (VND)?",
      "type": "single",
      "required": true,
      "weight": 8,
      "options": [
        { "value": 5000000, "label": "Dưới 5tr", "icon": "💰" },
        { "value": 10000000, "label": "5-10tr", "icon": "💰" },
        { "value": 20000000, "label": "10-20tr", "icon": "💰" },
        { "value": 99000000, "label": "Không giới hạn", "icon": "✨" }
      ]
    },
    {
      "id": "needs_hot_cold",
      "question": "Có cần nước nóng/lạnh sẵn không?",
      "type": "single",
      "required": false,
      "weight": 5,
      "options": [
        { "value": "yes", "label": "Có" },
        { "value": "no", "label": "Không cần" }
      ]
    }
  ]
}`;

const DEFAULT_SCORING_RULES = `{
  "rules": [
    {
      "userAttribute": "household_size",
      "productAttributePath": "scrapedData.recommendedHouseholdSize",
      "weight": 10,
      "matchType": "range_overlap"
    },
    {
      "userAttribute": "water_source",
      "productAttributePath": "scrapedData.supportedSources",
      "weight": 9,
      "matchType": "tag_match"
    },
    {
      "userAttribute": "budget_max",
      "productAttributePath": "scrapedData.priceVnd",
      "weight": 8,
      "matchType": "lte"
    },
    {
      "userAttribute": "needs_hot_cold",
      "productAttributePath": "scrapedData.hasHotCold",
      "weight": 5,
      "matchType": "exact"
    }
  ],
  "hardFilters": [
    {
      "productAttributePath": "scrapedData.inventoryStatus",
      "matchType": "neq",
      "value": "OOS"
    }
  ]
}`;

const DEFAULT_RESULT_TEMPLATE = `{
  "topN": 3,
  "hierarchy": "1+2",
  "highThreshold": 0.85,
  "mediumThreshold": 0.65,
  "confidenceLabels": {
    "high": "Rất phù hợp",
    "medium": "Phù hợp",
    "low": "Có thể cân nhắc"
  }
}`;

export function ToolForm({ niches, initial }: ToolFormProps): React.ReactElement {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [values, setValues] = React.useState<ToolFormValues>({
    slug: initial?.slug ?? "",
    nicheId: initial?.nicheId ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    tagline: initial?.tagline ?? "",
    quizSchemaJson: initial?.quizSchemaJson ?? DEFAULT_QUIZ_SCHEMA,
    scoringRulesJson: initial?.scoringRulesJson ?? DEFAULT_SCORING_RULES,
    resultTemplateJson: initial?.resultTemplateJson ?? DEFAULT_RESULT_TEMPLATE,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? ""
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const validateJson = (key: string, raw: string): unknown | null => {
    try {
      const parsed = JSON.parse(raw);
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
      return parsed;
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: `JSON lỗi: ${err instanceof Error ? err.message : "unknown"}` }));
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const quizSchema = validateJson("quizSchemaJson", values.quizSchemaJson);
    const scoringRules = validateJson("scoringRulesJson", values.scoringRulesJson);
    const resultTemplate = validateJson("resultTemplateJson", values.resultTemplateJson);
    if (!quizSchema || !scoringRules || !resultTemplate) {
      alert("JSON lỗi — fix trước khi save.");
      return;
    }
    if (!values.slug || !values.name || !values.nicheId) {
      alert("Slug, Name, Niche bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        slug: values.slug,
        nicheId: values.nicheId,
        name: values.name,
        description: values.description.trim() || null,
        tagline: values.tagline.trim() || null,
        quizSchema,
        scoringRules,
        resultTemplate,
        seoTitle: values.seoTitle.trim() || null,
        seoDescription: values.seoDescription.trim() || null
      };

      const result = isEdit
        ? await updateToolAction(initial!.id!, payload)
        : await createToolAction(payload);

      if (!result.ok) {
        alert(result.error ?? "Save thất bại");
        return;
      }
      if (!isEdit && "id" in result && result.id) {
        router.push(`/admin/tools/${result.id}`);
      } else {
        router.refresh();
        alert("✓ Đã lưu");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên Tool" required>
          <input
            className={adminInputClass}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="AI chọn máy lọc nước"
            required
          />
        </Field>
        <Field label="Slug (URL: /ai/[slug])" required hint="lowercase + dash">
          <input
            className={`${adminInputClass} font-mono`}
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            placeholder="may-loc-nuoc"
            pattern="[a-z0-9-]+"
            required
          />
        </Field>
        <Field label="Niche" required>
          <select
            className={adminInputClass}
            value={values.nicheId}
            onChange={(e) => setValues((v) => ({ ...v, nicheId: e.target.value }))}
            required
          >
            <option value="">— Chọn niche —</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.slug}) {n.status !== "ACTIVE" && "[INACTIVE]"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tagline (hero)" hint="Ngắn, có chữ AI">
          <input
            className={adminInputClass}
            value={values.tagline}
            onChange={(e) => setValues((v) => ({ ...v, tagline: e.target.value }))}
            placeholder="🤖 AI chọn máy lọc nước trong 60s"
          />
        </Field>
      </div>

      <Field label="Mô tả">
        <textarea
          className={adminInputClass}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={2}
          placeholder="Tool giúp gia đình chọn máy lọc nước phù hợp với số người, nguồn nước, ngân sách."
        />
      </Field>

      <JsonField
        label="Quiz schema (JSON)"
        hint="Cap 3 câu cốt lõi required + 2 câu optional refine"
        value={values.quizSchemaJson}
        onChange={(v) => setValues((s) => ({ ...s, quizSchemaJson: v }))}
        error={errors.quizSchemaJson}
      />

      <JsonField
        label="Scoring rules (JSON)"
        hint="Match types: exact / range_overlap / gte / lte / string_contains / tag_match"
        value={values.scoringRulesJson}
        onChange={(v) => setValues((s) => ({ ...s, scoringRulesJson: v }))}
        error={errors.scoringRulesJson}
      />

      <JsonField
        label="Result template (JSON)"
        hint="topN: số card hiện · hierarchy: 1+2 hoặc equal · confidence labels"
        value={values.resultTemplateJson}
        onChange={(v) => setValues((s) => ({ ...s, resultTemplateJson: v }))}
        error={errors.resultTemplateJson}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SEO title">
          <input
            className={adminInputClass}
            value={values.seoTitle}
            onChange={(e) => setValues((v) => ({ ...v, seoTitle: e.target.value }))}
            placeholder="AI chọn máy lọc nước trong 60 giây — DealVault"
          />
        </Field>
        <Field label="SEO description">
          <input
            className={adminInputClass}
            value={values.seoDescription}
            onChange={(e) => setValues((v) => ({ ...v, seoDescription: e.target.value }))}
            placeholder="Trả lời 3-5 câu, AI gợi ý 3 máy lọc nước hợp với gia đình bạn."
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-admin-line pt-6">
        <AdminButton type="submit" variant="primary" disabled={submitting}>
          <Save className="size-4" />
          {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo Tool"}
        </AdminButton>
        {isEdit && initial?.id && (
          <AdminButton
            type="button"
            variant="ghost"
            onClick={() => window.open(`/admin/tools/${initial.id}/preview`, "_blank")}
          >
            <Eye className="size-4" />
            Preview admin
          </AdminButton>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label className="block text-sm font-semibold text-admin-ink">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-admin-mute">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function JsonField({
  label,
  hint,
  value,
  onChange,
  error
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}): React.ReactElement {
  return (
    <div>
      <label className="block text-sm font-semibold text-admin-ink">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-admin-mute">{hint}</p>}
      <textarea
        className="mt-1.5 w-full rounded-lg border border-admin-line bg-white p-3 font-mono text-xs leading-relaxed text-admin-ink outline-none focus:border-admin-accent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(30, value.split("\n").length + 1)}
        spellCheck={false}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
