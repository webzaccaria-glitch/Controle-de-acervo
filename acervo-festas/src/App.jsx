import { useState, useEffect, useRef } from 'react'

// ── Google OAuth ──────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '239442392621-adsev5o9nhsd7u0g652s2tagirlvlddb.apps.googleusercontent.com'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events'
const FOLDER_NAME = 'Acervo de Festas'
const SESSION_KEY = 'acervo_session_v2'


// ── Verificação de Acesso via Google Sheets ───────────────────────────────────
const verificarAcesso = async (email) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/gviz/tq?tqx=out:csv&sheet=P%C3%A1gina1`
    const res = await fetch(url)
    const text = await res.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return false
    const headers = lines[0].split(',').map(c => c.replace(/^"|"$/g, '').trim().toLowerCase())
    const iEmail = headers.indexOf('email')
    const iStatus = headers.indexOf('status')
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim().toLowerCase())
      if (cols[iEmail] === email.toLowerCase()) return cols[iStatus] === 'ativo'
    }
    return false
  } catch (e) {
    console.error('Erro verificarAcesso:', e)
    return false
  }
}

// ── Tela Acesso Negado ─────────────────────────────────────────────────────────
function AcessoNegado({userEmail, onLogout}) {
  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at top,#1a0a0a,#0f0e17)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:480,textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:16}}>🔒</div>
        <div style={{fontFamily:'serif',fontSize:28,color:'#e8dfc8',marginBottom:8}}>Acesso Não Autorizado</div>
        <div style={{fontSize:14,color:'#6a6080',marginBottom:32,lineHeight:1.8}}>
          O email <strong style={{color:'#e05c5c'}}>{userEmail}</strong> não está na lista de usuários autorizados.<br/>
          Adquira o sistema para liberar seu acesso.
        </div>
        <div style={{background:'#1a0d0d',border:'1px solid #5a2222',borderRadius:14,padding:24,marginBottom:24}}>
          <div style={{fontSize:13,color:'#c0a0a0',marginBottom:16}}>Fale conosco para adquirir o Controle de Acervo:</div>
          <a href="https://wa.me/5521977205575?text=Ol%C3%A1%21+Quero+adquirir+o+Controle+de+Acervo"
            target="_blank" rel="noopener noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:10,background:'linear-gradient(135deg,#25d366,#128c7e)',color:'#fff',padding:'13px 28px',borderRadius:10,fontWeight:700,fontSize:15,textDecoration:'none'}}>
            <span style={{fontSize:20}}>💬</span> Falar no WhatsApp
          </a>
        </div>
        <button onClick={onLogout} style={{background:'transparent',border:'1px solid #2e2b4a',borderRadius:8,color:'#6a6080',padding:'9px 20px',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
          ← Sair e trocar de conta
        </button>
      </div>
    </div>
  )
}

// ── Drive API helpers ─────────────────────────────────────────────────────────
const driveReq = async (url, opts={}, token) => {
  const res = await fetch(url, { ...opts, headers: { 'Authorization': `Bearer ${token}`, ...opts.headers } })
  if (res.status === 204) return null
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}
const findOrCreateFolder = async (token) => {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const res = await driveReq(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {}, token)
  if (res.files && res.files.length > 0) return res.files[0].id
  const created = await driveReq('https://www.googleapis.com/drive/v3/files', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name:FOLDER_NAME, mimeType:'application/vnd.google-apps.folder' })
  }, token)
  return created.id
}
const findOrCreateFile = async (token, folderId, filename, defaultContent) => {
  const q = encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`)
  const res = await driveReq(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {}, token)
  if (res.files && res.files.length > 0) return res.files[0].id
  const meta = { name:filename, parents:[folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], {type:'application/json'}))
  form.append('file', new Blob([JSON.stringify(defaultContent)], {type:'application/json'}))
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method:'POST', headers:{'Authorization':`Bearer ${token}`}, body:form
  }).then(r=>r.json())
  return r.id
}
const readFile = async (token, fileId) => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers:{'Authorization':`Bearer ${token}`}
  })
  try { return await res.json() } catch { return null }
}
const writeFile = async (token, fileId, content) => {
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method:'PATCH',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body: JSON.stringify(content)
  })
}
// ── Google Calendar helpers ───────────────────────────────────────────────────
const calReq = async (url, opts={}, token) => {
  const res = await fetch(url, { ...opts, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json', ...opts.headers } })
  if (res.status===204) return null
  const data = await res.json().catch(()=>null)
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data
}
const createCalEvent = async (token, event) => {
  const r = await calReq('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method:'POST', body:JSON.stringify(event)
  }, token)
  return r?.id || null
}
const updateCalEvent = async (token, eventId, event) => {
  if (!eventId) return createCalEvent(token, event)
  await calReq(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method:'PUT', body:JSON.stringify(event)
  }, token)
  return eventId
}
const deleteCalEvent = async (token, eventId) => {
  if (!eventId) return
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method:'DELETE', headers:{'Authorization':`Bearer ${token}`}
  })
}
const buildCalEvents = (rental, inventory) => {
  const items = (rental.items||[]).map(it=>{
    const inv = inventory.find(i=>i.id===it.itemId)
    return inv ? `• ${inv.name} ×${it.qty}` : ''
  }).filter(Boolean).join('\n')
  const desc = `Locatário: ${rental.tenantName}\nTelefone: ${rental.phone||'—'}\nEndereço: ${rental.address||'—'}\nTotal: ${Number(rental.totalOrder||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}\n\nItens:\n${items}`
  const events = []
  if (rental.rentalDate) {
    events.push({ type:'saida', body:{
      summary: `📦 Saída — ${rental.tenantName}`,
      description: desc,
      start:{ date: rental.rentalDate },
      end:  { date: rental.rentalDate },
      colorId: '5',
      reminders:{ useDefault:false, overrides:[] }
    }})
  }
  if (rental.expectedReturnDate) {
    events.push({ type:'retorno', body:{
      summary: `🔄 Retorno Previsto — ${rental.tenantName}`,
      description: desc,
      start:{ date: rental.expectedReturnDate },
      end:  { date: rental.expectedReturnDate },
      colorId: '11',
      reminders:{ useDefault:false, overrides:[{method:'popup',minutes:1440},{method:'email',minutes:1440}] }
    }})
  }
  return events
}


// ── Categories ────────────────────────────────────────────────────────────────
const DEFAULT_CATS = [
  { key:'tecidos',   label:'Tecidos',   icon:'🪢', bg:'#3a1060', accent:'#c084fc' },
  { key:'acrílicos', label:'Acrílicos', icon:'💎', bg:'#0f2a4a', accent:'#52d9f5' },
  { key:'metálicos', label:'Metálicos', icon:'⚙️', bg:'#1e2e4a', accent:'#93c5fd' },
  { key:'madeira',   label:'Madeira',   icon:'🪵', bg:'#5c3a1e', accent:'#d4a843' },
  { key:'louças',    label:'Louças Decorativas', icon:'🍽️', bg:'#4a1a2e', accent:'#f9a0c0' },
]
const COLOR_PRESETS = [
  {bg:'#3a1060',accent:'#c084fc',name:'Roxo'},
  {bg:'#0f2a4a',accent:'#52d9f5',name:'Azul'},
  {bg:'#1e2e4a',accent:'#93c5fd',name:'Marinho'},
  {bg:'#5c3a1e',accent:'#d4a843',name:'Dourado'},
  {bg:'#4a1a2e',accent:'#f9a0c0',name:'Rosa'},
  {bg:'#1a3a2e',accent:'#6ee76e',name:'Verde'},
  {bg:'#3a1a1a',accent:'#f87171',name:'Vermelho'},
  {bg:'#2a2a1a',accent:'#fbbf24',name:'Âmbar'},
  {bg:'#1a283a',accent:'#7dd3fc',name:'Céu'},
  {bg:'#2a1a3a',accent:'#a78bfa',name:'Lavanda'},
]
const EMPTY_SUBCATS = { tecidos:[], 'acrílicos':[], metálicos:[], madeira:[], 'louças':[] }

