'use client'

import { useEffect, useRef, useState } from 'react'
import type { Aircraft } from '@/lib/types'

interface Station {
  id: string
  name: string
  region: string
  icao: string
  url: string
}

const STATIONS: Station[] = [
  { id: 'kjfk-app', name: 'JFK Approach', region: 'United States', icao: 'KJFK', url: 'https://s1-fmt2.liveatc.net/kjfk_app' },
  { id: 'klax-all', name: 'LAX Tower', region: 'United States', icao: 'KLAX', url: 'https://s1-fmt2.liveatc.net/klax_all' },
  { id: 'katl', name: 'Atlanta TRACON', region: 'United States', icao: 'KATL', url: 'https://s1-fmt2.liveatc.net/katl3' },
  { id: 'egll-dep', name: 'Heathrow Dep', region: 'United Kingdom', icao: 'EGLL', url: 'https://s1-fmt2.liveatc.net/egll1_dep' },
  { id: 'eham', name: 'Amsterdam Approach', region: 'Netherlands', icao: 'EHAM', url: 'https://s1-fmt2.liveatc.net/eham1' },
  { id: 'eddm', name: 'Munich Approach', region: 'Germany', icao: 'EDDM', url: 'https://s1-fmt2.liveatc.net/eddm1' },
  { id: 'lfpg', name: 'Paris CDG App', region: 'France', icao: 'LFPG', url: 'https://s1-fmt2.liveatc.net/lfpg_app' },
  { id: 'rjtt', name: 'Tokyo Approach', region: 'Japan', icao: 'RJTT', url: 'https://s1-fmt2.liveatc.net/rjtt1' },
  { id: 'omdb', name: 'Dubai App', region: 'United Arab Emirates', icao: 'OMDB', url: 'https://s1-fmt2.liveatc.net/omdb_gnd' },
  { id: 'yssy', name: 'Sydney Approach', region: 'Australia', icao: 'YSSY', url: 'https://s1-fmt2.liveatc.net/yssy1' },
]

function bestStation(aircraft: Aircraft | null): Station {
  if (!aircraft) return STATIONS[0]
  const match = STATIONS.find(s => s.region.toLowerCase() === aircraft.country.toLowerCase())
    ?? STATIONS.find(s => aircraft.country.toLowerCase().includes(s.region.split(' ')[0].toLowerCase()))
  return match ?? STATIONS[0]
}

interface Props {
  selected: Aircraft | null
}

export default function LiveATC({ selected }: Props) {
  const [open, setOpen] = useState(false)
  const [station, setStation] = useState<Station>(STATIONS[0])
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [error, setError] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoTunedRef = useRef<string | null>(null)

  // Auto-tune to selected aircraft country
  useEffect(() => {
    if (!selected) return
    const best = bestStation(selected)
    if (best.id !== autoTunedRef.current && best.id !== station.id) {
      setStation(best)
      autoTunedRef.current = best.id
    }
  }, [selected, station.id])

  // Load new station when it changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setError(false)
    if (playing) {
      audio.src = station.url
      audio.load()
      audio.play().catch(() => setError(true))
    }
  }, [station, playing])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      setError(false)
      audio.src = station.url
      audio.volume = volume
      audio.load()
      audio.play().then(() => setPlaying(true)).catch(() => {
        setError(true)
        setPlaying(false)
      })
    }
  }

  const handleVol = (v: number) => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
      <audio
        ref={audioRef}
        onError={() => setError(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        style={{ background: open ? 'rgba(0,230,118,0.04)' : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" style={{ color: playing ? 'var(--accent)' : 'var(--muted)' }}>
            {playing ? '📻' : '🎙'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: playing ? 'var(--accent)' : 'var(--muted)' }}>
            ATC LIVE
          </span>
          {playing && (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              <span className="font-mono text-[9px]" style={{ color: 'var(--accent)' }}>{station.icao}</span>
            </span>
          )}
        </div>
        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {/* Station selector */}
          <select
            value={station.id}
            onChange={e => {
              const s = STATIONS.find(s => s.id === e.target.value)!
              setStation(s)
            }}
            className="w-full rounded text-xs font-mono px-2 py-1.5 focus:outline-none"
            style={{ background: '#0a0a0c', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            {STATIONS.map(s => (
              <option key={s.id} value={s.id}>{s.icao} — {s.name}</option>
            ))}
          </select>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
              style={{
                background: playing ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${playing ? 'var(--accent)' : 'var(--border)'}`,
                color: playing ? 'var(--accent)' : 'var(--foreground)',
              }}
            >
              {playing ? '⏹' : '▶'}
            </button>

            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => handleVol(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="font-mono text-[10px] w-7 text-right" style={{ color: 'var(--muted)' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>

          {error && (
            <div className="text-[10px] font-mono px-2 py-1.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              Stream unavailable — try another station
            </div>
          )}

          {selected && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
              ↳ Auto-tuned to {selected.country}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
