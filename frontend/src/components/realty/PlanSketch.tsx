/**
 * Chizma yuklanmaguncha ko'rsatiladigan sxematik planirovka.
 * Xonalar soniga qarab deterministik tarzda bo'linadi (har safar bir xil chiqadi).
 */
export function PlanSketch({ rooms, area, className }: { rooms: number; area: string | number; className?: string }) {
  const W = 300
  const H = 200
  const pad = 14
  const a = typeof area === 'string' ? parseFloat(area) : area
  const n = Math.max(rooms, 0)
  // [x, y, w, h, label]
  const cells: [number, number, number, number, string][] = []
  const iw = W - pad * 2
  const ih = H - pad * 2
  const hallW = iw * 0.24

  cells.push([pad, pad + ih * 0.55, hallW, ih * 0.45, 'Dahliz'])
  cells.push([pad, pad, hallW, ih * 0.55, n === 0 ? 'Oshxona' : 'Oshxona'])
  const rest = Math.max(n, 1)
  const rx = pad + hallW
  const rw = iw - hallW
  if (rest <= 2) {
    for (let i = 0; i < rest; i++) cells.push([rx + (rw / rest) * i, pad, rw / rest, ih * 0.72, n === 0 ? 'Studiya' : i === 0 ? 'Mehmonxona' : 'Yotoqxona'])
    cells.push([rx, pad + ih * 0.72, rw * 0.45, ih * 0.28, 'Hammom'])
    cells.push([rx + rw * 0.45, pad + ih * 0.72, rw * 0.55, ih * 0.28, 'Balkon'])
  } else {
    const top = Math.ceil(rest / 2)
    const bottom = rest - top
    for (let i = 0; i < top; i++) cells.push([rx + (rw / top) * i, pad, rw / top, ih * 0.5, i === 0 ? 'Mehmonxona' : 'Yotoqxona'])
    const bw = rw - rw * 0.3
    for (let i = 0; i < bottom; i++) cells.push([rx + (bw / bottom) * i, pad + ih * 0.5, bw / bottom, ih * 0.5, 'Yotoqxona'])
    cells.push([rx + bw, pad + ih * 0.5, rw * 0.3, ih * 0.5, 'Hammom'])
  }

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Sxematik planirovka, ${n} xona, ${a} m²`}>
      <rect x={pad} y={pad} width={iw} height={ih} fill="rgba(255,255,255,0.03)" stroke="rgba(243,242,238,0.55)" strokeWidth="3" rx="2" />
      {cells.map(([x, y, w, h, label], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={label === 'Balkon' ? 'rgba(158,188,245,0.06)' : 'none'} stroke="rgba(243,242,238,0.35)" strokeWidth="1.4" />
          {/* eshik o'rni */}
          <line x1={x + 6} y1={y + h} x2={x + 22} y2={y + h} stroke="var(--bg, #0a0b0d)" strokeWidth="3" />
          <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize="9.5" fill="rgba(243,242,238,0.55)" fontFamily="Inter Variable, sans-serif">
            {label}
          </text>
        </g>
      ))}
      <text x={W - pad} y={H + 12} textAnchor="end" fontSize="10" fill="rgba(243,242,238,0.4)" fontFamily="Inter Variable, sans-serif">
        sxema · {a} m²
      </text>
    </svg>
  )
}
