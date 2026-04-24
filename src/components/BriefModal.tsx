'use client'

import { useState } from 'react'
import type { IntelBrief } from '@/lib/types'

interface Props {
  brief: IntelBrief | null
  history: IntelBrief[]
  loading: boolean
  error: string | null
  onClose: () => void
}

const LEVEL_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  ELEVATED: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

function renderSummary(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g)
    return (
      <p key={i} className={line.startsWith('•') ? 'ml-2' : ''}>
        {parts.map((part, j) =>
          j % 2 === 1
            ? <span key={j} style={{ fontWeight: 600, color: 'var(--foreground)' }}>{part}</span>
            : <span key={j}>{part}</span>
        )}
      </p>
    )
  })
}

function BriefCard({ b }: { b: IntelBrief }) {
  const col = LEVEL_COLOR[b.threatLevel] ?? '#22c55e'
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono" style={{ color: 'var(--muted)' }}>
        <span>SECTOR: {b.region}</span>
        <span>{new Date(b.generatedAt).toLocaleTimeString()}</span>
      </div>
      <div className="h-px" style={{ background: col, opacity: 0.3 }} />
      <div className="text-sm leading-relaxed space-y-1 font-mono" style={{ color: '#c8d0dc' }}>
        {renderSummary(b.summary)}
      </div>
      {b.sources.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            OSINT: {b.sources.join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

export default function BriefModal({ brief, history, loading, error, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState<number>(-1)

  if (!loading && !brief && !error && history.length === 0) return null

  const displayed = activeIdx === -1 ? brief : history[activeIdx] ?? null
  const levelCol = displayed ? (LEVEL_COLOR[displayed.threatLevel] ?? '#22c55e') : 'var(--accent)'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl mx-4 rounded-lg overflow-hidden shadow-2xl"
        style={{ background: '#080d18', border: `1px solid ${levelCol}33` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: `${levelCol}08` }}>
          <div className="flex items-center gap-3">
            {loading
              ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
              : <div className="w-2 h-2 rounded-full" style={{ background: levelCol, boxShadow: `0 0 8px ${levelCol}` }} />
            }
            <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              COBALT-INTEL Brief
            </span>
            {displayed && (
              <span className="font-mono text-xs font-bold uppercase" style={{ color: levelCol }}>
                — {displayed.threatLevel}
              </span>
            )}
          </div>
          <button onClick={onClose} className="font-mono text-sm transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
            [ESC]
          </button>
        </div>

        {/* History tabs */}
        {history.length > 0 && (
          <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
            {[{ label: 'Current', idx: -1 }, ...history.map((h, i) => ({
              label: `${new Date(h.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${h.threatLevel}`,
              idx: i,
            }))].map(({ label, idx }) => (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest shrink-0 transition-colors"
                style={{
                  color: activeIdx === idx ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: activeIdx === idx ? `2px solid var(--accent)` : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">
          {loading && activeIdx === -1 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span className="font-mono text-xs animate-pulse" style={{ color: 'var(--accent)' }}>
                Generating COBALT-INTEL brief…
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                ADS-B + OSINT → Claude Sonnet 4.6
              </span>
            </div>
          )}

          {error && activeIdx === -1 && !loading && (
            <div className="py-6 text-center">
              <p className="font-mono text-sm" style={{ color: 'var(--threat)' }}>{error}</p>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Check ANTHROPIC_API_KEY · try again in 60s
              </p>
            </div>
          )}

          {displayed && (!loading || activeIdx !== -1) && (
            <BriefCard b={displayed} />
          )}
        </div>
      </div>
    </div>
  )
}
