import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

/* ══════════════════════════════════════════════════════════════
   Daily Dispatch — Vercel Cron Digest Pipeline

   Runs daily via Vercel Cron. Fetches stories from RSS feeds,
   public APIs, and article pages. Deduplicates, selects top 5
   picks via Sonnet, and seeds Supabase. No Gmail, no laptop.
   ══════════════════════════════════════════════════════════════ */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── Config ──

const CRON_SECRET = process.env.CRON_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = "https://zuxznsgefrjkxokldoah.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHpuc2dlZnJqa3hva2xkb2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzA1MjIsImV4cCI6MjA5MzQwNjUyMn0.QU4csmfWGbRmCZUbcZWq142x44T1kR7oh-pwo9eMofE";

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ── Types ──

interface ParsedStory {
  title: string;
  summary: string;
  link: string;
  read_time: number;
  claude_take: string;
  pick_rank?: number;
}

interface SectionBlock {
  stream_name: string;
  section_name: string;
  stories: ParsedStory[];
}

// ── TLDR Stream Definitions ──

const TLDR_STREAMS: { slug: string; stream_name: string }[] = [
  { slug: "tech", stream_name: "TLDR" },
  { slug: "ai", stream_name: "TLDR AI" },
  { slug: "dev", stream_name: "TLDR Dev" },
  { slug: "infosec", stream_name: "TLDR Information Security" },
  { slug: "it", stream_name: "TLDR IT" },
  { slug: "fintech", stream_name: "TLDR Fintech" },
  { slug: "design", stream_name: "TLDR Design" },
  { slug: "crypto", stream_name: "TLDR Crypto" },
  { slug: "founders", stream_name: "TLDR Founders" },
  { slug: "marketing", stream_name: "TLDR Marketing" },
  { slug: "devops", stream_name: "TLDR DevOps" },
  { slug: "data", stream_name: "TLDR Data" },
];

// ── Utility ──

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function clampReadTime(text: string): number {
  const match = text.match(/(\d+)\s*min/i);
  if (match) return Math.min(parseInt(match[1], 10), 8);
  // Estimate from summary length
  const words = text.split(/\s+/).length;
  return Math.min(Math.max(Math.ceil(words / 200), 1), 5);
}

// ══════════════════════════════════════════════════════════════
// Source Fetchers
// ══════════════════════════════════════════════════════════════

// ── TLDR: Fetch article page for each stream ──

async function fetchTLDR(slug: string, streamName: string, date: string): Promise<SectionBlock[]> {
  const url = `https://tldr.tech/${slug}/${date}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return []; // Stream didn't publish today
    const html = await res.text();
    return parseTLDRPage(html, streamName);
  } catch {
    return [];
  }
}

function parseTLDRPage(html: string, streamName: string): SectionBlock[] {
  const $ = cheerio.load(html);
  const blocks: SectionBlock[] = [];
  let currentSection = "Headlines";
  let currentStories: ParsedStory[] = [];

  // TLDR pages use a consistent structure: section headers as standalone
  // text elements, stories as linked headlines with "(X minute read)"
  const contentArea = $("article, .content, main, body").first();
  const elements = contentArea.find("h3, h2, p, a");

  // Walk through all heading-level elements to find stories
  contentArea.find("h3").each((_, el) => {
    const $el = $(el);
    const $link = $el.find("a").first();

    if ($link.length === 0) {
      // Section header (no link) — e.g., "Big Tech & Startups"
      const text = $el.text().trim();
      // Skip emoji-only headers
      if (text.length > 2 && !/^[\p{Emoji}\s]+$/u.test(text)) {
        // Save previous section if it has stories
        if (currentStories.length > 0) {
          blocks.push({
            stream_name: streamName,
            section_name: currentSection,
            stories: currentStories,
          });
        }
        currentSection = text;
        currentStories = [];
      }
      return;
    }

    const linkText = $link.text().trim();
    const href = $link.attr("href") || "";

    // Skip sponsors
    if (linkText.includes("(Sponsor)") || linkText.includes("Sponsor")) return;
    // Skip "Quick Links" section label links and empty links
    if (!href || href === "#") return;

    // Extract read time from title text like "Title (4 minute read)"
    const readTimeMatch = linkText.match(/\((\d+)\s*minute\s*read\)/i);
    const title = linkText.replace(/\s*\(\d+\s*minute\s*read\)\s*/i, "").trim();
    if (!title) return;

    const readTime = readTimeMatch ? Math.min(parseInt(readTimeMatch[1], 10), 8) : 3;

    // Summary is the next sibling paragraph
    let summary = "";
    const $next = $el.next("p, div");
    if ($next.length > 0) {
      summary = $next.text().trim();
      // Skip if it looks like another story link or nav
      if (summary.length < 10) summary = "";
    }

    currentStories.push({
      title,
      summary: summary.slice(0, 500),
      link: href.startsWith("http") ? href : `https://tldr.tech${href}`,
      read_time: readTime,
      claude_take: "",
    });
  });

  // Don't forget the last section
  if (currentStories.length > 0) {
    blocks.push({
      stream_name: streamName,
      section_name: currentSection,
      stories: currentStories,
    });
  }

  return blocks;
}