// Migrate old material field to new mainCategory
const migrateItem = (item) => {
  if (item.mainCategory) return item
  const map = { madeira:'madeira', ferro:'metálicos', 'acrílico':'acrílicos' }
  return { ...item, mainCategory: map[item.material] || 'madeira', subCategory: item.subCategory || item.category || '' }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid         = () => Math.random().toString(36).slice(2,10)
const R$          = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const fmtDate     = (d) => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—'
const calcTotal   = (items) => (items||[]).reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||0),0)
const calcDebito  = (r) => Math.max(0, calcTotal(r.items)-Number(r.amountPaid||0))
const calcOverdue = (r) => {
  if (!r.expectedReturnDate||!Number(r.dailyRate)) return 0
  const today=new Date().toISOString().slice(0,10)
  const cmp=r.actualReturnDate||(r.status==='ativa'?today:null)
  if (!cmp) return 0
  const days=Math.max(0,Math.round((new Date(cmp+'T12:00:00')-new Date(r.expectedReturnDate+'T12:00:00'))/86400000))
  return days*Number(r.dailyRate||0)
}
const calcOverdueDays = (r) => {
  if (!r.expectedReturnDate) return 0
  const today=new Date().toISOString().slice(0,10)
  const cmp=r.actualReturnDate||(r.status==='ativa'?today:null)
  if (!cmp) return 0
  return Math.max(0,Math.round((new Date(cmp+'T12:00:00')-new Date(r.expectedReturnDate+'T12:00:00'))/86400000))
}
const getDepreciation = (item,rentals) => {
  const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(it=>it.itemId===item.id)).length
  const eu=Number(item.expectedUses)||100, rc=Number(item.replacementCost)||0
  return {useCount,costPerUse:rc/eu,accumulated:useCount*(rc/eu),remaining:Math.max(0,eu-useCount),pct:Math.min(100,Math.round((useCount/eu)*100)),replacementCost:rc,expectedUses:eu}
}
const filterByPeriod = (rentals,period) => {
  const now=new Date(), today=now.toISOString().slice(0,10)
  return rentals.filter(r=>{
    if (!r.rentalDate) return period==='all'
    const d=new Date(r.rentalDate+'T12:00:00')
    if (period==='day') return r.rentalDate===today
    if (period==='week') { const w=new Date(now); w.setDate(now.getDate()-7); return d>=w }
    if (period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    return true
  })
}
const PIN_KEY  = 'acervo_admin_pin'
const getPin   = () => localStorage.getItem(PIN_KEY)||'1234'
const savePin  = (p) => localStorage.setItem(PIN_KEY,p)
const checkPin = (p) => p===getPin()

// ── Print ─────────────────────────────────────────────────────────────────────
function printChecklist(rental,inventory,cats) {
  const useCats = cats||DEFAULT_CATS
  const saida=rental.items||[], total=calcTotal(saida), pago=Number(rental.amountPaid||0)
  const debito=Math.max(0,total-pago), overdue=calcOverdue(rental), overdueDays=calcOverdueDays(rental)
  const makeRows=(mode)=>saida.map(it=>{
    const inv=inventory.find(i=>i.id===it.itemId)
    const nome=inv?inv.name:'Item'
    const catLabel=inv?(useCats.find(c=>c.key===inv.mainCategory)||{label:inv.mainCategory||''}).label:''
    const sub=Number(it.unitPrice||0)*Number(it.qty||0)
    if (mode==='saida') return `<tr><td>${nome}</td><td>${catLabel}</td><td>${it.qty}</td><td style="text-align:right">${R$(it.unitPrice)}</td><td style="text-align:right;font-weight:600">${R$(sub)}</td><td class="cb"></td><td>&nbsp;</td></tr>`
    return `<tr><td>${nome}</td><td>${catLabel}</td><td>${it.qty}</td><td class="cb"></td><td>&nbsp;</td></tr>`
  }).join('')
  const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Checklist</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:sans-serif;color:#1a1a2e;padding:32px 40px;font-size:13px;}
.logo{text-align:center;margin-bottom:24px;border-bottom:3px double #b8860b;padding-bottom:16px;}.logo h1{font-size:28px;color:#b8860b;}
h2{font-size:15px;color:#1a1a2e;margin:18px 0 8px;border-left:4px solid #b8860b;padding-left:10px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}.field{background:#faf8f2;border:1px solid #e0d8c0;border-radius:4px;padding:6px 10px;}.field label{display:block;font-size:10px;text-transform:uppercase;color:#8a7a50;}.field span{font-weight:600;}
.fin{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:8px 0 18px;}.fc{border-radius:6px;padding:10px 14px;text-align:center;}.fc label{font-size:10px;text-transform:uppercase;color:#8a7a50;display:block;margin-bottom:4px;}.fc .v{font-size:16px;font-weight:700;}
.ft{background:#faf8f2;border:1px solid #e0d8c0;}.fp{background:#f0fff4;border:1px solid #b7e4c7;}.fp .v{color:#2d6a4f;}.fd{background:#fff5f5;border:1px solid #f5c0c0;}.fd .v{color:#c0392b;}.fq .v{color:#2d6a4f;}
table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px;}th{background:#1a1a2e;color:#f5e6c0;padding:7px 8px;text-align:left;font-weight:600;font-size:11px;}td{padding:6px 8px;border-bottom:1px solid #e8e0cc;}tr:nth-child(even) td{background:#faf8f2;}.cb{width:28px;text-align:center;}
.alert{border:2px solid #c0392b;border-radius:6px;padding:12px 16px;margin:18px 0;background:#fff5f5;}.alert strong{color:#c0392b;font-size:13px;display:block;margin-bottom:4px;}.alert p{font-size:12px;line-height:1.6;color:#3a1010;}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:32px;}.sig{border-top:1.5px solid #333;padding-top:8px;}.sig p{font-size:11px;color:#555;margin-top:2px;}.sig .nm{font-weight:600;}
.footer{text-align:center;margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #e0d8c0;padding-top:10px;}
@media print{body{padding:16px 20px;}}</style></head><body>
<div class="logo"><h1>✦ Controle de Locação ✦</h1><p style="font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase">Checklist de Saída &amp; Devolução</p></div>
<h2>Dados da Locação</h2>
<div class="grid2">
<div class="field"><label>Locatário</label><span>${rental.tenantName||'—'}</span></div>
<div class="field"><label>CPF</label><span>${rental.cpf||'—'}</span></div>
<div class="field"><label>Telefone</label><span>${rental.phone||'—'}</span></div>
<div class="field" style="grid-column:1/-1"><label>Endereço</label><span>${rental.address||'—'}</span></div>
<div class="field"><label>Data de Saída</label><span>${fmtDate(rental.rentalDate)}</span></div>
<div class="field"><label>Retorno Previsto</label><span>${fmtDate(rental.expectedReturnDate)}</span></div>
<div class="field"><label>Responsável pela Saída</label><span>${rental.exitBy||'—'}</span></div>
<div class="field"><label>Nº do Contrato</label><span>#${(rental.id||'').toUpperCase()}</span></div>
</div>
<h2>Resumo Financeiro</h2>
<div class="fin">
<div class="fc ft"><label>Total do Pedido</label><span class="v">${R$(total)}</span></div>
<div class="fc fp"><label>Valor Pago</label><span class="v">${R$(pago)}</span></div>
<div class="fc ${debito>0?'fd':'fq'}"><label>${debito>0?'⚠ Em Débito':'✓ Quitado'}</label><span class="v">${R$(debito)}</span></div>
</div>
${overdue>0?`<div style="border:2px solid #e07000;border-radius:6px;padding:10px 14px;margin-bottom:12px;background:#fff8f0"><strong style="color:#e07000">⚠ Atraso — ${overdueDays} dia(s): ${R$(overdue)}</strong></div>`:''}
<h2>Checklist de Saída</h2>
<table><thead><tr><th>Item</th><th>Categoria</th><th>Qtd</th><th>Vl. Unit.</th><th>Subtotal</th><th>✓</th><th>Observações</th></tr></thead><tbody>${makeRows('saida')}</tbody></table>
<h2>Checklist de Devolução</h2>
<table><thead><tr><th>Item</th><th>Categoria</th><th>Qtd Devolvida</th><th>✓</th><th>Estado / Avarias</th></tr></thead><tbody>${makeRows('retorno')}</tbody></table>
<div class="alert"><strong>⚠ Cláusula de Responsabilidade por Avaria</strong>
<p>Eu, <strong>${rental.tenantName||'Locatário'}</strong>, inscrito(a) no CPF sob o nº <strong>${rental.cpf||'___.___.___-__'}</strong>, residente em <strong>${rental.address||'—'}</strong>, telefone <strong>${rental.phone||'—'}</strong>, declaro ter recebido os materiais listados em perfeito estado e assumo total responsabilidade pela guarda e devolução no prazo.<br/><br/>
<strong>I — Responsabilidade por Avaria:</strong> Em caso de avaria, dano, quebra ou perda das peças locadas, o locatário obriga-se a pagar <strong>100% do valor do item novo</strong>, devendo ser quitado <strong>no ato da entrega do material</strong> danificado, independente de qualquer negociação posterior.<br/><br/>
<strong>II — Multa por Atraso:</strong> O não cumprimento do prazo implica cobrança de <strong style="color:#c0392b">${R$(rental.dailyRate||50)} por dia de atraso</strong>, contados a partir da data de retorno prevista até a efetiva devolução.<br/><br/>
<strong>III — Proteção ao Crédito:</strong> Em caso de não pagamento dos valores devidos, o locatário CPF <strong>${rental.cpf||'___.___.___-__'}</strong> terá seu nome incluído nos cadastros de inadimplentes do <strong>SPC e SERASA</strong>, podendo ainda ser acionado judicialmente com cobrança de juros, multa e honorários advocatícios, conforme o Código Civil Brasileiro.</p></div>
<div style="border:2px solid #e07000;border-radius:6px;padding:14px 16px;margin-bottom:18px;background:#fff8f0">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div>
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a5000;display:block;margin-bottom:4px">Multa por Dia de Atraso</span>
      <span style="font-size:28px;font-weight:700;color:#c07000">${R$(rental.dailyRate||50)}<span style="font-size:13px;font-weight:400;color:#8a5000">/dia</span></span>
    </div>
    <div style="background:#c05030;color:#fff;border-radius:6px;padding:8px 14px;font-size:11px;font-weight:700;text-align:center;line-height:1.4">
      ⚠ INADIMPLÊNCIA<br/>SPC &amp; SERASA
    </div>
  </div>
</div>
<div class="sigs">
<div class="sig"><br/><br/><br/><p>Assinatura do Locatário</p><p class="nm">${rental.tenantName||''}</p><p>Data: _____ / _____ / ________</p></div>
<div class="sig"><br/><br/><br/><p>Responsável pela Entrega / Devolução</p><p class="nm">${rental.exitBy||''}</p><p>Data: _____ / _____ / ________</p></div>
</div>
<div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} · Documento com validade de contrato mediante assinatura.</div>
</body></html>`
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600)
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;} body{margin:0;background:#0f0e17;}
::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:#1a1929;} ::-webkit-scrollbar-thumb{background:#d4a843;border-radius:3px;}
input:not([type="checkbox"]),select,textarea{background:#1a1929;border:1px solid #2e2b4a;color:#e8dfc8;border-radius:6px;padding:8px 12px;width:100%;font-family:inherit;font-size:14px;outline:none;transition:border-color .2s;}
input:not([type="checkbox"]):focus,select:focus,textarea:focus{border-color:#d4a843;}
input[type="checkbox"]{width:18px;height:18px;cursor:pointer;accent-color:#d4a843;} select option{background:#1a1929;}
label{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#8a7a9a;margin-bottom:4px;font-weight:600;}
.btn{cursor:pointer;border:none;border-radius:6px;padding:9px 18px;font-family:inherit;font-weight:600;font-size:13px;transition:all .2s;display:inline-flex;align-items:center;gap:6px;}
.btn-gold{background:linear-gradient(135deg,#d4a843,#b8860b);color:#0f0e17;} .btn-gold:hover{filter:brightness(1.1);transform:translateY(-1px);}
.btn-ghost{background:transparent;border:1px solid #2e2b4a!important;color:#b0a8c0;} .btn-ghost:hover{border-color:#d4a843!important;color:#d4a843;}
.btn-danger{background:#3d1c1c;color:#e05c5c;border:1px solid #5a2222!important;} .btn-danger:hover{background:#5a2222;}
.btn-green{background:linear-gradient(135deg,#2d6a4f,#1b4332);color:#d8f3dc;border:none;} .btn-green:hover{filter:brightness(1.1);transform:translateY(-1px);}
.btn-blue{background:linear-gradient(135deg,#1e3a5f,#0d2440);color:#a8d4ff;border:1px solid #2e4a6a!important;} .btn-blue:hover{filter:brightness(1.2);transform:translateY(-1px);}
.btn-orange{background:linear-gradient(135deg,#7a3a00,#5a2a00);color:#ffb366;border:1px solid #8a4a00!important;}
.card{background:#16152a;border:1px solid #1e1d35;border-radius:12px;padding:20px;}
.tag{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.modal-overlay{position:fixed;inset:0;background:#000000bb;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:#16152a;border:1px solid #2e2b4a;border-radius:16px;width:100%;max-width:660px;max-height:92vh;overflow-y:auto;padding:28px;}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.sec-label{font-size:11px;color:#d4a843;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:18px 0 10px;border-left:3px solid #d4a843;padding-left:8px;}
.progress-bar{height:6px;border-radius:3px;background:#1e1d35;overflow:hidden;}
.progress-fill{height:100%;border-radius:3px;transition:width .3s;}
.sub-tab-bar{display:flex;gap:6px;margin-bottom:24px;background:#0f0e17;border:1px solid #2e2b4a;border-radius:10px;padding:6px;}
.sub-tab{flex:1;cursor:pointer;border:none;border-radius:7px;padding:10px 16px;font-family:inherit;font-weight:600;font-size:13px;transition:all .2s;text-align:center;}
.sub-tab-active{background:linear-gradient(135deg,#d4a843,#b8860b);color:#0f0e17;}
.sub-tab-inactive{background:transparent;color:#6a6080;}
.sub-tab-inactive:hover{background:#1e1d35;color:#b0a8c0;}
.cat-section{border-radius:14px;overflow:hidden;margin-bottom:14px;}
.cat-header{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;transition:filter .2s;}
.cat-header:hover{filter:brightness(1.08);}
.cat-body{background:#0f0e17;border:1px solid #2e2b4a;border-top:none;border-radius:0 0 14px 14px;padding:14px;}
.subcat-group{margin-bottom:12px;}
.subcat-header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#16152a;border:1px solid #2e2b4a;border-radius:8px;margin-bottom:6px;}
.item-row{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#16152a;border:1px solid #1e1d35;border-radius:8px;margin-bottom:6px;transition:border-color .2s;}
.item-row:hover{border-color:#3a3060;}
@media(max-width:600px){.form-grid{grid-template-columns:1fr;}}
`

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({onLogin,loading,loadingMsg}) {
  return(
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at top,#1a1040 0%,#0f0e17 60%)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:440,textAlign:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:64,color:'#d4a843',lineHeight:1,marginBottom:8,textShadow:'0 0 40px #d4a84360'}}>✦</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:'#e8dfc8',marginBottom:6}}>Acervo de Festas</div>
        <div style={{fontSize:13,color:'#6a6080',letterSpacing:2,textTransform:'uppercase',marginBottom:48}}>Controle de Estoque & Locação</div>
        <div style={{background:'#16152a',border:'1px solid #2e2b4a',borderRadius:20,padding:'36px 32px',boxShadow:'0 24px 60px #00000080'}}>
          {loading?(
            <div style={{padding:'24px 0'}}>
              <div style={{fontSize:32,marginBottom:16}}>⏳</div>
              <div style={{color:'#d4a843',fontSize:15,fontWeight:600,marginBottom:8}}>{loadingMsg||'Conectando…'}</div>
              <div style={{fontSize:12,color:'#4a4060'}}>Aguarde um momento</div>
            </div>
          ):(
            <>
              <div style={{fontSize:15,color:'#8a7a9a',marginBottom:28,lineHeight:1.7}}>
                Faça login com sua conta Google para acessar seu acervo.<br/>
                <span style={{fontSize:12,color:'#4a4060'}}>Seus dados ficam salvos no seu Google Drive.</span>
              </div>
              <button onClick={onLogin}
                style={{width:'100%',padding:'14px 20px',background:'#fff',border:'none',borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:12,fontSize:15,fontWeight:600,color:'#1a1a2e',transition:'all .2s',boxShadow:'0 4px 16px #00000040'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f0f0f0'}
                onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7l-6.5 5C9.8 39.8 16.5 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6l6.2 5.2C41 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
                </svg>
                Entrar com Google
              </button>
              <div style={{marginTop:20,fontSize:11,color:'#3a3050',lineHeight:1.6}}>🔒 O app acessa apenas arquivos que ele mesmo criar no seu Drive.</div>
            </>
          )}
        </div>
        <div style={{marginTop:24,fontSize:11,color:'#3a2a5a'}}>✦ Acervo de Festas · Todos os direitos reservados</div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]               = useState(null)
  const [token,setToken]             = useState(null)
  const [driveIds,setDriveIds]       = useState(null)
  const [inventory,setInventory]     = useState([])
  const [rentals,setRentals]         = useState([])
  const [subcategories,setSubcats]   = useState(EMPTY_SUBCATS)
  const [categories,setCategories]     = useState(DEFAULT_CATS)
  const [loading,setLoading]         = useState(false)
  const [loadingMsg,setLoadingMsg]   = useState('')
  const [tab,setTab]                 = useState('rentals')
  const [adminUnlocked,setAdminUnlocked] = useState(false)
  const [adminSub,setAdminSub]       = useState('inventory')
  const [saving,setSavingStatus]     = useState(false)
  const [calStatus,setCalStatus]       = useState('') // '', 'syncing', 'ok', 'error'
  const [authReady,setAuthReady]     = useState(false)
  const [acessoNegado,setAcessoNegado] = useState(false)
  const tokenClientRef               = useRef(null)

  // ── Load Google GSI and handle auto-login ──
  useEffect(()=>{
    // Check for saved session
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const sess = JSON.parse(saved)
        if (sess.user) {
          setUser(sess.user)
          setLoading(true)
          setLoadingMsg('Restaurando sua sessão…')
        }
      } catch {}
    }

    if (document.getElementById('gsi-script')) { setAuthReady(true); return }
    const s = document.createElement('script')
    s.id = 'gsi-script'
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => setAuthReady(true)
    document.head.appendChild(s)
  },[])

  // ── Once GSI is ready, setup token client ──
  useEffect(()=>{
    if (!authReady) return
    const hasSaved = !!localStorage.getItem(SESSION_KEY)
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      prompt: hasSaved ? '' : 'select_account',
      callback: handleTokenResponse,
      error_callback: (err) => {
        console.error('Token error:', err)
        localStorage.removeItem(SESSION_KEY)
        setUser(null); setLoading(false)
      }
    })
    // Auto-login if session saved
    if (hasSaved) {
      tokenClientRef.current.requestAccessToken({ prompt: '' })
    }
  },[authReady])

  const handleTokenResponse = async (response) => {
    if (response.error) {
      localStorage.removeItem(SESSION_KEY)
      setUser(null); setLoading(false); return
    }
    const tk = response.access_token
    setToken(tk)
    setLoading(true)
    try {
      setLoadingMsg('Verificando conta…')
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{
        headers:{'Authorization':`Bearer ${tk}`}
      }).then(r=>r.json())
      setUser(userInfo)

      // ── Verificar autorização na planilha ──
      setLoadingMsg('Verificando autorização de acesso…')
      const autorizado = await verificarAcesso(userInfo.email)
      if (!autorizado) {
        setLoading(false)
        setAcessoNegado(true)
        localStorage.removeItem(SESSION_KEY)
        return
      }

      // Save session to localStorage for persistence
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user:userInfo, ts:Date.now() }))

      setLoadingMsg('Conectando ao Google Drive…')
      const folderId = await findOrCreateFolder(tk)

      setLoadingMsg('Preparando arquivos…')
      const [invId,rentId,subcatId,catsId] = await Promise.all([
        findOrCreateFile(tk,folderId,'inventory.json',[]),
        findOrCreateFile(tk,folderId,'rentals.json',[]),
        findOrCreateFile(tk,folderId,'subcategories.json',EMPTY_SUBCATS),
        findOrCreateFile(tk,folderId,'categories.json',DEFAULT_CATS),
      ])
      setDriveIds({folder:folderId,inventory:invId,rentals:rentId,subcategories:subcatId,categories:catsId})

      setLoadingMsg('Carregando seus dados…')
      const [inv,rent,subcats,catsData] = await Promise.all([
        readFile(tk,invId),
        readFile(tk,rentId),
        readFile(tk,subcatId),
        readFile(tk,catsId),
      ])
      setInventory((Array.isArray(inv)?inv:[]).map(migrateItem))
      setRentals(Array.isArray(rent)?rent:[])
      setSubcats(subcats&&typeof subcats==='object'?subcats:EMPTY_SUBCATS)
      setCategories(Array.isArray(catsData)&&catsData.length>0?catsData:DEFAULT_CATS)
    } catch(e) {
      console.error('Init error:',e)
      alert('Erro ao conectar ao Google Drive. Tente novamente.')
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
    }
    setLoading(false)
  }

  const login = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        prompt: 'select_account',
        callback: handleTokenResponse,
        error_callback: (err) => { localStorage.removeItem(SESSION_KEY); setUser(null); setLoading(false) }
      })
      tokenClientRef.current.requestAccessToken()
    }
  }

  const logout = () => {
    if (token) window.google?.accounts.oauth2.revoke(token,()=>{})
    localStorage.removeItem(SESSION_KEY)
    setUser(null); setToken(null); setDriveIds(null)
    setInventory([]); setRentals([]); setSubcats(EMPTY_SUBCATS); setAdminUnlocked(false); setAcessoNegado(false)
  }

  // ── Drive save helpers ──
  const saveDrive = async (key,data) => {
    if (!token||!driveIds) return
    setSavingStatus(true)
    try { await writeFile(token,driveIds[key],data) } catch(e){ console.error('Save error:',e) }
    setSavingStatus(false)
  }

  // ── Inventory CRUD ──
  const addInventory    = async(i)  => { const d=[i,...inventory];           setInventory(d); await saveDrive('inventory',d) }
  const updateInventory = async(i)  => { const d=inventory.map(x=>x.id===i.id?i:x); setInventory(d); await saveDrive('inventory',d) }
  const deleteInventory = async(id) => { const d=inventory.filter(x=>x.id!==id);    setInventory(d); await saveDrive('inventory',d) }

  // ── Sub-categories CRUD ──
  const addSubcat = async(cat,name) => {
    if (!name.trim()) return
    const d={...subcategories,[cat]:[...(subcategories[cat]||[]),name.trim()]}
    setSubcats(d); await saveDrive('subcategories',d)
  }
  const deleteSubcat = async(cat,name) => {
    const d={...subcategories,[cat]:(subcategories[cat]||[]).filter(s=>s!==name)}
    // Remove sub-category from items too
    const newInv=inventory.map(i=>i.mainCategory===cat&&i.subCategory===name?{...i,subCategory:''}:i)
    setSubcats(d); setInventory(newInv)
    await Promise.all([saveDrive('subcategories',d),saveDrive('inventory',newInv)])
  }

  // ── Rentals CRUD ──
  const addRental = async(r) => {
    let nr = {...r}
    if (token) {
      try {
        const evts = buildCalEvents(r, inventory)
        for (const e of evts) {
          const eid = await createCalEvent(token, e.body)
          if (e.type==='saida')   nr.calEventSaidaId   = eid
          if (e.type==='retorno') nr.calEventRetornoId = eid
        }
      } catch(e){ console.error('Cal sync failed:',e); setSavingStatus(false) }
    }
    const d=[nr,...rentals]; setRentals(d); await saveDrive('rentals',d)
  }
  const updateRental = async(r) => {
    let nr = {...r}
    if (token) {
      try {
        const evts = buildCalEvents(r, inventory)
        for (const e of evts) {
          if (e.type==='saida')   nr.calEventSaidaId   = await updateCalEvent(token, r.calEventSaidaId,   e.body)
          if (e.type==='retorno') nr.calEventRetornoId = await updateCalEvent(token, r.calEventRetornoId, e.body)
        }
      } catch(e){ console.error('Cal sync failed:',e); setSavingStatus(false) }
    }
    const d=rentals.map(x=>x.id===r.id?nr:x); setRentals(d); await saveDrive('rentals',d)
  }
  const deleteRental = async(id) => {
    const r = rentals.find(x=>x.id===id)
    if (r && token) {
      try {
        await Promise.all([
          deleteCalEvent(token, r.calEventSaidaId),
          deleteCalEvent(token, r.calEventRetornoId),
        ])
      } catch(e){ console.warn('Cal delete failed:',e) }
    }
    const d=rentals.filter(x=>x.id!==id); setRentals(d); await saveDrive('rentals',d)
  }
  const updateStatus = async(id,st) => { const d=rentals.map(r=>r.id===id?{...r,status:st}:r); setRentals(d); await saveDrive('rentals',d) }

  // ── Category CRUD ──
  const addCategory = async(cat) => {
    const d=[...categories,cat]; setCategories(d); await saveDrive('categories',d)
  }
  const updateCategory = async(cat) => {
    const d=categories.map(c=>c.key===cat.key?cat:c); setCategories(d); await saveDrive('categories',d)
  }
  const deleteCategory = async(key) => {
    if(inventory.some(i=>i.mainCategory===key)){alert('Não é possível excluir: existem itens nesta categoria.');return}
    const d=categories.filter(c=>c.key!==key); setCategories(d); await saveDrive('categories',d)
  }

  // Acesso negado
  if (acessoNegado && user) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');*{box-sizing:border-box;}body{margin:0;}`}</style>
        <AcessoNegado userEmail={user.email} onLogout={logout}/>
      </>
    )
  }

  // Show login screen
  if (!user||!driveIds) {
    return(
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600;700&display=swap');*{box-sizing:border-box;}body{margin:0;}`}</style>
        <LoginScreen onLogin={login} loading={loading} loadingMsg={loadingMsg}/>
      </>
    )
  }

  return(
    <div style={{minHeight:'100vh',background:'#0f0e17',fontFamily:"'Source Sans 3', sans-serif"}}>
      <style>{STYLES}</style>
      <div style={{background:'linear-gradient(135deg,#1a1929,#0f0e17)',borderBottom:'1px solid #2e2b4a',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display', serif",fontSize:20,color:'#d4a843',lineHeight:1}}>✦ Acervo de Festas</div>
          <div style={{fontSize:9,color:'#6a6080',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>Controle de Estoque & Locação</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {saving&&<span style={{fontSize:11,color:'#6a6080'}}>💾 Salvando…</span>}
          {calStatus==='syncing'&&<span style={{fontSize:11,color:'#6aa8ff',background:'#0a1a3a',border:'1px solid #1a3a6a',borderRadius:20,padding:'2px 10px'}}>📅 Sincronizando agenda…</span>}
          {calStatus==='ok'&&<span style={{fontSize:11,color:'#6ee76e',background:'#0a1a0a',border:'1px solid #1a4a1a',borderRadius:20,padding:'2px 10px'}}>📅 Agenda atualizada ✓</span>}
          {calStatus.startsWith('error')&&<span style={{fontSize:11,color:'#e05c5c',background:'#1a0a0a',border:'1px solid #4a1a1a',borderRadius:20,padding:'2px 10px'}} title={calStatus}>📅 ⚠ Agenda: erro — veja console</span>}
          <button className="btn" onClick={()=>setTab('rentals')}
            style={{background:tab==='rentals'?'linear-gradient(135deg,#d4a843,#b8860b)':'transparent',color:tab==='rentals'?'#0f0e17':'#8a7a9a',border:tab==='rentals'?'none':'1px solid #2e2b4a',fontWeight:700,fontSize:12,padding:'7px 14px'}}>
            🎪 Locações
          </button>
          <button className="btn" onClick={()=>setTab('admin')}
            style={{background:tab==='admin'?'linear-gradient(135deg,#5a3a8a,#3a1a6a)':'transparent',color:tab==='admin'?'#e8d4ff':'#8a7a9a',border:tab==='admin'?'1px solid #7a4aaa':'1px solid #2e2b4a',fontWeight:700,fontSize:12,padding:'7px 14px'}}>
            {adminUnlocked?'🔓':'🔐'} Administrativo
          </button>
          {adminUnlocked&&tab==='admin'&&(
            <button className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px'}} onClick={()=>setAdminUnlocked(false)}>🔒</button>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#1a1929',border:'1px solid #2e2b4a',borderRadius:20,padding:'5px 12px 5px 8px',marginLeft:4}}>
            {user.picture&&<img src={user.picture} style={{width:24,height:24,borderRadius:'50%'}} referrerPolicy="no-referrer"/>}
            <span style={{fontSize:12,color:'#8a7a9a',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.given_name||user.name}</span>
            <button onClick={logout} style={{background:'none',border:'none',color:'#4a4060',cursor:'pointer',fontSize:11,padding:0}} title="Sair">✕</button>
          </div>
        </div>
      </div>
      <div style={{padding:'20px',maxWidth:1100,margin:'0 auto'}}>
        {tab==='rentals'&&<RentalsTab rentals={rentals} inventory={inventory} subcategories={subcategories} categories={categories} onAdd={addRental} onUpdate={updateRental} onDelete={deleteRental} onStatusChange={updateStatus}/>}
        {tab==='admin'&&(
          adminUnlocked?(
            <div>
              <div className="sub-tab-bar">
                <button className={`sub-tab ${adminSub==='inventory'?'sub-tab-active':'sub-tab-inactive'}`} onClick={()=>setAdminSub('inventory')}>📦 Acervo</button>
                <button className={`sub-tab ${adminSub==='finance'?'sub-tab-active':'sub-tab-inactive'}`} onClick={()=>setAdminSub('finance')}>💰 Finanças</button>
              </div>
              {adminSub==='inventory'&&<InventoryTab inventory={inventory} rentals={rentals} subcategories={subcategories} categories={categories} onAdd={addInventory} onUpdate={updateInventory} onDelete={deleteInventory} onAddSubcat={addSubcat} onDeleteSubcat={deleteSubcat} onAddCat={addCategory} onUpdateCat={updateCategory} onDeleteCat={deleteCategory}/>}
              {adminSub==='finance'&&<FinanceTab rentals={rentals} inventory={inventory} categories={categories}/>}
            </div>
          ):(
            <AdminPinGate onUnlock={()=>setAdminUnlocked(true)}/>
          )
        )}
      </div>
    </div>
  )
}

// ── Admin PIN Gate ────────────────────────────────────────────────────────────
function AdminPinGate({onUnlock}) {
  const [pin,setPin]=useState(''), [error,setError]=useState('')
  const [changing,setChanging]=useState(false), [oldPin,setOldPin]=useState(''), [newPin,setNewPin]=useState(''), [confirm,setConfirm]=useState('')
  const handleEnter=()=>{ if(checkPin(pin)){onUnlock();setPin('');setError('')}else{setError('PIN incorreto.');setPin('')} }
  const handleChange=()=>{
    if(!checkPin(oldPin)){setError('PIN atual incorreto.');return}
    if(newPin.length<4){setError('Mínimo 4 dígitos.');return}
    if(newPin!==confirm){setError('PINs não coincidem.');return}
    savePin(newPin);setChanging(false);setOldPin('');setNewPin('');setConfirm('');setError('');alert('✅ PIN alterado!')
  }
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{width:'100%',maxWidth:420}}>
        <div style={{background:'linear-gradient(135deg,#1a1229,#0f0e17)',border:'1px solid #4a2a7a',borderRadius:20,padding:'40px 36px',textAlign:'center',boxShadow:'0 20px 60px #00000060'}}>
          <div style={{fontSize:52,marginBottom:16}}>🔐</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:'#c8a4ff',marginBottom:8}}>Área Administrativa</div>
          <div style={{fontSize:13,color:'#6a6080',marginBottom:32}}>Acesso restrito ao gerenciamento do acervo e finanças.</div>
          {!changing?(
            <>
              <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleEnter()} placeholder="••••" style={{textAlign:'center',letterSpacing:8,fontSize:22,padding:'12px',background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%',marginBottom:8}}/>
              {error&&<div style={{color:'#e05c5c',fontSize:13,marginBottom:12,background:'#2a0a0a',border:'1px solid #5a2222',borderRadius:6,padding:'8px 12px'}}>{error}</div>}
              <button onClick={handleEnter} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#7a4aaa,#5a2a8a)',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',marginBottom:12,fontFamily:'inherit'}}>Entrar</button>
              <button onClick={()=>{setChanging(true);setError('')}} style={{width:'100%',padding:'9px',background:'transparent',border:'1px solid #3a2a5a',borderRadius:8,color:'#8a7a9a',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>🔑 Alterar PIN</button>
              <div style={{fontSize:11,color:'#3a2a5a',marginTop:20}}>PIN padrão: <span style={{color:'#7a5a9a'}}>1234</span></div>
            </>
          ):(
            <>
              {[['PIN Atual',oldPin,setOldPin],['Novo PIN',newPin,setNewPin],['Confirmar',confirm,setConfirm]].map(([lbl,val,fn])=>(
                <div key={lbl} style={{marginBottom:10,textAlign:'left'}}>
                  <label style={{color:'#8a7a9a',display:'block',marginBottom:4}}>{lbl}</label>
                  <input type="password" inputMode="numeric" maxLength={8} value={val} onChange={e=>fn(e.target.value)} placeholder="••••" style={{textAlign:'center',letterSpacing:6,fontSize:18,background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%',padding:'10px'}}/>
                </div>
              ))}
              {error&&<div style={{color:'#e05c5c',fontSize:13,marginBottom:12,background:'#2a0a0a',border:'1px solid #5a2222',borderRadius:6,padding:'8px 12px'}}>{error}</div>}
              <button onClick={handleChange} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#7a4aaa,#5a2a8a)',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',marginBottom:10,fontFamily:'inherit'}}>💾 Salvar Novo PIN</button>
              <button onClick={()=>{setChanging(false);setError('');setOldPin('');setNewPin('');setConfirm('')}} style={{width:'100%',padding:'9px',background:'transparent',border:'1px solid #3a2a5a',borderRadius:8,color:'#8a7a9a',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Category Manager ─────────────────────────────────────────────────────────
function CategoryManager({categories,inventory,onAdd,onUpdate,onDelete,onClose}) {
  const useCats = categories||DEFAULT_CATS
  const [editing,setEditing]   = useState(null)  // cat object being edited
  const [adding,setAdding]     = useState(false)
  const blankCat = {key:'',label:'',icon:'🎁',...COLOR_PRESETS[0]}
  const [form,setForm]         = useState(blankCat)
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  const [saving,setSaving]     = useState(false)

  const openEdit = (cat) => { setForm({...cat}); setEditing(cat); setAdding(false) }
  const openAdd  = () => { setForm({...blankCat,key:'cat_'+Date.now()}); setEditing(null); setAdding(true) }
  const closeForm= () => { setEditing(null); setAdding(false) }

  const handleSave = async () => {
    if(!form.label.trim()) return alert('Informe o nome da categoria.')
    setSaving(true)
    if(editing) await onUpdate(form)
    else        await onAdd(form)
    setSaving(false); closeForm()
  }

  const handleDelete = async(key) => {
    const count = inventory.filter(i=>i.mainCategory===key).length
    if(count>0){alert(`Não é possível excluir: ${count} item(s) nesta categoria.`);return}
    if(window.confirm('Excluir esta categoria?')) await onDelete(key)
  }

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:'serif',fontSize:20,color:'#d4a843',marginBottom:4}}>⚙️ Gerenciar Categorias</div>
        <div style={{fontSize:12,color:'#6a6080',marginBottom:20}}>Crie, edite ou exclua categorias do acervo.</div>

        {/* Category list */}
        {!editing&&!adding&&(
          <>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {useCats.map(cat=>{
                const count=inventory.filter(i=>i.mainCategory===cat.key).length
                return(
                  <div key={cat.key} style={{display:'flex',alignItems:'center',gap:12,background:cat.bg,borderRadius:10,padding:'12px 16px',border:`1px solid ${cat.accent}30`}}>
                    <div style={{width:36,height:36,borderRadius:8,background:'#ffffff18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{cat.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:'#fff',fontSize:14}}>{cat.label}</div>
                      <div style={{fontSize:11,color:'#ffffff60'}}>{count} item(s) cadastrado(s)</div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px',background:'#ffffff18',border:'1px solid #ffffff25',color:'#fff'}} onClick={()=>openEdit(cat)}>✏️ Editar</button>
                      <button className="btn btn-danger" style={{fontSize:11,padding:'4px 8px'}} onClick={()=>handleDelete(cat.key)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button className="btn btn-gold" style={{width:'100%',justifyContent:'center'}} onClick={openAdd}>+ Nova Categoria</button>
          </>
        )}

        {/* Edit / Add form */}
        {(editing||adding)&&(
          <div>
            <div style={{fontFamily:'serif',fontSize:16,color:'#d4a843',marginBottom:14}}>{editing?'✏️ Editar Categoria':'✦ Nova Categoria'}</div>
            <div className="form-grid" style={{marginBottom:16}}>
              <div>
                <label>Nome da Categoria *</label>
                <input value={form.label} onChange={e=>setF('label',e.target.value)} placeholder="Ex: Iluminação, Mobília…"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label>Ícone da Categoria</label>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                  <div style={{width:52,height:52,background:form.bg,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,border:`1px solid ${form.accent}40`,flexShrink:0}}>{form.icon}</div>
                  <div style={{fontSize:12,color:'#6a6080'}}>Clique em um emoji abaixo para selecionar</div>
                </div>
                <div style={{background:'#0f0e17',border:'1px solid #2e2b4a',borderRadius:10,padding:'10px 12px',maxHeight:180,overflowY:'auto'}}>
                  {[
                    {group:'Decoração',emojis:['🎊','🎉','🎈','🎀','🎗️','✨','🌟','💫','🌸','🌺','🌻','🌹','🌿','🍃','🌾','🌴','🕯️','💡','🔦','🪔']},
                    {group:'Mobiliário',emojis:['🪑','🛋️','🪞','🚪','🪟','🛏️','🪴','🖼️','🪆','🧸']},
                    {group:'Mesa Posta',emojis:['🍽️','🥂','🍷','🫙','🥛','🍶','🫖','☕','🧃','🥄','🍴','🔪']},
                    {group:'Tecidos',emojis:['🪢','🧵','👗','🎀','🧶','🪡','👘','🥻']},
                    {group:'Materiais',emojis:['🪵','💎','⚙️','🔩','🔧','⚒️','🪛','🧱','🪨','🔮']},
                    {group:'Eventos',emojis:['🎭','🎪','🎨','🎬','🎤','🎵','🎶','🎺','🎸','🥁','🎻','🎹']},
                    {group:'Outros',emojis:['🎁','🏠','🌙','⭐','❤️','💛','💚','💙','💜','🤍','🖤','🤎']},
                  ].map(({group,emojis})=>(
                    <div key={group} style={{marginBottom:10}}>
                      <div style={{fontSize:9,color:'#4a4060',textTransform:'uppercase',letterSpacing:1.5,marginBottom:5,fontWeight:700}}>{group}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {emojis.map(e=>(
                          <button type="button" key={e} onClick={()=>setF('icon',e)}
                            style={{width:36,height:36,background:form.icon===e?form.bg:'#1a1929',border:`1px solid ${form.icon===e?form.accent:'#2e2b4a'}`,borderRadius:6,fontSize:18,cursor:'pointer',transition:'all .15s',display:'flex',alignItems:'center',justifyContent:'center'}}
                            title={e}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <label>Cor da Categoria</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginTop:8}}>
                {COLOR_PRESETS.map(p=>(
                  <button type="button" key={p.name} onClick={()=>setForm(f=>({...f,bg:p.bg,accent:p.accent}))}
                    style={{background:p.bg,borderRadius:8,padding:'10px 6px',textAlign:'center',cursor:'pointer',border:`2px solid ${form.bg===p.bg?p.accent:'transparent'}`,transition:'border-color .2s'}}>
                    <div style={{fontSize:16,marginBottom:2}}>●</div>
                    <div style={{fontSize:10,color:p.accent,fontWeight:700}}>{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
            {/* Preview */}
            <div style={{background:form.bg,borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:12,border:`1px solid ${form.accent}30`}}>
              <div style={{width:44,height:44,background:'#ffffff18',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>{form.icon}</div>
              <div>
                <div style={{fontWeight:700,color:'#fff',fontSize:16}}>{form.label||'Nome da categoria'}</div>
                <div style={{fontSize:12,color:'#ffffff60'}}>Prévia da categoria</div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={closeForm}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Salvando…':editing?'💾 Salvar':'✦ Criar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inventory Tab (drill-down navigation) ────────────────────────────────────
function InventoryTab({inventory,rentals,subcategories,categories,onAdd,onUpdate,onDelete,onAddSubcat,onDeleteSubcat,onAddCat,onUpdateCat,onDeleteCat}) {
  const useCats = categories||DEFAULT_CATS
  const [showCatManager,setShowCatManager] = useState(false)
  const [viewCat,setViewCat]   = useState(null)   // null = category grid
  const [viewSub,setViewSub]   = useState(null)   // null = sub list; '__none__' = items without sub
  const [showForm,setShowForm] = useState(false)
  const [editing,setEditing]   = useState(null)
  const [saving,setSaving]     = useState(false)
  const [subcatModal,setSubcatModal] = useState(null)
  const [subcatName,setSubcatName]   = useState('')
  const [search,setSearch]     = useState('')

  const blank={name:'',quantity:1,rentalPrice:'',painted:false,mainCategory:'madeira',subCategory:'',notes:'',replacementCost:'',expectedUses:100}
  const [form,setForm]=useState(blank)
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))

  const openNew=(cat='',sub='')=>{ setForm({...blank,mainCategory:cat||'madeira',subCategory:sub==='__none__'?'':sub||''}); setEditing(null); setShowForm(true) }
  const openEdit=(it)=>{ setForm({...it}); setEditing(it); setShowForm(true) }
  const close=()=>{ setShowForm(false); setEditing(null) }

  const handleSave=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    const item={...form,id:editing?editing.id:uid()}
    editing?await onUpdate(item):await onAdd(item)
    setSaving(false); close()
  }
  const handleDelete=async(id)=>{ if(window.confirm('Excluir este item?'))await onDelete(id) }
  const handleAddSubcat=async(cat)=>{
    if(!subcatName.trim())return
    await onAddSubcat(cat,subcatName.trim())
    setSubcatName(''); setSubcatModal(null)
  }

  const goBack=()=>{ if(viewSub!==null)setViewSub(null); else setViewCat(null); setSearch('') }
  const selectedCat = useCats.find(c=>c.key===viewCat)
  const totalItems  = inventory.reduce((a,i)=>a+Number(i.quantity||0),0)

  // ── LEVEL 0: Category grid ────────────────────────────────────────────────
  if (viewCat===null) return (
    <div>
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:28}}>
        {[['📦','Tipos',inventory.length],['🔢','Peças',totalItems],['🎨','Pintados',inventory.filter(i=>i.painted).length]].map(([ic,label,val])=>(
          <div key={label} className="card" style={{textAlign:'center',padding:'10px 8px'}}>
            <div style={{fontSize:18}}>{ic}</div>
            <div style={{fontSize:20,fontWeight:700,color:'#d4a843',fontFamily:'serif'}}>{val}</div>
            <div style={{fontSize:10,color:'#6a6080',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:'#d4a843'}}>Selecione uma categoria para gerenciar</div>
        <button className="btn btn-ghost" style={{fontSize:12,padding:'7px 14px'}} onClick={()=>setShowCatManager(true)}>⚙️ Gerenciar Categorias</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16}}>
        {useCats.map(cat=>{
          const count = inventory.filter(i=>i.mainCategory===cat.key).length
          const qty   = inventory.filter(i=>i.mainCategory===cat.key).reduce((a,i)=>a+Number(i.quantity||0),0)
          return(
            <div key={cat.key} onClick={()=>{setViewCat(cat.key);setViewSub(null)}}
              style={{background:cat.bg,borderRadius:16,padding:'28px 20px',cursor:'pointer',textAlign:'center',border:`1px solid ${cat.accent}40`,transition:'all .2s',boxShadow:'0 4px 20px #00000040'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow=`0 8px 30px ${cat.accent}30`}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 20px #00000040'}}>
              <div style={{fontSize:44,marginBottom:10}}>{cat.icon}</div>
              <div style={{fontSize:16,fontWeight:700,color:'#fff',letterSpacing:0.3}}>{cat.label}</div>
              <div style={{fontSize:12,color:`${cat.accent}cc`,marginTop:6}}>{count} tipo(s) · {qty} unidade(s)</div>
            </div>
          )
        })}
      </div>

      {/* Category manager modal */}
      {showCatManager&&<CategoryManager categories={useCats} inventory={inventory} onAdd={onAddCat} onUpdate={onUpdateCat} onDelete={onDeleteCat} onClose={()=>setShowCatManager(false)}/>}

      {/* Item form modal */}
      {showForm&&<ItemFormModal form={form} set={set} editing={editing} saving={saving} subcategories={subcategories} categories={useCats} onSave={handleSave} onClose={close}/>}
    </div>
  )

  const catItems  = inventory.filter(i=>i.mainCategory===viewCat)
  const catSubs   = subcategories[viewCat]||[]

  // ── LEVEL 1: Sub-categories for selected category ─────────────────────────
  if (viewSub===null) {
    const itemsWithoutSub = catItems.filter(i=>!i.subCategory||i.subCategory==='')
    return(
      <div>
        {/* Breadcrumb */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px'}} onClick={goBack}>← Categorias</button>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:22}}>{selectedCat?.icon}</span>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#d4a843'}}>{selectedCat?.label}</span>
            <span style={{fontSize:12,color:'#6a6080'}}>· {catItems.length} tipo(s)</span>
          </div>
        </div>
        {/* Actions */}
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
          <button className="btn btn-gold" style={{fontSize:12}} onClick={()=>openNew(viewCat,'')}>+ Item</button>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>{setSubcatModal(viewCat);setSubcatName('')}}>+ Sub-categoria</button>
        </div>

        {catSubs.length===0&&itemsWithoutSub.length===0?(
          <div className="card" style={{textAlign:'center',padding:40,color:'#4a4060'}}>
            <div style={{fontSize:36}}>{selectedCat?.icon}</div>
            <div style={{marginTop:8,fontFamily:'serif',fontSize:17}}>Nenhum item em {selectedCat?.label} ainda.</div>
            <button className="btn btn-gold" style={{marginTop:14,fontSize:12}} onClick={()=>openNew(viewCat,'')}>+ Adicionar primeiro item</button>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
            {/* Sub-category cards */}
            {catSubs.map(sub=>{
              const subItems=catItems.filter(i=>i.subCategory===sub)
              const subQty=subItems.reduce((a,i)=>a+Number(i.quantity||0),0)
              return(
                <div key={sub} onClick={()=>setViewSub(sub)}
                  style={{background:'#16152a',border:`1px solid ${selectedCat?.accent}30`,borderRadius:14,padding:'20px 16px',cursor:'pointer',transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=selectedCat?.accent;e.currentTarget.style.transform='translateY(-2px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=`${selectedCat?.accent}30`;e.currentTarget.style.transform='none'}}>
                  <div style={{fontSize:28,marginBottom:8}}>📂</div>
                  <div style={{fontWeight:700,color:'#e8dfc8',fontSize:15,marginBottom:4}}>{sub}</div>
                  <div style={{fontSize:12,color:'#6a6080'}}>{subItems.length} item(s) · {subQty} unid.</div>
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:10,gap:6}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-ghost" style={{fontSize:10,padding:'3px 8px'}} onClick={()=>openNew(viewCat,sub)}>+ Item</button>
                    <button className="btn btn-danger" style={{fontSize:10,padding:'3px 6px'}} onClick={()=>window.confirm(`Excluir sub-categoria "${sub}"?`)&&onDeleteSubcat(viewCat,sub)}>🗑</button>
                  </div>
                </div>
              )
            })}
            {/* "Sem sub-categoria" card */}
            {itemsWithoutSub.length>0&&(
              <div onClick={()=>setViewSub('__none__')}
                style={{background:'#16152a',border:'1px solid #2e2b4a',borderRadius:14,padding:'20px 16px',cursor:'pointer',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#6a6080';e.currentTarget.style.transform='translateY(-2px)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#2e2b4a';e.currentTarget.style.transform='none'}}>
                <div style={{fontSize:28,marginBottom:8}}>📋</div>
                <div style={{fontWeight:700,color:'#8a7a9a',fontSize:15,marginBottom:4}}>Sem sub-categoria</div>
                <div style={{fontSize:12,color:'#6a6080'}}>{itemsWithoutSub.length} item(s) · {itemsWithoutSub.reduce((a,i)=>a+Number(i.quantity||0),0)} unid.</div>
              </div>
            )}
          </div>
        )}

        {/* Sub-category modal */}
        {subcatModal&&(
          <div className="modal-overlay" onClick={()=>setSubcatModal(null)}>
            <div style={{background:'#16152a',border:'1px solid #2e2b4a',borderRadius:16,padding:28,width:'100%',maxWidth:380}} onClick={e=>e.stopPropagation()}>
              <div style={{fontFamily:'serif',fontSize:18,color:'#d4a843',marginBottom:16}}>+ Nova Sub-categoria em {selectedCat?.label}</div>
              <label>Nome da Sub-categoria</label>
              <input value={subcatName} onChange={e=>setSubcatName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddSubcat(subcatModal)} placeholder="Ex: Voal, Mesa Rústica…" style={{marginBottom:16}}/>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button className="btn btn-ghost" onClick={()=>setSubcatModal(null)}>Cancelar</button>
                <button className="btn btn-gold" onClick={()=>handleAddSubcat(subcatModal)}>✦ Criar</button>
              </div>
            </div>
          </div>
        )}
        {showForm&&<ItemFormModal form={form} set={set} editing={editing} saving={saving} subcategories={subcategories} categories={useCats} onSave={handleSave} onClose={close}/>}
      </div>
    )
  }

  // ── LEVEL 2: Items in selected sub-category ───────────────────────────────
  const subLabel   = viewSub==='__none__' ? 'Sem sub-categoria' : viewSub
  const displayItems = viewSub==='__none__'
    ? catItems.filter(i=>!i.subCategory||i.subCategory==='')
    : catItems.filter(i=>i.subCategory===viewSub)
  const searchedItems = search
    ? displayItems.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()))
    : displayItems

  return(
    <div>
      {/* Breadcrumb */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px'}} onClick={goBack}>← {selectedCat?.label}</button>
        <span style={{color:'#6a6080'}}>›</span>
        <span style={{color:'#d4a843',fontWeight:600}}>📂 {subLabel}</span>
        <span style={{fontSize:12,color:'#6a6080'}}>· {displayItems.length} item(s)</span>
      </div>
      {/* Actions */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input placeholder="🔍 Buscar item…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:160}}/>
        <button className="btn btn-gold" style={{fontSize:12}} onClick={()=>openNew(viewCat,viewSub)}>+ Novo Item</button>
      </div>

      {displayItems.length===0?(
        <div className="card" style={{textAlign:'center',padding:36,color:'#4a4060'}}>
          <div style={{fontSize:32}}>📭</div>
          <div style={{marginTop:8}}>Nenhum item aqui ainda.</div>
          <button className="btn btn-gold" style={{marginTop:12,fontSize:12}} onClick={()=>openNew(viewCat,viewSub)}>+ Adicionar primeiro item</button>
        </div>
      ):(
        <div style={{display:'grid',gap:8}}>
          {searchedItems.map(it=><ItemRow key={it.id} item={it} catAccent={selectedCat?.accent||'#d4a843'} rentals={rentals} onEdit={openEdit} onDelete={handleDelete}/>)}
        </div>
      )}
      {showForm&&<ItemFormModal form={form} set={set} editing={editing} saving={saving} subcategories={subcategories} categories={useCats} onSave={handleSave} onClose={close}/>}
    </div>
  )
}

// ── Item Form Modal (shared) ──────────────────────────────────────────────────
function ItemFormModal({form,set,editing,saving,subcategories,categories,onSave,onClose}) {
  const useCats = categories||DEFAULT_CATS
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:'serif',fontSize:20,color:'#d4a843',marginBottom:18}}>{editing?'✏️ Editar Item':'✦ Novo Item do Acervo'}</div>
        <div className="form-grid">
          <div style={{gridColumn:'1/-1'}}><label>Nome do Item *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Mesa Provençal…"/></div>
          <div>
            <label>Categoria *</label>
            <select value={form.mainCategory} onChange={e=>set('mainCategory',e.target.value)}>
              {useCats.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label>Sub-categoria (opcional)</label>
            <select value={form.subCategory} onChange={e=>set('subCategory',e.target.value)}>
              <option value="">— Nenhuma —</option>
              {((subcategories||{})[form.mainCategory]||[]).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label>Quantidade em Estoque</label><input type="number" min="0" value={form.quantity} onChange={e=>set('quantity',Number(e.target.value))}/></div>
          <div>
            <label>💰 Preço de Locação (R$/un)</label>
            <input type="number" min="0" step="0.01" value={form.rentalPrice} onChange={e=>set('rentalPrice',e.target.value)} placeholder="0,00"/>
            {(!form.rentalPrice||Number(form.rentalPrice)===0)&&<div style={{fontSize:11,color:'#f0a020',marginTop:4}}>⚠ Informe o preço para o carrinho.</div>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
            <input type="checkbox" id="cb_p2" checked={form.painted} onChange={e=>set('painted',e.target.checked)}/>
            <label htmlFor="cb_p2" style={{margin:0,cursor:'pointer',fontSize:14,textTransform:'none',letterSpacing:0,color:'#e8dfc8'}}>🎨 Item está pintado</label>
          </div>
          <div style={{gridColumn:'1/-1'}}><div className="sec-label" style={{marginTop:8}}>📊 Controle de Desgaste</div></div>
          <div><label>Custo de Reposição (R$)</label><input type="number" min="0" step="0.01" value={form.replacementCost} onChange={e=>set('replacementCost',e.target.value)} placeholder="Quanto custa repor?"/></div>
          <div>
            <label>Vida Útil (usos)</label>
            <input type="number" min="1" value={form.expectedUses} onChange={e=>set('expectedUses',Number(e.target.value))} placeholder="100"/>
            {Number(form.replacementCost)>0&&Number(form.expectedUses)>0&&<div style={{fontSize:11,color:'#d4a843',marginTop:4}}>Custo/uso: {Number(Number(form.replacementCost)/Number(form.expectedUses)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>}
          </div>
          <div style={{gridColumn:'1/-1'}}><label>Observações</label><textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Cor, estado…" style={{resize:'vertical'}}/></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={onSave} disabled={saving}>{saving?'Salvando…':editing?'💾 Salvar':'✦ Adicionar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({item,catAccent,rentals,onEdit,onDelete}) {
  const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(x=>x.itemId===item.id)).length
  const rc=Number(item.replacementCost)||0, eu=Number(item.expectedUses)||100
  const pct=rc>0?Math.min(100,Math.round((useCount/eu)*100)):null
  const barColor=pct>80?'#e05c5c':pct>50?'#f0a020':'#6ee76e'
  const semPreco=!item.rentalPrice||Number(item.rentalPrice)===0
  return(
    <div className="item-row">
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontWeight:600,color:'#e8dfc8',fontSize:14}}>{item.name}</span>
          {item.painted&&<span className="tag" style={{background:'#1b3a1b',color:'#6ee76e',fontSize:10}}>🎨 Pintado</span>}
          {semPreco
            ?<span className="tag" style={{background:'#3a2800',color:'#f0a020',border:'1px solid #8a5500',fontSize:10}}>⚠ Sem preço</span>
            :<span className="tag" style={{background:'#1c2a1c',color:'#a0d8a0',fontSize:10}}>💰 {Number(item.rentalPrice).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
          }
          <span className="tag" style={{background:'#1a1929',color:'#6a6080',border:'1px solid #2e2b4a',fontSize:10}}>🔄 {useCount}x usado</span>
        </div>
        {item.notes&&<div style={{fontSize:11,color:'#4a4060',marginTop:3,fontStyle:'italic'}}>{item.notes.slice(0,60)}{item.notes.length>60?'…':''}</div>}
        {pct!==null&&(
          <div style={{marginTop:5,maxWidth:220}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6a6080',marginBottom:2}}><span>Desgaste</span><span>{pct}%</span></div>
            <div className="progress-bar" style={{height:4}}><div className="progress-fill" style={{width:`${pct}%`,background:barColor}}/></div>
            {pct>=100&&<div style={{fontSize:10,color:'#e05c5c',marginTop:2,fontWeight:700}}>⚠ Reposição necessária!</div>}
          </div>
        )}
      </div>
      <div style={{textAlign:'center',minWidth:54,borderLeft:'1px solid #2e2b4a',paddingLeft:12}}>
        <div style={{fontSize:22,fontWeight:800,color:catAccent,fontFamily:'serif'}}>{item.quantity}</div>
        <div style={{fontSize:9,color:'#6a6080',textTransform:'uppercase'}}>unid.</div>
      </div>
      <div style={{display:'flex',gap:5,flexShrink:0}}>
        <button className="btn btn-ghost" style={{padding:'5px 9px',fontSize:12}} onClick={()=>onEdit(item)}>✏️</button>
        <button className="btn btn-danger" style={{padding:'5px 9px',fontSize:12}} onClick={()=>onDelete(item.id)}>🗑</button>
      </div>
    </div>
  )
}

// ── Rentals Tab ───────────────────────────────────────────────────────────────
function RentalsTab({rentals,inventory,subcategories,categories,onAdd,onUpdate,onDelete,onStatusChange}) {
  const useCats = categories||DEFAULT_CATS
  const [showForm,setShowForm]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [saving,setSaving]=useState(false)
  const blank={tenantName:'',cpf:'',address:'',phone:'',rentalDate:'',expectedReturnDate:'',actualReturnDate:'',dailyRate:'50',amountPaid:'',exitBy:'',items:[],status:'ativa',totalOrder:0}
  const [form,setForm]=useState(blank)
  const [sel,setSel]=useState({itemId:'',qty:1})
  const [selCat,setSelCat]=useState('')
  const [selSub,setSelSub]=useState('')
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}))
  const openNew=()=>{setForm({...blank,rentalDate:new Date().toISOString().slice(0,10)});setEditingId(null);setSelCat('');setSelSub('');setSel({itemId:'',qty:1});setShowForm(true)}
  const openEdit=(r)=>{setForm({...r});setEditingId(r.id);setSelCat('');setSelSub('');setSel({itemId:'',qty:1});setShowForm(true)}
  const close=()=>{setShowForm(false);setEditingId(null)}
  const formTotal=calcTotal(form.items),formPaid=Number(form.amountPaid||0),formDebito=Math.max(0,formTotal-formPaid)
  const autoDailyRate=()=>{
    if(!form.rentalDate||!form.expectedReturnDate)return
    const days=Math.max(1,Math.round((new Date(form.expectedReturnDate+'T12:00:00')-new Date(form.rentalDate+'T12:00:00'))/86400000))
    if(formTotal>0)setF('dailyRate',(formTotal/days).toFixed(2))
  }
  const syncPrices=()=>setForm(p=>({...p,items:p.items.map(it=>{const inv=inventory.find(i=>i.id===it.itemId);return inv&&inv.rentalPrice?{...it,unitPrice:Number(inv.rentalPrice)}:it})}))
  const addItem=()=>{
    if(!sel.itemId)return
    const inv=inventory.find(i=>i.id===sel.itemId);if(!inv)return
    const qty=Math.max(1,Math.min(Number(sel.qty)||1,inv.quantity)),unitPrice=Number(inv.rentalPrice||0)
    const exists=form.items.find(i=>i.itemId===sel.itemId)
    if(exists)setForm(p=>({...p,items:p.items.map(i=>i.itemId===sel.itemId?{...i,qty:Math.min(i.qty+qty,inv.quantity),unitPrice}:i)}))
    else setForm(p=>({...p,items:[...p.items,{itemId:sel.itemId,qty,unitPrice}]}))
    setSel({itemId:'',qty:1})
  }
  const removeItem=(id)=>setForm(p=>({...p,items:p.items.filter(i=>i.itemId!==id)}))
  const updateCartItem=(id,f,v)=>setForm(p=>({...p,items:p.items.map(i=>{
    if(i.itemId!==id)return i
    const inv=inventory.find(x=>x.id===id)
    if(f==='qty')return{...i,qty:Math.max(1,Math.min(Number(v)||1,inv?inv.quantity:999))}
    if(f==='unitPrice')return{...i,unitPrice:Number(v)||0}
    return i
  })}))
  const handleSave=async()=>{
    if(!form.tenantName.trim())return alert('Preencha o nome do locatário.')
    if(form.items.length===0)return alert('Adicione ao menos um item.')
    setSaving(true)
    const data={...form,totalOrder:formTotal}
    editingId?await onUpdate({...data,id:editingId}):await onAdd({...data,id:uid()})
    setSaving(false);close()
  }
  const handleDelete=async(id)=>{if(window.confirm('Excluir esta locação?'))await onDelete(id)}
  const handleSetReturn=async(r)=>{
    const date=prompt('Data de devolução (AAAA-MM-DD):',new Date().toISOString().slice(0,10))
    if(!date)return
    await onUpdate({...r,actualReturnDate:date,status:'concluída'})
  }
  const statusColors={ativa:['#1b3a1b','#6ee76e'],'concluída':['#1a2a4a','#6ea8fe'],cancelada:['#3a1c1c','#e05c5c']}
  const totalFat=rentals.reduce((a,r)=>a+calcTotal(r.items||[]),0)
  const totalDeb=rentals.filter(r=>r.status==='ativa').reduce((a,r)=>a+calcDebito(r),0)
  const totalOv=rentals.reduce((a,r)=>a+calcOverdue(r),0)
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:24}}>
        {[['🎪','Locações',rentals.length,'#d4a843'],['✅','Ativas',rentals.filter(r=>r.status==='ativa').length,'#6ee76e'],['💰','Faturamento',R$(totalFat),'#d4a843'],['⚠️','Em Débito',R$(totalDeb),totalDeb>0?'#e05c5c':'#6ee76e'],['⏰','Atrasos',R$(totalOv),totalOv>0?'#f0a020':'#6ee76e']].map(([ic,label,val,clr])=>(
          <div key={label} className="card" style={{textAlign:'center',padding:'12px 8px'}}>
            <div style={{fontSize:18}}>{ic}</div>
            <div style={{fontSize:typeof val==='string'&&val.length>8?14:20,fontWeight:700,color:clr,fontFamily:'serif',marginTop:2}}>{val}</div>
            <div style={{fontSize:10,color:'#6a6080',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button className="btn btn-gold" onClick={openNew}>+ Nova Locação</button>
      </div>
      {rentals.length===0?(
        <div className="card" style={{textAlign:'center',padding:48,color:'#4a4060'}}>
          <div style={{fontSize:40}}>🎪</div>
          <div style={{marginTop:8,fontFamily:'serif',fontSize:18}}>Nenhuma locação registrada</div>
          <button className="btn btn-gold" style={{marginTop:16}} onClick={openNew}>+ Registrar primeira locação</button>
        </div>
      ):(
        <div style={{display:'grid',gap:12}}>
          {rentals.map(r=>{
            const [sbg,sclr]=statusColors[r.status]||['#2e2b4a','#aaa']
            const rTotal=calcTotal(r.items||[]),rPago=Number(r.amountPaid||0),rDebito=Math.max(0,rTotal-rPago)
            const overdue=calcOverdue(r),overdueDays=calcOverdueDays(r),isLate=overdueDays>0&&r.status==='ativa'
            return(
              <div key={r.id} className="card" style={{borderColor:isLate?'#8a4a00':rDebito>0&&r.status==='ativa'?'#5a2222':'#2e2b4a',transition:'border-color .3s'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:220}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,color:'#e8dfc8',fontSize:15}}>👤 {r.tenantName}</span>
                      <span className="tag" style={{background:sbg,color:sclr}}>{r.status}</span>
                      {isLate&&<span className="tag" style={{background:'#3a2000',color:'#f0a020',border:'1px solid #8a4a00'}}>⏰ {overdueDays}d atraso</span>}
                    </div>
                    <div style={{fontSize:12,color:'#8a7a9a',marginTop:5,display:'flex',flexWrap:'wrap',gap:'2px 14px'}}>
                      <span>📍 {r.address||'—'}</span><span>📞 {r.phone||'—'}</span>{r.cpf&&<span>🪪 CPF: {r.cpf}</span>}
                      <span>📅 Saída: {fmtDate(r.rentalDate)}</span>
                      <span>🔄 Retorno: {fmtDate(r.expectedReturnDate)||'—'}</span>
                      {r.actualReturnDate&&<span style={{color:'#6ee76e'}}>✅ Dev.: {fmtDate(r.actualReturnDate)}</span>}
                    </div>
                    <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
                      {(r.items||[]).map(it=>{const inv=inventory.find(i=>i.id===it.itemId);return inv?<span key={it.itemId} className="tag" style={{background:'#1e1d35',color:'#b0a8c0'}}>{inv.name} ×{it.qty} · {R$(it.unitPrice)}</span>:null})}
                    </div>
                  </div>
                  <div style={{flexShrink:0,minWidth:210}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginBottom:6}}>
                      {[['Total',R$(rTotal),'#d4a843','#0f0e17','#2e2b4a'],['Pago',R$(rPago),'#6ee76e','#0f1a0f','#2e4a2e'],[rDebito>0?'Débito':'Quitado',R$(rDebito),rDebito>0?'#e05c5c':'#6ee76e',rDebito>0?'#1a0f0f':'#0f1a0f',rDebito>0?'#5a2222':'#2e4a2e']].map(([l,v,c,bg,bd])=>(
                        <div key={l} style={{background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:'5px 6px',textAlign:'center'}}>
                          <div style={{fontSize:9,color:'#6a6080',textTransform:'uppercase'}}>{l}</div>
                          <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {overdue>0&&<div style={{background:'#3a2000',border:'1px solid #8a4a00',borderRadius:8,padding:'5px 10px',marginBottom:6,textAlign:'center'}}><div style={{fontSize:9,color:'#8a6040',textTransform:'uppercase'}}>⏰ Atraso ({overdueDays}d)</div><div style={{fontSize:13,fontWeight:700,color:'#f0a020'}}>{R$(overdue)}</div></div>}
                    <div style={{display:'flex',gap:5,justifyContent:'flex-end',flexWrap:'wrap'}}>
                      <button className="btn btn-blue" style={{fontSize:11,padding:'5px 9px'}} onClick={()=>openEdit(r)}>✏️ Ajustar</button>
                      <button className="btn btn-green" style={{fontSize:11,padding:'5px 9px'}} onClick={()=>printChecklist(r,inventory,useCats)}>🖨 Checklist</button>
                      {r.status==='ativa'&&!r.actualReturnDate&&<button className="btn btn-orange" style={{fontSize:11,padding:'5px 9px'}} onClick={()=>handleSetReturn(r)}>📦 Devolvido</button>}
                      <select value={r.status} onChange={e=>onStatusChange(r.id,e.target.value)} style={{width:'auto',cursor:'pointer',padding:'5px 8px',fontSize:11,borderRadius:6}}>
                        <option value="ativa">Ativa</option><option value="concluída">Concluída</option><option value="cancelada">Cancelada</option>
                      </select>
                      <button className="btn btn-danger" style={{fontSize:11,padding:'5px 9px'}} onClick={()=>handleDelete(r.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {showForm&&(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'serif',fontSize:20,color:'#d4a843',marginBottom:2}}>{editingId?'✏️ Ajustar Pedido':'✦ Nova Locação'}</div>
            <div style={{fontSize:11,color:'#6a6080',marginBottom:18}}>{editingId?'Edite os dados, itens ou valores.':'Preencha os dados e monte o carrinho.'}</div>
            <div className="sec-label">Dados do Locatário</div>
            <div className="form-grid">
              <div style={{gridColumn:'1/-1'}}><label>Nome do Locatário *</label><input value={form.tenantName} onChange={e=>setF('tenantName',e.target.value)} placeholder="Nome completo"/></div>
              <div style={{gridColumn:'1/-1'}}><label>Endereço</label><input value={form.address} onChange={e=>setF('address',e.target.value)} placeholder="Rua, número, bairro, cidade"/></div>
              <div><label>Telefone</label><input value={form.phone} onChange={e=>setF('phone',e.target.value)} placeholder="(00) 00000-0000"/></div>
              <div>
                <label>CPF do Locatário *</label>
                <input value={form.cpf} onChange={e=>setF('cpf',e.target.value)} placeholder="000.000.000-00" maxLength={14}/>
                <div style={{fontSize:11,color:'#6a6080',marginTop:4}}>Consta no contrato de locação</div>
              </div>
              <div><label>Responsável pela Saída</label><input value={form.exitBy} onChange={e=>setF('exitBy',e.target.value)} placeholder="Nome de quem entregou"/></div>
            </div>
            <div className="sec-label">📅 Datas & Diária</div>
            <div className="form-grid">
              <div><label>Data de Saída</label><input type="date" value={form.rentalDate} onChange={e=>setF('rentalDate',e.target.value)} onBlur={autoDailyRate}/></div>
              <div><label>Retorno Previsto</label><input type="date" value={form.expectedReturnDate} onChange={e=>setF('expectedReturnDate',e.target.value)} onBlur={autoDailyRate}/></div>
              <div><label>Taxa Diária por Atraso (R$)</label><input type="number" min="0" step="0.01" value={form.dailyRate} onChange={e=>setF('dailyRate',e.target.value)} placeholder="50,00"/></div>
              {editingId&&<div><label>Data de Retorno Real</label><input type="date" value={form.actualReturnDate} onChange={e=>setF('actualReturnDate',e.target.value)}/></div>}
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginTop:18,marginBottom:10}}>
              <div className="sec-label" style={{margin:0}}>🛒 Carrinho</div>
              {form.items.length>0&&<button className="btn btn-blue" style={{fontSize:11,padding:'4px 10px'}} onClick={syncPrices}>🔄 Sincronizar Preços</button>}
            </div>
            {inventory.length===0?<div style={{background:'#1a1929',border:'1px solid #2e2b4a',borderRadius:8,padding:14,color:'#6a6080',fontSize:13,marginBottom:12}}>⚠ Nenhum item no acervo.</div>:(()=>{
              const catSubs=(subcategories&&selCat)?subcategories[selCat]||[]:[]
              const filteredItems=selCat?inventory.filter(i=>{
                if(i.mainCategory!==selCat)return false
                if(selSub)return(i.subCategory||'')===selSub
                return true
              }):[]
              return(
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
                  {/* Linha 1: Categoria + Sub-categoria */}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <select value={selCat} onChange={e=>{setSelCat(e.target.value);setSelSub('');setSel(p=>({...p,itemId:''}))}} style={{flex:1,minWidth:160}}>
                      <option value="">1. Selecione a categoria</option>
                      {useCats.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                    {selCat&&catSubs.length>0&&(
                      <select value={selSub} onChange={e=>{setSelSub(e.target.value);setSel(p=>({...p,itemId:''}))}} style={{flex:1,minWidth:160}}>
                        <option value="">2. Sub-categoria (opcional)</option>
                        {catSubs.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                  {/* Linha 2: Item + Qtd + Adicionar */}
                  {selCat&&(
                    <div style={{display:'flex',gap:8}}>
                      <select value={sel.itemId} onChange={e=>setSel(p=>({...p,itemId:e.target.value}))} style={{flex:1}}>
                        <option value="">{catSubs.length>0?'3.':'2.'} Selecione o item</option>
                        {filteredItems.length===0
                          ?<option disabled>Nenhum item nesta seleção</option>
                          :filteredItems.map(i=><option key={i.id} value={i.id}>{i.name} — {i.quantity} disp.{i.rentalPrice?` — ${R$(i.rentalPrice)}/un`:''}</option>)
                        }
                      </select>
                      <input type="number" min="1" value={sel.qty} onChange={e=>setSel(p=>({...p,qty:e.target.value}))} style={{width:64}}/>
                      <button className="btn btn-gold" onClick={addItem} style={{whiteSpace:'nowrap',padding:'8px 14px'}} disabled={!sel.itemId}>+ Add</button>
                    </div>
                  )}
                </div>
              )
            })()}
                {form.items.length>0&&(
              <div style={{background:'#0f0e17',border:'1px solid #2e2b4a',borderRadius:10,overflow:'hidden',marginBottom:4}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',padding:'6px 12px',background:'#1a1929',fontSize:10,color:'#6a6080',textTransform:'uppercase'}}>
                  <span>Item</span><span style={{textAlign:'center'}}>Qtd</span><span style={{textAlign:'right'}}>Vl. Unit.</span><span style={{textAlign:'right'}}>Subtotal</span><span></span>
                </div>
                {form.items.map(it=>{
                  const inv=inventory.find(i=>i.id===it.itemId),sub=it.unitPrice*it.qty
                  const diverge=inv&&Number(inv.rentalPrice)!==Number(it.unitPrice)
                  const catInfo=useCats.find(c=>c.key===inv?.mainCategory)||{icon:'',label:inv?.mainCategory||''}
                  return(
                    <div key={it.itemId} style={{display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',alignItems:'center',padding:'7px 12px',borderTop:'1px solid #1e1d35'}}>
                      <div>
                        <div style={{color:'#e8dfc8',fontSize:13,fontWeight:600}}>{inv?inv.name:'?'}</div>
                        <div style={{fontSize:10,color:'#6a6080'}}>{catInfo.icon} {catInfo.label}{diverge&&<span style={{color:'#f0a020'}}> ⚠ diverge</span>}</div>
                      </div>
                      <div><input type="number" min="1" value={it.qty} onChange={e=>updateCartItem(it.itemId,'qty',e.target.value)} style={{width:50,textAlign:'center',padding:'4px',fontSize:13}}/></div>
                      <div><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e=>updateCartItem(it.itemId,'unitPrice',e.target.value)} style={{width:90,textAlign:'right',padding:'4px 6px',fontSize:13}}/></div>
                      <div style={{textAlign:'right',color:'#d4a843',fontWeight:700,fontSize:14}}>{R$(sub)}</div>
                      <div><button className="btn btn-danger" style={{padding:'3px 6px',fontSize:11}} onClick={()=>removeItem(it.itemId)}>✕</button></div>
                    </div>
                  )
                })}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#1a1929',borderTop:'2px solid #2e2b4a'}}>
                  <span style={{fontSize:12,color:'#8a7a9a'}}>{form.items.length} {form.items.length===1?'item':'itens'}</span>
                  <span style={{fontWeight:700,color:'#d4a843',fontSize:16,fontFamily:'serif'}}>Total: {R$(formTotal)}</span>
                </div>
              </div>
            )}
            <div className="sec-label">💳 Pagamento</div>
            <div className="form-grid" style={{marginBottom:0}}>
              <div><label>Valor Pago (R$)</label><input type="number" step="0.01" min="0" value={form.amountPaid} onChange={e=>setF('amountPaid',e.target.value)} placeholder="0,00"/></div>
              <div style={{display:'flex',alignItems:'flex-end'}}>
                <div style={{width:'100%',background:formDebito>0?'#1a0f0f':'#0f1a0f',border:`1px solid ${formDebito>0?'#5a2222':'#2e4a2e'}`,borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:10,color:'#6a6080',textTransform:'uppercase',marginBottom:2}}>{formDebito>0?'⚠ Valor em Débito':formTotal>0?'✅ Quitado':'Débito'}</div>
                  <div style={{fontSize:18,fontWeight:800,color:formDebito>0?'#e05c5c':'#6ee76e',fontFamily:'serif'}}>{R$(formDebito)}</div>
                </div>
              </div>
            </div>
            {formTotal>0&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:10}}>
                {[['TOTAL',R$(formTotal),'#d4a843','#0f0e17','#2e2b4a'],['PAGO',R$(formPaid),'#6ee76e','#0f1a0f','#2e4a2e'],['DÉBITO',R$(formDebito),formDebito>0?'#e05c5c':'#6ee76e',formDebito>0?'#1a0f0f':'#0f1a0f',formDebito>0?'#5a2222':'#2e4a2e']].map(([l,v,c,bg,bd])=>(
                  <div key={l} style={{background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'#6a6080'}}>{l}</div>
                    <div style={{fontWeight:700,color:c,fontSize:15}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:'#1b0d0d',border:'1px solid #5a2222',borderRadius:8,padding:'9px 14px',marginTop:16,marginBottom:20}}>
              <div style={{color:'#e05c5c',fontSize:11,fontWeight:700}}>⚠ Incluído automaticamente no checklist:</div>
              <div style={{color:'#c0a0a0',fontSize:11,marginTop:3}}>Multa de 100% por avaria · Taxa de {R$(form.dailyRate||50)}/dia por atraso.</div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Salvando…':editingId?'💾 Salvar Ajustes':'✦ Registrar Locação'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Finance Tab ───────────────────────────────────────────────────────────────
function FinanceTab({rentals,inventory,categories}) {
  const [period,setPeriod]=useState('month')
  const filtered=filterByPeriod(rentals.filter(r=>r.status!=='cancelada'),period)
  const totalBilled=filtered.reduce((a,r)=>a+calcTotal(r.items||[]),0)
  const totalPaid=filtered.reduce((a,r)=>a+Number(r.amountPaid||0),0)
  const totalDebt=filtered.reduce((a,r)=>a+calcDebito(r),0)
  const totalOv=filtered.reduce((a,r)=>a+calcOverdue(r),0)
  const totalDesgaste=inventory.filter(i=>Number(i.replacementCost)>0).reduce((a,it)=>{
    const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(x=>x.itemId===it.id)).length
    return a+(useCount*(Number(it.replacementCost)||0)/Math.max(Number(it.expectedUses)||100,1))
  },0)
  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
        {[['day','Hoje'],['week','Esta Semana'],['month','Este Mês'],['all','Tudo']].map(([k,l])=>(
          <button key={k} className="btn" onClick={()=>setPeriod(k)}
            style={{background:period===k?'linear-gradient(135deg,#d4a843,#b8860b)':'#16152a',color:period===k?'#0f0e17':'#8a7a9a',border:period===k?'none':'1px solid #2e2b4a',fontWeight:700}}>
            {l}
          </button>
        ))}
        <span style={{marginLeft:'auto',fontSize:12,color:'#6a6080',alignSelf:'center'}}>{filtered.length} locaç{filtered.length===1?'ão':'ões'}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:28}}>
        {[['💰','Faturado',R$(totalBilled),'#d4a843','#1a150a','#4a3800'],['✅','Recebido',R$(totalPaid),'#6ee76e','#0f1a0f','#2e4a2e'],['⚠️','Em Débito',R$(totalDebt),totalDebt>0?'#e05c5c':'#6ee76e',totalDebt>0?'#1a0f0f':'#0f1a0f',totalDebt>0?'#5a2222':'#2e4a2e'],['⏰','Atrasos',R$(totalOv),totalOv>0?'#f0a020':'#6ee76e','#1a1000',totalOv>0?'#8a4a00':'#2e4a2e'],['📊','Total Recebido',R$(totalPaid+totalOv),'#a8d4ff','#0a1020','#1e3a5f'],['🔧','Desgaste Acumulado',R$(totalDesgaste),'#f0a020','#1a1200','#4a3800']].map(([ic,label,val,clr,bg,bd])=>(
          <div key={label} style={{background:bg,border:`1px solid ${bd}`,borderRadius:12,padding:'16px 12px',textAlign:'center'}}>
            <div style={{fontSize:22}}>{ic}</div>
            <div style={{fontSize:typeof val==='string'&&val.length>10?14:18,fontWeight:700,color:clr,fontFamily:'serif',marginTop:4}}>{val}</div>
            <div style={{fontSize:10,color:'#6a6080',marginTop:3,textTransform:'uppercase',letterSpacing:0.8}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{fontFamily:'serif',fontSize:17,color:'#d4a843',marginBottom:14}}>📋 Locações do Período</div>
      {filtered.length===0?(
        <div className="card" style={{textAlign:'center',padding:32,color:'#4a4060'}}><div style={{fontSize:32}}>📭</div><div style={{marginTop:8}}>Nenhuma locação neste período.</div></div>
      ):(
        <div style={{background:'#16152a',border:'1px solid #2e2b4a',borderRadius:12,overflow:'hidden',marginBottom:32}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 100px 90px 90px 90px',padding:'8px 16px',background:'#1a1929',fontSize:10,color:'#6a6080',textTransform:'uppercase'}}>
            <span>Locatário</span><span style={{textAlign:'center'}}>Data</span><span style={{textAlign:'right'}}>Total</span><span style={{textAlign:'right'}}>Pago</span><span style={{textAlign:'right'}}>Débito</span>
          </div>
          {filtered.map((r,idx)=>{
            const rTotal=calcTotal(r.items||[]),rPago=Number(r.amountPaid||0),rDeb=Math.max(0,rTotal-rPago)
            return(
              <div key={r.id} style={{display:'grid',gridTemplateColumns:'1fr 100px 90px 90px 90px',alignItems:'center',padding:'10px 16px',borderTop:'1px solid #1e1d35',background:idx%2===0?'transparent':'#0f0e1710'}}>
                <div><div style={{color:'#e8dfc8',fontSize:13,fontWeight:600}}>{r.tenantName}</div><div style={{fontSize:11,color:'#6a6080'}}>{r.status}</div></div>
                <div style={{textAlign:'center',fontSize:12,color:'#8a7a9a'}}>{fmtDate(r.rentalDate)}</div>
                <div style={{textAlign:'right',color:'#d4a843',fontWeight:600,fontSize:13}}>{R$(rTotal)}</div>
                <div style={{textAlign:'right',color:'#6ee76e',fontSize:13}}>{R$(rPago)}</div>
                <div style={{textAlign:'right',color:rDeb>0?'#e05c5c':'#6ee76e',fontSize:13}}>{R$(rDeb)}</div>
              </div>
            )
          })}
          <div style={{display:'grid',gridTemplateColumns:'1fr 100px 90px 90px 90px',padding:'10px 16px',borderTop:'2px solid #2e2b4a',background:'#1a1929'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#e8dfc8'}}>TOTAL</div><div/>
            <div style={{textAlign:'right',color:'#d4a843',fontWeight:700}}>{R$(totalBilled)}</div>
            <div style={{textAlign:'right',color:'#6ee76e',fontWeight:700}}>{R$(totalPaid)}</div>
            <div style={{textAlign:'right',color:totalDebt>0?'#e05c5c':'#6ee76e',fontWeight:700}}>{R$(totalDebt)}</div>
          </div>
        </div>
      )}
      <DesgasteSection inventory={inventory} rentals={rentals} categories={categories}/>
    </div>
  )
}

// ── Desgaste Section (collapsible, by category) ───────────────────────────────
function DesgasteSection({inventory,rentals,categories}) {
  const useCats = categories||DEFAULT_CATS
  const [open,setOpen]    = useState(false)
  const [openCat,setOpenCat] = useState({})

  const itemsWithCost = inventory.filter(i=>Number(i.replacementCost)>0)
  const getDepreciation = (item) => {
    const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(it=>it.itemId===item.id)).length
    const eu=Number(item.expectedUses)||100, rc=Number(item.replacementCost)||0
    return {useCount,costPerUse:rc/eu,accumulated:useCount*(rc/eu),remaining:Math.max(0,eu-useCount),pct:Math.min(100,Math.round((useCount/eu)*100)),replacementCost:rc}
  }
  const totalAccumulated = itemsWithCost.reduce((a,it)=>a+getDepreciation(it).accumulated,0)
  const totalReplacement = itemsWithCost.reduce((a,it)=>a+Number(it.replacementCost)*Number(it.quantity||1),0)
  const R$ = (v) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

  return(
    <div style={{marginTop:8}}>
      {/* Header — sempre visível */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#16152a',border:'1px solid #2e2b4a',borderRadius:open?'12px 12px 0 0':'12px',padding:'14px 18px',cursor:'pointer',transition:'border-radius .2s'}}
        onClick={()=>setOpen(p=>!p)}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>📊</span>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:'#d4a843'}}>Desgaste de Material</div>
            <div style={{fontSize:11,color:'#6a6080',marginTop:2}}>
              {itemsWithCost.length} item(s) monitorado(s) · Acumulado: <span style={{color:'#f0a020',fontWeight:600}}>{R$(totalAccumulated)}</span>
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {itemsWithCost.filter(i=>getDepreciation(i).pct>=100).length>0&&(
            <span style={{fontSize:11,background:'#3a1a1a',color:'#e05c5c',border:'1px solid #5a2222',borderRadius:20,padding:'2px 10px',fontWeight:700}}>
              ⚠ {itemsWithCost.filter(i=>getDepreciation(i).pct>=100).length} reposição(ões)
            </span>
          )}
          <span style={{color:'#6a6080',fontSize:18,transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▾</span>
        </div>
      </div>

      {/* Collapsible body */}
      {open&&(
        <div style={{border:'1px solid #2e2b4a',borderTop:'none',borderRadius:'0 0 12px 12px',overflow:'hidden'}}>
          {itemsWithCost.length===0?(
            <div style={{padding:20,color:'#6a6080',fontSize:13,textAlign:'center'}}>
              Nenhum item com custo de reposição cadastrado.<br/>
              <span style={{fontSize:12}}>Vá em <strong style={{color:'#d4a843'}}>Administrativo → Acervo</strong> e informe o custo de reposição.</span>
            </div>
          ):(
            <>
              {/* Summary row */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'12px 16px',background:'#0f0e17',borderBottom:'1px solid #2e2b4a'}}>
                <div style={{background:'#1a0f0a',border:'1px solid #4a3000',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#8a6040',textTransform:'uppercase',marginBottom:2}}>Total Depreciado</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#f0a020'}}>{R$(totalAccumulated)}</div>
                </div>
                <div style={{background:'#0f1a2a',border:'1px solid #1e3a5a',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#6080a0',textTransform:'uppercase',marginBottom:2}}>Custo Reposição Total</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#6ea8fe'}}>{R$(totalReplacement)}</div>
                </div>
              </div>

              {/* By category */}
              {useCats.map(cat=>{
                const catItems = itemsWithCost.filter(i=>i.mainCategory===cat.key)
                if(catItems.length===0) return null
                const isCatOpen = openCat[cat.key]!==false // default open
                const catAccumulated = catItems.reduce((a,it)=>a+getDepreciation(it).accumulated,0)
                return(
                  <div key={cat.key} style={{borderBottom:'1px solid #1e1d35'}}>
                    {/* Category header */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'#16152a',cursor:'pointer'}}
                      onClick={()=>setOpenCat(p=>({...p,[cat.key]:p[cat.key]===false}))}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:18}}>{cat.icon}</span>
                        <span style={{fontWeight:600,color:cat.accent,fontSize:14}}>{cat.label}</span>
                        <span style={{fontSize:11,color:'#6a6080'}}>· {catItems.length} item(s)</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:12,color:'#f0a020'}}>{R$(catAccumulated)}</span>
                        <span style={{color:'#4a4060',fontSize:14}}>{isCatOpen?'▾':'▸'}</span>
                      </div>
                    </div>

                    {/* Category items */}
                    {isCatOpen&&(
                      <div style={{background:'#0f0e17'}}>
                        {/* Table header */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 60px 80px 80px 110px 80px',padding:'6px 16px',fontSize:10,color:'#4a4060',textTransform:'uppercase',letterSpacing:0.5,borderBottom:'1px solid #1e1d35'}}>
                          <span>Item</span><span style={{textAlign:'center'}}>Usos</span><span style={{textAlign:'right'}}>Custo/Uso</span><span style={{textAlign:'right'}}>Acumulado</span><span style={{textAlign:'center'}}>Vida Útil</span><span style={{textAlign:'right'}}>Reposição</span>
                        </div>
                        {catItems.map((it,idx)=>{
                          const dep=getDepreciation(it)
                          const barColor=dep.pct>80?'#e05c5c':dep.pct>50?'#f0a020':'#6ee76e'
                          return(
                            <div key={it.id} style={{display:'grid',gridTemplateColumns:'1fr 60px 80px 80px 110px 80px',alignItems:'center',padding:'10px 16px',borderTop:'1px solid #1e1d35',background:idx%2===0?'transparent':'#16152a10'}}>
                              <div>
                                <div style={{color:'#e8dfc8',fontSize:13,fontWeight:600}}>{it.name}</div>
                                {it.subCategory&&<div style={{fontSize:10,color:'#4a4060'}}>📂 {it.subCategory}</div>}
                              </div>
                              <div style={{textAlign:'center',fontSize:14,fontWeight:700,color:'#a8d4ff'}}>{dep.useCount}</div>
                              <div style={{textAlign:'right',fontSize:12,color:'#d4a843'}}>{R$(dep.costPerUse)}</div>
                              <div style={{textAlign:'right',fontSize:12,color:dep.pct>80?'#e05c5c':'#f0a020',fontWeight:600}}>{R$(dep.accumulated)}</div>
                              <div style={{padding:'0 8px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#6a6080',marginBottom:2}}><span>{dep.remaining} rest.</span><span>{dep.pct}%</span></div>
                                <div style={{height:5,background:'#1e1d35',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${dep.pct}%`,background:barColor,borderRadius:3}}/></div>
                                {dep.pct>=100&&<div style={{fontSize:9,color:'#e05c5c',marginTop:2,fontWeight:700}}>⚠ Repor!</div>}
                              </div>
                              <div style={{textAlign:'right',fontSize:12,color:'#6a6080'}}>{R$(dep.replacementCost)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
