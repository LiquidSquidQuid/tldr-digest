import type { DigestRow, DigestData, Story, Stream } from "./types";

const SUPABASE_URL = "https://zuxznsgefrjkxokldoah.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHpuc2dlZnJqa3hva2xkb2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzA1MjIsImV4cCI6MjA5MzQwNjUyMn0.QU4csmfWGbRmCZUbcZWq142x44T1kR7oh-pwo9eMofE";

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

// Canonical stream definitions with all known aliases
const STREAM_DEFS: { id: string; display: string; short: string; aliases: string[] }[] = [
  { id: "tldr", display: "Main", short: "Main", aliases: ["TLDR", "Main"] },
  { id: "ai", display: "AI", short: "AI", aliases: ["TLDR AI", "AI"] },
  { id: "dev", display: "Dev", short: "Dev", aliases: ["TLDR Dev", "Dev"] },
  { id: "infosec", display: "InfoSec", short: "InfoSec", aliases: ["TLDR Information Security", "InfoSec", "Information Security"] },
  { id: "it", display: "IT", short: "IT", aliases: ["TLDR IT", "IT"] },
  { id: "fintech", display: "Fintech", short: "Fintech", aliases: ["TLDR Fintech", "Fintech"] },
  { id: "design", display: "Design", short: "Design", aliases: ["TLDR Design", "Design"] },
  { id: "crypto", display: "Crypto", short: "Crypto", aliases: ["TLDR Crypto", "Crypto"] },
  { id: "founders", display: "Founders", short: "Founders", aliases: ["TLDR Founders", "Founders"] },
  { id: "marketing", display: "Marketing", short: "Marketing", aliases: ["TLDR Marketing", "Marketing"] },
  { id: "devops", display: "DevOps", short: "DevOps", aliases: ["TLDR DevOps", "DevOps"] },
  { id: "data", display: "Data", short: "Data", aliases: ["TLDR Data", "Data", "Product"] },
];

// Build lookup: any alias → Stream (case-insensitive)
const STREAMS: Record<string, Stream> = {};
for (const def of STREAM_DEFS) {
  const stream: Stream = { id: def.id, name: def.display, short: def.short, cssVar: `--col-${def.id}` };
  for (const alias of def.aliases) {
    STREAMS[alias] = stream;
    STREAMS[alias.toLowerCase()] = stream;
  }
}

const STREAM_ORDER = STREAM_DEFS.map((d) => d.aliases[0]);

function parseReadTime(rt: string | number | undefined): number {
  if (!rt) return 3;
  const n = parseInt(String(rt), 10);
  return isNaN(n) ? 3 : n;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function query(endpoint: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: HEADERS,
    cache: "no-store", // always fetch fresh — digest updates once daily
  });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`);
  return res.json();
}

export async function fetchDigest(): Promise<DigestData | null> {
  const today = new Date().toISOString().split("T")[0];

  // Try today first
  let rows = (await query(
    `digest_entries?digest_date=eq.${today}&select=*`
  )) as DigestRow[];

  // Fall back to latest available date
  if (!rows || rows.length === 0) {
    const latestRows = (await query(
      `digest_entries?select=digest_date&order=digest_date.desc&limit=1`
    )) as { digest_date: string }[];

    if (!latestRows || latestRows.length === 0) return null;

    rows = (await query(
      `digest_entries?digest_date=eq.${latestRows[0].digest_date}&select=*`
    )) as DigestRow[];
  }

  if (!rows || rows.length === 0) return null;

  const digestDate = rows[0].digest_date;
  const dayLabel = formatDate(digestDate);

  // Sort by canonical stream order — resolve alias to index
  const streamIdx = (name: string): number => {
    const s = STREAMS[name] || STREAMS[name.toLowerCase()];
    if (!s) return 99;
    return STREAM_DEFS.findIndex((d) => d.id === s.id);
  };
  rows.sort((a, b) => streamIdx(a.stream_name) - streamIdx(b.stream_name));

  const streams: Stream[] = [];
  const stories: Record<string, Story[]> = {};
  const allStories: Story[] = [];
  const storyById: Record<string, Story> = {};
  const topPicks: Story[] = [];
  let totalStories = 0;
  let totalReadMin = 0;

  for (const row of rows) {
    const cfg = STREAMS[row.stream_name] || STREAMS[row.stream_name.toLowerCase()];
    if (!cfg) continue;

    if (!stories[cfg.id]) {
      streams.push(cfg);
      stories[cfg.id] = [];
    }

    for (const rawStory of row.stories || []) {
      const readTime = parseReadTime(rawStory.read_time);
      const id = `s-${cfg.id}-${totalStories}`;
      const story: Story = {
        id,
        streamId: cfg.id,
        section: row.section_name,
        title: rawStory.title || "",
        summary: rawStory.summary || "",
        take: rawStory.claude_take || "",
        url: rawStory.link || "",
        readTime,
        pickRank: rawStory.pick_rank || null,
      };

      stories[cfg.id].push(story);
      allStories.push(story);
      storyById[id] = story;

      if (story.pickRank) {
        topPicks.push(story);
      }

      totalStories++;
      totalReadMin += readTime;
    }
  }

  // Sort top picks by rank
  topPicks.sort((a, b) => (a.pickRank || 99) - (b.pickRank || 99));

  return {
    date: digestDate,
    dayLabel,
    streams,
    stories,
    allStories,
    storyById,
    topPicks: topPicks.slice(0, 5),
    totalStories,
    totalReadMin,
  };
}

// Helper to get CSS variable reference for a stream ID
export function streamColor(id: string): string {
  return `var(--col-${id})`;
}
