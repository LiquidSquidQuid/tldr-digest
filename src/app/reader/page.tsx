"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { DigestData, Story, Stream } from "@/lib/types";
import styles from "./reader.module.css";

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
  const refs = useRef<Record<string, HTMLElement | null>>({});
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
                        {items.map((story) => (
                          <article
                            key={story.id}
                            ref={(el) => { refs.current[story.id] = el; }}
                            className={`${styles.story} ${readSet.has(story.id) ? styles.storyRead : ""}`}
                            style={{ "--stream-color": sc(s.id) } as React.CSSProperties}
                          >
                            <div className={styles.storyMeta}>
                              <span className={styles.readTimeBadge}>
                                ⏱ {story.readTime} min
                              </span>
                              <span className={styles.sectionName}>· {story.section}</span>
                              <button
                                className={styles.readToggle}
                                onClick={() => toggleRead(story.id)}
                                title={readSet.has(story.id) ? "Mark unread" : "Mark read"}
                              >
                                {readSet.has(story.id) && <span className={styles.readCheck}>✓</span>}
                              </button>
                            </div>
                            <h3 className={styles.storyH3}>{story.title}</h3>
                            <p className={styles.storySummary}>{story.summary}</p>
                            <div className={styles.take}>
                              <div className={styles.takeLabel}>
                                <span className="claude-avatar">C</span>
                                Claude&apos;s take
                              </div>
                              <div className={styles.takeBody}>{story.take}</div>
                            </div>
                            <div className={styles.storyFooter}>
                              {story.url && story.url !== "#" && (
                                <a href={story.url} target="_blank" rel="noopener noreferrer" className={styles.srcLink}>
                                  Read source
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </article>
                        ))}
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
