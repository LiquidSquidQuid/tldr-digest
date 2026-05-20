"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { DigestData, Story, Stream } from "@/lib/types";
import styles from "./reader.module.css";

/* ── Procedural ink-spill renderer ──
   Smooth welling/bleeding effect using layered radial gradients
   that expand and merge like real ink wicking through paper.
   Every reveal is unique via randomized tendrils and timing. */

function animateInkSpill(canvas: HTMLCanvasElement): () => void {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) return () => {};
  const ctx = ctxOrNull;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;
  const diag = Math.sqrt(W * W + H * H);

  const rng = () => Math.random();

  // Origin — where the ink wells up from
  const ox = W * (0.08 + rng() * 0.2);
  const oy = H * (0.3 + rng() * 0.4);

  // Tendrils: smooth radial-gradient circles that bleed outward
  // along organic paths. Each tendril is a soft circle that grows
  // and drifts, creating a smooth smearing effect when they overlap.
  interface Tendril {
    angle: number;       // direction from origin
    speed: number;       // how fast it reaches its target (0–1 multiplier)
    reach: number;       // max distance from origin
    width: number;       // radius of the soft gradient circle
    delay: number;       // when it starts (0–1)
    drift: number;       // lateral wobble as it extends
    driftFreq: number;   // wobble frequency
    alpha: number;       // peak opacity
  }

  const TENDRIL_COUNT = 10 + Math.floor(rng() * 6);
  const tendrils: Tendril[] = [];

  // Main spread tendrils — cover the full area
  for (let i = 0; i < TENDRIL_COUNT; i++) {
    const angle = (i / TENDRIL_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    tendrils.push({
      angle,
      speed: 0.6 + rng() * 0.4,
      reach: diag * (0.5 + rng() * 0.5),
      width: 80 + rng() * 180,
      delay: (i / TENDRIL_COUNT) * 0.25 + rng() * 0.1,
      drift: 20 + rng() * 40,
      driftFreq: 1 + rng() * 2,
      alpha: 0.25 + rng() * 0.15,
    });
  }

  // Extra fill tendrils — wider, slower, ensure full coverage
  for (let i = 0; i < 6; i++) {
    const angle = rng() * Math.PI * 2;
    tendrils.push({
      angle,
      speed: 0.4 + rng() * 0.3,
      reach: diag * 0.8,
      width: 150 + rng() * 250,
      delay: 0.05 + rng() * 0.2,
      drift: 10 + rng() * 20,
      driftFreq: 0.5 + rng(),
      alpha: 0.18 + rng() * 0.12,
    });
  }

  let start: number | null = null;
  let rafId: number;
  const DURATION = 1600;

  function frame(ts: number) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / DURATION, 1);

    ctx.clearRect(0, 0, W, H);

    // Global easing — smooth deceleration
    const ease = 1 - Math.pow(1 - progress, 2.8);

    // Layer 1: Central well — a large soft gradient expanding from origin
    const coreRadius = ease * diag * 0.7;
    if (coreRadius > 0) {
      const coreGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreRadius);
      const coreAlpha = Math.min(0.92, ease * 1.1);
      coreGrad.addColorStop(0, `rgba(30, 15, 105, ${coreAlpha})`);
      coreGrad.addColorStop(0.4, `rgba(62, 22, 100, ${coreAlpha * 0.85})`);
      coreGrad.addColorStop(0.7, `rgba(115, 38, 90, ${coreAlpha * 0.5})`);
      coreGrad.addColorStop(1, `rgba(165, 55, 70, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Layer 2: Tendrils — each is a soft radial gradient that travels
    // outward from origin along its angle, creating smooth bleeding fingers
    for (const t of tendrils) {
      const tProgress = Math.max(0, Math.min(1,
        (ease - t.delay) / (1 - t.delay)
      ));
      if (tProgress <= 0) continue;

      // Smooth ease per tendril
      const tEase = 1 - Math.pow(1 - tProgress, 2.2);
      const dist = tEase * t.reach * t.speed;

      // Lateral drift for organic wobble
      const lateralOffset = Math.sin(tEase * Math.PI * t.driftFreq) * t.drift * tEase;
      const perpAngle = t.angle + Math.PI / 2;

      const cx = ox + Math.cos(t.angle) * dist + Math.cos(perpAngle) * lateralOffset;
      const cy = oy + Math.sin(t.angle) * dist + Math.sin(perpAngle) * lateralOffset;

      // Radius grows as it extends
      const r = t.width * (0.5 + tEase * 0.8);
      if (r <= 0) continue;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const a = t.alpha * tEase;
      grad.addColorStop(0, `rgba(45, 18, 110, ${a})`);
      grad.addColorStop(0.35, `rgba(80, 28, 98, ${a * 0.8})`);
      grad.addColorStop(0.65, `rgba(130, 42, 82, ${a * 0.4})`);
      grad.addColorStop(1, `rgba(170, 58, 65, 0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Layer 3: Secondary wells — ink pools that bloom at random points
    // These add organic variation to the density
    const wellCount = 4;
    for (let i = 0; i < wellCount; i++) {
      // Each well blooms at a staggered time
      const wellDelay = 0.1 + (i / wellCount) * 0.3;
      const wProgress = Math.max(0, Math.min(1,
        (ease - wellDelay) / (1 - wellDelay)
      ));
      if (wProgress <= 0) continue;

      const wEase = 1 - Math.pow(1 - wProgress, 3);
      // Position wells along the spread direction with randomized offsets
      // Use deterministic-ish placement based on index (seeded by initial rng calls)
      const wAngle = (i * 1.8 + 0.5) + ox * 0.001;
      const wDist = diag * (0.2 + i * 0.15);
      const wx = ox + Math.cos(wAngle) * wDist * wEase;
      const wy = oy + Math.sin(wAngle) * wDist * wEase;
      const wr = (100 + i * 60) * wEase;

      const wGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      const wa = 0.3 * wEase;
      wGrad.addColorStop(0, `rgba(38, 16, 108, ${wa})`);
      wGrad.addColorStop(0.5, `rgba(75, 25, 95, ${wa * 0.6})`);
      wGrad.addColorStop(1, `rgba(140, 45, 80, 0)`);
      ctx.fillStyle = wGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // Layer 4: Final saturation — as the ink settles, the whole area
    // deepens smoothly. This ensures full coverage without hard edges.
    if (progress > 0.3) {
      const settleT = (progress - 0.3) / 0.7;
      const settleEase = 1 - Math.pow(1 - settleT, 3);
      const settleAlpha = settleEase * 0.88;
      ctx.fillStyle = `rgba(28, 14, 95, ${settleAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(frame);
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}

/* ── Stream color helper ── */
function sc(id: string): string {
  return `var(--col-${id})`;
}

/* ── Supabase fetch (client-side) ── */
const SUPABASE_URL = "https://zuxznsgefrjkxokldoah.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eHpuc2dlZnJqa3hva2xkb2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzA1MjIsImV4cCI6MjA5MzQwNjUyMn0.QU4csmfWGbRmCZUbcZWq142x44T1kR7oh-pwo9eMofE";

// Canonical stream configs keyed by stable id
const STREAM_DEFS: { id: string; short: string; aliases: string[] }[] = [
  { id: "tldr", short: "Main", aliases: ["TLDR", "Main"] },
  { id: "ai", short: "AI", aliases: ["TLDR AI", "AI"] },
  { id: "dev", short: "Dev", aliases: ["TLDR Dev", "Dev"] },
  { id: "infosec", short: "InfoSec", aliases: ["TLDR Information Security", "InfoSec", "Information Security"] },
  { id: "it", short: "IT", aliases: ["TLDR IT", "IT"] },
  { id: "fintech", short: "Fintech", aliases: ["TLDR Fintech", "Fintech"] },
  { id: "design", short: "Design", aliases: ["TLDR Design", "Design"] },
  { id: "crypto", short: "Crypto", aliases: ["TLDR Crypto", "Crypto"] },
  { id: "founders", short: "Founders", aliases: ["TLDR Founders", "Founders"] },
  { id: "marketing", short: "Marketing", aliases: ["TLDR Marketing", "Marketing"] },
  { id: "devops", short: "DevOps", aliases: ["TLDR DevOps", "DevOps"] },
  { id: "data", short: "Data", aliases: ["TLDR Data", "Data", "Product"] },
];

// Build lookup: any alias → stream config (case-insensitive)
const STREAMS_MAP: Record<string, { id: string; short: string }> = {};
for (const def of STREAM_DEFS) {
  for (const alias of def.aliases) {
    STREAMS_MAP[alias] = { id: def.id, short: def.short };
    STREAMS_MAP[alias.toLowerCase()] = { id: def.id, short: def.short };
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

/* ── Content-derived stable story ID ──
   Hash based on title + streamId + date so the same story
   always gets the same ID regardless of row ordering.
   Uses a fast djb2-style hash → hex string. */
function stableStoryId(title: string, streamId: string, date: string): string {
  const input = `${streamId}::${date}::${title}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return `d-${streamId}-${h.toString(16)}`;
}

const READ_KEY = "dispatch:read";

function getReadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveReadSet(s: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...s]));
  } catch { /* noop */ }
}

