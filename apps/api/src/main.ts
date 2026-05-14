import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log(`API running at http://localhost:${port}/api/v1`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error("Failed to start API", error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
