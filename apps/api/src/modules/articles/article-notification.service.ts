import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * STORY-10: notify operator khi pipeline article ready (status `PENDING_REVIEW`).
 *
 * Placeholder log mặc định. Khi `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` set →
 * gửi qua Resend. Sprint sau có thể swap MJML template.
 */
@Injectable()
export class ArticleNotificationService {
  private readonly logger = new Logger(ArticleNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyOperatorOnComplete(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { niche: { select: { name: true, slug: true } } }
    });
    if (!article) return;

    const recipient = process.env.ADMIN_EMAIL ?? "";
    if (!recipient) {
      this.logger.warn("[article-notify] ADMIN_EMAIL not set — skip notification");
      return;
    }

    const subject = `[dealvault] "${article.title}" sẵn sàng review`;
    const url = `${process.env.SITE_URL ?? "http://localhost:3100"}/admin/articles/${article.id}`;
    const body = [
      `Xin chào,`,
      ``,
      `Bài viết "${article.title}" đã được AI tạo xong và đang chờ review.`,
      ``,
      `Type:  ${article.type}`,
      `Niche: ${article.niche?.name ?? "—"}`,
      ``,
      `Review + publish tại:`,
      url,
      ``,
      `— dealvault`
    ].join("\n");

    if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "no-reply@dealvault.vn",
            to: recipient,
            subject,
            text: body
          })
        });
        if (!resp.ok) {
          this.logger.warn(`[article-notify] Resend ${resp.status}: ${await resp.text()}`);
        }
      } catch (err: unknown) {
        this.logger.warn(
          `[article-notify] Resend throw: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return;
    }

    this.logger.log(
      `[article-notify placeholder]\nTo: ${recipient}\nSubject: ${subject}\nBody:\n${body}`
    );
  }
}
