import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ParseStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const UNAPPROVE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Refinery v2 (STORY-09): bulk approve + un-approve auto-approved trong 24h.
 */
@Injectable()
export class RefineryService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkApprove(ids: string[], reviewedBy: string | undefined): Promise<number> {
    if (ids.length === 0) return 0;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productExtraction.updateMany({
        where: { id: { in: ids } },
        data: {
          status: ParseStatus.PUBLISHED,
          reviewedAt: new Date(),
          reviewedBy: reviewedBy ?? null
        }
      });
      const rows = await tx.productExtraction.findMany({
        where: { id: { in: ids } },
        select: { productId: true }
      });
      if (rows.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: rows.map((r) => r.productId) } },
          data: { isPublic: true }
        });
      }
      return updated.count;
    });
  }

  async unapprove(id: string): Promise<void> {
    const ex = await this.prisma.productExtraction.findUnique({ where: { id } });
    if (!ex) throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    if (!ex.autoApproved) {
      throw new HttpException("Chỉ un-approve được product auto-duyệt.", HttpStatus.BAD_REQUEST);
    }
    if (
      ex.autoApprovedAt &&
      Date.now() - ex.autoApprovedAt.getTime() > UNAPPROVE_WINDOW_MS
    ) {
      throw new HttpException(
        "Quá 24h — không bỏ duyệt được nữa, vui lòng archive thủ công.",
        HttpStatus.BAD_REQUEST
      );
    }
    await this.prisma.$transaction([
      this.prisma.productExtraction.update({
        where: { id },
        data: { status: ParseStatus.PENDING_REVIEW, unapprovedAt: new Date() }
      }),
      this.prisma.product.update({
        where: { id: ex.productId },
        data: { isPublic: false }
      })
    ]);
  }

  async listExtractions(filter: { tab?: "human" | "auto" | "all" }) {
    const tab = filter.tab ?? "human";
    if (tab === "human") {
      return this.prisma.productExtraction.findMany({
        where: {
          OR: [{ status: ParseStatus.PENDING_REVIEW }, { confidenceScore: { lt: 80 } }],
          autoApproved: false
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { product: true }
      });
    }
    if (tab === "auto") {
      const since = new Date(Date.now() - UNAPPROVE_WINDOW_MS);
      return this.prisma.productExtraction.findMany({
        where: {
          autoApproved: true,
          autoApprovedAt: { gte: since }
        },
        orderBy: { autoApprovedAt: "desc" },
        take: 100,
        include: { product: true }
      });
    }
    return this.prisma.productExtraction.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { product: true }
    });
  }
}
