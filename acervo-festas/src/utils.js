// ── Formatters ────────────────────────────────────────────────────────────────
export const uid     = () => Math.random().toString(36).slice(2, 10)
export const R$      = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const fmtDate = (d) => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—'

// ── Financial calculations ────────────────────────────────────────────────────
export const calcTotal  = (items) => (items||[]).reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||0),0)
export const calcDebito = (r) => Math.max(0, calcTotal(r.items) - Number(r.amountPaid||0))

export const calcOverdue = (r) => {
  if (!r.expectedReturnDate || !Number(r.dailyRate)) return 0
  const today = new Date().toISOString().slice(0,10)
  const compareDate = r.actualReturnDate || (r.status==='ativa' ? today : null)
  if (!compareDate) return 0
  const exp = new Date(r.expectedReturnDate+'T12:00:00')
  const act = new Date(compareDate+'T12:00:00')
  const days = Math.max(0, Math.round((act-exp)/86400000))
  return days * Number(r.dailyRate||0)
}

export const calcOverdueDays = (r) => {
  if (!r.expectedReturnDate) return 0
  const today = new Date().toISOString().slice(0,10)
  const compareDate = r.actualReturnDate || (r.status==='ativa' ? today : null)
  if (!compareDate) return 0
  const exp = new Date(r.expectedReturnDate+'T12:00:00')
  const act = new Date(compareDate+'T12:00:00')
  return Math.max(0, Math.round((act-exp)/86400000))
}

// ── Depreciation ──────────────────────────────────────────────────────────────
export const getDepreciation = (item, rentals) => {
  const useCount = rentals.filter(r =>
    r.status !== 'cancelada' &&
    (r.items||[]).some(it => it.itemId===item.id)
  ).length
  const expectedUses    = Number(item.expectedUses)    || 100
  const replacementCost = Number(item.replacementCost) || 0
  const costPerUse      = replacementCost / expectedUses
  const accumulated     = useCount * costPerUse
  const remaining       = Math.max(0, expectedUses - useCount)
  const pct             = Math.min(100, Math.round((useCount/expectedUses)*100))
  return { useCount, costPerUse, accumulated, remaining, pct, replacementCost, expectedUses }
}

// ── Period filter ─────────────────────────────────────────────────────────────
export const filterByPeriod = (rentals, period) => {
  const now   = new Date()
  const today = now.toISOString().slice(0,10)
  return rentals.filter(r => {
    if (!r.rentalDate) return period==='all'
    const d = new Date(r.rentalDate+'T12:00:00')
    if (period==='day')   return r.rentalDate===today
    if (period==='week')  { const w=new Date(now); w.setDate(now.getDate()-7); return d>=w }
    if (period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    return true
  })
}

// ── Admin PIN (localStorage) ──────────────────────────────────────────────────
const PIN_KEY = 'acervo_admin_pin'
export const getPin      = ()      => localStorage.getItem(PIN_KEY) || '1234'
export const setPin      = (pin)   => localStorage.setItem(PIN_KEY, pin)
export const checkPin    = (pin)   => pin === getPin()

// ── Shared CSS ────────────────────────────────────────────────────────────────
export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0f0e17; }
  ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:#1a1929;} ::-webkit-scrollbar-thumb{background:#d4a843;border-radius:3px;}
  input:not([type="checkbox"]), select, textarea { background:#1a1929; border:1px solid #2e2b4a; color:#e8dfc8; border-radius:6px; padding:8px 12px; width:100%; font-family:inherit; font-size:14px; outline:none; transition:border-color .2s; }
  input:not([type="checkbox"]):focus, select:focus, textarea:focus { border-color:#d4a843; }
  input[type="checkbox"] { width:18px; height:18px; cursor:pointer; accent-color:#d4a843; }
  select option { background:#1a1929; }
  label { display:block; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#8a7a9a; margin-bottom:4px; font-weight:600; }
  .btn { cursor:pointer; border:none; border-radius:6px; padding:9px 18px; font-family:inherit; font-weight:600; font-size:13px; transition:all .2s; display:inline-flex; align-items:center; gap:6px; }
  .btn-gold   { background:linear-gradient(135deg,#d4a843,#b8860b); color:#0f0e17; } .btn-gold:hover   { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 4px 16px #d4a84340; }
  .btn-ghost  { background:transparent; border:1px solid #2e2b4a !important; color:#b0a8c0; } .btn-ghost:hover  { border-color:#d4a843 !important; color:#d4a843; }
  .btn-danger { background:#3d1c1c; color:#e05c5c; border:1px solid #5a2222 !important; } .btn-danger:hover { background:#5a2222; }
  .btn-green  { background:linear-gradient(135deg,#2d6a4f,#1b4332); color:#d8f3dc; border:none; } .btn-green:hover  { filter:brightness(1.1); transform:translateY(-1px); }
  .btn-blue   { background:linear-gradient(135deg,#1e3a5f,#0d2440); color:#a8d4ff; border:1px solid #2e4a6a !important; } .btn-blue:hover   { filter:brightness(1.2); transform:translateY(-1px); }
  .btn-orange { background:linear-gradient(135deg,#7a3a00,#5a2a00); color:#ffb366; border:1px solid #8a4a00 !important; } .btn-orange:hover { filter:brightness(1.2); }
  .card { background:#16152a; border:1px solid #1e1d35; border-radius:12px; padding:20px; }
  .tag  { display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700; }
  .modal-overlay { position:fixed; inset:0; background:#000000bb; z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; }
  .modal { background:#16152a; border:1px solid #2e2b4a; border-radius:16px; width:100%; max-width:660px; max-height:92vh; overflow-y:auto; padding:28px; }
  .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .sec-label { font-size:11px; color:#d4a843; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; margin:18px 0 10px; border-left:3px solid #d4a843; padding-left:8px; }
  .progress-bar { height:6px; border-radius:3px; background:#1e1d35; overflow:hidden; }
  .progress-fill { height:100%; border-radius:3px; transition:width .3s; }
  @media (max-width:600px) { .form-grid { grid-template-columns:1fr; } }
`
