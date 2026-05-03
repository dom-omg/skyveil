'use client'

import { useEffect, useState } from 'react'
import type { ConflictEvent, OsintItem } from '@/lib/types'
import type { ActivityEvent } from '@/app/console/page'

interface Props {
  events: ConflictEvent[]
  activities: ActivityEvent[]
}

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function toneColor(tone: number): string {
  if (tone < -5) return '#ef4444'
  if (tone < -2) return '#f59e0b'
  return '#4a5248'
}

function toneLabel(tone: number): string {
  if (tone < -5) return 'HOT'
  if (tone < -2) return 'NEG'
  return 'NEU'
}

const TYPE_ICON: Record<ActivityEvent['type'], string> = {
  CLUSTER: '⚠', FORMATION: '◈', SQUAWK: '⚡', BRIEF: '◎', ANOMALY: '↑', ORBIT: '⊙',
}

type Tab = 'INTEL' | 'ACTIVITY' | 'OSINT'

export default function EventsFeed({ events, activities }: Props) {
  const [tab, setTab] = useState<Tab>('INTEL')
  const [osint, setOsint] = useState<OsintItem[]>([])
  const [osintLoading, setOsintLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'OSINT' || osint.length > 0) return
    setOsintLoading(true)
    fetch('/api/osint')
      .then(r => r.json())
      .then((d: { items: OsintItem[] }) => setOsint(d.items))
      .catch((err: unknown) => console.error('fetch error:', err))
      .finally(() => setOsintLoading(false))
  }, [tab, osint.length])

  // Refresh OSINT every 3 minutes
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/osint')
        .then(r => r.json())
        .then((d: { items: OsintItem[] }) => setOsint(d.items))
        .catch((err: unknown) => console.error('fetch error:', err))
    }, 180_000)
    return () => clearInterval(id)
  }, [])

  const tabCount: Record<Tab, number | null> = {
    INTEL: events.length > 0 ? events.length : null,
    ACTIVITY: activities.length > 0 ? activities.length : null,
    OSINT: osint.length > 0 ? osint.length : null,
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 rounded-full"
              style={{ background: tab === 'ACTIVITY' ? 'var(--accent)' : tab === 'OSINT' ? '#fb923c' : 'var(--threat)' }} />
            <span className="font-mono text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)' }}>
              {tab === 'INTEL' ? 'Intel Feed' : tab === 'ACTIVITY' ? 'Activity Log' : 'OSINT Ticker'}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-3">
            <span className="font-mono text-xl font-bold"
              style={{ color: tab === 'INTEL' ? 'var(--threat)' : tab === 'OSINT' ? '#fb923c' : 'var(--accent)' }}>
              {tab === 'INTEL' ? events.length : tab === 'ACTIVITY' ? activities.length : osint.length}
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {tab === 'INTEL' ? 'GDELT · 24h' : tab === 'ACTIVITY' ? 'session events' : 'live sources'}
            </span>
          </div>
        </div>
        <div className="flex">
          {(['INTEL', 'ACTIVITY', 'OSINT'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-[10px] font-mono uppercase tracking-widest"
              style={{
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                background: tab === t ? 'rgba(0,230,118,0.03)' : 'transparent',
              }}>
              {t}
              {tabCount[t] !== null && (
                <span className="ml-1 px-1 rounded text-[8px]"
                  style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--accent)' }}>
                  {tabCount[t]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* INTEL tab */}
      {tab === 'INTEL' && (
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }} />
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Loading events…</span>
            </div>
          )}
          {events.map(e => {
            const col = toneColor(e.tone)
            return (
              <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-3 transition-all"
                style={{ borderBottom: '1px solid var(--border)', borderLeft: `2px solid ${col}33` }}
                onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.025)'; ev.currentTarget.style.borderLeftColor = col }}
                onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderLeftColor = `${col}33` }}>
                <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: 'var(--foreground)' }}>{e.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${col}18`, color: col, border: `1px solid ${col}33` }}>
                    {toneLabel(e.tone)}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{e.source}</span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--muted)' }}>{timeAgo(e.publishedAt)}</span>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* ACTIVITY tab */}
      {tab === 'ACTIVITY' && (
        <div className="flex-1 overflow-y-auto">
          {activities.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32">
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Monitoring… no events yet</span>
            </div>
          )}
          {activities.map((a, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3"
              style={{ borderBottom: '1px solid var(--border)', borderLeft: `2px solid ${a.color}44` }}>
              <span className="text-base shrink-0 mt-0.5" style={{ color: a.color }}>{TYPE_ICON[a.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono leading-snug" style={{ color: 'var(--foreground)' }}>{a.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-mono px-1 rounded"
                    style={{ background: `${a.color}15`, color: a.color }}>
                    {a.type}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>
                    {timeAgo(a.time)} ago
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OSINT tab */}
      {tab === 'OSINT' && (
        <div className="flex-1 overflow-y-auto">
          {osintLoading && (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <div className="w-4 h-4 border border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }} />
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Fetching OSINT…</span>
            </div>
          )}
          {!osintLoading && osint.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32">
              <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>No OSINT items</span>
            </div>
          )}
          {osint.map(item => (
            <a
              key={item.id}
              href={item.url !== '#' ? item.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 transition-all"
              style={{ borderBottom: '1px solid var(--border)', borderLeft: '2px solid rgba(251,146,60,0.2)' }}
              onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.025)'; ev.currentTarget.style.borderLeftColor = 'rgba(251,146,60,0.8)' }}
              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderLeftColor = 'rgba(251,146,60,0.2)' }}
            >
              <p className="text-xs leading-snug line-clamp-2 mb-1.5" style={{ color: 'var(--foreground)' }}>{item.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  OSINT
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{item.source}</span>
                <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--muted)' }}>{timeAgo(item.publishedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
