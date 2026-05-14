"use client";

import type React from "react";
import { useState } from "react";

const field =
  "w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20";

export function PromptTestClient(): React.ReactElement {
  const [prompt, setPrompt] = useState("You are an expert extraction engine.");
  const [sampleText, setSampleText] = useState(
    "Card A annual fee 500000 VND, cashback 10%, minimum income 15000000 VND."
  );
  const [schemaConfig, setSchemaConfig] = useState(
    JSON.stringify(
      {
        annualFee: "number",
        cashbackPercent: "string",
        minIncome: "number"
      },
      null,
      2
    )
  );
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const onTest = async (): Promise<void> => {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const parsedSchema = JSON.parse(schemaConfig) as Record<string, unknown>;
      const response = await fetch("/api/admin/prompt-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sampleText, schemaConfig: parsedSchema })
      });
      const body = (await response.json()) as { result?: unknown; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Prompt test failed");
      }
      setResult(JSON.stringify(body.result ?? {}, null, 2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prompt test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="admin-card space-y-4 p-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Sandbox</p>
          <h2 className="mt-1 text-lg font-semibold text-admin-ink">Test prompt với input mẫu</h2>
        </div>
        <button
          type="button"
          onClick={onTest}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-admin-accent px-5 text-sm font-semibold text-white shadow-google transition hover:bg-admin-accent/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner /> Đang chạy…
            </>
          ) : (
            <>
              <PlayIcon /> Chạy thử
            </>
          )}
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <FieldArea
          label="System prompt"
          value={prompt}
          onChange={setPrompt}
          field={field}
          rows={6}
        />
        <FieldArea
          label="Input mẫu (raw)"
          value={sampleText}
          onChange={setSampleText}
          field={field}
          rows={6}
        />
      </div>
      <FieldArea
        label="Schema config (JSON)"
        value={schemaConfig}
        onChange={setSchemaConfig}
        field={`${field} font-mono`}
        rows={8}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {result ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-admin-mute">Kết quả</p>
          <pre className="scrollbar-thin max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-admin-line bg-admin-subtle p-4 font-mono text-xs text-admin-ink">
            {result}
          </pre>
        </div>
      ) : null}
    </article>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  field,
  rows
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  field: string;
  rows: number;
}): React.ReactElement {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-admin-ink">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={field}
      />
    </label>
  );
}

function PlayIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}

function Spinner(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-3.5 animate-spin">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
    </svg>
  );
}
