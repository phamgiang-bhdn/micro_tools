import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

interface ConversionHook {
  revenue: string;
  status: string;
  network?: string;
  receivedAt?: string;
}

interface MoneyTrailRow {
  trackingCode: string;
  ipHash: string;
  userAgent: string | null;
  createdAt: string;
  product: { name: string; network: string };
  conversionHooks: ConversionHook[];
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const qs = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "format" && v) qs.set(k, v);
  }
  qs.set("limit", "1000");

  const apiUrl = `${API_BASE_URL}/admin/money-trail?${qs.toString()}`;
  const res = await fetch(apiUrl, {
    cache: "no-store",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY }
  });
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 });
  }
  const rows = (await res.json()) as MoneyTrailRow[];

  const header = [
    "trackingCode",
    "createdAt",
    "product",
    "productNetwork",
    "conversionStatus",
    "conversionNetwork",
    "revenue",
    "receivedAt",
    "ipHash",
    "userAgent"
  ];
  const lines = [header.join(",")];

  for (const row of rows) {
    const hook = row.conversionHooks[0];
    lines.push(
      [
        row.trackingCode,
        row.createdAt,
        row.product.name,
        row.product.network,
        hook?.status ?? "",
        hook?.network ?? "",
        hook?.revenue ?? "",
        hook?.receivedAt ?? "",
        row.ipHash,
        row.userAgent ?? ""
      ]
        .map((v) => escapeCsv(String(v ?? "")))
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `money-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
