import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { InventoryCheckService } from "./inventory-check.service";
import { ToolEmailDripService } from "./email-drip.service";
import { ToolScoringService } from "./scoring.service";
import { ToolPublicController } from "./tool-public.controller";
import { ToolAiService } from "./tool-ai.service";

/**
 * Tool module — AI-visible decision engine.
 *
 * Providers:
 *  - ToolScoringService → deterministic scoring (no AI)
 *  - ToolAiService      → wraps AiService for parseUserInput + generateReasoning
 *  - InventoryCheckService → cron 6h check OOS status
 *  - ToolPublicController → public endpoints /tool/* (no auth)
 *
 * Admin endpoints (CRUD Tool, preview, inventory trigger) live in AdminController giữ pattern hiện có.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ToolPublicController],
  providers: [
    PrismaService,
    AiService,
    ToolScoringService,
    ToolAiService,
    InventoryCheckService,
    ToolEmailDripService
  ],
  exports: [ToolScoringService, ToolAiService, InventoryCheckService, ToolEmailDripService]
})
export class ToolModule {}
