/**
 * Local dev API — mirrors Cloudflare Pages Function /api/scrape
 */
import { scrapeToDocumentation } from "../../shared/scrape-core.mjs";
import dotenv from "dotenv";

dotenv.config();

export async function handleScrapeRequest(body) {
  return scrapeToDocumentation(body, {
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY || "",
  });
}
