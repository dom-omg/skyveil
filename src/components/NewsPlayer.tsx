'use client'

import { useEffect, useRef, useState } from 'react'

interface Channel {
  id: string
  name: string
  lang: string
  ytChannelId: string
  hlsUrl?: string
}

const CHANNELS: Channel[] = [
  { id: 'f24en', name: 'France 24', lang: 'EN', ytChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg', hlsUrl: 'https://streaming.france24.com/live/F24_EN_HLS_LO/playlist.m3u8' },
  { id: 'aje', name: 'Al Jazeera', lang: 'EN', ytChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg', hlsUrl: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8' },
  { id: 'dw', name: 'DW News', lang: 'EN', ytChannelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'skynews', name: 'Sky News', lang: 'EN', ytChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'f24fr', name: 'France 24', lang: 'FR', ytChannelId: 'UCzDNBqSwEHAJu6CZ1yLDHYQ' },
]

interface Props {
  autoChannel?: string // channel id to auto-switch to
}

export default function NewsPlayer({ autoChannel }: Props) {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<Channel>(CHANNELS[0])
  const [useHls, setUseHls] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null)

  useEffect(() => {
    if (!autoChannel) return
    const found = CHANNELS.find(c => c.id === autoChannel)
    if (found) setChannel(found)
  }, [autoChannel])

  useEffect(() => {
    if (!useHls || !open || !channel.hlsUrl || !videoRef.current) return
    let destroyed = false

    import('hls.js').then(({ default: Hls }) => {
      if (destroyed || !videoRef.current || !channel.hlsUrl) return
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true })
        hlsRef.current = hls
        hls.loadSource(channel.hlsUrl)
        hls.attachMedia(videoRef.current)
        hls.on(Hls.Events.MANIFEST_PARSED, () => { videoRef.current?.play().catch(() => {}) })
        hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal: boolean }) => { if (data.fatal) setUseHls(false) })
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = channel.hlsUrl
        videoRef.current.play().catch(() => {})
      } else {
        setUseHls(false)
      }
    })

    return () => {
      destroyed = true
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [useHls, channel, open])

  const ytEmbedUrl = `https://www.youtube.com/embed/live_stream?channel=${channel.ytChannelId}&autoplay=1&mute=0`

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-20 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs transition-all"
        style={{
          background: 'rgba(9,9,11,0.92)',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ color: '#ef4444' }}>⬤</span> LIVE NEWS
      </button>
    )
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-20 rounded-xl overflow-hidden shadow-2xl"
      style={{ width: 380, background: '#0a0a0c', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--foreground)' }}>
            {channel.name} · {channel.lang}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {channel.hlsUrl && (
            <button
              onClick={() => setUseHls(u => !u)}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ border: `1px solid ${useHls ? 'var(--accent)' : 'var(--border)'}`, color: useHls ? 'var(--accent)' : 'var(--muted)' }}
            >
              HLS
            </button>
          )}
          <button onClick={() => setOpen(false)} className="font-mono text-xs" style={{ color: 'var(--muted)' }}>✕</button>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
        {CHANNELS.map(c => (
          <button
            key={c.id}
            onClick={() => { setChannel(c); setUseHls(false) }}
            className="shrink-0 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest whitespace-nowrap transition-colors"
            style={{
              borderBottom: channel.id === c.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: channel.id === c.id ? 'var(--accent)' : 'var(--muted)',
              background: channel.id === c.id ? 'rgba(0,230,118,0.04)' : 'transparent',
            }}
          >
            {c.name} {c.lang}
          </button>
        ))}
      </div>

      {/* Player */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {useHls && channel.hlsUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            playsInline
            style={{ background: '#000' }}
          />
        ) : (
          <iframe
            key={channel.id}
            src={ytEmbedUrl}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ border: 'none', background: '#000' }}
          />
        )}
      </div>
    </div>
  )
}
