# API Intelligence Research — Scraping & Crypto Data (2026)

**Purpose:** Document high-efficiency free and paid APIs for freelancers, builders, and WhiteLab ecosystem side revenue.  
**Last updated:** 2026-05-30  
**Disclaimer:** Pricing and limits change — verify on vendor sites before production commitments.

---

## Executive summary

| Segment | Best free starting point | Best paid scale | WhiteLab angle |
| --- | --- | --- | --- |
| General web scraping | Firecrawl (1K pages/mo), ScraperAPI trial | Olostep / ScrapingBee at volume | Builder grants + affiliate referrals |
| JS-heavy / SPAs | ScrapingBee, Firecrawl | ScrapingBee Standard | Console integrations doc |
| Enterprise / anti-bot | — | Bright Data, Zyte, Oxylabs | B2B data partnerships |
| Prebuilt scrapers | Apify free tier | Apify Scale + marketplace Actors | Hackathon tracks |
| Crypto market data | DefiLlama (no key), CoinGecko Demo | CoinGecko Analyst | WLAB dashboard feeds |
| Exchange real-time | Binance public API (WebSocket) | Paid aggregators | Price oracle planning |

---

## 1. Ücretsiz / cömert free tier — en çok kullanılanlar

### Web scraping & crawling

| API | Free tier | Rate / limit | En iyi kullanım | Verim notu |
| --- | --- | --- | --- | --- |
| [Firecrawl](https://www.firecrawl.dev/pricing) | 1,000 credits/mo | 2 concurrent | AI/RAG, Markdown çıktı, agent MCP | ~1 credit/sayfa; LLM token tasarrufu |
| [ScraperAPI](https://www.scraperapi.com/pricing/) | 1K credits + 7-day 5K trial | Credit multipliers | Static HTML, proxy rotation, 5 SDK dili | JS render = daha fazla credit |
| [ScrapingBee](https://www.scrapingbee.com/pricing/) | 1,000 API calls | Concurrency plana göre | JS render, screenshot, headless Chrome | Entry $49/mo → 250K credits |
| [ScrapingDog](https://www.scrapingdog.com/) | ~1K requests trial | Platform endpoint | Google, Amazon, LinkedIn yapılandırılmış | SERP odaklı |
| [Scrape.do](https://scrape.do/) | 1K requests | Pay-for-success | Budget proxy rotation | ~$29/mo entry |
| [Apify](https://apify.com/pricing) | $5 free platform credits/mo | Compute + proxy metered | 19K+ hazır Actor marketplace | Actor başına fiyat değişir |
| [FlyByAPIs](https://flybyapis.com/) | 200 Google SERP/mo kalıcı | Structured JSON | SERP-only, kredi çarpanı yok | Niş ama ucuz SERP |

### AI-native / structured extraction

| API | Free tier | Output | Not |
| --- | --- | --- | --- |
| [Olostep](https://www.olostep.com/) | 500 successful requests trial | JSON, batch 10K URL | Yüksek hacimde $0.399/1K sayfa (Scale) |
| [Firecrawl](https://www.firecrawl.dev/) | 1K pages/mo | Markdown, JSON | LangChain / MCP native |

### Crypto & DeFi data (keyless veya demo)

| API | Free tier | Auth | Rate limit | Coverage |
| --- | --- | --- | --- | --- |
| [DefiLlama](https://api-docs.defillama.com/) | Tamamen ücretsiz | **Key yok** (`api.llama.fi`) | IP-based fair use | TVL, yields, DEX vol, stablecoins |
| [CoinGecko Demo](https://www.coingecko.com/en/api/pricing) | 10K credits/mo | API key (ücretsiz hesap) | ~30–100 req/min | 17K+ coin, OHLCV (1y historical) |
| [CoinMarketCap Basic](https://coinmarketcap.com/api/pricing/) | 10K credits/mo | API key; bazı endpoint keyless | 30 req/min | Metadata, listings; keyless hızlı başlangıç |
| [Binance Public](https://binance-docs.github.io/apidocs/) | Ücretsiz | Key opsiyonel | 1200 req/min REST; WS free | Tek borsa, en iyi free real-time |
| [Kraken Public](https://docs.kraken.com/rest/) | Ücretsiz | Key opsiyonel | ~300 req/min | Tek borsa REST + WS |

**Freelancer tavsiyesi:** Crypto fiyat için önce **DefiLlama + CoinGecko Demo**; tek borsa bot için **Binance WS**. Scraping için **Firecrawl** (AI projeler) veya **ScraperAPI trial** (genel HTML).

---

## 2. Freemium / giriş ücretli — verimli orta segment

| API | Entry price | Included volume | $/1K effective | Sweet spot |
| --- | --- | --- | --- | --- |
| Firecrawl Hobby | ~$16–19/mo | 3K–5K credits | ~$3–6/1K | AI agent pipelines |
| Olostep Starter | $9/mo | 5K pages | $1.80/1K | Batch JSON extraction |
| Apify Starter | $29/mo | Platform credits | Değişken | Marketplace Actors |
| Scrape.do | $29/mo | Pay-as-you-go | Success-only | Irregular workloads |
| ScrapingBee Freelance | $49/mo | 250K credits | ~$0.20/1K base* | JS-heavy sites |
| ScraperAPI Hobby | $49/mo | 100K credits | ~$0.49/1K base* | Multi-SDK teams |

\*Credit multipliers: JS render, residential proxy, stealth modları maliyeti 5–75x artırabilir — gerçek maliyeti hedef domain ile benchmark edin.

### Crypto paid tiers

| API | Entry paid | Highlights |
| --- | --- | --- |
| CoinGecko Analyst | ~$129/mo | Full historical, cacheless real-time, WebSocket |
| CoinMarketCap Hobbyist | ~$79/mo | Daha fazla endpoint, ticari kullanım sınırları |
| DefiLlama Pro | ~$300/mo | `pro-api.llama.fi`, yüksek limit, ek endpoint |
| CryptoCompare Pro | ~$80/mo | OHLCV, daha fazla call |

---

## 3. Enterprise / ücretli — yüksek hacim & anti-bot

| Platform | Model | Entry order-of-magnitude | Best for |
| --- | --- | --- | --- |
| [Bright Data](https://brightdata.com/pricing/web-scraper) | Pay per successful record | ~$1.50/1K records; Scale ~$499/mo | 400M+ residential IPs, Crawl API, CAPTCHA |
| [Oxylabs](https://oxylabs.io/pricing) | Results / GB | Free trial; from ~$49/mo | Web Scraper API, OxyCopilot |
| [Zyte](https://www.zyte.com/pricing/) | Subscription + usage | Enterprise quotes | Ban-heavy e-commerce |
| [Apify Scale](https://apify.com/pricing) | Platform credits | $199+/mo | Custom Actors at scale |
| Bright Data Crawl API | Monthly packs | $499–$1999/mo | LLM training datasets, SEO audits |

**Ne zaman enterprise:** Datadome/Cloudflare agresif siteler, milyon+ sayfa/ay, SLA + SSO gereksinimi.

---

## 4. Kullanım senaryosuna göre seçim

| Senaryo | Öneri | Neden |
| --- | --- | --- |
| Freelancer: basit fiyat takip botu | DefiLlama + CoinGecko | Keyless/ucuz, yeterli coverage |
| Freelancer: e-ticaret fiyat scrape | Scrape.do veya ScrapingBee trial | Success-based / JS render |
| AI agent / RAG pipeline | Firecrawl veya Olostep | Markdown/JSON, MCP |
| Google SERP monitoring | FlyByAPIs free tier → paid | Structured JSON, no HTML parse |
| Crypto launch dashboard | CoinGecko + kendi subgraph | WhiteLab tokenomics + market feed |
| Enterprise compliance crawl | Bright Data Crawl API | Legal proxy sourcing, audit logs |

---

## 5. Gizli maliyetler (2026 dikkat)

1. **Credit multipliers** — JS render, premium proxy, stealth = 5–75x credit tüketimi (ScrapingBee, ScraperAPI).
2. **Variable credit endpoints** — CoinMarketCap endpoint başına 1–40 credit; yoğun polling hızla biter.
3. **No WebSocket on free crypto aggregators** — CoinGecko/CMC free tier'da WS yok; real-time için borsa API veya paid tier.
4. **Attribution** — CoinGecko Demo ticari projede attribution gerektirebilir.
5. **Free tier production yasağı** — Çoğu scraping API free tier sadece değerlendirme içindir.

---

## 6. WhiteLab yan gelir modelleri

### Model A — API Partner Directory (düşük risk)
- `/apis` sayfasında kategorize liste + affiliate linkler
- Gelir: referral commission (ScraperAPI, Apify partner programları)
- WLAB: ekosistem builder'larına "recommended stack" olarak konumlanma

### Model B — WhiteLab Data Gateway (orta risk)
- Cloudflare Worker proxy: rate limit + API key yönetimi
- Free tier: DefiLlama + cache; Paid: birleşik crypto + scrape cookbook
- WLAB stake → indirimli API credits (utility token alignment)

### Model C — Grants → Builder revenue share (uzun vade)
- Hackathon kazananları Apify Actor veya subgraph yayımlar
- Protocol fee'nin %X'i builder'a; WLAB listing exposure

### Model D — Premium documentation product
- `api-intelligence-research.md` + güncel fiyat tabloları → gated PDF / NFT access
- Testnet aşamasında ücretsiz; mainnet sonrası premium tier

**Önerilen sıra:** A (hemen) → B (post-Sepolia) → C (grants live) → D (opsiyonel).

---

## 7. Kaynaklar

- [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- [ScraperAPI vs ScrapingBee comparison](https://scrappa.co/compare/scraperapi-vs-scrapingbee)
- [Olostep web crawling APIs blog](https://www.olostep.com/blog/best-web-crawling-apis)
- [Bright Data Web Scraper API pricing](https://brightdata.com/pricing/web-scraper)
- [CoinGecko best free crypto API 2026](https://www.coingecko.com/learn/best-free-crypto-api)
- [DefiLlama API docs](https://api-docs.defillama.com/)
- [Apify vs Bright Data](https://use-apify.com/docs/apify-vs-the-world/apify-vs-bright-data)

---

## 8. Bakım

- **Quarterly review:** Fiyat/limit değişikliklerini `shared/api-directory.json` ile senkronize et
- **Owner:** Ecosystem / developer relations
- **Next agent task:** Affiliate link enrollment + Worker gateway spike (Aşama 5B)
