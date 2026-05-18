import { Controller, Get, Query } from "@nestjs/common";
import { TopProductsSyncService } from "../crawler/top-products-sync.service";

@Controller("top-products")
export class TopProductsController {
  constructor(private readonly service: TopProductsSyncService) {}

  @Get()
  async getTop(@Query("limit") limit?: string) {
    const parsed = Math.min(Math.max(Number(limit ?? 12), 1), 50);
    return this.service.getLatestSnapshot(parsed);
  }
}
