import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * ToolEmailDripService — Story 6.5 post-click drip queue.
 *
 * Khi user click affiliate có email (từ QuizSession.email) → enqueue 2 drip:
 *   - Day 3: "Bạn đã chọn {product} chưa? Nếu cần so sánh lại..." + share link
 *   - Day 7: "{N} deal mới tuần này cho {niche}"
 *
 * Cron daily 9h check PENDING + scheduledFor <= now → render + send.
 *
 * Phase 1 stub: log to console + mark SENT. Phase 2 wire Resend/SendGrid.
 *
 * Env:
 *  - EMAIL_DRIP_ENABLED (default false)
 *  - RESEND_API_KEY (optional — nếu set → thật, nếu không → log only)
 */
@Injectable()
export class ToolEmailDripService {
  private readonly logger = new Logger(ToolEmailDripService.name);
  private readonly enabled = process.env.EMAIL_DRIP_ENABLED === "true";

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue 2 drip emails sau khi user click affiliate.
   * Idempotent — không duplicate nếu đã enqueue cho cùng (email × quizSessionId × dripType).
   */
  async enqueuePostClick(args: {
    email: string;
    quizSessionId: string;
    toolId: string;
    productId: string;
    productName: string;
    nicheName: string;
    shareSlug?: string | null;
  }): Promise<void> {
    if (!args.email || !args.email.includes("@")) return;

    const day3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const day7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const basePayload = {
      productName: args.productName,
      nicheName: args.nicheName,
      shareSlug: args.shareSlug ?? null
    };

    try {
      await this.prisma.$transaction([
        this.prisma.toolEmailDrip.create({
          data: {
            email: args.email,
            quizSessionId: args.quizSessionId,
            toolId: args.toolId,
            productId: args.productId,
            dripType: "day3-followup",
            scheduledFor: day3,
            payload: basePayload as Prisma.InputJsonValue
          }
        }),
        this.prisma.toolEmailDrip.create({
          data: {
            email: args.email,
            quizSessionId: args.quizSessionId,
            toolId: args.toolId,
            productId: args.productId,
            dripType: "day7-newdeals",
            scheduledFor: day7,
            payload: basePayload as Prisma.InputJsonValue
          }
        })
      ]);
      this.logger.log(`Enqueued 2 drip emails for ${args.email} (session ${args.quizSessionId}).`);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to enqueue drip for ${args.email}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  @Cron("0 9 * * *")
  async scheduledFlush(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug("Email drip cron disabled (EMAIL_DRIP_ENABLED != 'true').");
      return;
    }
    await this.flushDue();
  }

  /** Public trigger cho admin button. */
  async flushDue(): Promise<{ found: number; sent: number; failed: number }> {
    const due = await this.prisma.toolEmailDrip.findMany({
      where: { status: "PENDING", scheduledFor: { lte: new Date() } },
      take: 100
    });

    if (due.length === 0) return { found: 0, sent: 0, failed: 0 };
    this.logger.log(`Flushing ${due.length} due drip email(s)...`);

    let sent = 0;
    let failed = 0;
    for (const drip of due) {
      try {
        await this.sendOne(drip);
        await this.prisma.toolEmailDrip.update({
          where: { id: drip.id },
          data: { status: "SENT", sentAt: new Date() }
        });
        sent += 1;
      } catch (error: unknown) {
        failed += 1;
        await this.prisma.toolEmailDrip.update({
          where: { id: drip.id },
          data: {
            status: "FAILED",
            errorReason: error instanceof Error ? error.message.slice(0, 500) : String(error)
          }
        });
      }
    }

    return { found: due.length, sent, failed };
  }

  /**
   * Render + send 1 email. Phase 1: log only (Resend chưa wire).
   * Phase 2: nếu RESEND_API_KEY set → fetch Resend API thật.
   */
  private async sendOne(drip: { email: string; dripType: string; payload: unknown; quizSessionId: string | null }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const payload = (drip.payload ?? {}) as Record<string, unknown>;
    const productName = (payload.productName as string) ?? "(product)";
    const nicheName = (payload.nicheName as string) ?? "sản phẩm";
    const shareSlug = payload.shareSlug as string | null;
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3100";
    const resultLink = shareSlug ? `${siteUrl}/r/${shareSlug}?source=email-drip-${drip.dripType}` : siteUrl;

    let subject = "DealVault";
    let body = "";
    if (drip.dripType === "day3-followup") {
      subject = `Bạn đã chọn ${productName} chưa?`;
      body = `Chào bạn,\n\nVài ngày trước AI DealVault đã gợi ý ${productName} cho bạn.\n\nNếu chưa chốt, bạn có thể xem lại kết quả + so sánh thêm:\n${resultLink}\n\nCó câu hỏi? Trả lời email này.\n\n— DealVault`;
    } else if (drip.dripType === "day7-newdeals") {
      subject = `Deal ${nicheName} mới tuần này`;
      body = `Tuần này DealVault có thêm deal ${nicheName.toLowerCase()}.\n\nXem kết quả AI gợi ý cập nhật cho bạn:\n${resultLink}\n\n— DealVault\n\nUnsubscribe: ${siteUrl}/unsubscribe?email=${encodeURIComponent(drip.email)}`;
    }

    if (!apiKey) {
      this.logger.log(`[email-drip] (no RESEND_API_KEY — log only) to=${drip.email} subject="${subject}"`);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "DealVault <noreply@dealvault.vn>",
        to: drip.email,
        subject,
        text: body
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`);
    }
  }
}
