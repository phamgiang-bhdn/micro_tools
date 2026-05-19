"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, Search as SearchIcon, X } from "lucide-react";
import {
  AdminButton,
  Dialog,
  DialogClose,
  DialogContent
} from "../../../components/admin/ui";
import { cn } from "../../../lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface AdvancedFieldDef {
  key: string;
  label: string;
  options: FilterOption[];
}

interface ProductsFilterProps {
  basePath: string;
  searchKey: string;
  searchPlaceholder?: string;
  statusKey: string;
  statusLabel: string;
  statusOptions: FilterOption[];
  advancedFields: AdvancedFieldDef[];
  storageKey: string;
}

const inputClass =
  "h-9 rounded-md border border-admin-line bg-admin-surface px-3 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20";
const selectClass =
  "h-9 rounded-md border border-admin-line bg-admin-surface px-3 pr-8 text-sm text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20";

export function ProductsFilter({
  basePath,
  searchKey,
  searchPlaceholder,
  statusKey,
  statusLabel,
  statusOptions,
  advancedFields,
  storageKey
}: ProductsFilterProps): React.ReactElement {
  const router = useRouter();
  const sp = useSearchParams();

  const allKeys = React.useMemo(
    () => [searchKey, statusKey, ...advancedFields.map((f) => f.key)],
    [searchKey, statusKey, advancedFields]
  );

  const currentValues = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of allKeys) {
      const v = sp.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [sp, allKeys]);

  const [searchDraft, setSearchDraft] = React.useState(currentValues[searchKey] ?? "");
  const urlSearch = currentValues[searchKey] ?? "";
  React.useEffect(() => {
    setSearchDraft(urlSearch);
  }, [urlSearch]);

  const pushFilters = React.useCallback(
    (next: Record<string, string>) => {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(next)) {
        if (v) clean[k] = v;
      }
      try {
        if (Object.keys(clean).length === 0) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, JSON.stringify(clean));
        }
      } catch {
        // ignore quota / SSR
      }
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(clean)) params.set(k, v);
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath);
    },
    [router, basePath, storageKey]
  );

  // Hydrate from localStorage once when URL is empty.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (sp.toString() !== "") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const k of allKeys) {
        const v = saved[k];
        if (typeof v === "string" && v) params.set(k, v);
      }
      if (Array.from(params.keys()).length === 0) return;
      router.replace(`${basePath}?${params.toString()}`);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateOne = (key: string, value: string) => {
    pushFilters({ ...currentValues, [key]: value });
  };

  const removeOne = (key: string) => {
    const next = { ...currentValues };
    delete next[key];
    pushFilters(next);
  };

  const resetAll = () => {
    pushFilters({});
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushFilters({ ...currentValues, [searchKey]: searchDraft.trim() });
  };

  // Advanced active chips (excluding the always-visible search + status).
  const activeAdvanced = advancedFields
    .map((f) => {
      const v = currentValues[f.key];
      if (!v) return null;
      const opt = f.options.find((o) => o.value === v);
      return { field: f, label: opt?.label ?? v };
    })
    .filter((x): x is { field: AdvancedFieldDef; label: string } => x !== null);

  const anyActive =
    activeAdvanced.length > 0 ||
    Boolean(currentValues[searchKey]) ||
    Boolean(currentValues[statusKey]);

  // Dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!dialogOpen) return;
    const init: Record<string, string> = {};
    for (const f of advancedFields) init[f.key] = currentValues[f.key] ?? "";
    setDraft(init);
  }, [dialogOpen, advancedFields, currentValues]);

  const draftActiveCount = Object.values(draft).filter(Boolean).length;

  const applyDraft = () => {
    const next: Record<string, string> = { ...currentValues };
    for (const f of advancedFields) {
      const v = draft[f.key];
      if (v) next[f.key] = v;
      else delete next[f.key];
    }
    pushFilters(next);
    setDialogOpen(false);
  };

  const clearDraft = () => {
    const cleared: Record<string, string> = {};
    for (const f of advancedFields) cleared[f.key] = "";
    setDraft(cleared);
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={submitSearch}
        className="admin-card flex flex-wrap items-center gap-2 px-3 py-2"
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-admin-mute" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={searchPlaceholder ?? "Tìm kiếm..."}
            aria-label="Tìm kiếm"
            className={cn(inputClass, "w-64 pl-8")}
          />
        </div>
        <select
          value={currentValues[statusKey] ?? ""}
          onChange={(e) => updateOne(statusKey, e.target.value)}
          aria-label={statusLabel}
          className={cn(selectClass, "min-w-[10rem]")}
        >
          <option value="">Tất cả: {statusLabel}</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <AdminButton type="submit" size="sm" iconLeft={<SearchIcon />}>
            Tìm
          </AdminButton>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition",
              activeAdvanced.length > 0
                ? "border-admin-accent bg-admin-accent/5 text-admin-accent hover:bg-admin-accent/10"
                : "border-admin-line bg-admin-surface text-admin-ink hover:border-admin-accent hover:text-admin-accent"
            )}
          >
            <Filter className="size-3.5" />
            Lọc nâng cao
            {activeAdvanced.length > 0 ? (
              <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-admin-accent px-1.5 text-[11px] font-semibold text-white">
                {activeAdvanced.length}
              </span>
            ) : null}
          </button>
          {anyActive ? (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-admin-line bg-admin-surface px-3 text-sm font-medium text-admin-mute transition hover:border-rose-300 hover:text-rose-600"
            >
              <RotateCcw className="size-3.5" />
              Xoá lọc
            </button>
          ) : null}
        </div>
      </form>

      {activeAdvanced.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-admin-mute">
            Đang lọc
          </span>
          {activeAdvanced.map((c) => (
            <span
              key={c.field.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-admin-accent/30 bg-admin-accent/5 py-1 pl-2.5 pr-1 text-[12px] text-admin-ink"
            >
              <span className="text-admin-mute">{c.field.label}:</span>
              <span className="font-medium">{c.label}</span>
              <button
                type="button"
                aria-label={`Xoá lọc ${c.field.label}`}
                onClick={() => removeOne(c.field.key)}
                className="grid size-4 place-items-center rounded-full text-admin-mute transition hover:bg-admin-accent/15 hover:text-admin-accent"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          size="lg"
          title="Lọc nâng cao"
          description="Chọn giá trị cho các tiêu chí muốn lọc. Để trống nghĩa là không lọc tiêu chí đó. Bộ lọc được lưu tự động cho lần sau."
          footer={
            <>
              <button
                type="button"
                onClick={clearDraft}
                className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-admin-line bg-admin-surface px-3 text-sm font-medium text-admin-mute transition hover:border-rose-300 hover:text-rose-600"
              >
                <RotateCcw className="size-3.5" />
                Xoá hết
              </button>
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-md border border-admin-line bg-admin-surface px-3 text-sm font-medium text-admin-ink transition hover:border-admin-accent"
                >
                  Huỷ
                </button>
              </DialogClose>
              <AdminButton type="button" size="sm" onClick={applyDraft} iconLeft={<Filter />}>
                Áp dụng{draftActiveCount > 0 ? ` (${draftActiveCount})` : ""}
              </AdminButton>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {advancedFields.map((f) => {
              const value = draft[f.key] ?? "";
              const isActive = Boolean(value);
              return (
                <label
                  key={f.key}
                  className={cn(
                    "block space-y-1 rounded-lg border bg-admin-surface p-2.5 transition",
                    isActive ? "border-admin-accent/40 bg-admin-accent/5" : "border-admin-line"
                  )}
                >
                  <span className="flex items-center justify-between text-[12px] font-medium text-admin-ink">
                    <span>{f.label}</span>
                    {isActive ? (
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-admin-accent">
                        Đang lọc
                      </span>
                    ) : null}
                  </span>
                  <select
                    value={value}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    className={cn(selectClass, "w-full")}
                  >
                    <option value="">— Tất cả —</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
