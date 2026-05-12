import styles from "./landing.module.css";

export default function Landing() {
  return (
    <>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <span className="brand-mark">D</span>
            Dispatch <small className={styles.brandSub}>by Claude</small>
          </div>
          <div className={styles.navLinks}>
            <a href="#why">Why</a>
            <a href="#topics">Topics</a>
            <a href="#how">How it works</a>
          </div>
          <div className={styles.navActions}>
            <a href="/reader" className="btn btn-ghost">
              Today&apos;s dispatch
            </a>
            <a href="/reader" className="btn btn-primary">
              Read it now →
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
            <div className={styles.heroEyebrow}>
              <span className={styles.live}>Live</span>
              <span>Today&apos;s dispatch · updated daily</span>
            </div>
            <div className={styles.heroGrid}>
              <div>
                <h1 className={styles.heroH1}>
                  <span className={styles.row}>Claude reads</span>
                  <span className={styles.row}><em className={styles.heroEm}>the wires.</em></span>
                  <span className={styles.row}>You get the</span>
                  <span className={styles.row}><em className={styles.heroEm}>dispatch.</em></span>
                </h1>
                <p className={styles.heroLede}>
                  Every morning, Claude scans <strong>dozens of newsletters</strong>,
                  collapses the noise, and writes you one brief — with a take on what actually matters and what&apos;s hype.
                </p>
                <div className={styles.heroCtas}>
                  <a href="/reader" className="btn-lg btn-primary">
                    Read today&apos;s dispatch
                    <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                  <a href="#how" className="btn-lg btn-secondary">How it works</a>
                </div>
                <div className={styles.heroMeta}>
                  <span><b>○</b> Free · no signup</span>
                  <span><b>○</b> Updated daily</span>
                  <span><b>○</b> Powered by Claude</span>
                </div>
              </div>
              <div className={styles.pickStack} aria-hidden="true">
                {[
                  { stream: "var(--col-ai)", chip: "AI", time: "4 min", title: "Anthropic releases Claude 4.5 Sonnet with 4M context", n: 1, top: 0, rotate: "-3.5deg", z: 4 },
                  { stream: "var(--col-dev)", chip: "Dev", time: "3 min", title: "TC39 advances Records and Tuples to Stage 4", n: 2, top: 64, rotate: "2deg", z: 3 },
                  { stream: "var(--col-infosec)", chip: "Sec", time: "5 min", title: "Critical RCE found in widely-used libssh2", n: 3, top: 130, rotate: "-1deg", z: 2 },
                  { stream: "var(--col-fintech)", chip: "Fin", time: "3 min", title: "Stripe acquires Mercury for $2.4B in cash + stock", n: 4, top: 198, rotate: "2.4deg", z: 1 },
                ].map((p) => (
                  <div key={p.n} className={styles.pick} style={{ "--stream": p.stream, top: p.top, transform: `rotate(${p.rotate})`, zIndex: p.z } as React.CSSProperties}>
                    <div className={styles.pickHead}>
                      <span className={styles.pickNum}>{p.n}</span>
                      <span className={styles.pickChip}>{p.chip}</span>
                      <span className={styles.pickTime}>{p.time}</span>
                    </div>
                    <h4 className={styles.pickTitle}>{p.title}</h4>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Topic Marquee ── */}
        <div className={styles.marquee}>
          <span className={styles.marqueeLabel}>Topics</span>
          <div className={styles.marqueeTrack}>
            {[
              { name: "Artificial Intelligence", color: "var(--col-ai)" },
              { name: "Software Dev", color: "var(--col-dev)" },
              { name: "Cybersecurity", color: "var(--col-infosec)" },
              { name: "Cloud & DevOps", color: "var(--col-devops)" },
              { name: "Fintech", color: "var(--col-fintech)" },
              { name: "Design Systems", color: "var(--col-design)" },
              { name: "Startups", color: "var(--col-founders)" },
              { name: "Data Engineering", color: "var(--col-data)" },
              { name: "Crypto & Web3", color: "var(--col-crypto)" },
              { name: "Marketing", color: "var(--col-marketing)" },
              { name: "Artificial Intelligence", color: "var(--col-ai)" },
              { name: "Software Dev", color: "var(--col-dev)" },
              { name: "Cybersecurity", color: "var(--col-infosec)" },
              { name: "Cloud & DevOps", color: "var(--col-devops)" },
              { name: "Fintech", color: "var(--col-fintech)" },
              { name: "Design Systems", color: "var(--col-design)" },
              { name: "Startups", color: "var(--col-founders)" },
              { name: "Data Engineering", color: "var(--col-data)" },
              { name: "Crypto & Web3", color: "var(--col-crypto)" },
              { name: "Marketing", color: "var(--col-marketing)" },
            ].map((t, i) => (
              <span key={i} className={styles.marqueeItem} style={{ "--stream": t.color } as React.CSSProperties}>
                <span className={styles.marqueeDot} />{t.name}<span className={styles.marqueeStar}>✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Stage / Browser Preview ── */}
        <div className={styles.stage}>
          <div className={styles.stageEye}>A peek at today</div>
          <div className={styles.stageTitle}>The reader, in <em>one screen.</em> Top picks on the left, the full take on the right.</div>
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <div className={styles.dots}><span /><span /><span /></div>
              <div className={styles.browserUrl}>dispatch · <b>today&apos;s brief</b></div>
              <div style={{ width: 53 }} />
            </div>
            <div className={styles.browserBody}>
              <div className={styles.brLeft}>
                <h3 className={styles.brLeftH3}>Today&apos;s dispatch</h3>
                <div className={styles.brLeftSub}>5 picks · ranked across all topics</div>
                <div className={styles.brPicks}>
                  {[
                    { num: "01", title: "Anthropic releases Claude 4.5 Sonnet", chip: "AI", time: "4 min", stream: "var(--col-ai)" },
                    { num: "02", title: "TC39 advances Records and Tuples to Stage 4", chip: "Dev", time: "3 min", stream: "var(--col-dev)" },
                    { num: "03", title: "Critical RCE in libssh2", chip: "InfoSec", time: "5 min", stream: "var(--col-infosec)" },
                    { num: "04", title: "Apple ships on-device foundation API", chip: "Main", time: "2 min", stream: "var(--col-tldr)" },
                    { num: "05", title: "Stripe acquires Mercury for $2.4B", chip: "Fintech", time: "3 min", stream: "var(--col-fintech)" },
                  ].map((p) => (
                    <div key={p.num} className={styles.brPick} style={{ "--stream": p.stream } as React.CSSProperties}>
                      <span className={styles.brPickNum}>{p.num}</span>
                      <div className={styles.brPickBody}>
                        <span className={styles.brPickTitle}>{p.title}</span>
                        <span className={styles.brPickMeta}><span className={styles.brPickChip}>{p.chip}</span><span>·</span><span>{p.time}</span></span>
                      </div>
                      <span className={styles.brPickArrow}>→</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.brCard}>
                <div className={styles.brCardMeta}><span className={styles.brCardPill}>AI</span><span>·</span><span>4 min read</span><span>·</span><span>Headlines</span></div>
                <h4 className={styles.brCardH4}>Anthropic releases Claude 4.5 Sonnet with a 4M-token context window</h4>
                <p className={styles.brCardSum}>Anthropic shipped Claude 4.5 Sonnet today, extending context to 4M tokens and posting state-of-the-art results on SWE-bench Verified (76.3%) and GPQA Diamond.</p>
                <div className={styles.brCardTake}>
                  <div className={styles.brCardTakeLabel}><span className="claude-avatar">C</span>Claude&apos;s take</div>
                  The benchmarks are good but the real story is the 4M window holding usable recall — needle-in-haystack at 95%+ across the full range. This effectively kills &quot;naive RAG over a small corpus&quot; as a use case.
                </div>
                <div className={styles.brCardActions}>
                  <span className={styles.kbd}>J</span><span>next</span>
                  <span style={{ marginLeft: 8 }}>·</span>
                  <span className={styles.kbd}>R</span><span>mark read</span>
                  <span style={{ marginLeft: 8 }}>·</span>
                  <span className={styles.kbd}>⌘K</span><span>search</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat Band ── */}
        <div className={styles.statBand}>
          <div className={styles.stat}><div className={styles.statV}><em>12+</em></div><div className={styles.statL}>Sources</div></div>
          <div className={styles.stat}><div className={styles.statV}>~22</div><div className={styles.statL}>Stories / day</div></div>
          <div className={styles.stat}><div className={styles.statV}><em>5</em>m</div><div className={styles.statL}>Avg read time</div></div>
          <div className={styles.stat}><div className={styles.statV}>Daily</div><div className={styles.statL}>Updated</div></div>
        </div>

        {/* ── Problem Section (01) ── */}
        <section className={styles.section} id="why">
          <div className={styles.sectionNum}>01</div>
          <div className="section-eyebrow">The problem</div>
          <h2 className={styles.sectionH2}>Twelve newsletters. <em>One inbox.</em><br/>Same story, <em>five takes.</em></h2>
          <p className={styles.lede}>You subscribe to the newsletters. But by the third email covering the same Anthropic release, you&apos;re skimming. We fix that — Claude deduplicates, then writes the take you actually want.</p>
          <div className={styles.compare}>
            <div className={`${styles.compareCol} ${styles.bad}`}>
              <div className={styles.compareLabel}><span className={styles.compareDotAmber} />Your inbox today</div>
              <h3 className={styles.compareH3}>Five emails. <em>One story.</em></h3>
              <div className={styles.quote}><span className={styles.quoteSrc}>Newsletter A · 6:01am</span>&quot;Anthropic launches Claude 4.5 Sonnet with a 4M context window…&quot;</div>
              <div className={`${styles.quote} ${styles.quoteOffset1}`}><span className={styles.quoteSrc}>Newsletter B · 6:02am</span>&quot;Anthropic launches Claude 4.5 Sonnet with a 4M context window…&quot;</div>
              <div className={`${styles.quote} ${styles.quoteOffset2}`}><span className={styles.quoteSrc}>Newsletter C · 6:03am</span>&quot;Anthropic launches Claude 4.5 Sonnet with a 4M context window…&quot;</div>
            </div>
            <div className={`${styles.compareCol} ${styles.good}`}>
              <div className={styles.compareLabelGood}><span className={styles.compareDotGreen} />Dispatch</div>
              <h3 className={styles.compareH3Good}>One story. <em>With a take.</em></h3>
              <div className={styles.quoteGood}>
                <span className={styles.quoteSrcGood}>Dispatch · 6:14am</span>
                &quot;Anthropic releases Claude 4.5 Sonnet with a 4M-token context window — SOTA on SWE-bench and GPQA Diamond.&quot;
                <div className={styles.takeBlock}>&quot;The real story is the 4M window holding usable recall — needle-in-haystack at 95%+ across the full range. This kills naive RAG over a small corpus as a use case.&quot;</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Grid (02) ── */}
        <section className={styles.section} style={{ paddingTop: 0 }}>
          <div className={styles.sectionNum}>02</div>
          <div className="section-eyebrow">What you get</div>
          <h2 className={styles.sectionH2}>A reader built for <em>five minutes,</em><br/>not fifty.</h2>
          <p className={styles.lede}>Every detail is tuned for how busy people actually read news — skim the brief, dive into one or two takes, get on with your day.</p>
          <div className={styles.featGrid}>
            {[
              { icon: "✦", title: "Top 5 picks,", accent: "daily", desc: "Five stories worth your attention, ranked across all topics. Read them and you'll know more than 80% of your team.", chips: ["curated", "~5 min"] },
              { icon: "⌘", title: "Cross-topic", accent: "search", desc: "Hit ⌘K. Search title, summary, and Claude's take across every topic at once. No reload, no page jumps.", chips: ["instant", "⌘K"] },
              { icon: "◐", title: "Filter by", accent: "read time", desc: "Three minutes before standup? Narrow to ≤2 min stories and you'll still get through eight of them.", chips: ["≤2m", "≤5m"] },
              { icon: "●", title: "Read state,", accent: "per story", desc: "Read dots fade. A progress bar on each topic tracks how far through today's batch you are.", chips: ["localStorage"] },
              { icon: "C", title: "Claude's take,", accent: "always visible", desc: "No expand-to-read. The take is the product, so it lives directly on every card — never hidden behind a click.", chips: ["claude"] },
              { icon: "⇄", title: "Built for", accent: "both screens", desc: "Desktop reading flow with a sidebar; mobile with a horizontal topic scroller. Same data, the right shape.", chips: ["responsive"] },
            ].map((f) => (
              <div key={f.accent} className={styles.feat}>
                <div className={styles.featIcon}>{f.icon}</div>
                <h3 className={styles.featH3}>{f.title} <em>{f.accent}</em></h3>
                <p className={styles.featP}>{f.desc}</p>
                <div className={styles.featChips}>{f.chips.map((c) => (<span key={c} className={styles.featChip}>{c}</span>))}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Topics (03) ── */}
        <section className={styles.section} id="topics" style={{ paddingTop: 0 }}>
          <div className={styles.sectionNum}>03</div>
          <div className="section-eyebrow">Topics</div>
          <h2 className={styles.sectionH2}>Every corner of <em>tech,</em><br/>one brief.</h2>
          <p className={styles.lede}>Claude monitors newsletters across AI, dev, security, fintech, and more. Each topic is color-coded and grouped by its original section.</p>
          <div className={styles.topicsGrid}>
            {[
              { name: "AI & ML", desc: "models, research · ~5/day", color: "var(--col-ai)" },
              { name: "Dev", desc: "langs, runtimes · ~4/day", color: "var(--col-dev)" },
              { name: "InfoSec", desc: "CVEs, attacks · ~3/day", color: "var(--col-infosec)" },
              { name: "DevOps", desc: "infra, k8s · ~3/day", color: "var(--col-devops)" },
              { name: "Data", desc: "warehouses, ml ops · ~3/day", color: "var(--col-data)" },
              { name: "Design", desc: "tools, systems · ~2/day", color: "var(--col-design)" },
              { name: "Fintech", desc: "payments, banking · ~3/day", color: "var(--col-fintech)" },
              { name: "Startups", desc: "YC, fundraising · ~2/day", color: "var(--col-founders)" },
              { name: "Crypto", desc: "web3, defi · ~2/day", color: "var(--col-crypto)" },
            ].map((t) => (
              <div key={t.name} className={styles.topicCard} style={{ "--stream": t.color } as React.CSSProperties}>
                <div className={styles.topicName}>{t.name}</div>
                <div className={styles.topicDesc}>{t.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works (04) ── */}
        <section className={styles.section} id="how" style={{ paddingTop: 0 }}>
          <div className={styles.sectionNum}>04</div>
          <div className="section-eyebrow">How it works</div>
          <h2 className={styles.sectionH2}>The pipeline, <em>in four steps.</em></h2>
          <p className={styles.lede}>Runs every morning. No magic — just fetch, dedupe, take, render.</p>
          <div className={styles.howRows}>
            <div className={styles.howRow}>
              <div className={styles.stepN}>01</div>
              <div className={styles.stepBody}><h3>Fetch</h3><p>Pull every newsletter issue from the morning. Parse into structured stories with title, summary, link, and topic.</p><div className={styles.stepKw}>RSS · HTML · 12+ sources</div></div>
              <div className={styles.howArt}>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>fetch <span className={styles.artV}>newsletter-ai</span> <span className={styles.artG}>✓ 5</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>fetch <span className={styles.artV}>newsletter-dev</span> <span className={styles.artG}>✓ 4</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>fetch <span className={styles.artV}>newsletter-sec</span> <span className={styles.artG}>✓ 3</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>fetch <span className={styles.artV}>newsletter-…</span> <span className={styles.artG}>✓ +10</span></div>
              </div>
            </div>
            <div className={styles.howRow}>
              <div className={styles.stepN}>02</div>
              <div className={styles.stepBody}><h3>Dedupe</h3><p>The same story shows up in five newsletters. Claude merges similar stories into one canonical headline.</p><div className={styles.stepKw}>semantic · merge · cite-back</div></div>
              <div className={styles.howArt}>
                <div className={styles.artLine}><span className={styles.artStrike}>Anthropic launches Claude 4.5…</span> <span className={styles.artDim}>Src A</span></div>
                <div className={styles.artLine}><span className={styles.artStrike}>Claude 4.5 Sonnet ships…</span> <span className={styles.artDim}>Src B</span></div>
                <div className={styles.artLine}><span className={styles.artStrike}>Anthropic&apos;s new 4M-token model…</span> <span className={styles.artDim}>Src C</span></div>
                <div className={styles.artLine}><span className={styles.artV}>⇒ Claude 4.5 Sonnet · 4M context</span></div>
              </div>
            </div>
            <div className={styles.howRow}>
              <div className={styles.stepN}>03</div>
              <div className={styles.stepBody}><h3>Take</h3><p>Claude reads each merged story with a prompt tuned for skepticism, opinion, and signal — writes 3–5 sentences in a consistent voice.</p><div className={styles.stepKw}>claude · 800 tokens · ≈400ms each</div></div>
              <div className={styles.howArt}>
                <div className={styles.artLine}><span className={styles.artDim}>prompt:</span> <span className={styles.artV}>&quot;What&apos;s the real story, what&apos;s hype?&quot;</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>model:</span> claude</div>
                <div className={styles.artLine}><span className={styles.artDim}>tone:</span> skeptical, direct, 3–5 sentences</div>
                <div className={styles.artLine}><span className={styles.artG}>→</span> &quot;The benchmarks are good but the real story…&quot;</div>
              </div>
            </div>
            <div className={styles.howRow}>
              <div className={styles.stepN}>04</div>
              <div className={styles.stepBody}><h3>Publish</h3><p>Render to the reader. Loads in under 200ms. No SPA bloat, no auth, no email. Just the dispatch, every morning.</p><div className={styles.stepKw}>static · &lt;200ms · zero bloat</div></div>
              <div className={styles.howArt}>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>build <span className={styles.artV}>/dispatch/today</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>deploy <span className={styles.artG}>✓ 47kb gzipped</span></div>
                <div className={styles.artLine}><span className={styles.artDim}>→</span>notify <span className={styles.artG}>✓ live</span></div>
                <div className={styles.artLine}><span className={styles.artV}>○</span> live</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaEyebrow}>Updated daily</div>
          <h2 className={styles.ctaH2}>Today&apos;s dispatch<br/>is <em>waiting.</em></h2>
          <p className={styles.ctaP}>Claude already read everything. The whole dispatch takes about five minutes — and the top picks in two.</p>
          <div className={styles.ctaRow}>
            <a href="/reader" className={styles.ctaBtnPrimary}>Read today&apos;s dispatch →</a>
            <a href="#topics" className={styles.ctaBtnSecondary}>See all topics</a>
          </div>
          <div className={styles.ctaMeta}>no signup · no email · always free</div>
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span style={{ color: "var(--ink)" }}>Dispatch</span>
            <span className={styles.footerMono}> · curated by Claude · multi-source</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Changelog</a><a href="#">GitHub</a><a href="#">Privacy</a>
          </div>
        </footer>
      </div>
    </>
  );
}
