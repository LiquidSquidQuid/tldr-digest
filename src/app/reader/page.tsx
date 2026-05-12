"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { DigestData, Story, Stream } from "@/lib/types";
import styles from "./reader.module.css";

/* ── Procedural ink-spill renderer ──
   Draws an organic, unique ink blot that expands outward.
   Uses layered radial blobs with turbulent offsets so every
   reveal looks like real ink bleeding into paper. */

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

  // Deep dark purple palette
  const INK_CORE = "rgba(18, 4, 36, 0.95)";    // #120424
  const INK_MID  = "rgba(26, 10, 46, 0.88)";    // #1a0a2e
  const INK_EDGE = "rgba(38, 16, 62, 0.72)";    // #26103e
  const INK_BLEED = "rgba(55, 20, 80, 0.35)";   // bleed fringe

  // Generate random blob field — each blob is an ink droplet
  const rng = () => Math.random();
  const BLOB_COUNT = 18 + Math.floor(rng() * 12);
  interface Blob {
    cx: number; cy: number;       // center relative to origin
    rx: number; ry: number;       // ellipse radii
    rot: number;                  // rotation
    delay: number;                // stagger timing (0–1)
    color: string;
    wobbleAmp: number;            // organic edge distortion amplitude
    wobbleFreq: number;           // distortion frequency
    wobblePhase: number;          // randomize phase
  }

  // Origin: slightly left of center, vertically centered
  const ox = W * (0.12 + rng() * 0.15);
  const oy = H * (0.35 + rng() * 0.3);

  const blobs: Blob[] = [];
  for (let i = 0; i < BLOB_COUNT; i++) {
    const t = i / BLOB_COUNT;
    // Spread outward with some randomness
    const angle = rng() * Math.PI * 2;
    const spread = (0.15 + t * 0.85) * Math.max(W, H) * (0.5 + rng() * 0.4);
    const colors = [INK_CORE, INK_CORE, INK_MID, INK_MID, INK_EDGE, INK_BLEED];
    blobs.push({
      cx: Math.cos(angle) * spread * (0.6 + rng() * 0.8),
      cy: Math.sin(angle) * spread * (0.3 + rng() * 0.5),
      rx: (30 + rng() * 90) * (1 + t * 1.5),
      ry: (20 + rng() * 60) * (1 + t * 1.2),
      rot: rng() * Math.PI,
      delay: t * 0.6 + rng() * 0.15,
      color: colors[Math.floor(rng() * colors.length)],
      wobbleAmp: 3 + rng() * 8,
      wobbleFreq: 3 + Math.floor(rng() * 5),
      wobblePhase: rng() * Math.PI * 2,
    });
  }

  // Add extra coverage blobs to fill corners
  const corners = [
    { x: 0, y: 0 }, { x: W, y: 0 },
    { x: 0, y: H }, { x: W, y: H },
    { x: W * 0.5, y: 0 }, { x: W * 0.5, y: H },
    { x: W, y: H * 0.5 },
  ];
  for (const c of corners) {
    blobs.push({
      cx: c.x - ox, cy: c.y - oy,
      rx: 60 + rng() * 120, ry: 50 + rng() * 80,
      rot: rng() * Math.PI,
      delay: 0.4 + rng() * 0.3,
      color: INK_MID,
      wobbleAmp: 4 + rng() * 6,
      wobbleFreq: 3 + Math.floor(rng() * 4),
      wobblePhase: rng() * Math.PI * 2,
    });
  }

  let start: number | null = null;
  let rafId: number;
  const DURATION = 800; // ms

  function drawBlob(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    rx: number, ry: number,
    rot: number,
    wobbleAmp: number, wobbleFreq: number, wobblePhase: number,
    scale: number
  ) {
    const steps = 60;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      // Organic wobble on the edge
      const wobble = 1 + Math.sin(a * wobbleFreq + wobblePhase) * (wobbleAmp / 100) * scale;
      const px = Math.cos(a) * rx * scale * wobble;
      const py = Math.sin(a) * ry * scale * wobble;
      // Rotate
      const rpx = px * Math.cos(rot) - py * Math.sin(rot);
      const rpy = px * Math.sin(rot) + py * Math.cos(rot);
      if (i === 0) ctx.moveTo(x + rpx, y + rpy);
      else ctx.lineTo(x + rpx, y + rpy);
    }
    ctx.closePath();
  }

  function frame(ts: number) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / DURATION, 1);

    ctx.clearRect(0, 0, W, H);

    // Easing: fast start, gentle settle
    const ease = 1 - Math.pow(1 - progress, 3);

    for (const blob of blobs) {
      const blobProgress = Math.max(0, Math.min(1,
        (ease - blob.delay) / (1 - blob.delay)
      ));
      if (blobProgress <= 0) continue;

      const blobEase = 1 - Math.pow(1 - blobProgress, 2.5);
      const x = ox + blob.cx * blobEase;
      const y = oy + blob.cy * blobEase;

      ctx.fillStyle = blob.color;
      drawBlob(
        ctx, x, y,
        blob.rx, blob.ry, blob.rot,
        blob.wobbleAmp, blob.wobbleFreq, blob.wobblePhase,
        blobEase
      );
      ctx.fill();
    }

    // Final pass: full coverage rectangle fades in at the end
    if (progress > 0.5) {
      const coverAlpha = Math.min(1, (progress - 0.5) * 2) * 0.96;
      ctx.fillStyle = `rgba(18, 4, 36, ${coverAlpha})`;
      ctx.beginPath();
      // Rounded rect
      const r = 10;
      ctx.moveTo(r, 0);
      ctx.lineTo(W - r, 0);
      ctx.quadraticCurveTo(W, 0, W, r);
      ctx.lineTo(W, H - r);
      ctx.quadraticCurveTo(W, H, W - r, H);
      ctx.lineTo(r, H);
      ctx.quadraticCurveTo(0, H, 0, H - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
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

const STREAMS_MAP: Record<string, { id: string; short: string }> = {
  TLDR: { id: "tldr", short: "Main" },
  "TLDR AI": { id: "ai", short: "AI" },
  "TLDR Dev": { id: "dev", short: "Dev" },
  "TLDR Information Security": { id: "infosec", short: "InfoSec" },
  "TLDR IT": { id: "it", short: "IT" },
  "TLDR Fintech": { id: "fintech", short: "Fintech" },
  "TLDR Design": { id: "design", short: "Design" },
  "TLDR Crypto": { id: "crypto", short: "Crypto" },
  "TLDR Founders": { id: "founders", short: "Founders" },
  "TLDR Marketing": { id: "marketing", short: "Marketing" },
  "TLDR DevOps": { id: "devops", short: "DevOps" },
  "TLDR Data": { id: "data", short: "Data" },
};
const STREAM_ORDER = Object.keys(STREAMS_MAP);

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
  const today = new Date().toISOString().split("T")[0];

  let res = await fetch(
    `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=eq.${today}&select=*`,
    { headers }
  );
  let rows: RawRow[] = await res.json();

  if (!rows || rows.length === 0) {
    const latestRes = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?select=digest_date&order=digest_date.desc&limit=1`,
      { headers }
    );
    const latestRows = await latestRes.json();
    if (!latestRows || latestRows.length === 0) return null;
    res = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_entries?digest_date=eq.${latestRows[0].digest_date}&select=*`,
      { headers }
    );
    rows = await res.json();
  }

  if (!rows || rows.length === 0) return null;

  const digestDate = rows[0].digest_date;
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
  let total = 0;
  let totalMin = 0;

  for (const row of rows) {
    const cfg = STREAMS_MAP[row.stream_name];
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
      const readTime = parseReadTime(raw.read_time);
      const id = `s-${cfg.id}-${total}`;
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
      };
      stories[cfg.id].push(story);
      allStories.push(story);
      storyById[id] = story;
      if (story.pickRank) topPicks.push(story);
      total++;
      totalMin += readTime;
    }
  }

  topPicks.sort((a, b) => (a.pickRank || 99) - (b.pickRank || 99));

  return {
    date: digestDate,
    dayLabel: formatDate(digestDate),
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
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [collapsingSet, setCollapsingSet] = useState<Set<string>>(new Set());
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const inkCleanups = useRef<Record<string, (() => void) | undefined>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReadSet(getReadSet());
    fetchDigest().then((d) => {
      setData(d);
      setLoading(false);
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

  const toggleRead = useCallback(
    (id: string) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveReadSet(next);
        return next;
      });
    },
    []
  );

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
        // Kick off ink animation after DOM updates
        requestAnimationFrame(() => {
          const canvas = document.querySelector(
            `[data-ink-id="${id}"]`
          ) as HTMLCanvasElement | null;
          if (canvas) {
            inkCleanups.current[id] = animateInkSpill(canvas);
          }
        });
      }
      return next;
    });
  }, []);

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
        if (st.readTime > maxT) return false;
        if (!qq) return true;
        return `${st.title} ${st.summary} ${st.take}`.toLowerCase().includes(qq);
      });
    }
    return out;
  }, [data, q, timeFilter]);

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
            Dispatch <small className={styles.brandSub}>by Claude</small>
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
                  {data.totalStories}
                  <span className={styles.heroStatUnit}>stories</span>
                </div>
                <div className={styles.heroStatL}>curated today</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatV}>
                  {data.streams.length}
                  <span className={styles.heroStatUnit}>topics</span>
                </div>
                <div className={styles.heroStatL}>across sources</div>
              </div>
              <div className={styles.heroStat}>
                <div className={styles.heroStatV}>
                  ~{Math.round(data.totalReadMin / 4)}
                  <span className={styles.heroStatUnit}>min</span>
                </div>
                <div className={styles.heroStatL}>to read it all</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Top Picks ── */}
        {data.topPicks.length > 0 && (
          <section className={styles.picks}>
            <div className={styles.picksHead}>
              <div>
                <div className={styles.picksLabel}>↳ today&apos;s dispatch</div>
                <h2 className={styles.picksH2}>
                  The stories <em>worth your attention</em>
                </h2>
              </div>
              <div className={styles.picksMeta}>
                picks · {data.dayLabel.split(",")[0].toLowerCase()}
              </div>
            </div>
            <div className={styles.picksGrid}>
              {data.topPicks.map((p, i) => {
                const stream = data.streams.find((s) => s.id === p.streamId);
                return (
                  <article
                    key={p.id}
                    className={styles.pickCard}
                    style={{ "--stream-color": sc(p.streamId) } as React.CSSProperties}
                    onClick={() => jumpTo(p.id)}
                  >
                    <div className={styles.pickChip}>
                      <span className={styles.pickDot} />
                      {stream?.short || p.streamId}
                    </div>
                    <h3 className={styles.pickH3}>{p.title}</h3>
                    <div className={styles.pickFooter}>
                      <span>
                        {String(i + 1).padStart(2, "0")} / {String(data.topPicks.length).padStart(2, "0")}
                      </span>
                      <span>{p.readTime} min</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
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
          <main className={styles.main}>
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

                            {/* Collapsed teaser */}
                            {!isExpanded && !isCollapsing && story.take && (
                              <div className={styles.takeTeaser}>
                                <span className="claude-avatar" style={{ width: 18, height: 18, fontSize: 10 }}>C</span>
                                Claude&apos;s take
                                <span className={styles.teaserArrow}>→</span>
                              </div>
                            )}

                            {/* Expandable take with ink spill */}
                            {story.take && (isExpanded || isCollapsing) && (
                              <>
                                <div className={styles.takeWrap}>
                                  <div className={styles.takeInner}>
                                    <div className={styles.take}>
                                      <canvas
                                        className={styles.inkCanvas}
                                        data-ink-id={story.id}
                                      />
                                      <div className={styles.takeContent}>
                                        <div className={styles.takeLabel}>
                                          <span className="claude-avatar">C</span>
                                          Claude&apos;s take
                                        </div>
                                        <div className={styles.takeBody}>{story.take}</div>
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
                            )}
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
                <em>Dispatch</em> · curated by Claude
              </div>
              <div>{data.dayLabel}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
