import { Injectable, Logger } from "@nestjs/common";
import { ArticleStatus } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  PipelineStage,
  PipelineStageName,
  STAGE_SUCCESS_STATUS,
  StageContext
} from "../pipeline.types";
import { headCheck } from "../utils/http";

@Injectable()
export class FactCheckStage implements PipelineStage {
  readonly name = PipelineStageName.FACT_CHECK;
  readonly agent = "fact-check@v2";
  private readonly logger = new Logger(FactCheckStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: StageContext) {
    const evidence = await this.prisma.articleEvidence.findMany({
      where: {
        articleId: ctx.articleId,
        type: { in: ["FACT", "NEWS", "PRICE", "SPEC", "IMAGE"] }
      },
      select: { id: true, sourceUrl: true, type: true }
    });

    await ctx.reportProgress?.(`Kiểm tra ${evidence.length} nguồn dẫn còn live…`, 15);

    if (evidence.length === 0) {
      this.logger.warn(`No evidence to fact-check for article ${ctx.articleId}`);
      await this.prisma.article.update({
        where: { id: ctx.articleId },
        data: { evidenceFreshAt: new Date() }
      });
      return {
        nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
        outputSummary: { checked: 0, passed: 0, note: "no evidence (likely Tavily not configured)" }
      };
    }

    let passed = 0;
    let dead = 0;
    const results = await Promise.allSettled(
      evidence.map(async (e) => {
        const expect = e.type === "IMAGE" ? "image/" : undefined;
        const r = await headCheck(e.sourceUrl, expect, 4000);
        await this.prisma.articleEvidence.update({
          where: { id: e.id },
          data: { factCheckPassed: r.ok, factCheckedAt: new Date() }
        });
        return r.ok;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) passed += 1;
      else dead += 1;
    }

    await ctx.reportProgress?.(`Đã kiểm tra ${passed}/${evidence.length} nguồn`, 90);

    const passRate = evidence.length > 0 ? passed / evidence.length : 0;
    const minPassRate = 0.6;

    if (passRate < minPassRate) {
      this.logger.warn(
        `Fact-check pass rate ${(passRate * 100).toFixed(0)}% < ${(minPassRate * 100).toFixed(0)}% — NEEDS_REVISION`
      );
      return {
        nextStatus: ArticleStatus.NEEDS_REVISION,
        outputSummary: { checked: evidence.length, passed, dead, passRate, threshold: minPassRate, exhausted: true }
      };
    }

    await this.prisma.article.update({
      where: { id: ctx.articleId },
      data: { evidenceFreshAt: new Date() }
    });

    return {
      nextStatus: STAGE_SUCCESS_STATUS[this.name] as ArticleStatus,
      outputSummary: { checked: evidence.length, passed, dead, passRate }
    };
  }
}
