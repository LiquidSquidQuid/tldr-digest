import { NextRequest, NextResponse } from "next/server";

/* ── On-demand Claude Take generator ──
   Called when a user expands a story card. Generates a personalized
   take via Anthropic Sonnet, then caches it to Supabase so it's
   never regenerated. Server-side only — API key never reaches client. */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = "https://zuxznsgefrjkxokldoah.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHpuc2dlZnJqa3hva2xkb2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzA1MjIsImV4cCI6MjA5MzQwNjUyMn0.QU4csmfWGbRmCZUbcZWq142x44T1kR7oh-pwo9eMofE";

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Simple in-memory rate limiter: max 10 requests per minute per IP
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateMap.set(ip, recent);
  return false;
}

// Periodically clean up stale entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateMap) {
    const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, recent);
  }
}, RATE_WINDOW_MS);

const SYSTEM_PROMPT = `You are Claude, writing sharp analytical takes on news stories for a tech-savvy reader. The reader is a Laboratory Operations Manager at a major medical center (120+ staff, nine lab departments), a serial entrepreneur, and a Next.js/Supabase developer.

Write a 2-3 paragraph take (150-200 words):
- Paragraph 1: What happened and why it matters. Go beyond the headline.
- Paragraph 2: Connect it to the reader's world — healthcare operations, lab management, compliance, workforce, automation, or their dev/entrepreneurial side. If tenuous, focus on broader leadership or technology angle.
- Paragraph 3: Forward-looking — what to watch for, what action this might trigger.

Direct, intelligent tone. No fluff, no "In conclusion." Assume the reader is sharp and busy.`;

interface TakeRequest {
  storyId: string;
  title: string;
  summary: string;
  streamId: string;
  section: string;
  url: string;
  digestDate: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let body: TakeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { storyId, title, summary, streamId, section, url, digestDate } = body;
  if (!storyId || !title || !digestDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check if take already exists in Supabase (cached)
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/story_takes?story_id=eq.${encodeURIComponent(storyId)}&select=take`,
      { headers: SB_HEADERS }
    );
    if (checkRes.ok) {
      const rows = await checkRes.json();
      if (rows.length > 0 && rows[0].take) {
        return NextResponse.json({ take: rows[0].take, cached: true });
      }
    }
  } catch {
    // Cache miss — proceed to generate
  }

  // Generate take via Anthropic API
  const userMessage = `Story from ${section} (${streamId} stream):

Title: ${title}
Summary: ${summary}
${url && url !== "#" ? `Source: ${url}` : ""}

Write your take on this story.`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return NextResponse.json({ error: "Take generation failed" }, { status: 502 });
    }

    const result = await anthropicRes.json();
    const take = result.content?.[0]?.text ?? "";

    if (!take) {
      return NextResponse.json({ error: "Empty take returned" }, { status: 502 });
    }

    // Cache to Supabase (fire-and-forget, don't block response)
    fetch(`${SUPABASE_URL}/rest/v1/story_takes`, {
      method: "POST",
      headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        story_id: storyId,
        digest_date: digestDate,
        take,
      }),
    }).catch(() => {
      // Silent — take was already returned to user
    });

    return NextResponse.json({ take, cached: false });
  } catch (err) {
    console.error("Take generation error:", err);
    return NextResponse.json({ error: "Take generation failed" }, { status: 500 });
  }
}
