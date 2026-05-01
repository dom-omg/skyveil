'use client'
import { useEffect, useRef, useState } from 'react'
import './landing.css'

const TICKER_ITEMS = [
  { tag: 'CONTACT', cls: 'alert', text: 'RC-135V · ELINT · IONIAN SEA · FL310' },
  { tag: 'AIS', cls: '', text: 'TANKER · IRGCN AOR · COURSE 087° · 13.2 kn' },
  { tag: 'NOTAM', cls: 'amber', text: 'EUR/SAM · TRA-451 · ACTIVE 14:00–18:00Z' },
  { tag: 'OSINT', cls: '', text: 'GDELT · ARTICLE CLUSTER +312% · BLACK SEA' },
  { tag: 'TRACK', cls: '', text: 'E-3 SENTRY · ORBIT EAST POLAND · FL280' },
  { tag: 'CONTACT', cls: 'alert', text: 'TU-95MS · COLD LAKE FIR · TRANSPONDER OFF' },
  { tag: 'NAV', cls: '', text: 'CSG-12 · POSITION FIX · 36.2°N 30.8°E' },
  { tag: 'NOTAM', cls: 'amber', text: 'PACIFIC · MISSILE TEST WINDOW · 72H' },
  { tag: 'OSINT', cls: '', text: 'SAT IMAGERY · NEW EARTHWORKS · KALININGRAD' },
  { tag: 'AIR', cls: '', text: 'F-35A · 4-SHIP · OFFUTT → RAMSTEIN · FL360' },
  { tag: 'TRACK', cls: '', text: 'P-8A POSEIDON · BARENTS · 25,000ft' },
  { tag: 'CONTACT', cls: 'alert', text: 'SU-24 · INTERCEPT · BALTIC SECTOR' },
]

const FEED_ITEMS = [
  { cat: 'ALERT', cls: 'alert', text: 'Unscheduled scramble from Ämari AB. 4 × Eurofighter Typhoon climbing east-bound.', loc: 'BALTIC · 0421Z' },
  { cat: 'CONTACT', cls: 'alert', text: 'RC-135V Rivet Joint entering AOR. Orbit pattern indicates ELINT collection.', loc: 'IONIAN · 0418Z' },
  { cat: 'AIS', cls: '', text: 'Liberian-flagged tanker HUMANITY deviating from filed course. Heading 087°.', loc: 'PERSIAN GULF · 0414Z' },
  { cat: 'NOTAM', cls: 'amber', text: 'Temporary restricted area TRA-451 activated. Live exercise window 14–18Z.', loc: 'NORTH SEA · 0411Z' },
  { cat: 'OSINT', cls: '', text: 'GDELT cluster around Rostov-on-Don: 312% above 7-day baseline.', loc: 'GLOBAL · 0407Z' },
  { cat: 'TRACK', cls: '', text: 'E-3 Sentry AWACS established orbit east of Warsaw. FL280, holding.', loc: 'POLAND · 0403Z' },
  { cat: 'NAV', cls: '', text: 'Carrier strike group CSG-12 position confirmed. Speed 21 kn, course 195°.', loc: 'EAST MED · 0359Z' },
  { cat: 'CONTACT', cls: 'alert', text: 'Tu-95MS bear formation tracked off Alaska ADIZ. F-22 intercept airborne.', loc: 'BERING · 0354Z' },
]

function pad(n: number) { return n < 10 ? '0' + n : '' + n }
function fmt(n: number) { return n.toLocaleString('en-US') }

