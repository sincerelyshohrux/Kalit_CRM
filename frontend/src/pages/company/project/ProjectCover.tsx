/** Rasm bo'lmasa — loyiha nomidan rang olgan, chizilgan bino siluetli muqova */
export function ProjectCover({ src, name, className }: { src: string | null; name: string; className?: string }) {
  if (src) return <img className={className} src={src} alt="" loading="lazy" />
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <svg className={className} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`g${h}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 18% 22%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 40) % 360} 14% 10%)`} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#g${h})`} />
      {[
        [40, 70, 46, 110],
        [96, 38, 58, 142],
        [164, 58, 50, 122],
        [224, 86, 54, 94],
      ].map(([x, y, w, hh], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={hh} rx="3" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" />
          {Array.from({ length: Math.floor(hh / 14) }).map((_, r) =>
            Array.from({ length: Math.floor(w / 12) }).map((__, c) => (
              <rect key={`${r}-${c}`} x={x + 5 + c * 12} y={y + 6 + r * 14} width="6" height="7" rx="1" fill={(r * 7 + c * 3 + i) % 5 === 0 ? 'rgba(236,194,122,0.5)' : 'rgba(255,255,255,0.1)'} />
            )),
          )}
        </g>
      ))}
    </svg>
  )
}
