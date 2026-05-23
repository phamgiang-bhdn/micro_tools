"use client";

import type React from "react";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  code: string;
  className?: string;
}

export function CopyCodeButton({ code, className }: Props): React.ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100 ${className ?? ""}`}
      aria-label={copied ? "Đã sao chép" : "Sao chép mã"}
    >
      <span className="font-mono">{code}</span>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <Check className="size-3.5" />
          <span className="text-xs">Đã sao chép</span>
        </span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
