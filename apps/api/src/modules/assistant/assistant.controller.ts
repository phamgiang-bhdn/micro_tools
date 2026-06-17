import { Body, Controller, HttpException, HttpStatus, Logger, Post } from "@nestjs/common";
import { AssistantService } from "./assistant.service";
import { AskDto } from "./dto/ask.dto";

/** Public AI assistant. Body validate qua AskDto + global ValidationPipe. */
@Controller("assistant")
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistant: AssistantService) {}

  @Post("ask")
  async ask(@Body() dto: AskDto) {
    try {
      return await this.assistant.ask(dto.query);
    } catch (error: unknown) {
      this.logger.error("Assistant ask failed", error instanceof Error ? error.stack : String(error));
      throw new HttpException("Trợ lý AI tạm gián đoạn", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