/* ── Supabase read-mark sync ──
   Supabase is source of truth; localStorage is a fast cache.
   On load: fetch remote marks, merge with local, push any local-only marks up.
   On toggle: optimistic local update + async remote upsert/delete. */

async function fetchRemoteReadMarks(): Promise<Set<string>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/read_marks?select=id`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    if (!res.ok) return new Set();
    const rows: { id: string }[] = await res.json();
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

async function addRemoteReadMark(id: string, digestDate: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/read_marks`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id, digest_date: digestDate }),
    });
  } catch { /* silent — localStorage is cache */ }
}

async function removeRemoteReadMark(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/read_marks?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
  } catch { /* silent */ }
}

interface RawRow {
  digest_date: string;
  stream_name: string;
  section_name: string;
  stories: {
    title: string;
    summary: string;
    claude_take: string;
    link: string;
    read_time: string | number;
    pick_rank?: number | null;
  }[];
}

async function fetchDigest(): Promise<DigestData | null> {
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  // Rolling 7-day window: fetch past 7 days of stories
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const windowStart = weekAgo.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=gte.${windowStart}&digest_date=lte.${today}&select=*&order=digest_date.desc`,
    { headers }
  );
  let rows: RawRow[] = await res.json();

  // Fallback: if nothing in window, grab the latest available date
  if (!rows || rows.length === 0) {
    const latestRes = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?select=digest_date&order=digest_date.desc&limit=1`,
      { headers }
    );
    const latestRows = await latestRes.json();
    if (!latestRows || latestRows.length === 0) return null;
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=eq.${latestRows[0].digest_date}&select=*`,
      { headers }
    );
    rows = await fallbackRes.json();
  }

  if (!rows || rows.length === 0) return null;

  // Most recent date is the "primary" date for display
  const latestDate = rows.reduce((max, r) => r.digest_date > max ? r.digest_date : max, rows[0].digest_date);

  // Sort by canonical stream order
  const streamIdx = (name: string): number => {
    const cfg = STREAMS_MAP[name] || STREAMS_MAP[name.toLowerCase()];
    if (!cfg) return 99;
    return STREAM_DEFS.findIndex((d) => d.id === cfg.id);
  };
  rows.sort((a, b) => streamIdx(a.stream_name) - streamIdx(b.stream_name));

  const streams: Stream[] = [];
  const stories: Record<string, Story[]> = {};
  const allStories: Story[] = [];
  const storyById: Record<string, Story> = {};
  const topPicks: Story[] = [];
  const seenTitles = new Set<string>(); // dedup across days
  let total = 0;
  let totalMin = 0;

  for (const row of rows) {
    const cfg = STREAMS_MAP[row.stream_name] || STREAMS_MAP[row.stream_name.toLowerCase()];
    if (!cfg) continue;
    if (!stories[cfg.id]) {
      streams.push({
        id: cfg.id,
        name: row.stream_name.replace("TLDR ", "").replace("TLDR", "Main"),
        short: cfg.short,
        cssVar: `--col-${cfg.id}`,
      });
      stories[cfg.id] = [];
    }
    for (const raw of row.stories || []) {
      // Dedup: same title across multiple days keeps the newest
      const dedupKey = `${cfg.id}::${raw.title}`;
      if (seenTitles.has(dedupKey)) continue;
      seenTitles.add(dedupKey);

      const readTime = parseReadTime(raw.read_time);
      const id = stableStoryId(raw.title || "", cfg.id, row.digest_date);
      const story: Story = {
        id,
        streamId: cfg.id,
        section: row.section_name,
        title: raw.title || "",
        summary: raw.summary || "",
        take: raw.claude_take || "",
        url: raw.link || "",
        readTime,
        pickRank: raw.pick_rank || null,
        digestDate: row.digest_date,
      };
      stories[cfg.id].push(story);
      allStories.push(story);
      storyById[id] = story;
      // Only today's picks show in the top picks carousel
      if (story.pickRank && row.digest_date === latestDate) topPicks.push(story);
      total++;
      totalMin += readTime;
    }
  }

  topPicks.sort((a, b) => (a.pickRank || 99) - (b.pickRank || 99));

  return {
    date: latestDate,
    dayLabel: formatDate(latestDate),
    streams,
    stories,
    allStories,
    storyById,
    topPicks: topPicks.slice(0, 5),
    totalStories: total,
    totalReadMin: totalMin,
  };
}

/* ══════════════════════════════════════════════════ */

export default function ReaderPage() {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [hideRead, setHideRead] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [collapsingSet, setCollapsingSet] = useState<Set<string>>(new Set());
  const [departingSet, setDepartingSet] = useState<Set<string>>(new Set());
  const [consumedSet, setConsumedSet] = useState<Set<string>>(new Set());
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const inkCleanups = useRef<Record<string, (() => void) | undefined>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLElement>(null);
  const picksRef = useRef<HTMLElement>(null);
  const [picksPastView, setPicksPastView] = useState(false);
  // On-demand Claude takes: storyId → take text (or "loading" sentinel)
  const [takesMap, setTakesMap] = useState<Record<string, string>>({});
  const takesInFlight = useRef<Set<string>>(new Set());
  // Tracks stories where loading exceeded cache-response threshold,
  // meaning Sonnet is actively generating (not a Supabase cache hit)
  const [generatingSet, setGeneratingSet] = useState<Set<string>>(new Set());
  const generatingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Store digest date for remote sync calls
  const digestDateRef = useRef<string>("");

  useEffect(() => {
    // Load local cache immediately for fast paint
    const localMarks = getReadSet();
    setReadSet(localMarks);

    fetchDigest().then(async (d) => {
      setData(d);
      if (d) digestDateRef.current = d.date;
      setLoading(false);

      if (!d) return;

      // Merge remote marks with local cache
      const remoteMarks = await fetchRemoteReadMarks();
      const validIds = new Set(d.allStories.map((s) => s.id));

      // Union: local + remote (filtered to valid story IDs)
      const merged = new Set<string>();
      for (const id of localMarks) if (validIds.has(id)) merged.add(id);
      for (const id of remoteMarks) if (validIds.has(id)) merged.add(id);

      // Push any local-only marks to remote
      const localOnly = [...merged].filter((id) => !remoteMarks.has(id));
      for (const id of localOnly) {
        addRemoteReadMark(id, d.date);
      }

      saveReadSet(merged);
      setReadSet(merged);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Track when picks section scrolls out of view
  useEffect(() => {
    const el = picksRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPicksPastView(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [data]);

  // Scroll feed to top when switching topics
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeStream]);

  // ── Live progress stats (reactive to readSet) ──
  const progressStats = useMemo(() => {
    if (!data) return { read: 0, total: 0, pct: 0, minLeft: 0, minRead: 0, totalMin: 0 };
    const total = data.totalStories;
    const read = data.allStories.filter((s) => readSet.has(s.id)).length;
    const minRead = data.allStories
      .filter((s) => readSet.has(s.id))
      .reduce((a, s) => a + s.readTime, 0);
    const minLeft = data.totalReadMin - minRead;
    const pct = total > 0 ? Math.round((read / total) * 100) : 0;
    return { read, total, pct, minLeft, minRead, totalMin: data.totalReadMin };
  }, [data, readSet]);

  // ── Consumption history (persist daily read counts) ──
  const picksReadCount = useMemo(() => {
    if (!data) return 0;
    return data.topPicks.filter((p) => readSet.has(p.id)).length;
  }, [data, readSet]);

  const allPicksRead = data ? picksReadCount >= data.topPicks.length : false;

  const HISTORY_KEY = "dispatch:history";

  const consumptionHistory = useMemo(() => {
    if (!data) return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const hist: { date: string; read: number; total: number }[] = raw ? JSON.parse(raw) : [];
      // Update today's entry
      const today = data.date;
      const todayRead = data.allStories.filter((s) => readSet.has(s.id)).length;
      const idx = hist.findIndex((h) => h.date === today);
      if (idx >= 0) {
        hist[idx] = { date: today, read: todayRead, total: data.totalStories };
      } else {
        hist.push({ date: today, read: todayRead, total: data.totalStories });
      }
      // Keep last 14 days
      const trimmed = hist.slice(-14);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
      return trimmed;
    } catch {
      return [{ date: data.date, read: progressStats.read, total: progressStats.total }];
    }
  }, [data, readSet, progressStats.read, progressStats.total]);

  const toggleRead = useCallback(
    (id: string) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          removeRemoteReadMark(id);
        } else {
          next.add(id);
          const storyDate = data?.storyById[id]?.digestDate || digestDateRef.current;
          addRemoteReadMark(id, storyDate);

          // Always: brief "consumed" pulse animation
          setConsumedSet((cs) => { const n = new Set(cs); n.add(id); return n; });
          setTimeout(() => {
            setConsumedSet((cs) => { const n = new Set(cs); n.delete(id); return n; });
          }, 600);

          // Collapse Claude's take if expanded
          setExpandedSet((ep) => {
            if (!ep.has(id)) return ep;
            const ne = new Set(ep);
            ne.delete(id);
            setCollapsingSet((cp) => { const nc = new Set(cp); nc.add(id); return nc; });
            if (inkCleanups.current[id]) {
              inkCleanups.current[id]!();
              delete inkCleanups.current[id];
            }
            setTimeout(() => {
              setCollapsingSet((cp) => { const nc = new Set(cp); nc.delete(id); return nc; });
            }, 400);
            return ne;
          });

          // When hide-read is active: fold-away departure after pulse
          if (hideRead) {
            setDepartingSet((ds) => { const n = new Set(ds); n.add(id); return n; });
            setTimeout(() => {
              setDepartingSet((ds) => { const n = new Set(ds); n.delete(id); return n; });
            }, 900); // matches CSS fold duration
          }
        }
        saveReadSet(next);
        return next;
      });
    },
    [hideRead, data]
  );

  // Fetch a Claude take on demand (or use pre-generated/cached one)
  const fetchTake = useCallback(
    (story: Story) => {
      const id = story.id;
      // Already have it (pre-generated from scheduled task or previously fetched)
      if (story.take || takesMap[id]) return;
      // Already in flight
      if (takesInFlight.current.has(id)) return;

      takesInFlight.current.add(id);
      setTakesMap((prev) => ({ ...prev, [id]: "__loading__" }));

      // If response doesn't arrive within 800ms, it's a fresh Sonnet
      // generation — escalate the shimmer to "generating" state
      generatingTimers.current[id] = setTimeout(() => {
        setGeneratingSet((gs) => { const n = new Set(gs); n.add(id); return n; });
      }, 800);

      fetch("/api/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: id,
          title: story.title,
          summary: story.summary,
          streamId: story.streamId,
          section: story.section,
          url: story.url,
          digestDate: story.digestDate || digestDateRef.current,
        }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((data: { take: string }) => {
          setTakesMap((prev) => ({ ...prev, [id]: data.take }));
        })
        .catch(() => {
          setTakesMap((prev) => ({ ...prev, [id]: "__error__" }));
        })
        .finally(() => {
          takesInFlight.current.delete(id);
          // Clear the escalation timer and generating state
          clearTimeout(generatingTimers.current[id]);
          delete generatingTimers.current[id];
          setGeneratingSet((gs) => { const n = new Set(gs); n.delete(id); return n; });
        });
    },
    [takesMap]
  );

  // Fire ink animation for a story card (called when take is ready)
  const fireInk = useCallback((id: string) => {
    // Don't double-fire
    if (inkCleanups.current[id]) return;
    requestAnimationFrame(() => {
      const canvas = document.querySelector(
        `[data-ink-id="${id}"]`
      ) as HTMLCanvasElement | null;
      if (canvas) {
        inkCleanups.current[id] = animateInkSpill(canvas);
      }
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Collapsing — add to collapsing set for exit animation
        next.delete(id);
        setCollapsingSet((cp) => { const n = new Set(cp); n.add(id); return n; });
        // Clean up ink canvas
        if (inkCleanups.current[id]) {
          inkCleanups.current[id]!();
          delete inkCleanups.current[id];
        }
        setTimeout(() => {
          setCollapsingSet((cp) => { const n = new Set(cp); n.delete(id); return n; });
        }, 400);
      } else {
        next.add(id);
        // Trigger on-demand take fetch if needed
        if (data?.storyById[id]) {
          fetchTake(data.storyById[id]);
        }
        // Only fire ink immediately if take is already available
        const story = data?.storyById[id];
        const existingTake = story?.take || takesMap[id];
        if (existingTake && existingTake !== "__loading__" && existingTake !== "__error__") {
          fireInk(id);
        }
        // Otherwise, ink fires when take arrives (via useEffect below)
      }
      return next;
    });
  }, [data, fetchTake, takesMap, fireInk]);

  // Watch for takes resolving — fire ink animation when a loading take arrives
  const prevTakesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const [id, value] of Object.entries(takesMap)) {
      const prev = prevTakesRef.current[id];
      // Transition from loading → actual take text
      if (prev === "__loading__" && value && value !== "__loading__" && value !== "__error__") {
        if (expandedSet.has(id)) {
          fireInk(id);
        }
      }
    }
    prevTakesRef.current = { ...takesMap };
  }, [takesMap, expandedSet, fireInk]);

  const jumpTo = useCallback((id: string) => {
    const el = refs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 3px var(--accent)";
      setTimeout(() => {
        el.style.boxShadow = "";
      }, 1600);
    }
  }, []);

  const filteredByStream = useMemo(() => {
    if (!data) return {};
    const out: Record<string, Story[]> = {};
    const qq = q.trim().toLowerCase();
    const maxT = timeFilter === "all" ? Infinity : parseInt(timeFilter, 10);
    for (const s of data.streams) {
      out[s.id] = (data.stories[s.id] || []).filter((st) => {
        if (hideRead && readSet.has(st.id) && !departingSet.has(st.id)) return false;
        if (st.readTime > maxT) return false;
        if (!qq) return true;
        return `${st.title} ${st.summary} ${st.take}`.toLowerCase().includes(qq);
      });
    }
    return out;
  }, [data, q, timeFilter, hideRead, readSet, departingSet]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const id in filteredByStream) out[id] = filteredByStream[id].length;
    return out;
  }, [filteredByStream]);

  const visibleStreams = useMemo(() => {
    if (!data) return [];
    return data.streams.filter((s) => {
      if (activeStream && s.id !== activeStream) return false;
      return (filteredByStream[s.id] || []).length > 0;
    });
  }, [data, activeStream, filteredByStream]);

  const totalVisible = visibleStreams.reduce(
    (a, s) => a + (filteredByStream[s.id]?.length || 0),
    0
  );

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingInner}>
          <span className="brand-mark">D</span>
          <div className={styles.loadingText}>Loading dispatch…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingInner}>
          <span className="brand-mark">D</span>
          <div className={styles.loadingText}>No dispatch available yet.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="/" className={styles.brand}>
            <span className="brand-mark">D</span>
            Dispatch <small className={styles.brandSub}>by Claude, for Abhi</small>
          </a>
          <label className={styles.searchBox}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="m21 21-4.34-4.34M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${data.totalStories} stories…`}
              className={styles.searchInput}
            />
            <span className={styles.kbd}>⌘K</span>
          </label>
          <div className={styles.navActions}>
            <a href="/" className={styles.navBack}>← Landing</a>
          </div>
        </div>
      </nav>

      <div className={styles.shell}>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroHead}>
            <div>
              <div className={styles.heroEyebrow}>
                <span className={styles.liveDot} />
                Updated {data.dayLabel}
              </div>
              <h1 className={styles.heroH1}>
                Your morning <em>dispatch</em>.
              </h1>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <div className={styles.heroStatV}>
                  {progressStats.read}<span className={styles.heroStatSlash}>/</span>{progressStats.total}
                </div>
                <div className={styles.heroStatL}>stories read</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatV}>
                  {progressStats.pct}<span className={styles.heroStatUnit}>%</span>
                </div>
                <div className={styles.heroStatL}>consumed</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatV}>
                  ~{Math.max(1, Math.round(progressStats.minLeft / 4))}
                  <span className={styles.heroStatUnit}>min</span>
                </div>
                <div className={styles.heroStatL}>remaining</div>
              </div>
            </div>

            {/* ── Progress bar ── */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressStats.pct}%` }}
              />
            </div>

            {/* ── Consumption sparkline ── */}
            {consumptionHistory.length > 1 && (
              <div className={styles.sparkWrap}>
                <svg
                  className={styles.sparkSvg}
                  viewBox={`0 0 ${(consumptionHistory.length - 1) * 28} 40`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
                      <stop offset="50%" stopColor="var(--accent-2)" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="var(--accent-3)" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const pts = consumptionHistory.map((h) =>
                      h.total > 0 ? (h.read / h.total) * 100 : 0
                    );
                    const maxY = 40;
                    const w = (consumptionHistory.length - 1) * 28;
                    const coords = pts.map((p, i) => ({
                      x: i * 28,
                      y: maxY - (p / 100) * (maxY - 4),
                    }));
                    const line = coords.map((c, i) =>
                      i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`
                    ).join(" ");
                    const area = `${line} L${w},${maxY} L0,${maxY} Z`;
                    return (
                      <>
                        <path d={area} fill="url(#sparkFill)" />
                        <path d={line} fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {coords.map((c, i) => (
                          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--accent-2)" opacity={i === coords.length - 1 ? 1 : 0.4} />
                        ))}
                      </>
                    );
                  })()}
                </svg>
                <div className={styles.sparkLabel}>
                  {consumptionHistory.length} day consumption
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Top Picks ── */}
        {data.topPicks.length > 0 && (
          <section className={styles.picks} ref={picksRef}>
            <div className={styles.picksHead}>
              <div>
                <div className={styles.picksLabel}>↳ today&apos;s dispatch</div>
                <h2 className={styles.picksH2}>
                  The stories <em>worth your attention</em>
                </h2>
              </div>
              <div className={styles.picksMeta}>
                {picksReadCount}/{data.topPicks.length} consumed · {data.dayLabel.split(",")[0].toLowerCase()}
              </div>
            </div>
            <div className={styles.picksGrid}>
              {data.topPicks.map((p, i) => {
                const stream = data.streams.find((s) => s.id === p.streamId);
                const isPickRead = readSet.has(p.id);
                return (
                  <article
                    key={p.id}
                    className={`${styles.pickCard} ${isPickRead ? styles.pickCardRead : ""}`}
                    style={{ "--stream-color": sc(p.streamId) } as React.CSSProperties}
                    onClick={() => jumpTo(p.id)}
                  >
                    {isPickRead && (
                      <div className={styles.pickConsumed}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    <div className={styles.pickChip}>
                      <span className={styles.pickDot} />
                      {stream?.short || p.streamId}
                    </div>
                    <h3 className={styles.pickH3}>{p.title}</h3>
                    {p.summary && (
                      <p className={styles.pickSummary}>{p.summary}</p>
                    )}
                    <div className={styles.pickFooter}>
                      <span>
                        {String(i + 1).padStart(2, "0")} / {String(data.topPicks.length).padStart(2, "0")}
                      </span>
                      <span>{isPickRead ? "done" : `${p.readTime} min`}</span>
                    </div>
                  </article>
                );
              })}
            </div>
            {allPicksRead && (
              <div className={styles.picksComplete}>
                All five consumed. You&apos;re caught up on today&apos;s best.
              </div>
            )}
          </section>
        )}

        {/* ── Floating "Back to picks" pill ── */}
        {data.topPicks.length > 0 && !allPicksRead && picksPastView && (
          <button
            className={styles.picksFab}
            onClick={() => picksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span className={styles.picksFabDots}>
              {data.topPicks.map((p) => (
                <span
                  key={p.id}
                  className={`${styles.picksFabDot} ${readSet.has(p.id) ? styles.picksFabDotDone : ""}`}
                />
              ))}
            </span>
            {data.topPicks.length - picksReadCount} picks left
          </button>
        )}

        {/* ── Layout Grid ── */}
        <div className={styles.layout}>
          {/* ── Sidebar ── */}
          <aside className={styles.sidebar}>
            <div className={`${styles.sidebarCard} ${styles.streamsCard}`}>
              <h4 className={styles.sidebarH4}>
                Topics <span className={styles.sidebarRight}>{data.streams.length}</span>
              </h4>
              <div className={styles.streamList}>
                <button
                  className={`${styles.streamRow} ${activeStream === null ? styles.streamRowActive : ""}`}
                  onClick={() => setActiveStream(null)}
                  style={{ "--stream-color": "var(--ink)" } as React.CSSProperties}
                >
                  <span className={styles.streamDot} />
                  <span className={styles.streamName}>All topics</span>
                  <span className={styles.streamCount}>{data.totalStories}</span>
                </button>
                {data.streams.map((s) => {
                  const storyList = data.stories[s.id] || [];
                  if (!storyList.length) return null;
                  const readCount = storyList.filter((st) => readSet.has(st.id)).length;
                  const pct = Math.round((readCount / storyList.length) * 100);
                  return (
                    <button
                      key={s.id}
                      className={`${styles.streamRow} ${activeStream === s.id ? styles.streamRowActive : ""}`}
                      onClick={() => setActiveStream(activeStream === s.id ? null : s.id)}
                      style={{ "--stream-color": sc(s.id) } as React.CSSProperties}
                    >
                      <span className={styles.streamDot} />
                      <span className={styles.streamName}>{s.short}</span>
                      <span className={styles.streamCount}>{counts[s.id] || 0}</span>
                      <span className={styles.progressMini} style={{ "--w": `${pct}%` } as React.CSSProperties} />
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* ── Main Feed ── */}
          <main className={styles.main} ref={feedRef}>
            <div className={styles.feedHead}>
              <div className={styles.feedHeadL}>
                {activeStream
                  ? data.streams.find((s) => s.id === activeStream)?.short || "All"
                  : "All topics"}
              </div>
              <div className={styles.feedHeadR}>
                <span>
                  {totalVisible} {totalVisible === 1 ? "story" : "stories"}
                </span>
                <div className={styles.filterChips}>
                  <button
                    className={`${styles.chip} ${hideRead ? styles.chipOn : ""}`}
                    onClick={() => setHideRead((h) => !h)}
                  >
                    {hideRead ? "read hidden" : "show all"}
                  </button>
                  {[
                    ["all", "all"],
                    ["2", "≤2m"],
                    ["3", "≤3m"],
                    ["5", "≤5m"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={`${styles.chip} ${timeFilter === v ? styles.chipOn : ""}`}
                      onClick={() => setTimeFilter(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleStreams.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyBig}>Nothing matches.</div>
                Try a broader search or a wider time filter.
              </div>
            )}

            {visibleStreams.map((s) => {
              const list = filteredByStream[s.id] || [];
              const grouped: Record<string, Story[]> = {};
              for (const st of list) {
                (grouped[st.section] ||= []).push(st);
              }
              return (
                <section key={s.id} className={styles.streamSection}>
                  <div
                    className={styles.streamHead}
                    style={{ "--stream-color": sc(s.id) } as React.CSSProperties}
                  >
                    <span className={styles.streamPill}>
                      <span className={styles.streamPillDot} />
                      {s.short}
                    </span>
                    <h2 className={styles.streamH2}>{s.name.replace("TLDR ", "")}</h2>
                    <span className={styles.streamHeadCount}>
                      {list.length} {list.length === 1 ? "story" : "stories"}
                    </span>
                  </div>
                  {Object.entries(grouped).map(([sec, items]) => (
                    <div key={sec}>
                      <div className={styles.subsectionTitle}>— {sec}</div>
                      <div className={styles.stories}>
                        {items.map((story) => {
                          const isExpanded = expandedSet.has(story.id);
                          const isCollapsing = collapsingSet.has(story.id);
                          return (
                          <article
                            key={story.id}
                            ref={(el) => { refs.current[story.id] = el; }}
                            className={[
                              styles.story,
                              readSet.has(story.id) ? styles.storyRead : "",
                              isExpanded ? styles.storyExpanded : "",
                              isCollapsing ? styles.storyCollapsing : "",
                              consumedSet.has(story.id) ? styles.storyConsumed : "",
                              departingSet.has(story.id) ? styles.storyDeparting : "",
                            ].filter(Boolean).join(" ")}
                            style={{ "--stream-color": sc(s.id) } as React.CSSProperties}
                            onClick={(e) => {
                              // Don't toggle if clicking links or buttons
                              const tag = (e.target as HTMLElement).closest("a, button");
                              if (tag) return;
                              toggleExpand(story.id);
                            }}
                          >
                            <div className={styles.storyMeta}>
                              <span className={styles.readTimeBadge}>
                                ⏱ {story.readTime} min
                              </span>
                              <span className={styles.sectionName}>· {story.section}</span>
                              <button
                                className={styles.readToggle}
                                onClick={(e) => { e.stopPropagation(); toggleRead(story.id); }}
                                title={readSet.has(story.id) ? "Mark unread" : "Mark read"}
                              >
                                {readSet.has(story.id) && <span className={styles.readCheck}>✓</span>}
                              </button>
                            </div>
                            <h3 className={styles.storyH3}>{story.title}</h3>
                            <p className={styles.storySummary}>{story.summary}</p>

                            {/* Source link — always visible on collapsed cards */}
                            {story.url && story.url !== "#" && (
                              <div className={styles.sourceRow}>
                                <a
                                  href={story.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.sourceLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Read source
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </a>
                              </div>
                            )}

                            {/* Collapsed teaser — always show */}
                            {!isExpanded && !isCollapsing && (
                              <div className={styles.takeTeaser}>
                                <span className="claude-avatar" style={{ width: 18, height: 18, fontSize: 10 }}>C</span>
                                Claude&apos;s take
                                <span className={styles.teaserArrow}>→</span>
                              </div>
                            )}

                            {/* Expandable take with ink spill */}
                            {(isExpanded || isCollapsing) && (() => {
                              const resolvedTake = story.take || takesMap[story.id] || "";
                              const isLoading = resolvedTake === "__loading__";
                              const isError = resolvedTake === "__error__";
                              return (
                              <>
                                <div className={styles.takeWrap}>
                                  <div className={styles.takeInner}>
                                    <div className={styles.take}>
                                      <canvas
                                        className={`${styles.inkCanvas}${isLoading ? (generatingSet.has(story.id) ? ` ${styles.inkCanvasGenerating}` : ` ${styles.inkCanvasLoading}`) : ""}`}
                                        data-ink-id={story.id}
                                      />
                                      <div className={styles.takeContent}>
                                        <div className={styles.takeLabel}>
                                          <span className="claude-avatar">C</span>
                                          Claude&apos;s take
                                        </div>
                                        {isLoading && (
                                          <div className={`${styles.takeLoading} ${generatingSet.has(story.id) ? styles.takeLoadingActive : ""}`}>
                                            <span className={styles.takeLoadingDot} />
                                            <span className={styles.takeLoadingDot} />
                                            <span className={styles.takeLoadingDot} />
                                            <span className={styles.takeLoadingLabel}>
                                              {generatingSet.has(story.id) ? "generating" : "fetching"}
                                            </span>
                                          </div>
                                        )}
                                        {isError && (
                                          <div className={styles.takeBody} style={{ opacity: 0.5 }}>
                                            Couldn&apos;t generate a take right now. Try again later.
                                          </div>
                                        )}
                                        {!isLoading && !isError && resolvedTake && (
                                          <div className={styles.takeBody}>{resolvedTake}</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.storyFooter}>
                                  {story.url && story.url !== "#" && (
                                    <a
                                      href={story.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.srcLink}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Read source
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                        <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              </>
                              );
                            })()}
                          </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}

            <div className={styles.pageFooter}>
              <div className={styles.footerBrand}>
                <em>Dispatch</em> · curated by Claude, for Abhi
              </div>
              <div>{data.dayLabel}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