export default function LandingPage() {
  const [utcDisplay, setUtcDisplay] = useState('— UTC')
  const [consoleTime, setConsoleTime] = useState('— UTC')
  const [consoleFrame, setConsoleFrame] = useState('——:——Z')
  const [tracks, setTracks] = useState({ air: 12847, nav: 3412, not: 1209, evt: 8664, console: 2184 })
  const [radarPing, setRadarPing] = useState(42)
  const [feedIdx, setFeedIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const sweepRef = useRef<SVGGElement | null>(null)
  const rafRef = useRef<number>(0)
  const angleRef = useRef(0)

  useEffect(() => {
    function tick() {
      const d = new Date()
      const t = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
      const date = `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`
      setUtcDisplay(`${date} · ${t} UTC`)
      setConsoleTime(`${t} UTC`)
      setConsoleFrame(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setTracks(p => ({
        air: p.air + Math.floor((Math.random() - 0.5) * 16),
        nav: p.nav + Math.floor((Math.random() - 0.5) * 8),
        not: p.not + Math.floor((Math.random() - 0.5) * 4),
        evt: p.evt + Math.floor((Math.random() - 0.5) * 10),
        console: p.console + Math.floor((Math.random() - 0.5) * 6),
      }))
      setRadarPing(38 + Math.floor(Math.random() * 12))
    }, 1800)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function animate() {
      angleRef.current = (angleRef.current + 0.6) % 360
      if (sweepRef.current) {
        sweepRef.current.style.transform = `rotate(${angleRef.current}deg)`
        sweepRef.current.style.transformOrigin = '270px 270px'
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setFeedIdx(p => (p + 1) % FEED_ITEMS.length), 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const elems = document.querySelectorAll<HTMLElement>('[data-count-target]')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target as HTMLElement
        const target = parseInt(el.dataset.countTarget || '0', 10)
        const large = target > 1000
        const duration = 1600
        const start = performance.now()
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - t, 3)
          el.textContent = large ? Math.floor(target * eased).toLocaleString('en-US') : Math.floor(target * eased).toString()
          if (t < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        obs.unobserve(el)
      })
    }, { threshold: 0.4 })
    elems.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const visibleFeed = Array.from({ length: 5 }, (_, i) => FEED_ITEMS[(feedIdx + i) % FEED_ITEMS.length])
  const tickerDouble = [...TICKER_ITEMS, ...TICKER_ITEMS]

  return (
    <div className="landing-root">
      <div className="l-grain" />

      {/* CLASSIFICATION */}
      <div className="l-classification">
        <div className="l-classification__inner">
          <div className="l-classification__side">
            <span>OFFICIAL · OSINT</span>
            <span>{utcDisplay}</span>
          </div>
          <div className="l-classification__center">
            <span className="l-classification__dot" />
            <span>SKYVEIL // OPERATIONAL // RT FEED ACTIVE</span>
            <span className="l-classification__dot" />
          </div>
          <div className="l-classification__side">
            <span>BUILD v2.41.07</span>
            <span>UNCLASSIFIED</span>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="l-nav">
        <div className="l-nav__inner">
          <a href="#" className="l-nav__brand">
            <svg className="l-nav__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10c-2.5-3-4-6.5-4-10s1.5-7 4-10z"/>
              <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
            </svg>
            SKYVEIL
          </a>
          <div className="l-nav__links">
            <a className="l-nav__link" href="#capabilities"><span className="l-num">01</span>Capabilities</a>
            <a className="l-nav__link" href="#console"><span className="l-num">02</span>Console</a>
            <a className="l-nav__link" href="#coverage"><span className="l-num">03</span>Coverage</a>
            <a className="l-nav__link" href="#sources"><span className="l-num">04</span>Sources</a>
            <a className="l-nav__link" href="#access"><span className="l-num">05</span>Access</a>
          </div>
          <div className="l-nav__cta">
            <a href="/console" className="l-nav__pill">Live Globe ↗</a>
            <a href="#access" className="l-btn">
              Request Access
              <svg className="l-btn__arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 5h8M5 1l4 4-4 4"/>
              </svg>
            </a>
          </div>
        </div>
      </nav>

      <main className="l-main">

        {/* HERO */}
        <section className="l-hero">
          <div className="l-wrap">
            <div className="l-hero__inner">
              <div>
                <div className="l-hero__meta">
                  <span className="l-hero__meta-pulse" />
                  <span className="l-hero__meta-text"><strong>LIVE</strong> · {fmt(tracks.air)} active tracks · 147 regions</span>
                </div>
                <h1 className="l-hero__title">
                  Global<br/>
                  situational<br/>
                  <em>awareness,</em><br/>
                  at operator<br/>
                  tempo.
                </h1>
                <p className="l-hero__sub">
                  <strong>Skyveil</strong> ingests every public signal — ADS-B, AIS, NOTAMs, GDELT, satellite imagery — and resolves them into a single, queryable picture of the world. <strong>No black boxes.</strong> No proprietary feeds. Open intelligence, refined.
                </p>
                <div className="l-hero__cta">
                  <a href="#access" className="l-btn">
                    Request Access
                    <svg className="l-btn__arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 5h8M5 1l4 4-4 4"/>
                    </svg>
                  </a>
                  <a href="/console" className="l-btn l-btn--ghost">View Live Console</a>
                </div>
                <div className="l-hero__telemetry">
                  <div className="l-telem"><div className="l-telem__label">Airborne</div><div className="l-telem__value">{fmt(tracks.air)}</div></div>
                  <div className="l-telem"><div className="l-telem__label">Naval</div><div className="l-telem__value">{fmt(tracks.nav)}</div></div>
                  <div className="l-telem"><div className="l-telem__label">NOTAMs · 24h</div><div className="l-telem__value">{fmt(tracks.not)}</div></div>
                  <div className="l-telem"><div className="l-telem__label">Events</div><div className="l-telem__value">{fmt(tracks.evt)}</div></div>
                </div>
              </div>

              {/* Radar */}
              <div className="l-hero__radar">
                <div className="l-hud-corner tl"/><div className="l-hud-corner tr"/>
                <div className="l-hud-corner bl"/><div className="l-hud-corner br"/>
                <div className="l-radar-coords tl">LAT 45°30&apos;N<br/>LON 073°34&apos;W</div>
                <div className="l-radar-coords tr">MODE TRACK<br/>ZOOM 0.62x</div>
                <div className="l-radar-coords bl">REF: GMT<br/>PROJ: AZIM</div>
                <div className="l-radar-coords br">PING {radarPing}ms<br/>QOS NOMINAL</div>
                <svg viewBox="0 0 540 540" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
                  <defs>
                    <radialGradient id="rgrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#c9d6dd" stopOpacity="0.06"/>
                      <stop offset="70%" stopColor="#c9d6dd" stopOpacity="0"/>
                    </radialGradient>
                    <linearGradient id="sweep-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#c9d6dd" stopOpacity="0"/>
                      <stop offset="100%" stopColor="#c9d6dd" stopOpacity="0.45"/>
                    </linearGradient>
                    <pattern id="dotgrid" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="0.6" fill="#2a2e33"/>
                    </pattern>
                  </defs>
                  <circle cx="270" cy="270" r="240" fill="url(#rgrad)"/>
                  <circle cx="270" cy="270" r="240" fill="url(#dotgrid)" opacity="0.5"/>
                  <g fill="none" stroke="#2a2e33" strokeWidth="0.5">
                    <circle cx="270" cy="270" r="60"/><circle cx="270" cy="270" r="120"/>
                    <circle cx="270" cy="270" r="180"/><circle cx="270" cy="270" r="240"/>
                  </g>
                  <g stroke="#2a2e33" strokeWidth="0.5">
                    <line x1="30" y1="270" x2="510" y2="270"/>
                    <line x1="270" y1="30" x2="270" y2="510"/>
                  </g>
                  <g fill="#1c1f23" stroke="#2a2e33" strokeWidth="0.4" opacity="0.75">
                    <path d="M155 160 Q140 175 145 200 Q140 220 155 240 Q175 260 200 250 Q220 230 215 205 Q210 180 195 165 Q180 155 170 158 Z"/>
                    <path d="M210 295 Q205 320 215 345 Q230 360 230 380 Q220 395 215 380 Q205 360 200 335 Q200 310 210 295 Z"/>
                    <path d="M275 175 Q285 175 295 185 Q305 195 300 205 Q290 210 280 205 Q272 195 275 185 Z"/>
                    <path d="M285 220 Q300 215 310 230 Q320 260 315 290 Q305 320 300 335 Q290 340 285 320 Q275 290 280 260 Q280 235 285 220 Z"/>
                    <path d="M310 165 Q345 160 380 175 Q400 195 395 220 Q380 235 360 230 Q335 225 320 215 Q310 200 310 185 Z"/>
                    <path d="M390 320 Q410 315 425 325 Q425 340 410 345 Q395 345 388 335 Z"/>
                  </g>
                  <g ref={sweepRef} className="l-radar-sweep">
                    <path d="M270 270 L510 270 A240 240 0 0 0 423 90 Z" fill="url(#sweep-grad)"/>
                  </g>
                  <g>
                    {[[170,195],[295,190],[365,200],[200,310],[403,328]].map(([cx,cy],i) => (
                      <g key={i}><circle cx={cx} cy={cy} r="2" fill="#c9d6dd"/><circle cx={cx} cy={cy} r="6" fill="none" stroke="#c9d6dd" strokeWidth="0.5" opacity="0.4"/></g>
                    ))}
                    {[[305,265],[346,190]].map(([cx,cy],i) => (
                      <g key={i}><circle cx={cx} cy={cy} r="3" fill="#ff4530"/>
                        <circle cx={cx} cy={cy} r="9" fill="none" stroke="#ff4530" strokeWidth="0.7" opacity="0.6">
                          <animate attributeName="r" values="3;14;3" dur="2.4s" begin={`${i*0.6}s`} repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" begin={`${i*0.6}s`} repeatCount="indefinite"/>
                        </circle>
                      </g>
                    ))}
                    <g><circle cx="380" cy="220" r="2.5" fill="#e8a33c"/><circle cx="380" cy="220" r="7" fill="none" stroke="#e8a33c" strokeWidth="0.5" opacity="0.5"/></g>
                  </g>
                  <g stroke="#c9d6dd" strokeWidth="0.7" fill="none" opacity="0.8">
                    <circle cx="270" cy="270" r="4"/>
                    <line x1="262" y1="270" x2="266" y2="270"/><line x1="274" y1="270" x2="278" y2="270"/>
                    <line x1="270" y1="262" x2="270" y2="266"/><line x1="270" y1="274" x2="270" y2="278"/>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div className="l-ticker">
          <div className="l-ticker__track">
            {tickerDouble.map((item, i) => (
              <span key={i} className="l-ticker__item">
                <span className={`l-ticker__tag${item.cls === 'alert' ? ' l-ticker__tag--alert' : item.cls === 'amber' ? ' l-ticker__tag--amber' : ''}`}>{item.tag}</span>
                <span className="l-ticker__sep">·</span>
                <span>{item.text}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 01 CAPABILITIES */}
        <section className="l-section" id="capabilities">
          <div className="l-wrap">
            <div className="l-section__head">
              <div className="l-section__num"><span>01</span> — Capabilities</div>
              <h2 className="l-section__title">Four signal classes. <em>One picture.</em> Resolved in real time across every theatre.</h2>
            </div>
            <div className="l-caps">
              <div className="l-cap">
                <svg className="l-cap__icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1"><path d="M16 4l4 14 10 4-10 2-4 8-4-8-10-2 10-4z"/></svg>
                <div className="l-cap__id">SVL — 01</div><h3 className="l-cap__name">Aerial</h3>
                <p className="l-cap__desc">Multilateration of ADS-B, MLAT and Mode-S signals. Military, civil, state. Squawk-resolved with formation detection.</p>
                <div className="l-cap__specs">
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Latency</span><span className="l-cap__spec-v">&lt; 1.4s</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Coverage</span><span className="l-cap__spec-v">147 ctr</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">ICAO</span><span className="l-cap__spec-v">98.7%</span></div>
                </div>
              </div>
              <div className="l-cap">
                <svg className="l-cap__icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1"><path d="M4 22h24M6 22V12l10-6 10 6v10M16 22V14"/></svg>
                <div className="l-cap__id">SVL — 02</div><h3 className="l-cap__name">Maritime</h3>
                <p className="l-cap__desc">AIS broadcasts, vessel registries, port-call data, dark-vessel inference. From bulk carriers to gray-hull movements.</p>
                <div className="l-cap__specs">
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Vessels</span><span className="l-cap__spec-v">412k+</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Ports</span><span className="l-cap__spec-v">3,940</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Refresh</span><span className="l-cap__spec-v">3s</span></div>
                </div>
              </div>
              <div className="l-cap">
                <svg className="l-cap__icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1"><rect x="5" y="8" width="22" height="16"/><path d="M5 12h22M9 16h6M9 19h10"/></svg>
                <div className="l-cap__id">SVL — 03</div><h3 className="l-cap__name">NOTAMs</h3>
                <p className="l-cap__desc">Notice-to-airmen parsing, geofenced alerts, exercise windows. Closures, restrictions, military operating areas.</p>
                <div className="l-cap__specs">
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Sources</span><span className="l-cap__spec-v">214</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Window</span><span className="l-cap__spec-v">24h+</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Parsed</span><span className="l-cap__spec-v">Auto</span></div>
                </div>
              </div>
              <div className="l-cap">
                <svg className="l-cap__icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c4 3 6 7 6 12s-2 9-6 12c-4-3-6-7-6-12s2-9 6-12z"/></svg>
                <div className="l-cap__id">SVL — 04</div><h3 className="l-cap__name">OSINT</h3>
                <p className="l-cap__desc">GDELT 2.0 ingest, language-resolved geocoding, source clustering, narrative drift. Verified open sources only.</p>
                <div className="l-cap__specs">
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Articles/d</span><span className="l-cap__spec-v">340k</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Languages</span><span className="l-cap__spec-v">68</span></div>
                  <div className="l-cap__spec"><span className="l-cap__spec-k">Geocoded</span><span className="l-cap__spec-v">96.1%</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 CONSOLE */}
        <section className="l-section" id="console">
          <div className="l-wrap">
            <div className="l-section__head">
              <div className="l-section__num"><span>02</span> — Console</div>
              <h2 className="l-section__title">A single pane of glass. <em>The world,</em> queryable.</h2>
            </div>
            <div className="l-console">
              <div className="l-console__bar">
                <div className="l-console__bar-l">
                  <span className="l-console__sig"/>
                  <span className="l-console__title">SKYVEIL · INTEL CONSOLE</span>
                </div>
                <div className="l-console__bar-r">
                  <span>SECTOR · GLOBAL</span>
                  <span>FILTER · MIL</span>
                  <span>{consoleTime}</span>
                </div>
              </div>
              <div className="l-console__body">
                <div className="l-console__main">
                  <div className="l-console__overlay">
                    <div>SECTOR <strong>EUR · MED</strong></div>
                    <div>TRACKS <strong>{fmt(tracks.console)}</strong></div>
                    <div>FORMATIONS <strong>14</strong></div>
                  </div>
                  <div className="l-console__overlay-r">
                    FRAME · <strong>{consoleFrame}</strong><br/>REFRESH · <strong>1.4s</strong>
                  </div>
                  <div className="l-console__globe">
                    <svg viewBox="0 0 700 540" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="cdotgrid" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                          <circle cx="1" cy="1" r="0.5" fill="#2a2e33"/>
                        </pattern>
                      </defs>
                      <g fill="none" stroke="#1c1f23" strokeWidth="0.5">
                        <ellipse cx="350" cy="270" rx="320" ry="60"/><ellipse cx="350" cy="270" rx="320" ry="120"/>
                        <ellipse cx="350" cy="270" rx="320" ry="180"/><ellipse cx="350" cy="270" rx="320" ry="240"/>
                      </g>
                      <g fill="none" stroke="#1c1f23" strokeWidth="0.5">
                        <ellipse cx="350" cy="270" rx="60" ry="240"/><ellipse cx="350" cy="270" rx="120" ry="240"/>
                        <ellipse cx="350" cy="270" rx="180" ry="240"/><ellipse cx="350" cy="270" rx="240" ry="240"/>
                        <ellipse cx="350" cy="270" rx="300" ry="240"/>
                      </g>
                      <g fill="#3a4046">
                        {/* N. America */}
                        {[[160,200],[170,195],[180,190],[155,215],[165,210],[175,205],[185,200],[160,230],[170,225],[180,220],[190,215],[200,210],[170,245],[180,240],[190,235],[200,230],[210,225],[190,260],[200,255],[210,250],[200,275],[210,270]].map(([cx,cy],i) => <circle key={`na${i}`} cx={cx} cy={cy} r="1.8"/>)}
                        {/* S. America */}
                        {[[225,320],[235,325],[225,335],[235,340],[245,345],[230,355],[240,360],[235,375],[245,380],[245,395]].map(([cx,cy],i) => <circle key={`sa${i}`} cx={cx} cy={cy} r="1.8"/>)}
                        {/* Europe */}
                        {[[345,200],[355,195],[365,200],[375,205],[355,215],[365,210],[375,215],[385,220],[370,225],[380,230]].map(([cx,cy],i) => <circle key={`eu${i}`} cx={cx} cy={cy} r="1.8"/>)}
                        {/* Africa */}
                        {[[360,250],[370,255],[380,250],[360,275],[370,280],[380,275],[390,280],[365,300],[375,305],[385,300],[370,325],[380,330],[375,350]].map(([cx,cy],i) => <circle key={`af${i}`} cx={cx} cy={cy} r="1.8"/>)}
                        {/* Asia */}
                        {[[410,190],[420,195],[430,190],[440,195],[450,190],[460,195],[470,200],[480,195],[490,200],[420,210],[430,215],[440,210],[450,215],[460,220],[470,215],[480,220],[495,215],[430,235],[445,230],[460,235],[475,240],[490,245],[450,255],[465,260],[485,270],[490,290],[500,295],[510,290]].map(([cx,cy],i) => <circle key={`as${i}`} cx={cx} cy={cy} r="1.8"/>)}
                        {/* Australia */}
                        {[[510,345],[520,340],[530,345],[540,350],[515,360],[525,355],[535,360]].map(([cx,cy],i) => <circle key={`au${i}`} cx={cx} cy={cy} r="1.8"/>)}
                      </g>
                      <g fill="none" stroke="#c9d6dd" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 3">
                        <path d="M180 230 Q280 210 360 220"/>
                        <path d="M210 250 Q300 270 420 215"/>
                        <path d="M380 280 Q450 250 520 240"/>
                        <path d="M180 200 Q340 160 480 200"/>
                      </g>
                      <g>
                        {[[280,215,20],[330,245,40],[440,260,-20],[360,195,70],[490,295,110]].map(([x,y,r],i) => (
                          <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
                            <path d="M0 -4 L1 1 L4 2 L1 3 L0 6 L-1 3 L-4 2 L-1 1 Z" fill="#c9d6dd"/>
                          </g>
                        ))}
                      </g>
                      <g>
                        <circle cx="380" cy="245" r="3" fill="#ff4530"/>
                        <circle cx="380" cy="245" r="14" fill="none" stroke="#ff4530" strokeWidth="0.7" opacity="0.6">
                          <animate attributeName="r" values="3;26;3" dur="3s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.7;0;0.7" dur="3s" repeatCount="indefinite"/>
                        </circle>
                        <text x="395" y="248" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#ff4530" letterSpacing="2">CONTACT · 14 AC</text>
                      </g>
                      <g>
                        <circle cx="465" cy="225" r="2.5" fill="#e8a33c"/>
                        <circle cx="465" cy="225" r="10" fill="none" stroke="#e8a33c" strokeWidth="0.6" opacity="0.5">
                          <animate attributeName="r" values="2.5;18;2.5" dur="3.4s" begin="0.8s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.6;0;0.6" dur="3.4s" begin="0.8s" repeatCount="indefinite"/>
                        </circle>
                        <text x="478" y="228" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#e8a33c" letterSpacing="2">NOTAM</text>
                      </g>
                      <text x="20" y="500" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">PROJECTION · MERCATOR / CLIPPED</text>
                      <text x="680" y="500" textAnchor="end" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">LAYER · MIL.AIR + MARITIME</text>
                    </svg>
                  </div>
                </div>
                <div className="l-console__feed">
                  <div className="l-feed__head">
                    <span><strong>INTEL FEED</strong> · LIVE</span>
                    <span>OSINT · GDELT · MIL</span>
                  </div>
                  <div className="l-feed__list">
                    {visibleFeed.map((item, i) => (
                      <div key={`${feedIdx}-${i}`} className="l-feed__item" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="l-feed__item-head">
                          <span className={`l-feed__cat${item.cls === 'alert' ? ' l-feed__cat--alert' : item.cls === 'amber' ? ' l-feed__cat--amber' : ''}`}>{item.cat}</span>
                          <span className="l-feed__time">{item.loc}</span>
                        </div>
                        <div className="l-feed__text">{item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 COVERAGE */}
        <section className="l-section" id="coverage">
          <div className="l-wrap">
            <div className="l-section__head">
              <div className="l-section__num"><span>03</span> — Coverage</div>
              <h2 className="l-section__title">Continuous global ingest. <em>No theatre uncovered.</em></h2>
            </div>
            <div className="l-coverage">
              <div className="l-map-grid">
                <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
                  <g fill="#2a2e33">
                    {[[120,130],[130,125],[140,130],[115,140],[125,140],[135,140],[145,140],[120,150],[130,150],[140,150],[150,150],[160,150],[135,160],[145,160],[155,160],[165,160],[155,170],[165,170],[160,180],[170,180]].map(([cx,cy],i) => <circle key={`m-na${i}`} cx={cx} cy={cy} r="1.4"/>)}
                    {[[170,220],[180,225],[175,235],[185,240],[180,250],[190,255],[185,265],[195,270],[190,280],[195,290]].map(([cx,cy],i) => <circle key={`m-sa${i}`} cx={cx} cy={cy} r="1.4"/>)}
                    {[[290,130],[300,125],[310,130],[320,135],[295,140],[305,140],[315,140],[325,140],[300,150],[310,150],[320,150],[330,150]].map(([cx,cy],i) => <circle key={`m-eu${i}`} cx={cx} cy={cy} r="1.4"/>)}
                    {[[305,170],[315,175],[325,170],[305,185],[315,190],[325,185],[335,190],[310,205],[320,210],[330,205],[315,225],[325,230],[320,245],[330,250]].map(([cx,cy],i) => <circle key={`m-af${i}`} cx={cx} cy={cy} r="1.4"/>)}
                    {[[350,120],[360,125],[370,120],[380,125],[390,120],[400,125],[410,120],[420,125],[430,120],[440,130],[450,125],[460,135],[365,140],[375,135],[385,140],[395,135],[405,140],[415,135],[425,140],[435,135],[445,140],[455,145],[380,155],[395,150],[410,155],[425,150],[440,155],[455,160],[465,155],[400,170],[415,175],[430,170],[445,175],[460,180],[455,195],[465,200],[475,195]].map(([cx,cy],i) => <circle key={`m-as${i}`} cx={cx} cy={cy} r="1.4"/>)}
                    {[[475,265],[485,260],[495,265],[505,270],[510,280],[500,285],[490,275]].map(([cx,cy],i) => <circle key={`m-oc${i}`} cx={cx} cy={cy} r="1.4"/>)}
                  </g>
                  <g>
                    {[[155,155],[310,140],[425,155]].map(([cx,cy],i) => (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r="2" fill="#c9d6dd"/>
                        <circle cx={cx} cy={cy} r="6" fill="none" stroke="#c9d6dd" strokeWidth="0.5" opacity="0.5">
                          <animate attributeName="r" values="2;14;2" dur="3s" begin={`${i*0.5}s`} repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin={`${i*0.5}s`} repeatCount="indefinite"/>
                        </circle>
                      </g>
                    ))}
                    {[[335,195],[450,170]].map(([cx,cy],i) => (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r="2.5" fill="#ff4530"/>
                        <circle cx={cx} cy={cy} r="8" fill="none" stroke="#ff4530" strokeWidth="0.6" opacity="0.6">
                          <animate attributeName="r" values="2.5;18;2.5" dur="2.4s" begin={`${i}s`} repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" begin={`${i}s`} repeatCount="indefinite"/>
                        </circle>
                      </g>
                    ))}
                  </g>
                  <g fill="none" stroke="#c9d6dd" strokeWidth="0.5" opacity="0.25" strokeDasharray="2 3">
                    <path d="M155 155 Q260 80 310 140"/>
                    <path d="M310 140 Q380 90 425 155"/>
                    <path d="M155 155 Q280 280 335 195"/>
                    <path d="M425 155 Q445 165 450 170"/>
                  </g>
                  <text x="20" y="20" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">REAL-TIME COVERAGE · NODE NETWORK</text>
                  <text x="580" y="20" textAnchor="end" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">147 REGIONS</text>
                  <text x="20" y="385" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">UPDATE · 1.4s</text>
                  <text x="580" y="385" textAnchor="end" fontFamily="var(--font-geist-mono)" fontSize="9" fill="#5a5d61" letterSpacing="2">NOMINAL</text>
                </svg>
              </div>
              <div className="l-metrics">
                <div className="l-metric"><span className="l-metric__id">M.01</span><span className="l-metric__num" data-count-target="12847">0</span><span className="l-metric__lab">Active aerial tracks · live</span></div>
                <div className="l-metric"><span className="l-metric__id">M.02</span><span className="l-metric__num" data-count-target="412000">0</span><span className="l-metric__lab">Vessels resolved across registries</span></div>
                <div className="l-metric"><span className="l-metric__id">M.03</span><span className="l-metric__num" data-count-target="147">0</span><span className="l-metric__lab">Regions / FIRs covered</span></div>
                <div className="l-metric"><span className="l-metric__id">M.04</span><span className="l-metric__num" data-count-target="340">0</span><span style={{ fontFamily:'var(--font-geist-sans)', fontSize:'clamp(28px,3vw,40px)', marginLeft:'-8px', opacity:0.7 }}>k</span><span className="l-metric__lab">OSINT articles ingested · daily</span></div>
                <div className="l-metric"><span className="l-metric__id">M.05</span><span className="l-metric__num">1.4<span style={{ fontFamily:'var(--font-geist-sans)', fontSize:'0.5em', opacity:0.6 }}>s</span></span><span className="l-metric__lab">End-to-end signal latency</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 SOURCES */}
        <section className="l-section" id="sources">
          <div className="l-wrap">
            <div className="l-section__head">
              <div className="l-section__num"><span>04</span> — Sources</div>
              <h2 className="l-section__title">Open by design. <em>Auditable</em> by default.</h2>
            </div>
            <div className="l-method">
              {[
                { id:'M.01 / INGEST', title:'Public signals only.', text:'ADS-B, AIS, NOTAMs, GDELT 2.0, satellite tasking schedules, public registries, government feeds. Every byte is traceable to its origin.' },
                { id:'M.02 / RESOLVE', title:'Cross-corroboration.', text:'Multilateration, hex correlation, callsign-to-registry joins, vessel-to-port reconciliation. Confidence scores attached to every track.' },
                { id:'M.03 / SURFACE', title:'Analyst-grade UI.', text:'Filter by squawk, registration, owner, formation, region. Export to GeoJSON, CSV, KML. API access at every layer.' },
                { id:'M.04 / RETAIN', title:'Cold storage, indexed.', text:'Every frame archived. 36-month rolling history. Replay any sector, any moment. Time-travel debugging for analysts.' },
                { id:'M.05 / ALERT', title:'Geofenced triggers.', text:'Webhook, email, Slack, RSS. Build custom watchlists by hex, ICAO range, MMSI, polygon. Sub-second dispatch.' },
                { id:'M.06 / OPEN', title:'No black boxes.', text:'Source citations on every event. Methodology documented. Pull requests welcome on the public corpus and resolution rules.' },
              ].map(cell => (
                <div key={cell.id} className="l-method__cell">
                  <div className="l-method__id">{cell.id}</div>
                  <h4 className="l-method__title">{cell.title}</h4>
                  <p className="l-method__text">{cell.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* QUOTE */}
        <section className="l-quote-section">
          <div className="l-wrap">
            <div className="l-quote">
              &ldquo;<em>The best intelligence picture</em> is the one anyone can verify. Skyveil is open by construction — not by promise.&rdquo;
            </div>
            <div className="l-quote__attr">
              <span>— SKYVEIL · DESIGN PRINCIPLE</span>
              <span>FILED <span>2025.04.12</span></span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="l-cta" id="access">
          <div className="l-wrap">
            <div className="l-cta__inner">
              <div className="l-cta__pre">
                <span className="l-cta__pre-line"/><span className="l-cta__pre-text">EARLY ACCESS · GATED</span><span className="l-cta__pre-line"/>
              </div>
              <h2 className="l-cta__title">Watch the world<br/><em>before it watches</em><br/>you back.</h2>
              <p className="l-cta__sub">Request operator credentials. Approved analysts, journalists, and researchers receive console access within 72 hours.</p>
              <form className="l-cta__form" onSubmit={e => { e.preventDefault(); setSubmitted(true) }}>
                <input type="email" placeholder="operator@domain.tld" required />
                <button type="submit">{submitted ? '✓ Submitted' : 'Request →'}</button>
              </form>
              <div className="l-cta__note">SECURE · TLS 1.3 · NO TRACKERS · 147 SLOTS REMAINING THIS QUARTER</div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="l-footer">
          <div className="l-wrap">
            <div className="l-foot">
              <div className="l-foot__brand">
                SKYVEIL.
                <p>Global situational awareness, refined for the open-source intelligence community. Built independently. No defense-prime entanglements.</p>
              </div>
              <div className="l-foot__col">
                <h4>Product</h4>
                <ul><li><a href="#">Console</a></li><li><a href="#">API</a></li><li><a href="#">Replay</a></li><li><a href="#">Watchlists</a></li></ul>
              </div>
              <div className="l-foot__col">
                <h4>Coverage</h4>
                <ul><li><a href="#">Aerial</a></li><li><a href="#">Maritime</a></li><li><a href="#">NOTAMs</a></li><li><a href="#">OSINT</a></li></ul>
              </div>
              <div className="l-foot__col">
                <h4>Company</h4>
                <ul><li><a href="#">Methodology</a></li><li><a href="#">Status</a></li><li><a href="#">Press</a></li><li><a href="#">Contact</a></li></ul>
              </div>
            </div>
            <div className="l-foot__bottom">
              <span>© 2025 SKYVEIL · ALL DATA PUBLIC-SOURCE</span>
              <span>BUILD v2.41.07 · UPTIME 99.987%</span>
              <span>MONTRÉAL · LISBON · SINGAPORE</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  )
}
