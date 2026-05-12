import { fetchDigest } from "@/lib/supabase";
import styles from "./landing.module.css";

export default async function Landing() {
  const data = await fetchDigest();

  const storyCount = data?.totalStories ?? 0;
  const streamCount = data?.streams.length ?? 0;
  const readMin = data?.totalReadMin ?? 0;
  const topPicks = data?.topPicks ?? [];
  const dateLabel = data?.dayLabel ?? "Today";

  // Build stream stats for the showcase
  const streamStats = (data?.streams ?? []).map((s) => ({
    name: s.name === "Main" ? "TLDR Main" : s.name,
    short: s.short,
    id: s.id,
    count: data?.stories[s.id]?.length ?? 0,
  }));

  return (
    <>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <span className="brand-mark">D</span>
            Dispatch <small className={styles.brandSub}>by Claude</small>
          </div>
          <div className={styles.navActions}>
            <a href="/reader" className="btn btn-primary">
              Read today&apos;s dispatch →
            </a>
          </div>
        </div>
      </nav>

      <div className="shell">
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.aurora} aria-hidden="true">
            <b /><b /><b />
          </div>
          <div className={styles.heroInner}>
            <h1 className={styles.heroH1}>
              <span className={styles.row}>Too much</span>
              <span className={styles.row}><em className={styles.heroEm}>signal.</em></span>
              <span className={styles.row}>Never enough</span>
              <span className={styles.row}><em className={styles.heroEm}>time.</em></span>
            </h1>
            <p className={styles.heroLede}>
              Twelve newsletters land before your first coffee.
              By the third one covering the same story, you&apos;re skimming.
              You&apos;re not behind — you&apos;re <strong>buried.</strong>
            </p>
            <p className={styles.heroLede2}>
              So we built something. Every morning, Claude inhales the entire
              TLDR network — <strong>{storyCount || "100+"} stories</strong> across{" "}
              <strong>{streamCount || "12"} streams</strong> — and exhales a single
              brief with a take on what actually matters. The whole thing
              takes <strong>five minutes.</strong>
            </p>
            <div className={styles.heroCtas}>
              <a href="/reader" className={styles.heroBtnPrimary}>
                Read today&apos;s dispatch
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a href="#how" className={styles.heroBtnSecondary}>See how it works</a>
            </div>
          </div>
        </section>

        {/* ── Live Stats ── */}
        <div className={styles.statBand}>
          <div className={styles.stat}>
            <div className={styles.statV}><em>{storyCount || "—"}</em></div>
            <div className={styles.statL}>Stories parsed today</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statV}>{streamCount || "12"}</div>
            <div className={styles.statL}>Streams monitored</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statV}><em>5</em></div>
            <div className={styles.statL}>Top picks, ranked</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statV}><em>~5</em>m</div>
            <div className={styles.statL}>To read it all</div>
          </div>
        </div>

        {/* ── How It Works ── */}
        <section className={styles.section} id="how">
          <div className={styles.sectionNum}>01</div>
          <div className="section-eyebrow">The pipeline</div>
          <h2 className={styles.sectionH2}>
            Three steps.<br/><em>Zero effort.</em>
          </h2>
          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <div className={styles.howStep}>01</div>
              <h3 className={styles.howH3}>Inhale</h3>
              <p className={styles.howP}>
                Every morning, Claude pulls the full TLDR network —
                AI, Dev, Security, Fintech, Design, and seven more streams.
                Hundreds of stories, parsed and structured before you wake up.
              </p>
              <div className={styles.howKw}>gmail · parse · 12 streams</div>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howStep}>02</div>
              <h3 className={styles.howH3}>Distill</h3>
              <p className={styles.howP}>
                Each story gets a personalized Claude take — not a summary,
                a <em>perspective.</em> What&apos;s real, what&apos;s hype,
                and why it matters to someone who builds things and leads people.
              </p>
              <div className={styles.howKw}>claude · analysis · 150–250 words each</div>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howStep}>03</div>
              <h3 className={styles.howH3}>Surface</h3>
              <p className={styles.howP}>
                The five stories worth your morning get ranked to the top.
                Everything else is organized by stream and section —
                searchable, skimmable, expandable. In and out in five minutes.
              </p>
              <div className={styles.howKw}>ranked · searchable · 5 min</div>
            </div>
          </div>
        </section>

        {/* ── Today's Top Picks (Live) ── */}
        {topPicks.length > 0 && (
          <section className={styles.section} style={{ paddingTop: 0 }}>
            <div className={styles.sectionNum}>02</div>
            <div className="section-eyebrow">{dateLabel}</div>
            <h2 className={styles.sectionH2}>
              Today&apos;s top <em>five.</em>
            </h2>
            <p className={styles.lede}>
              The stories Claude ranked highest this morning. Live from the dispatch.
            </p>
            <div className={styles.picksGrid}>
              {topPicks.map((pick, i) => (
                <a
                  key={pick.id}
                  href="/reader"
                  className={styles.pickCard}
                  style={{ "--stream-color": `var(--col-${pick.streamId})` } as React.CSSProperties}
                >
                  <div className={styles.pickRank}>{String(i + 1).padStart(2, "0")}</div>
                  <div className={styles.pickBody}>
                    <div className={styles.pickStream}>{pick.streamId === "tldr" ? "Main" : pick.streamId.toUpperCase()}</div>
                    <h3 className={styles.pickTitle}>{pick.title}</h3>
                    <p className={styles.pickSummary}>{pick.summary}</p>
                  </div>
                  <div className={styles.pickArrow}>→</div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Stream Showcase ── */}
        <section className={styles.section} style={{ paddingTop: 0 }} id="streams">
          <div className={styles.sectionNum}>03</div>
          <div className="section-eyebrow">Coverage</div>
          <h2 className={styles.sectionH2}>
            Every corner<br/>of <em>tech.</em>
          </h2>
          <p className={styles.lede}>
            {streamCount} streams. {storyCount || "100+"} stories today. All distilled into one reader.
          </p>
          <div className={styles.streamsGrid}>
            {streamStats.map((s) => (
              <div
                key={s.id}
                className={styles.streamCard}
                style={{ "--stream": `var(--col-${s.id})` } as React.CSSProperties}
              >
                <div className={styles.streamDot} />
                <div className={styles.streamName}>{s.short}</div>
                <div className={styles.streamCount}>{s.count} stories</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaEyebrow}>Updated every morning</div>
          <h2 className={styles.ctaH2}>
            Claude already<br/>read <em>everything.</em>
          </h2>
          <p className={styles.ctaP}>
            {storyCount || "100+"} stories distilled. Five picks ranked.
            The whole dispatch takes five minutes — and the top picks in two.
          </p>
          <div className={styles.ctaRow}>
            <a href="/reader" className={styles.ctaBtnPrimary}>Read today&apos;s dispatch →</a>
          </div>
          <div className={styles.ctaMeta}>no signup · no email · always free</div>
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span style={{ color: "var(--ink)" }}>Dispatch</span>
            <span className={styles.footerMono}> · curated by Claude</span>
          </div>
        </footer>
      </div>
    </>
  );
}
