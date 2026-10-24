// Renders assets/bg3-run.svg from a real asciinema recording of bg3-ingame-harness.
// Every line comes from the cast; only the timing is compressed so the replay fits a loop.
// Usage: node scripts/render-run.mjs assets/bg3-dead-aim.cast assets/bg3-run.svg
import { readFileSync, writeFileSync } from 'node:fs'

const [castPath = 'assets/bg3-dead-aim.cast', outPath = 'assets/bg3-run.svg'] = process.argv.slice(2)

const events = readFileSync(castPath, 'utf8').trim().split('\n').slice(1).map((l) => JSON.parse(l))
const lines = events.map((e) => e[2]).join('').split('\r\n').filter(Boolean)

// Palette and type from the portfolio's DESIGN.md.
const C = { bg: '#0e100f', surface: '#141715', line: '#242926', text: '#e6e9e5', muted: '#a3aba5', faint: '#7e8781', accent: '#8fe3ad' }
const FONT = `ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace`
const W = 880
const SIZE = 13
const CH = SIZE * 0.6
const LH = 20
const PAD = 24
const HEAD = 44
const VISIBLE = 15
const H = HEAD + PAD + VISIBLE * LH + PAD - 6
const COL_ID = 5
const COL_DESC = 37
const DESC_MAX = Math.floor((W - PAD * 2) / CH) - COL_DESC

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

// Timeline in seconds inside one loop.
const LOOP = 16
const TYPE_END = 1.6
const rows = []
let t = TYPE_END + 0.9 // the game boots; the real run waited 50 s here
for (const raw of lines) {
  if (raw.startsWith('$ ')) {
    rows.push({ kind: 'cmd', text: raw.slice(2), at: 0 })
    continue
  }
  const pass = /^PASS ([\w.-]+)(?:: (.*))?$/.exec(raw)
  const time = /^TIME ([\w.-]+): (.*)$/.exec(raw)
  if (pass && !pass[2]) rows.push({ kind: 'final', id: pass[1], at: (t += 0.35) })
  else if (pass) rows.push({ kind: 'pass', id: pass[1], desc: pass[2].replace(/\s*\(expected .*\)$/, ''), at: t })
  else if (time) rows.push({ kind: 'time', id: time[1], ms: time[2], at: (t += 0.4) })
  else rows.push({ kind: 'raw', text: raw, at: t })
  if (pass && pass[2]) t += rows.length === 2 ? 1.1 : 0.17 // mods load first, then the batch of checks
}
const DONE = t
const pct = (s) => +((s / LOOP) * 100).toFixed(3)
const FADE = pct(LOOP - 0.6)