// ── Hacker News: Top stories via Firebase API ──

async function fetchHackerNews(): Promise<SectionBlock[]> {
  try {
    const idsRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!idsRes.ok) return [];
    const ids: number[] = await idsRes.json();

    // Fetch top 25 stories in parallel
    const top25 = ids.slice(0, 25);
    const storyPromises = top25.map(async (id) => {
      try {
        const res = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          { signal: AbortSignal.timeout(5_000) }
        );
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    });

    const hnStories = (await Promise.all(storyPromises)).filter(Boolean);

    // Map to stories — categorize AI stories to TLDR AI, rest to TLDR Dev
    const aiKeywords = /\b(ai|llm|gpt|claude|openai|anthropic|gemini|machine learning|neural|transformer|diffusion|deep learning)\b/i;
    const devStories: ParsedStory[] = [];
    const aiStories: ParsedStory[] = [];

    for (const s of hnStories) {
      if (!s.title || !s.url) continue;
      const story: ParsedStory = {
        title: s.title,
        summary: `${s.score} points · ${s.descendants || 0} comments on Hacker News`,
        link: s.url,
        read_time: 3,
        claude_take: "",
      };
      if (aiKeywords.test(s.title)) {
        aiStories.push(story);
      } else {
        devStories.push(story);
      }
    }

    const blocks: SectionBlock[] = [];
    if (devStories.length > 0) {
      blocks.push({
        stream_name: "TLDR Dev",
        section_name: "Hacker News",
        stories: devStories.slice(0, 15),
      });
    }
    if (aiStories.length > 0) {
      blocks.push({
        stream_name: "TLDR AI",
        section_name: "Hacker News",
        stories: aiStories.slice(0, 10),
      });
    }
    return blocks;
  } catch {
    return [];
  }
}

// ── Substack: RSS feed parser ──

interface SubstackConfig {
  feedUrl: string;
  stream_name: string;
  section_name: string;
}

const SUBSTACK_FEEDS: SubstackConfig[] = [
  {
    feedUrl: "https://bensbites.beehiiv.com/feed",
    stream_name: "TLDR AI",
    section_name: "Ben's Bites",
  },
  {
    feedUrl: "https://blog.bytebytego.com/feed",
    stream_name: "TLDR Dev",
    section_name: "ByteByteGo",
  },
  {
    feedUrl: "https://newsletter.pragmaticengineer.com/feed",
    stream_name: "TLDR Dev",
    section_name: "The Pragmatic Engineer",
  },
];

