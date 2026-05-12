import type { DigestRow, DigestData, Story, Stream } from "./types";

const SUPABASE_URL = "https://zuxznsgefrjkxokldoah.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHpuc2dlZnJqa3hva2xkb2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzA1MjIsImV4cCI6MjA5MzQwNjUyMn0.QU4csmfWGbRmCZUbcZWq142x44T1kR7oh-pwo9eMofE";

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

// Maps stream_name from Supabase to our internal stream config
const STREAMS: Record<string, Stream> = {
  TLDR: { id: "tldr", name: "TLDR", short: "Main", cssVar: "--col-tldr" },
  "TLDR AI": { id: "ai", name: "TLDR AI", short: "AI", cssVar: "--col-ai" },
  "TLDR Dev": { id: "dev", name: "TLDR Dev", short: "Dev", cssVar: "--col-dev" },
  "TLDR Information Security": {
    id: "infosec",
    name: "TLDR InfoSec",
    short: "InfoSec",
    cssVar: "--col-infosec",
  },
  "TLDR IT": { id: "it", name: "TLDR IT", short: "IT", cssVar: "--col-it" },
  "TLDR Fintech": {
    id: "fintech",
    name: "TLDR Fintech",
    short: "Fintech",
    cssVar: "--col-fintech",
  },
  "TLDR Design": {
    id: "design",
    name: "TLDR Design",
    short: "Design",
    cssVar: "--col-design",
  },
  "TLDR Crypto": {
    id: "crypto",
    name: "TLDR Crypto",
    short: "Crypto",
    cssVar: "--col-crypto",
  },
  "TLDR Founders": {
    id: "founders",
    name: "TLDR Founders",
    short: "Founders",
    cssVar: "--col-founders",
  },
  "TLDR Marketing": {
    id: "marketing",
    name: "TLDR Marketing",
    short: "Marketing",
    cssVar: "--col-marketing",
  },
  "TLDR DevOps": {
    id: "devops",
    name: "TLDR DevOps",
    short: "DevOps",
    cssVar: "--col-devops",
  },
  "TLDR Data": { id: "data", name: "TLDR Data", short: "Data", cssVar: "--col-data" },
};

const STREAM_ORDER = Object.keys(STREAMS);

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
    next: { revalidate: 300 }, // revalidate every 5 minutes
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

  // Sort by stream order
  rows.sort((a, b) => {
    const ai = STREAM_ORDER.indexOf(a.stream_name);
    const bi = STREAM_ORDER.indexOf(b.stream_name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const streams: Stream[] = [];
  const stories: Record<string, Story[]> = {};
  const allStories: Story[] = [];
  const storyById: Record<string, Story> = {};
  const topPicks: Story[] = [];
  let totalStories = 0;
  let totalReadMin = 0;

  for (const row of rows) {
    const cfg = STREAMS[row.stream_name];
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
