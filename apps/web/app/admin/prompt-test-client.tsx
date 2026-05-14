"use client";

import type React from "react";
import { useState } from "react";

const field =
  "w-full rounded-lg border border-google-outline bg-google-surface px-3 py-2.5 text-sm text-google-ink placeholder:text-google-ink-secondary focus:border-google-blue focus:outline-none focus:ring-1 focus:ring-google-blue";

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
    <div className="space-y-4 rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google lg:col-span-2">
      <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">Test prompt</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`${field} h-24`} />
      <textarea value={sampleText} onChange={(e) => setSampleText(e.target.value)} className={`${field} h-24`} />
      <textarea value={schemaConfig} onChange={(e) => setSchemaConfig(e.target.value)} className={`${field} h-36 font-mono text-xs`} />
      <button
        type="button"
        onClick={onTest}
        disabled={loading}
        className="inline-flex h-10 items-center rounded-full border border-google-warning bg-white px-6 text-sm font-medium text-google-ink shadow-google hover:bg-amber-50 disabled:opacity-50"
      >
        {loading ? "Testing…" : "Test prompt"}
      </button>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-google-error">{error}</div>
      )}
      {result && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-google-outline bg-google-surface-tint p-4 font-mono text-xs text-google-ink">
          {result}
        </pre>
      )}
    </div>
  );
}