async function fetchSubstackFeed(config: SubstackConfig): Promise<SectionBlock[]> {
  try {
    const res = await fetch(config.feedUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xml: true });

    const todayStr = today();
    const stories: ParsedStory[] = [];

    $("item").each((_, el) => {
      const $el = $(el);
      const title = $el.find("title").text().trim();
      const link = $el.find("link").text().trim();
      const pubDate = $el.find("pubDate").text().trim();
      const description = $el.find("description").text().trim();

      // Only include items from today or yesterday (feeds may lag)
      if (pubDate) {
        const itemDate = new Date(pubDate).toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (itemDate !== todayStr && itemDate !== yesterday) return;
      }

      if (!title || !link) return;

      // Clean description: strip HTML tags, truncate
      const cleanDesc = description
        .replace(/<[^>]*>/g, "")
        .replace(/&[a-z]+;/gi, " ")
        .trim()
        .slice(0, 300);

      stories.push({
        title,
        summary: cleanDesc || title,
        link,
        read_time: clampReadTime(cleanDesc),
        claude_take: "",
      });
    });

    if (stories.length === 0) return [];
    return [{
      stream_name: config.stream_name,
      section_name: config.section_name,
      stories: stories.slice(0, 5),
    }];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// Deduplication
// ══════════════════════════════════════════════════════════════

async function getExistingLinks(days: number): Promise<Set<string>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_recent_links`,
      {
        method: "POST",
        headers: SB_HEADERS,
        body: JSON.stringify({ days_back: days }),
      }
    );
    // Fallback: direct query if RPC doesn't exist
    if (!res.ok) {
      const fallback = await fetch(
        `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=gte.${
          new Date(Date.now() - days * 86400000).toISOString().split("T")[0]
        }&select=stories`,
        { headers: SB_HEADERS }
      );
      if (!fallback.ok) return new Set();
      const rows: { stories: ParsedStory[] }[] = await fallback.json();
      const links = new Set<string>();
      for (const row of rows) {
        for (const s of row.stories || []) {
          if (s.link) links.add(s.link);
        }
      }
      return links;
    }
    const links: { link: string }[] = await res.json();
    return new Set(links.map((l) => l.link));
  } catch {
    return new Set();
  }
}

async function getTodayExistingLinks(): Promise<Set<string>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=eq.${today()}&select=stories`,
      { headers: SB_HEADERS }
    );
    if (!res.ok) return new Set();
    const rows: { stories: ParsedStory[] }[] = await res.json();
    const links = new Set<string>();
    for (const row of rows) {
      for (const s of row.stories || []) {
        if (s.link) links.add(s.link);
      }
    }
    return links;
  } catch {
    return new Set();
  }
}

function dedup(blocks: SectionBlock[], existingLinks: Set<string>): { blocks: SectionBlock[]; removed: number } {
  let removed = 0;
  const deduped: SectionBlock[] = [];

  for (const block of blocks) {
    const filtered = block.stories.filter((s) => {
      if (existingLinks.has(s.link)) {
        removed++;
        return false;
      }
      return true;
    });
    if (filtered.length > 0) {
      deduped.push({ ...block, stories: filtered });
    }
  }

  return { blocks: deduped, removed };
}

// ══════════════════════════════════════════════════════════════
// Top 5 Pick Selection (Sonnet API)
// ══════════════════════════════════════════════════════════════

async function selectTopPicks(blocks: SectionBlock[]): Promise<Map<string, number>> {
  if (!ANTHROPIC_API_KEY) return new Map();

  // Build a flat list of all stories with IDs
  const allStories: { idx: number; title: string; summary: string; stream: string; link: string }[] = [];
  for (const block of blocks) {
    for (const story of block.stories) {
      allStories.push({
        idx: allStories.length,
        title: story.title,
        summary: story.summary.slice(0, 150),
        stream: block.stream_name,
        link: story.link,
      });
    }
  }

  if (allStories.length < 5) return new Map();

  const storyList = allStories
    .map((s) => `[${s.idx}] (${s.stream}) ${s.title} — ${s.summary}`)
    .join("\n");

  const systemPrompt = `You select the 5 most compelling news stories for a reader who is:
- A Laboratory Operations Manager at a major medical center (120+ staff, nine departments)
- A serial entrepreneur (health lab, organic products)
- A Next.js/Supabase developer
- A dad interested in science and tech

Selection criteria (in order):
1. Direct healthcare/lab ops/compliance relevance
2. Significant dev/AI/infrastructure shifts
3. Major industry moves or regulatory changes
4. Genuinely interesting science or tech
5. Stories where the headline hides the real insight

Spread picks across at least 3 different streams. Pick #1 = the single most important story today.

Respond with ONLY a JSON array of 5 objects: [{"idx": number, "rank": 1-5}]
No explanation, no markdown, just the JSON array.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: `Today's stories:\n${storyList}` }],
      }),
    });

    if (!res.ok) return new Map();

    const result = await res.json();
    const text = result.content?.[0]?.text ?? "";

    // Parse JSON response — handle potential markdown wrapping
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return new Map();

    const picks: { idx: number; rank: number }[] = JSON.parse(jsonMatch[0]);
    const pickMap = new Map<string, number>();

    for (const pick of picks) {
      const story = allStories[pick.idx];
      if (story) {
        pickMap.set(story.link, pick.rank);
      }
    }

    return pickMap;
  } catch {
    return new Map();
  }
}

