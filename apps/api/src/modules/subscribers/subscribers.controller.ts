import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { createConfirmationToken, verifyConfirmationToken } from "./subscriber-token.util";

const createSubscriberSchema = z
  .object({
    email: z.string().email().optional(),
    pushEndpoint: z.string().url().optional(),
    pushP256dh: z.string().optional(),
    pushAuth: z.string().optional(),
    source: z.enum(["modal_home", "deal_hot_footer", "after_click", "about_page", "bell_icon", "manual_admin"]),
    preferredNiches: z.array(z.string()).max(3).optional().default([])
  })
  .refine((d) => d.email || d.pushEndpoint, "Phải có email hoặc push endpoint");

@Controller("subscribers")
export class SubscribersController {
  private readonly logger = new Logger(SubscribersController.name);
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() payload: unknown) {
    const parsed = createSubscriberSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException(parsed.error.flatten(), HttpStatus.BAD_REQUEST);
    }
    const data = parsed.data;
    try {
      // Re-activate if previously unsubscribed
      const existing = data.email
        ? await this.prisma.subscriber.findUnique({ where: { email: data.email } })
        : data.pushEndpoint
          ? await this.prisma.subscriber.findUnique({ where: { pushEndpoint: data.pushEndpoint } })
          : null;

      const subscriber = existing
        ? await this.prisma.subscriber.update({
            where: { id: existing.id },
            data: {
              source: data.source,
              preferredNiches: data.preferredNiches ?? [],
              status: existing.confirmedAt ? "ACTIVE" : "PENDING",
              unsubscribedAt: null,
              pushEndpoint: data.pushEndpoint ?? existing.pushEndpoint,
              pushP256dh: data.pushP256dh ?? existing.pushP256dh,
              pushAuth: data.pushAuth ?? existing.pushAuth
            }
          })
        : await this.prisma.subscriber.create({
            data: {
              email: data.email,
              pushEndpoint: data.pushEndpoint,
              pushP256dh: data.pushP256dh,
              pushAuth: data.pushAuth,
              source: data.source,
              preferredNiches: data.preferredNiches ?? [],
              status: data.email ? "PENDING" : "ACTIVE"
            }
          });

      if (subscriber.email && subscriber.status === "PENDING") {
        const token = createConfirmationToken(subscriber.id);
        this.logger.log(
          `[email-placeholder] confirm link for ${subscriber.email}: /api/v1/subscribers/confirm/${token}`
        );
      }

      return { subscriberId: subscriber.id, requiresConfirmation: subscriber.status === "PENDING" };
    } catch (error) {
      this.logger.error(
        "Failed to create subscriber",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException("Đăng ký thất bại", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get("confirm/:token")
  async confirm(@Param("token") token: string, @Res() res: Response) {
    const subscriberId = verifyConfirmationToken(token);
    if (!subscriberId) {
      throw new HttpException("Token không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST);
    }
    try {
      await this.prisma.subscriber.update({
        where: { id: subscriberId },
        data: { confirmedAt: new Date(), status: "ACTIVE" }
      });
    } catch (error) {
      this.logger.error(
        "Failed to confirm subscriber",
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException("Xác nhận thất bại", HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3100";
    return res.redirect(`${siteUrl}/cam-on-da-dang-ky`);
  }

  @Get(":id/unsubscribe")
  async unsubscribe(@Param("id") id: string, @Query("token") token: string, @Res() res: Response) {
    const subscriberId = verifyConfirmationToken(token);
    if (subscriberId !== id) {
      throw new HttpException("Token không hợp lệ", HttpStatus.BAD_REQUEST);
    }
    try {
      await this.prisma.subscriber.update({
        where: { id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() }
      });
    } catch (error) {
      this.logger.error(
        "Failed to unsubscribe",
        error instanceof Error ? error.stack : String(error)
      );
    }
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3100";
    return res.redirect(`${siteUrl}/da-huy-dang-ky`);
  }
}
