// Fetches one Lolalytics tier-list page the same way the app does and prints
// what was decoded, so a format change is easy to diagnose.
//   node scripts/probe-stats.mjs [lane]      lane: top|jungle|middle|bottom|support
const lane = process.argv[2] ?? 'middle'
const url = `https://lolalytics.com/lol/tierlist/?lane=${lane}&tier=emerald_plus`
console.log('GET', url)
const res = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    Accept: 'text/html'
  }
})
console.log('status', res.status, res.headers.get('content-type'))
const html = await res.text()
console.log('html length', html.length, '| patch:', /Patch (\d+\.\d+)/.exec(html)?.[1])
const m = /<script type="qwik\/json">([\s\S]*?)<\/script>/.exec(html)
if (!m) {
  console.log('qwik/json NOT found. First 400 chars:\n', html.slice(0, 400))
  process.exit(1)
}
const objs = JSON.parse(m[1]).objs
const isRef = (v) => typeof v === 'string' && /^[0-9a-z]{1,4}$/.test(v) && objs[parseInt(v, 36)] !== undefined
const resolve = (v, d = 0) => {
  if (d > 4) return v
  if (isRef(v)) return resolve(objs[parseInt(v, 36)], d + 1)
  if (Array.isArray(v)) return v.map((x) => resolve(x, d + 1))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, d + 1)]))
  return v
}
const rows = objs
  .filter((v) => v && typeof v === 'object' && !Array.isArray(v) && 'row' in v && 'cid' in v)
  .map((v) => ({ cid: resolve(v.cid), ...resolve(v.row) }))
console.log('rows decoded:', rows.length)
console.log('first row:', rows[0])
