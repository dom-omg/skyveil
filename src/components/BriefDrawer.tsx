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

function exportPDF(b: IntelBrief) {
  const w = window.open('', '_blank')
  if (!w) return
  const col = LEVEL_COLOR[b.threatLevel] ?? '#22c55e'
  const html = b.summary
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
  w.document.write(`<!DOCTYPE html><html><head>
    <title>SKYVEIL · ${b.region}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; background: #fff; color: #1a1a1a; padding: 48px; max-width: 800px; }
      .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
      .title { font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #666; }
      .region { font-size: 20px; font-weight: 700; margin: 8px 0 4px; }
      .meta { font-size: 11px; color: #888; }
      .level { display: inline-block; font-size: 12px; font-weight: 700; color: ${col}; border: 1px solid ${col}; padding: 2px 8px; border-radius: 3px; margin-left: 12px; }
      .body { font-size: 13px; line-height: 1.75; }
      .sources { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
      .footer { margin-top: 40px; font-size: 10px; color: #bbb; }
    </style>
  </head><body>
    <div class="header">
      <div class="title">SKYVEIL Brief <span class="level">${b.threatLevel}</span></div>
      <div class="region">${b.region}</div>
      <div class="meta">Generated: ${new Date(b.generatedAt).toLocaleString()} · ID: ${b.id}</div>
    </div>
    <div class="body">${html}</div>
    ${b.sources.length > 0 ? `<div class="sources">OSINT Sources: ${b.sources.join(', ')}</div>` : ''}
    <div class="footer">SKYVEIL — ADS-B + GDELT OSINT analysis · Unclassified</div>
  </body></html>`)
  w.document.close()
  w.print()
}

function renderSummary(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g)
    return (
      <p key={i} className={line.startsWith('•') ? 'ml-3' : ''} style={{ marginBottom: '4px' }}>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
          <span className="font-mono text-xs font-bold uppercase" style={{ color: col }}>{b.threatLevel}</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
          {new Date(b.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        SECTOR: {b.region}
      </div>

      <div className="h-px" style={{ background: col, opacity: 0.25 }} />

      <div className="text-sm leading-relaxed space-y-1 font-mono" style={{ color: '#c8d0dc' }}>
        {renderSummary(b.summary)}
      </div>

      {b.sources.length > 0 && (
        <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
            OSINT: {b.sources.join(' · ')}
          </span>
        </div>
      )}

      <button
        onClick={() => exportPDF(b)}
        className="w-full py-2 text-xs font-mono uppercase tracking-widest rounded transition-colors"
        style={{ border: '1px solid var(--border)', color: 'var(--muted)', background: 'rgba(255,255,255,0.02)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        Export PDF ↗
      </button>
    </div>
  )
}

export default function BriefDrawer({ brief, history, loading, error, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState<number>(-1)
  const isOpen = loading || !!brief || !!error || history.length > 0

  const displayed = activeIdx === -1 ? brief : (history[activeIdx] ?? null)
  const levelCol = displayed ? (LEVEL_COLOR[displayed.threatLevel] ?? 'var(--accent)') : 'var(--accent)'

  return (
    <div
      className="absolute top-0 right-0 h-full z-40 flex flex-col"
      style={{
        width: '460px',
        background: 'rgba(9,9,11,0.97)',
        borderLeft: `1px solid ${isOpen ? levelCol + '33' : 'var(--border)'}`,
        backdropFilter: 'blur(8px)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: `${levelCol}08` }}>
        <div className="flex items-center gap-3">
          {loading
            ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
            : <div className="w-2 h-2 rounded-full" style={{ background: levelCol, boxShadow: `0 0 8px ${levelCol}` }} />
          }
          <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            SKYVEIL
          </span>
        </div>
        <button
          onClick={onClose}
          className="font-mono text-sm px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          ✕
        </button>
      </div>

      {/* History tabs */}
      {history.length > 0 && (
        <div className="flex shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {[{ label: 'Current', idx: -1 }, ...history.map((h, i) => ({
            label: `${new Date(h.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            idx: i,
          }))].map(({ label, idx }) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest shrink-0"
              style={{
                color: activeIdx === idx ? 'var(--accent)' : 'var(--muted)',
                borderBottom: activeIdx === idx ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading && activeIdx === -1 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <span className="font-mono text-xs animate-pulse" style={{ color: 'var(--accent)' }}>
              Generating brief…
            </span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
              ADS-B + OSINT → Claude Sonnet 4.6
            </span>
          </div>
        )}

        {error && activeIdx === -1 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="font-mono text-sm" style={{ color: 'var(--threat)' }}>{error}</span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
              Check ANTHROPIC_API_KEY · wait 60s and retry
            </span>
          </div>
        )}

        {displayed && (!loading || activeIdx !== -1) && (
          <BriefCard b={displayed} />
        )}
      </div>
    </div>
  )
}
