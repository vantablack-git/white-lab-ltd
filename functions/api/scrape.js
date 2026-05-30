import { scrapeToDocumentation } from "../../shared/scrape-core.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const result = await scrapeToDocumentation(body, {
      firecrawlApiKey: env.FIRECRAWL_API_KEY || env.FIRECRAWL_API_KEY_SECRET || "",
    });
    return json(result);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Scrape failed.",
      },
      400
    );
  }
}
