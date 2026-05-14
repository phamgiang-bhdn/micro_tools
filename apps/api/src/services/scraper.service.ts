import { Injectable, Logger } from "@nestjs/common";
import { chromium } from "playwright";

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async scrapeTextContent(url: string): Promise<string> {
    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
    });

    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "en-US",
        viewport: { width: 1366, height: 768 }
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined
        });
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);

      const bodyText = await page.locator("body").innerText();
      return bodyText.trim();
    } catch (error: unknown) {
      this.logger.error(`Scraping failed for URL: ${url}`, error instanceof Error ? error.stack : String(error));
      throw error;
    } finally {
      await browser.close();
    }
  }
}