let css = ''
let body = ''
rows.forEach((r, i) => {
  const y = PAD + HEAD + i * LH + SIZE
  const x = (col) => PAD + col * CH
  let row = ''
  if (r.kind === 'cmd') {
    row += `<text x="${x(0)}" y="${y}" fill="${C.faint}">$</text>`
    row += `<text x="${x(2)}" y="${y}" fill="${C.text}" textLength="${(r.text.length * CH).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(r.text)}</text>`
    const w = r.text.length * CH
    const steps = r.text.length
    css += `.cover{animation:type ${LOOP}s infinite}@keyframes type{0%{transform:translateX(0);animation-timing-function:steps(${steps},end)}${pct(TYPE_END)}%,100%{transform:translateX(${w.toFixed(1)}px)}}`
    css += `.cursor{animation:type ${LOOP}s infinite,blinkout ${LOOP}s infinite}@keyframes blinkout{0%,${pct(TYPE_END + 0.5)}%{opacity:1}${pct(TYPE_END + 0.55)}%,100%{opacity:0}}`
    row += `<rect class="cover" x="${x(2)}" y="${y - SIZE}" width="${(w + CH * 2).toFixed(1)}" height="${LH}" fill="${C.bg}"/>`
    row += `<rect class="cursor" x="${x(2)}" y="${y - SIZE + 1}" width="${CH.toFixed(1)}" height="${SIZE + 3}" fill="${C.accent}"/>`
    body += `<g>${row}</g>`
    return
  }
  if (r.kind === 'pass') {
    row += `<text x="${x(0)}" y="${y}" fill="${C.accent}">PASS</text>`
    row += `<text x="${x(COL_ID)}" y="${y}" fill="${C.text}">${esc(r.id)}</text>`
    row += `<text x="${x(COL_DESC)}" y="${y}" fill="${C.faint}">${esc(clip(r.desc, DESC_MAX))}</text>`
  } else if (r.kind === 'time') {
    row += `<text x="${x(0)}" y="${y}" fill="${C.muted}">TIME</text>`
    row += `<text x="${x(COL_ID)}" y="${y}" fill="${C.muted}">${esc(r.id)}: ${esc(r.ms)}</text>`
  } else if (r.kind === 'final') {
    row += `<rect x="${x(0) - 4}" y="${y - SIZE - 2}" width="${(4 * CH + 8).toFixed(1)}" height="${LH}" rx="3" fill="${C.accent}"/>`
    row += `<text x="${x(0)}" y="${y}" fill="${C.bg}" font-weight="700">PASS</text>`
    row += `<text x="${x(COL_ID)}" y="${y}" fill="${C.text}" font-weight="700">${esc(r.id)}</text>`
  } else {
    row += `<text x="${x(0)}" y="${y}" fill="${C.muted}">${esc(r.text)}</text>`
  }
  const p = pct(r.at)
  css += `.r${i}{animation:r${i} ${LOOP}s infinite}@keyframes r${i}{0%,${Math.max(p - 0.01, 0)}%{opacity:0}${p}%,${FADE}%{opacity:1}100%{opacity:0}}`
  body += `<g class="r${i}">${row}</g>`
})

// Scroll one line each time a row lands below the window.
const stops = ['0%{transform:translateY(0)}']
rows.forEach((r, i) => {
  const over = i - (VISIBLE - 1)
  if (over > 0) stops.push(`${pct(r.at)}%{transform:translateY(${-over * LH}px)}`)
})
const finalShift = -Math.max(0, rows.length - VISIBLE) * LH
stops.push(`${FADE}%{transform:translateY(${finalShift}px)}`, '100%{transform:translateY(0)}')
css += `.scroll{animation:scroll ${LOOP}s infinite steps(1,end)}@keyframes scroll{${stops.join('')}}`
css += `@media (prefers-reduced-motion:reduce){.scroll,.cover,.cursor,[class^="r"]{animation:none!important}.cover,.cursor{display:none}.scroll{transform:translateY(${finalShift}px)}}`

const checks = rows.filter((r) => r.kind === 'pass').length
const title = `bg3-ingame-harness: a real run inside Baldur's Gate 3, ${checks} checks passing`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${esc(title)}</title>
<style>${css}</style>
<defs><clipPath id="win"><rect x="0" y="${HEAD}" width="${W}" height="${H - HEAD}"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${C.bg}" stroke="${C.line}"/>
<path d="M0.5 ${HEAD}H${W - 0.5}" stroke="${C.line}"/>
<g font-family="${FONT}" font-size="${SIZE}">
<text x="${PAD}" y="${HEAD / 2 + 4.5}" fill="${C.muted}">bg3-ingame-harness <tspan fill="${C.faint}">· real run, Oct 19, 2026</tspan></text>
<text x="${W - PAD}" y="${HEAD / 2 + 4.5}" fill="${C.faint}" text-anchor="end">a 2-minute run, sped up</text>
<g clip-path="url(#win)"><g class="scroll">${body}</g></g>
</g>
</svg>
`
writeFileSync(outPath, svg)
console.log(`${outPath}: ${rows.length} lines, ${checks} checks, done at ${DONE.toFixed(1)} s of ${LOOP} s`)
