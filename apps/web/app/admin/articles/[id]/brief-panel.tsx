"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Target, User, Tag, Layers as LayersIcon, Sparkles } from "lucide-react";

interface BriefShape {
  thesis?: string;
  intent?: string;
  targetKeywords?: string[];
  targetDepth?: string;
  layoutVariant?: string;
  hookPattern?: string;
  persona?: {
    name?: string;
    painPoint?: string;
    budget?: string;
    expertise?: string;
  };
}

interface Props {
  brief: BriefShape | null;
  authorName?: string;
}

/**
 * Visual brief panel — hiển thị "Định hướng bài" prominent ở đầu tab Các phần
 * (workspace chính của admin). Pattern: label font-semibold + value font-normal,
 * KHÔNG dùng text-mute cho nội dung.
 *
 * Collapsible: default mở (admin cần thấy ngay), bấm collapse khi đã ngấm.
 */
export function BriefPanel({ brief, authorName }: Props) {
  const [open, setOpen] = useState(true);

  if (!brief) {
    return (
      <div className="admin-card p-4">
        <div className="flex items-center gap-2 text-[13px] text-admin-ink">
          <Target className="size-4 text-admin-mute" />
          <span className="font-semibold">Định hướng bài</span>
          <span className="text-admin-mute">— chưa có (bước Brief chưa chạy)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-admin-line bg-admin-subtle/50 px-4 py-2.5 text-left transition hover:bg-admin-subtle"
      >
        <Target className="size-4 text-primary-600" />
        <span className="text-[13px] font-bold text-admin-ink">Định hướng bài</span>
        {brief.intent ? (
          <span className="rounded bg-admin-surface px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-admin-ink">
            {intentLabel(brief.intent)}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-admin-ink">
          {open ? "Thu gọn" : "Mở rộng"}
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 p-4">
          {/* Thesis — đập vào mắt */}
          {brief.thesis ? (
            <div className="rounded-md border-l-4 border-primary-500 bg-primary-50/40 px-4 py-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-primary-700">
                Luận điểm chính
              </div>
              <p className="mt-1.5 text-[14px] font-medium leading-snug text-admin-ink">
                {brief.thesis}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Persona */}
            {brief.persona ? (
              <div className="rounded-md border border-admin-line bg-admin-surface p-3">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-admin-ink">
                  <User className="size-3.5 text-admin-mute" />
                  Người đọc mục tiêu
                </div>
                <div className="mt-2 space-y-1.5 text-[13px]">
                  {brief.persona.name ? (
                    <div>
                      <span className="font-semibold text-admin-ink">{brief.persona.name}</span>
                      {brief.persona.expertise ? (
                        <span className="ml-2 rounded-full bg-admin-subtle px-2 py-0.5 text-[10.5px] font-medium text-admin-ink">
                          {expertiseLabel(brief.persona.expertise)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {brief.persona.painPoint ? (
                    <p className="text-admin-ink">
                      <span className="font-semibold">Vấn đề: </span>
                      {brief.persona.painPoint}
                    </p>
                  ) : null}
                  {brief.persona.budget ? (
                    <p className="text-admin-ink">
                      <span className="font-semibold">Ngân sách: </span>
                      {brief.persona.budget}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Cấu trúc bài */}
            <div className="rounded-md border border-admin-line bg-admin-surface p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-admin-ink">
                <LayersIcon className="size-3.5 text-admin-mute" />
                Cấu trúc
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                {brief.targetDepth ? (
                  <>
                    <dt className="font-semibold text-admin-ink">Độ dài</dt>
                    <dd className="text-admin-ink">{depthLabel(brief.targetDepth)}</dd>
                  </>
                ) : null}
                {brief.layoutVariant ? (
                  <>
                    <dt className="font-semibold text-admin-ink">Bố cục</dt>
                    <dd className="text-admin-ink">{layoutLabel(brief.layoutVariant)}</dd>
                  </>
                ) : null}
                {brief.hookPattern ? (
                  <>
                    <dt className="font-semibold text-admin-ink">Kiểu mở bài</dt>
                    <dd className="text-admin-ink">{hookLabel(brief.hookPattern)}</dd>
                  </>
                ) : null}
                {authorName ? (
                  <>
                    <dt className="font-semibold text-admin-ink">Tác giả</dt>
                    <dd className="text-admin-ink">{authorName}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          </div>

          {/* Keywords */}
          {Array.isArray(brief.targetKeywords) && brief.targetKeywords.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-admin-ink">
                <Tag className="size-3.5 text-admin-mute" />
                Từ khoá SEO
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {brief.targetKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-[12px] font-medium text-primary-800"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        // Collapsed preview: 1 dòng thesis
        <div className="px-4 py-2.5">
          <p className="line-clamp-1 text-[13px] text-admin-ink">
            <Sparkles className="mr-1.5 inline size-3.5 text-primary-500" />
            {brief.thesis || "(chưa có luận điểm)"}
          </p>
        </div>
      )}
    </div>
  );
}

function intentLabel(v: string): string {
  switch (v) {
    case "transactional":
      return "Mua hàng";
    case "commercial-investigation":
      return "Đang chọn";
    case "comparison":
      return "So sánh";
    case "informational":
      return "Tìm hiểu";
    default:
      return v;
  }
}

function depthLabel(v: string): string {
  switch (v) {
    case "shallow":
      return "Ngắn (800-1200 từ)";
    case "medium":
      return "Vừa (1500-2200 từ)";
    case "deep-dive":
      return "Sâu (2500+ từ)";
    default:
      return v;
  }
}

function layoutLabel(v: string): string {
  switch (v) {
    case "magazine":
      return "Magazine";
    case "technical":
      return "Kỹ thuật";
    case "narrative":
      return "Kể chuyện";
    case "comparison-heavy":
      return "Nặng so sánh";
    case "listicle":
      return "Listicle";
    default:
      return v;
  }
}

function hookLabel(v: string): string {
  switch (v) {
    case "scenario":
      return "Tình huống";
    case "stat":
      return "Số liệu";
    case "question":
      return "Câu hỏi";
    case "anecdote":
      return "Giai thoại";
    case "contrarian":
      return "Phản biện";
    case "myth-bust":
      return "Phá định kiến";
    case "vivid":
      return "Hình ảnh sống động";
    case "news":
      return "Tin tức";
    default:
      return v;
  }
}

function expertiseLabel(v: string): string {
  switch (v) {
    case "novice":
      return "Sơ cấp";
    case "intermediate":
      return "Trung cấp";
    case "expert":
      return "Chuyên gia";
    default:
      return v;
  }
}
