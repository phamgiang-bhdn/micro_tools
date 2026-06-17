import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";

@Module({
  controllers: [AssistantController],
  providers: [PrismaService, AiService, AssistantService]
})
export class AssistantModule {}
