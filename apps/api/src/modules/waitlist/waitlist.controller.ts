import { Body, Controller, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

const submitSchema = z.object({
  email: z.string().email().max(254),
  nicheSlug: z.string().min(1).max(120),
  surveyAnswer: z.string().max(500).optional(),
  source: z.string().max(60).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(1024).optional(),
  honeypot: z.string().optional()
});

@Controller("waitlist")
export class WaitlistController {
  private readonly logger = new Logger(WaitlistController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async submit(@Body() body: unknown): Promise<{ success: boolean; alreadyJoined?: boolean }> {
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }

    if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
      return { success: true };
    }

    const niche = await this.prisma.niche.findUnique({
      where: { slug: parsed.data.nicheSlug },
      select: { id: true }
    });

    const ipHash = parsed.data.ipAddress
      ? createHash("sha256").update(parsed.data.ipAddress).digest("hex")
      : null;

    try {
      await this.prisma.waitlistSignup.upsert({
        where: {
          email_nicheSlug: {
            email: parsed.data.email.toLowerCase(),
            nicheSlug: parsed.data.nicheSlug
          }
        },
        update: {
          surveyAnswer: parsed.data.surveyAnswer ?? undefined,
          source: parsed.data.source ?? undefined
        },
        create: {
          id: randomUUID(),
          email: parsed.data.email.toLowerCase(),
          nicheId: niche?.id ?? null,
          nicheSlug: parsed.data.nicheSlug,
          surveyAnswer: parsed.data.surveyAnswer ?? null,
          source: parsed.data.source ?? null,
          ipHash,
          userAgent: parsed.data.userAgent?.slice(0, 1024) ?? null
        }
      });
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(
        "Failed to upsert WaitlistSignup",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException("Failed to register waitlist", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
