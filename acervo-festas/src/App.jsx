import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  'https://yyqqizuxkdmeprmgdhgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXFpenV4a2RtZXBybWdkaGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY2ODEsImV4cCI6MjA5NTIyMjY4MX0.4-x6IfzZjghQY8FOxt6jGG_1VHJC8nJJPH3shPcje78'
)
const dbToInventory = (r) => ({ id:r.id, name:r.name, quantity:r.quantity, rentalPrice:r.rental_price||0, painted:r.painted, material:r.material, category:r.category||'', notes:r.notes||'', replacementCost:r.replacement_cost||0, expectedUses:r.expected_uses||100, createdAt:r.created_at })
const inventoryToDB = (i) => ({ id:i.id, name:i.name, quantity:Number(i.quantity||0), rental_price:Number(i.rentalPrice||0), painted:i.painted, material:i.material, category:i.category||'', notes:i.notes||'', replacement_cost:Number(i.replacementCost||0), expected_uses:Number(i.expectedUses||100) })
const dbToRental    = (r) => ({ id:r.id, tenantName:r.tenant_name, address:r.address||'', phone:r.phone||'', rentalDate:r.rental_date||'', amountPaid:r.amount_paid||0, exitBy:r.exit_by||'', status:r.status, totalOrder:r.total_order||0, items:r.items||[], expectedReturnDate:r.expected_return_date||'', actualReturnDate:r.actual_return_date||'', dailyRate:r.daily_rate||0, createdAt:r.created_at })
const rentalToDB    = (r) => ({ id:r.id, tenant_name:r.tenantName, address:r.address||'', phone:r.phone||'', rental_date:r.rentalDate||null, amount_paid:Number(r.amountPaid||0), exit_by:r.exitBy||'', status:r.status||'ativa', total_order:Number(r.totalOrder||0), items:r.items||[], expected_return_date:r.expectedReturnDate||null, actual_return_date:r.actualReturnDate||null, daily_rate:Number(r.dailyRate||0) })

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
  const cpu=rc/eu, acc=useCount*cpu, rem=Math.max(0,eu-useCount), pct=Math.min(100,Math.round((useCount/eu)*100))
  return {useCount,costPerUse:cpu,accumulated:acc,remaining:rem,pct,replacementCost:rc,expectedUses:eu}
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
function printChecklist(rental,inventory) {
  const saida=rental.items||[], total=calcTotal(saida), pago=Number(rental.amountPaid||0)
  const debito=Math.max(0,total-pago), overdue=calcOverdue(rental), overdueDays=calcOverdueDays(rental)
  const makeRows=(mode)=>saida.map(it=>{
    const inv=inventory.find(i=>i.id===it.itemId)
    const nome=inv?inv.name:'Item', mat=inv?inv.material:'', pint=inv?(inv.painted?'Sim':'Não'):''
    const sub=Number(it.unitPrice||0)*Number(it.qty||0)
    if (mode==='saida') return `<tr><td>${nome}</td><td>${mat}</td><td>${pint}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${R$(it.unitPrice)}</td><td style="text-align:right;font-weight:600">${R$(sub)}</td><td class="cb"></td><td>&nbsp;</td></tr>`
    return `<tr><td>${nome}</td><td>${mat}</td><td>${pint}</td><td style="text-align:center">${it.qty}</td><td class="cb"></td><td>&nbsp;</td></tr>`
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
<table><thead><tr><th>Item</th><th>Material</th><th>Pintado</th><th>Qtd</th><th>Vl. Unit.</th><th>Subtotal</th><th>✓</th><th>Observações</th></tr></thead><tbody>${makeRows('saida')}</tbody></table>
<h2>Checklist de Devolução</h2>
<table><thead><tr><th>Item</th><th>Material</th><th>Pintado</th><th>Qtd Devolvida</th><th>✓</th><th>Estado / Avarias</th></tr></thead><tbody>${makeRows('retorno')}</tbody></table>
<div class="alert"><strong>⚠ Cláusula de Responsabilidade por Avaria</strong>
<p>O locatário declara ter recebido os itens em perfeito estado e assume total responsabilidade durante o período de locação.<br/><br/>
<strong>Em caso de avaria, dano, quebra ou perda</strong>, o locatário pagará multa de <strong>100% do valor da locação</strong> por item danificado, além do custo de reparo ou reposição.<br/><br/>
O não cumprimento do prazo implica cobrança de <strong>${R$(rental.dailyRate||0)} por dia de atraso</strong>.</p></div>
<div class="sigs">
<div class="sig"><br/><br/><br/><p>Assinatura do Locatário</p><p class="nm">${rental.tenantName||''}</p><p>Data: _____ / _____ / ________</p></div>
<div class="sig"><br/><br/><br/><p>Responsável pela Entrega / Devolução</p><p class="nm">${rental.exitBy||''}</p><p>Data: _____ / _____ / ________</p></div>
</div>
<div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} · Este documento tem validade de contrato mediante assinatura das partes.</div>
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
.btn-red{background:linear-gradient(135deg,#6a1a1a,#4a0a0a);color:#ffaaaa;border:1px solid #8a2222!important;}
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
@media(max-width:600px){.form-grid{grid-template-columns:1fr;}}
`

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]             = useState('rentals')
  const [adminUnlocked,setAdminUnlocked] = useState(false)
  const [adminSub,setAdminSub]   = useState('inventory')
  const [inventory,setInventory] = useState([])
  const [rentals,setRentals]     = useState([])
  const [loading,setLoading]     = useState(true)
  const [error,setError]         = useState(null)

  const loadAll = async () => {
    setLoading(true); setError(null)
    const [invRes,rentRes] = await Promise.all([
      supabase.from('inventory').select('*').order('created_at',{ascending:false}),
      supabase.from('rentals').select('*').order('created_at',{ascending:false}),
    ])
    if (invRes.error||rentRes.error) setError('Erro ao carregar dados. Verifique sua conexão.')
    else { setInventory((invRes.data||[]).map(dbToInventory)); setRentals((rentRes.data||[]).map(dbToRental)) }
    setLoading(false)
  }
  useEffect(()=>{loadAll()},[])

  const addInventory    = async(i)=>{const{data,error}=await supabase.from('inventory').insert([inventoryToDB(i)]).select();if(!error)setInventory(p=>[dbToInventory(data[0]),...p])}
  const updateInventory = async(i)=>{await supabase.from('inventory').update(inventoryToDB(i)).eq('id',i.id);setInventory(p=>p.map(x=>x.id===i.id?i:x))}
  const deleteInventory = async(id)=>{await supabase.from('inventory').delete().eq('id',id);setInventory(p=>p.filter(i=>i.id!==id))}
  const addRental       = async(r)=>{const{data,error}=await supabase.from('rentals').insert([rentalToDB(r)]).select();if(!error)setRentals(p=>[dbToRental(data[0]),...p])}
  const updateRental    = async(r)=>{await supabase.from('rentals').update(rentalToDB(r)).eq('id',r.id);setRentals(p=>p.map(x=>x.id===r.id?r:x))}
  const deleteRental    = async(id)=>{await supabase.from('rentals').delete().eq('id',id);setRentals(p=>p.filter(r=>r.id!==id))}
  const updateStatus    = async(id,status)=>{await supabase.from('rentals').update({status}).eq('id',id);setRentals(p=>p.map(r=>r.id===id?{...r,status}:r))}

  if (loading) return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0e17',gap:16}}><div style={{color:'#d4a843',fontFamily:'serif',fontSize:26}}>✦ Acervo de Festas</div><div style={{color:'#6a6080',fontSize:14}}>Conectando ao banco de dados…</div></div>
  if (error)   return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0e17',gap:16}}><div style={{color:'#e05c5c',fontSize:18}}>⚠ {error}</div><button onClick={loadAll} style={{background:'#d4a843',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontWeight:700,fontFamily:'inherit'}}>Tentar novamente</button></div>

  return (
    <div style={{minHeight:'100vh',background:'#0f0e17',fontFamily:"'Source Sans 3', sans-serif"}}>
      <style>{STYLES}</style>

      {/* ── Header ── */}
      <div style={{background:'linear-gradient(135deg,#1a1929,#0f0e17)',borderBottom:'1px solid #2e2b4a',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display', serif",fontSize:22,color:'#d4a843',lineHeight:1}}>✦ Acervo de Festas</div>
          <div style={{fontSize:10,color:'#6a6080',letterSpacing:2,textTransform:'uppercase',marginTop:3}}>Controle de Estoque & Locação</div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {/* Locações — aberta para todos */}
          <button className="btn" onClick={()=>setTab('rentals')}
            style={{background:tab==='rentals'?'linear-gradient(135deg,#d4a843,#b8860b)':'transparent',color:tab==='rentals'?'#0f0e17':'#8a7a9a',border:tab==='rentals'?'none':'1px solid #2e2b4a',fontWeight:700,fontSize:12,padding:'7px 14px'}}>
            🎪 Locações
          </button>
          {/* Administrativo — com cadeado */}
          <button className="btn" onClick={()=>setTab('admin')}
            style={{background:tab==='admin'?'linear-gradient(135deg,#5a3a8a,#3a1a6a)':'transparent',color:tab==='admin'?'#e8d4ff':'#8a7a9a',border:tab==='admin'?'1px solid #7a4aaa':'1px solid #2e2b4a',fontWeight:700,fontSize:12,padding:'7px 14px',gap:6}}>
            {adminUnlocked?'🔓':'🔐'} Administrativo
          </button>
          {/* Botão de bloquear quando admin está aberto */}
          {adminUnlocked&&tab==='admin'&&(
            <button className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px'}} onClick={()=>{setAdminUnlocked(false)}}>
              🔒 Bloquear
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{padding:'20px',maxWidth:1100,margin:'0 auto'}}>
        {tab==='rentals' && (
          <RentalsTab rentals={rentals} inventory={inventory} onAdd={addRental} onUpdate={updateRental} onDelete={deleteRental} onStatusChange={updateStatus}/>
        )}
        {tab==='admin' && (
          adminUnlocked ? (
            <div>
              {/* Sub-abas do administrativo */}
              <div className="sub-tab-bar">
                <button className={`sub-tab ${adminSub==='inventory'?'sub-tab-active':'sub-tab-inactive'}`} onClick={()=>setAdminSub('inventory')}>
                  📦 Acervo
                </button>
                <button className={`sub-tab ${adminSub==='finance'?'sub-tab-active':'sub-tab-inactive'}`} onClick={()=>setAdminSub('finance')}>
                  💰 Finanças
                </button>
              </div>
              {adminSub==='inventory' && <InventoryTab inventory={inventory} rentals={rentals} onAdd={addInventory} onUpdate={updateInventory} onDelete={deleteInventory}/>}
              {adminSub==='finance'   && <FinanceTab rentals={rentals} inventory={inventory}/>}
            </div>
          ) : (
            <AdminPinGate onUnlock={()=>setAdminUnlocked(true)}/>
          )
        )}
      </div>
    </div>
  )
}

// ── Admin PIN Gate ────────────────────────────────────────────────────────────
function AdminPinGate({onUnlock}) {
  const [pin,setPin]           = useState('')
  const [error,setError]       = useState('')
  const [changing,setChanging] = useState(false)
  const [oldPin,setOldPin]     = useState('')
  const [newPin,setNewPin]     = useState('')
  const [confirm,setConfirm]   = useState('')

  const handleEnter = () => {
    if (checkPin(pin)) { onUnlock(); setPin(''); setError('') }
    else { setError('PIN incorreto. Tente novamente.'); setPin('') }
  }
  const handleChange = () => {
    if (!checkPin(oldPin)) { setError('PIN atual incorreto.'); return }
    if (newPin.length<4)   { setError('Novo PIN deve ter no mínimo 4 dígitos.'); return }
    if (newPin!==confirm)  { setError('Os PINs não coincidem.'); return }
    savePin(newPin); setChanging(false); setOldPin(''); setNewPin(''); setConfirm(''); setError('')
    alert('✅ PIN alterado com sucesso!')
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{width:'100%',maxWidth:420}}>
        {/* Card principal */}
        <div style={{background:'linear-gradient(135deg,#1a1229,#0f0e17)',border:'1px solid #4a2a7a',borderRadius:20,padding:'40px 36px',textAlign:'center',boxShadow:'0 20px 60px #00000060'}}>
          <div style={{fontSize:52,marginBottom:16}}>🔐</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:'#c8a4ff',marginBottom:8}}>Área Administrativa</div>
          <div style={{fontSize:13,color:'#6a6080',marginBottom:32,lineHeight:1.6}}>Acesso restrito. Esta área contém<br/>o gerenciamento do acervo e finanças.</div>

          {!changing ? (
            <>
              <div style={{marginBottom:16}}>
                <label style={{color:'#8a7a9a',textAlign:'left',display:'block',marginBottom:8}}>PIN de Acesso</label>
                <input type="password" inputMode="numeric" maxLength={8} value={pin}
                  onChange={e=>setPin(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleEnter()}
                  placeholder="••••"
                  style={{textAlign:'center',letterSpacing:8,fontSize:22,padding:'12px',background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%'}}/>
              </div>
              {error&&<div style={{color:'#e05c5c',fontSize:13,marginBottom:12,background:'#2a0a0a',border:'1px solid #5a2222',borderRadius:6,padding:'8px 12px'}}>{error}</div>}
              <button onClick={handleEnter}
                style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#7a4aaa,#5a2a8a)',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',marginBottom:12,fontFamily:'inherit',letterSpacing:0.5}}>
                Entrar na Área Administrativa
              </button>
              <button onClick={()=>{setChanging(true);setError('')}}
                style={{width:'100%',padding:'9px',background:'transparent',border:'1px solid #3a2a5a',borderRadius:8,color:'#8a7a9a',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                🔑 Alterar PIN
              </button>
              <div style={{fontSize:11,color:'#3a2a5a',marginTop:20}}>PIN padrão: <span style={{color:'#7a5a9a'}}>1234</span></div>
            </>
          ) : (
            <>
              <div style={{textAlign:'left',marginBottom:16}}>
                <label style={{color:'#8a7a9a',display:'block',marginBottom:6}}>PIN Atual</label>
                <input type="password" inputMode="numeric" maxLength={8} value={oldPin} onChange={e=>setOldPin(e.target.value)} placeholder="••••" style={{textAlign:'center',letterSpacing:6,fontSize:18,marginBottom:12,background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%',padding:'10px'}}/>
                <label style={{color:'#8a7a9a',display:'block',marginBottom:6}}>Novo PIN</label>
                <input type="password" inputMode="numeric" maxLength={8} value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Mínimo 4 dígitos" style={{textAlign:'center',letterSpacing:6,fontSize:18,marginBottom:12,background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%',padding:'10px'}}/>
                <label style={{color:'#8a7a9a',display:'block',marginBottom:6}}>Confirmar Novo PIN</label>
                <input type="password" inputMode="numeric" maxLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita o novo PIN" style={{textAlign:'center',letterSpacing:6,fontSize:18,background:'#0f0e17',border:'1px solid #4a2a7a',color:'#e8dfc8',borderRadius:8,width:'100%',padding:'10px'}}/>
              </div>
              {error&&<div style={{color:'#e05c5c',fontSize:13,marginBottom:12,background:'#2a0a0a',border:'1px solid #5a2222',borderRadius:6,padding:'8px 12px'}}>{error}</div>}
              <button onClick={handleChange}
                style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#7a4aaa,#5a2a8a)',border:'none',borderRadius:10,color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',marginBottom:10,fontFamily:'inherit'}}>
                💾 Salvar Novo PIN
              </button>
              <button onClick={()=>{setChanging(false);setError('');setOldPin('');setNewPin('');setConfirm('')}}
                style={{width:'100%',padding:'9px',background:'transparent',border:'1px solid #3a2a5a',borderRadius:8,color:'#8a7a9a',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({inventory,rentals,onAdd,onUpdate,onDelete}) {
  const [showForm,setShowForm]=useState(false)
  const [editing,setEditing]=useState(null)
  const [saving,setSaving]=useState(false)
  const [search,setSearch]=useState('')
  const [filterMat,setFilterMat]=useState('all')
  const blank={name:'',quantity:1,rentalPrice:'',painted:false,material:'madeira',category:'',notes:'',replacementCost:'',expectedUses:100}
  const [form,setForm]=useState(blank)
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  const openNew=()=>{setForm(blank);setEditing(null);setShowForm(true)}
  const openEdit=(it)=>{setForm({...it});setEditing(it.id);setShowForm(true)}
  const close=()=>{setShowForm(false);setEditing(null)}
  const handleSave=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    editing?await onUpdate({...form,id:editing}):await onAdd({...form,id:uid()})
    setSaving(false);close()
  }
  const handleDelete=async(id)=>{if(window.confirm('Excluir este item?'))await onDelete(id)}
  const matColors={madeira:['#7c5c2e','#d4a843'],ferro:['#2e3d5e','#6ea8fe'],'acrílico':['#2a4a3e','#52d9a6']}
  const filtered=inventory.filter(i=>(filterMat==='all'||i.material===filterMat)&&(i.name.toLowerCase().includes(search.toLowerCase())||(i.category||'').toLowerCase().includes(search.toLowerCase())))

  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:20}}>
        {[['📦','Tipos',inventory.length],['🔢','Peças',inventory.reduce((a,i)=>a+Number(i.quantity||0),0)],['🎨','Pintados',inventory.filter(i=>i.painted).length],['🪵','Madeira',inventory.filter(i=>i.material==='madeira').length],['⚙️','Ferro',inventory.filter(i=>i.material==='ferro').length],['💎','Acrílico',inventory.filter(i=>i.material==='acrílico').length]].map(([ic,label,val])=>(
          <div key={label} className="card" style={{textAlign:'center',padding:'10px 8px'}}>
            <div style={{fontSize:18}}>{ic}</div>
            <div style={{fontSize:20,fontWeight:700,color:'#d4a843',fontFamily:'serif'}}>{val}</div>
            <div style={{fontSize:10,color:'#6a6080',marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input placeholder="🔍 Buscar…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:160}}/>
        <select value={filterMat} onChange={e=>setFilterMat(e.target.value)} style={{width:150}}>
          <option value="all">Todos os materiais</option>
          <option value="madeira">🪵 Madeira</option>
          <option value="ferro">⚙️ Ferro</option>
          <option value="acrílico">💎 Acrílico</option>
        </select>
        <button className="btn btn-gold" onClick={openNew}>+ Novo Item</button>
      </div>
      {filtered.length===0?(
        <div className="card" style={{textAlign:'center',padding:40,color:'#4a4060'}}>
          <div style={{fontSize:36}}>📭</div>
          <div style={{marginTop:8,fontFamily:'serif',fontSize:18}}>Nenhum item encontrado</div>
          <button className="btn btn-gold" style={{marginTop:14}} onClick={openNew}>+ Adicionar primeiro item</button>
        </div>
      ):(
        <div style={{display:'grid',gap:10}}>
          {filtered.map(it=>{
            const [bg,accent]=matColors[it.material]||['#2e2b4a','#aaa']
            const semPreco=!it.rentalPrice||Number(it.rentalPrice)===0
            const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(x=>x.itemId===it.id)).length
            const pct=Math.min(100,Math.round((useCount/Math.max(Number(it.expectedUses)||100,1))*100))
            return(
              <div key={it.id} className="card" style={{display:'flex',alignItems:'center',gap:14,borderColor:semPreco?'#5a3a00':'#2e2b4a',transition:'border-color .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=accent} onMouseLeave={e=>e.currentTarget.style.borderColor=semPreco?'#5a3a00':'#2e2b4a'}>
                <div style={{width:44,height:44,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                  {it.material==='madeira'?'🪵':it.material==='ferro'?'⚙️':'💎'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:'#e8dfc8',fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.name}</div>
                  <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                    <span className="tag" style={{background:bg,color:accent}}>{it.material.charAt(0).toUpperCase()+it.material.slice(1)}</span>
                    <span className="tag" style={{background:it.painted?'#1b3a1b':'#222',color:it.painted?'#6ee76e':'#777'}}>{it.painted?'🎨 Pintado':'⬜ Sem pintura'}</span>
                    {semPreco?<span className="tag" style={{background:'#3a2800',color:'#f0a020',border:'1px solid #8a5500'}}>⚠ Sem preço</span>:<span className="tag" style={{background:'#1c2a1c',color:'#a0d8a0'}}>💰 {R$(it.rentalPrice)}/un</span>}
                    <span className="tag" style={{background:'#1a1929',color:'#8a7a9a',border:'1px solid #2e2b4a'}}>🔄 {useCount} uso(s)</span>
                  </div>
                  {Number(it.replacementCost)>0&&(
                    <div style={{marginTop:5}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6a6080',marginBottom:2}}><span>Desgaste</span><span>{pct}%</span></div>
                      <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:pct>80?'#e05c5c':pct>50?'#f0a020':'#6ee76e'}}/></div>
                    </div>
                  )}
                </div>
                <div style={{textAlign:'center',padding:'0 12px',borderLeft:'1px solid #2e2b4a',flexShrink:0}}>
                  <div style={{fontSize:24,fontWeight:800,color:accent,fontFamily:'serif'}}>{it.quantity}</div>
                  <div style={{fontSize:10,color:'#6a6080',textTransform:'uppercase',letterSpacing:1}}>unid.</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-ghost" style={{padding:'6px 10px',fontSize:12}} onClick={()=>openEdit(it)}>✏️</button>
                  <button className="btn btn-danger" style={{padding:'6px 10px',fontSize:12}} onClick={()=>handleDelete(it.id)}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {showForm&&(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'serif',fontSize:20,color:'#d4a843',marginBottom:18}}>{editing?'✏️ Editar Item':'✦ Novo Item do Acervo'}</div>
            <div className="form-grid">
              <div style={{gridColumn:'1/-1'}}><label>Nome do Item *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Mesa Provençal…"/></div>
              <div><label>Quantidade em Estoque</label><input type="number" min="0" value={form.quantity} onChange={e=>set('quantity',Number(e.target.value))}/></div>
              <div>
                <label>💰 Preço de Locação (R$/un) *</label>
                <input type="number" min="0" step="0.01" value={form.rentalPrice} onChange={e=>set('rentalPrice',e.target.value)} placeholder="0,00"/>
                {(!form.rentalPrice||Number(form.rentalPrice)===0)&&<div style={{fontSize:11,color:'#f0a020',marginTop:4}}>⚠ Informe o preço para sincronizar com o carrinho.</div>}
              </div>
              <div><label>Material</label><select value={form.material} onChange={e=>set('material',e.target.value)}><option value="madeira">🪵 Madeira</option><option value="ferro">⚙️ Ferro</option><option value="acrílico">💎 Acrílico</option></select></div>
              <div><label>Categoria</label><input value={form.category} onChange={e=>set('category',e.target.value)} placeholder="Mobiliário, Iluminação…"/></div>
              <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
                <input type="checkbox" id="cb_p" checked={form.painted} onChange={e=>set('painted',e.target.checked)}/>
                <label htmlFor="cb_p" style={{margin:0,cursor:'pointer',fontSize:14,textTransform:'none',letterSpacing:0,color:'#e8dfc8'}}>🎨 Item está pintado</label>
              </div>
              <div style={{gridColumn:'1/-1'}}><div className="sec-label" style={{marginTop:8}}>📊 Controle de Desgaste</div></div>
              <div><label>Custo de Reposição (R$)</label><input type="number" min="0" step="0.01" value={form.replacementCost} onChange={e=>set('replacementCost',e.target.value)} placeholder="Quanto custa repor?"/></div>
              <div>
                <label>Vida Útil Esperada (usos)</label>
                <input type="number" min="1" value={form.expectedUses} onChange={e=>set('expectedUses',Number(e.target.value))} placeholder="100"/>
                {Number(form.replacementCost)>0&&Number(form.expectedUses)>0&&<div style={{fontSize:11,color:'#d4a843',marginTop:4}}>Custo/uso: {R$(Number(form.replacementCost)/Number(form.expectedUses))}</div>}
              </div>
              <div style={{gridColumn:'1/-1'}}><label>Observações</label><textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Cor, estado…" style={{resize:'vertical'}}/></div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18}}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Salvando…':editing?'💾 Salvar':'✦ Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rentals Tab ───────────────────────────────────────────────────────────────
function RentalsTab({rentals,inventory,onAdd,onUpdate,onDelete,onStatusChange}) {
  const [showForm,setShowForm]=useState(false)
  const [editingId,setEditingId]=useState(null)
  const [saving,setSaving]=useState(false)
  const blank={tenantName:'',address:'',phone:'',rentalDate:'',expectedReturnDate:'',actualReturnDate:'',dailyRate:'',amountPaid:'',exitBy:'',items:[],status:'ativa',totalOrder:0}
  const [form,setForm]=useState(blank)
  const [sel,setSel]=useState({itemId:'',qty:1})
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}))
  const openNew=()=>{setForm({...blank,rentalDate:new Date().toISOString().slice(0,10)});setEditingId(null);setShowForm(true)}
  const openEdit=(r)=>{setForm({...r});setEditingId(r.id);setShowForm(true)}
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
                      <span>📍 {r.address||'—'}</span><span>📞 {r.phone||'—'}</span>
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
                      <button className="btn btn-green" style={{fontSize:11,padding:'5px 9px'}} onClick={()=>printChecklist(r,inventory)}>🖨 Checklist</button>
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
              <div><label>Responsável pela Saída</label><input value={form.exitBy} onChange={e=>setF('exitBy',e.target.value)} placeholder="Nome de quem entregou"/></div>
            </div>
            <div className="sec-label">📅 Datas & Diária</div>
            <div className="form-grid">
              <div><label>Data de Saída</label><input type="date" value={form.rentalDate} onChange={e=>setF('rentalDate',e.target.value)} onBlur={autoDailyRate}/></div>
              <div><label>Retorno Previsto</label><input type="date" value={form.expectedReturnDate} onChange={e=>setF('expectedReturnDate',e.target.value)} onBlur={autoDailyRate}/></div>
              <div><label>Taxa Diária (R$)</label><input type="number" min="0" step="0.01" value={form.dailyRate} onChange={e=>setF('dailyRate',e.target.value)} placeholder="Auto-calculado"/></div>
              {editingId&&<div><label>Data de Retorno Real</label><input type="date" value={form.actualReturnDate} onChange={e=>setF('actualReturnDate',e.target.value)}/></div>}
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginTop:18,marginBottom:10}}>
              <div className="sec-label" style={{margin:0}}>🛒 Carrinho</div>
              {form.items.length>0&&<button className="btn btn-blue" style={{fontSize:11,padding:'4px 10px'}} onClick={syncPrices}>🔄 Sincronizar Preços</button>}
            </div>
            {inventory.length===0?<div style={{background:'#1a1929',border:'1px solid #2e2b4a',borderRadius:8,padding:14,color:'#6a6080',fontSize:13,marginBottom:12}}>⚠ Nenhum item no acervo.</div>:(
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <select value={sel.itemId} onChange={e=>setSel(p=>({...p,itemId:e.target.value}))} style={{flex:1}}>
                  <option value="">— Selecione um item —</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.material}) — {i.quantity} disp. {i.rentalPrice?`— ${R$(i.rentalPrice)}/un`:''}</option>)}
                </select>
                <input type="number" min="1" value={sel.qty} onChange={e=>setSel(p=>({...p,qty:e.target.value}))} style={{width:64}}/>
                <button className="btn btn-gold" onClick={addItem} style={{whiteSpace:'nowrap',padding:'8px 14px'}}>+ Add</button>
              </div>
            )}
            {form.items.length>0&&(
              <div style={{background:'#0f0e17',border:'1px solid #2e2b4a',borderRadius:10,overflow:'hidden',marginBottom:4}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',padding:'6px 12px',background:'#1a1929',fontSize:10,color:'#6a6080',textTransform:'uppercase'}}>
                  <span>Item</span><span style={{textAlign:'center'}}>Qtd</span><span style={{textAlign:'right'}}>Vl. Unit.</span><span style={{textAlign:'right'}}>Subtotal</span><span></span>
                </div>
                {form.items.map(it=>{
                  const inv=inventory.find(i=>i.id===it.itemId),sub=it.unitPrice*it.qty
                  const diverge=inv&&Number(inv.rentalPrice)!==Number(it.unitPrice)
                  return(
                    <div key={it.itemId} style={{display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',alignItems:'center',padding:'7px 12px',borderTop:'1px solid #1e1d35'}}>
                      <div>
                        <div style={{color:'#e8dfc8',fontSize:13,fontWeight:600}}>{inv?inv.name:'?'}</div>
                        <div style={{fontSize:10,color:'#6a6080'}}>{inv?inv.material:''}{diverge&&<span style={{color:'#f0a020'}}> ⚠ diverge</span>}</div>
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
              <div style={{color:'#c0a0a0',fontSize:11,marginTop:3}}>Multa de 100% por avaria · Taxa de {R$(form.dailyRate||0)}/dia por atraso.</div>
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
function FinanceTab({rentals,inventory}) {
  const [period,setPeriod]=useState('month')
  const filtered=filterByPeriod(rentals.filter(r=>r.status!=='cancelada'),period)
  const totalBilled=filtered.reduce((a,r)=>a+calcTotal(r.items||[]),0)
  const totalPaid=filtered.reduce((a,r)=>a+Number(r.amountPaid||0),0)
  const totalDebt=filtered.reduce((a,r)=>a+calcDebito(r),0)
  const totalOv=filtered.reduce((a,r)=>a+calcOverdue(r),0)

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
        {[['💰','Faturado',R$(totalBilled),'#d4a843','#1a150a','#4a3800'],['✅','Recebido',R$(totalPaid),'#6ee76e','#0f1a0f','#2e4a2e'],['⚠️','Em Débito',R$(totalDebt),totalDebt>0?'#e05c5c':'#6ee76e',totalDebt>0?'#1a0f0f':'#0f1a0f',totalDebt>0?'#5a2222':'#2e4a2e'],['⏰','Atrasos',R$(totalOv),totalOv>0?'#f0a020':'#6ee76e','#1a1000',totalOv>0?'#8a4a00':'#2e4a2e'],['📊','Total Recebido',R$(totalPaid+totalOv),'#a8d4ff','#0a1020','#1e3a5f']].map(([ic,label,val,clr,bg,bd])=>(
          <div key={label} style={{background:bg,border:`1px solid ${bd}`,borderRadius:12,padding:'16px 12px',textAlign:'center'}}>
            <div style={{fontSize:22}}>{ic}</div>
            <div style={{fontSize:typeof val==='string'&&val.length>10?14:18,fontWeight:700,color:clr,fontFamily:'serif',marginTop:4}}>{val}</div>
            <div style={{fontSize:10,color:'#6a6080',marginTop:3,textTransform:'uppercase',letterSpacing:0.8}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{fontFamily:'serif',fontSize:17,color:'#d4a843',marginBottom:14}}>📋 Locações do Período</div>
      {filtered.length===0?(
        <div className="card" style={{textAlign:'center',padding:32,color:'#4a4060'}}>
          <div style={{fontSize:32}}>📭</div>
          <div style={{marginTop:8}}>Nenhuma locação neste período.</div>
        </div>
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
      <div style={{fontFamily:'serif',fontSize:17,color:'#d4a843',marginBottom:14}}>📊 Desgaste de Material</div>
      {inventory.filter(i=>Number(i.replacementCost)>0).length===0?(
        <div className="card" style={{padding:20,color:'#6a6080',fontSize:13}}>Nenhum item com custo de reposição cadastrado.<br/><span style={{fontSize:12}}>Vá em <strong style={{color:'#d4a843'}}>Administrativo → Acervo</strong> e informe o custo de reposição e vida útil de cada item.</span></div>
      ):(
        <div style={{background:'#16152a',border:'1px solid #2e2b4a',borderRadius:12,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 70px 90px 90px 100px 90px',padding:'8px 16px',background:'#1a1929',fontSize:10,color:'#6a6080',textTransform:'uppercase'}}>
            <span>Item</span><span style={{textAlign:'center'}}>Usos</span><span style={{textAlign:'right'}}>Custo/Uso</span><span style={{textAlign:'right'}}>Acumulado</span><span style={{textAlign:'center'}}>Vida Útil</span><span style={{textAlign:'right'}}>Reposição</span>
          </div>
          {inventory.filter(i=>Number(i.replacementCost)>0).map((it,idx)=>{
            const dep=getDepreciation(it,rentals)
            const barColor=dep.pct>80?'#e05c5c':dep.pct>50?'#f0a020':'#6ee76e'
            return(
              <div key={it.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 90px 90px 100px 90px',alignItems:'center',padding:'12px 16px',borderTop:'1px solid #1e1d35',background:idx%2===0?'transparent':'#0f0e1710'}}>
                <div><div style={{color:'#e8dfc8',fontSize:13,fontWeight:600}}>{it.name}</div><div style={{fontSize:11,color:'#6a6080'}}>{it.material}</div></div>
                <div style={{textAlign:'center',fontSize:14,fontWeight:700,color:'#a8d4ff'}}>{dep.useCount}</div>
                <div style={{textAlign:'right',fontSize:13,color:'#d4a843'}}>{R$(dep.costPerUse)}</div>
                <div style={{textAlign:'right',fontSize:13,color:dep.pct>80?'#e05c5c':'#f0a020',fontWeight:600}}>{R$(dep.accumulated)}</div>
                <div style={{padding:'0 8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6a6080',marginBottom:3}}><span>{dep.remaining} rest.</span><span>{dep.pct}%</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${dep.pct}%`,background:barColor}}/></div>
                  {dep.pct>=100&&<div style={{fontSize:10,color:'#e05c5c',marginTop:3,fontWeight:700}}>⚠ Reposição necessária!</div>}
                </div>
                <div style={{textAlign:'right',fontSize:13,color:'#8a7a9a'}}>{R$(dep.replacementCost)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
