import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfidenceService } from "./confidence.service";
import { RefineryService } from "./refinery.service";

@Module({
  providers: [PrismaService, ConfidenceService, RefineryService],
  exports: [ConfidenceService, RefineryService]
})
export class RefineryModule {}