// ══════════════════════════════════════════════════════════════
// Supabase Seeding (Additive)
// ══════════════════════════════════════════════════════════════

async function seedSupabase(
  blocks: SectionBlock[],
  picks: Map<string, number>,
  date: string
): Promise<number> {
  let inserted = 0;

  // Apply pick ranks to stories
  for (const block of blocks) {
    for (const story of block.stories) {
      const rank = picks.get(story.link);
      if (rank) story.pick_rank = rank;
    }
  }

  // Insert each section block as a row
  for (const block of blocks) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/digest_entries`, {
        method: "POST",
        headers: { ...SB_HEADERS, Prefer: "return=minimal" },
        body: JSON.stringify({
          digest_date: date,
          stream_name: block.stream_name,
          section_name: block.section_name,
          stories: block.stories,
        }),
      });
      if (res.ok) inserted += block.stories.length;
    } catch {
      // Continue with other blocks
    }
  }

  return inserted;
}

// Check if picks already exist for today
async function picksExistForToday(date: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=eq.${date}&select=stories`,
      { headers: SB_HEADERS }
    );
    if (!res.ok) return false;
    const rows: { stories: ParsedStory[] }[] = await res.json();
    for (const row of rows) {
      for (const s of row.stories) {
        if (s.pick_rank) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = today();
  const log: string[] = [`Dispatch digest run for ${date}`];

  // 1. Get existing links (today + last 3 days for dedup)
  const [existingLinks, todayLinks] = await Promise.all([
    getExistingLinks(3),
    getTodayExistingLinks(),
  ]);
  // Combine: don't re-add stories already in today's digest
  const allExisting = new Set([...existingLinks, ...todayLinks]);
  log.push(`Found ${allExisting.size} existing links to dedup against`);

  // 2. Fetch all sources in parallel
  const tldrPromises = TLDR_STREAMS.map((s) => fetchTLDR(s.slug, s.stream_name, date));
  const hnPromise = fetchHackerNews();
  const substackPromises = SUBSTACK_FEEDS.map((f) => fetchSubstackFeed(f));

  const [tldrResults, hnResult, ...substackResults] = await Promise.all([
    Promise.all(tldrPromises),
    hnPromise,
    ...substackPromises,
  ]);

  // Flatten all blocks
  const allBlocks: SectionBlock[] = [
    ...tldrResults.flat(),
    ...hnResult,
    ...substackResults.flat(),
  ];

  const totalFetched = allBlocks.reduce((a, b) => a + b.stories.length, 0);
  log.push(`Fetched ${totalFetched} stories from ${allBlocks.length} sections`);

  // 3. Deduplicate
  const { blocks: newBlocks, removed } = dedup(allBlocks, allExisting);
  const totalNew = newBlocks.reduce((a, b) => a + b.stories.length, 0);
  log.push(`After dedup: ${totalNew} new stories (${removed} duplicates removed)`);

  if (totalNew === 0) {
    log.push("No new stories to add. Done.");
    return NextResponse.json({ ok: true, log });
  }

  // 4. Select top 5 picks (only if no picks exist for today)
  const hasPicks = await picksExistForToday(date);
  let picks = new Map<string, number>();
  if (!hasPicks && totalNew >= 5) {
    // Include ALL of today's stories (existing + new) for pick selection
    // so picks are chosen from the full day's content
    picks = await selectTopPicks(newBlocks);
    log.push(`Selected ${picks.size} top picks`);
  } else if (hasPicks) {
    log.push("Picks already exist for today, skipping selection");
  } else {
    log.push(`Only ${totalNew} new stories, skipping pick selection (need >= 5)`);
  }

  // 5. Seed Supabase (additive — only new stories)
  const inserted = await seedSupabase(newBlocks, picks, date);
  log.push(`Inserted ${inserted} stories into Supabase`);

  return NextResponse.json({ ok: true, date, inserted, removed, log });
}
