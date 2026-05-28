import { useState } from 'react'
import { uid, R$, fmtDate, calcTotal, calcDebito, calcOverdue, calcOverdueDays } from './utils.js'
import { printChecklist } from './print.js'

export default function RentalsTab({ rentals, inventory, onAdd, onUpdate, onDelete, onStatusChange }) {
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving]       = useState(false)

  const blank = { tenantName:'', address:'', phone:'', rentalDate:'', expectedReturnDate:'', actualReturnDate:'', dailyRate:'', amountPaid:'', exitBy:'', items:[], status:'ativa', totalOrder:0 }
  const [form, setForm] = useState(blank)
  const [sel, setSel]   = useState({ itemId:'', qty:1 })
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))

  const openNew  = () => { setForm({...blank, rentalDate:new Date().toISOString().slice(0,10)}); setEditingId(null); setShowForm(true) }
  const openEdit = (r)  => { setForm({...r}); setEditingId(r.id); setShowForm(true) }
  const close    = () => { setShowForm(false); setEditingId(null) }

  const formTotal  = calcTotal(form.items)
  const formPaid   = Number(form.amountPaid||0)
  const formDebito = Math.max(0,formTotal-formPaid)

  // Auto-calc daily rate from total and date range
  const autoDailyRate = () => {
    if (!form.rentalDate||!form.expectedReturnDate) return
    const days = Math.max(1,Math.round((new Date(form.expectedReturnDate+'T12:00:00')-new Date(form.rentalDate+'T12:00:00'))/86400000))
    if (formTotal>0) setF('dailyRate',(formTotal/days).toFixed(2))
  }

  const syncPrices = () => setForm(p=>({...p,items:p.items.map(it=>{const inv=inventory.find(i=>i.id===it.itemId);return inv&&inv.rentalPrice?{...it,unitPrice:Number(inv.rentalPrice)}:it})}))

  const addItem = () => {
    if (!sel.itemId) return
    const inv=inventory.find(i=>i.id===sel.itemId); if (!inv) return
    const qty=Math.max(1,Math.min(Number(sel.qty)||1,inv.quantity)), unitPrice=Number(inv.rentalPrice||0)
    const exists=form.items.find(i=>i.itemId===sel.itemId)
    if (exists) setForm(p=>({...p,items:p.items.map(i=>i.itemId===sel.itemId?{...i,qty:Math.min(i.qty+qty,inv.quantity),unitPrice}:i)}))
    else        setForm(p=>({...p,items:[...p.items,{itemId:sel.itemId,qty,unitPrice}]}))
    setSel({itemId:'',qty:1})
  }
  const removeItem     = (id)    => setForm(p=>({...p,items:p.items.filter(i=>i.itemId!==id)}))
  const updateCartItem = (id,f,v)=> setForm(p=>({...p,items:p.items.map(i=>{
    if(i.itemId!==id) return i
    const inv=inventory.find(x=>x.id===id)
    if(f==='qty')       return {...i,qty:Math.max(1,Math.min(Number(v)||1,inv?inv.quantity:999))}
    if(f==='unitPrice') return {...i,unitPrice:Number(v)||0}
    return i
  })}))

  const handleSave = async () => {
    if (!form.tenantName.trim()) return alert('Preencha o nome do locatário.')
    if (form.items.length===0)   return alert('Adicione ao menos um item.')
    setSaving(true)
    const data={...form,totalOrder:formTotal}
    editingId ? await onUpdate({...data,id:editingId}) : await onAdd({...data,id:uid()})
    setSaving(false); close()
  }
  const handleDelete = async (id) => { if(window.confirm('Excluir esta locação?')) await onDelete(id) }

  // Set actual return date inline
  const handleSetReturn = async (r) => {
    const date = prompt('Data de devolução real (AAAA-MM-DD):', new Date().toISOString().slice(0,10))
    if (!date) return
    await onUpdate({...r, actualReturnDate:date, status:'concluída'})
  }

  const statusColors = { ativa:['#1b3a1b','#6ee76e'], 'concluída':['#1a2a4a','#6ea8fe'], cancelada:['#3a1c1c','#e05c5c'] }
  const totalFat = rentals.reduce((a,r)=>a+calcTotal(r.items||[]),0)
  const totalDeb = rentals.filter(r=>r.status==='ativa').reduce((a,r)=>a+calcDebito(r),0)
  const totalOverdue = rentals.reduce((a,r)=>a+calcOverdue(r),0)

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
        {[['🎪','Locações',rentals.length,'#d4a843'],['✅','Ativas',rentals.filter(r=>r.status==='ativa').length,'#6ee76e'],['💰','Faturamento',R$(totalFat),'#d4a843'],['⚠️','Em Débito',R$(totalDeb),totalDeb>0?'#e05c5c':'#6ee76e'],['⏰','Atrasos',R$(totalOverdue),totalOverdue>0?'#f0a020':'#6ee76e']].map(([ic,label,val,clr])=>(
          <div key={label} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
            <div style={{ fontSize:18 }}>{ic}</div>
            <div style={{ fontSize:typeof val==='string'&&val.length>8?14:20, fontWeight:700, color:clr, fontFamily:'serif', marginTop:2 }}>{val}</div>
            <div style={{ fontSize:10, color:'#6a6080', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-gold" onClick={openNew}>+ Nova Locação</button>
      </div>

      {rentals.length===0 ? (
        <div className="card" style={{ textAlign:'center', padding:48, color:'#4a4060' }}>
          <div style={{ fontSize:40 }}>🎪</div>
          <div style={{ marginTop:8, fontFamily:'serif', fontSize:18 }}>Nenhuma locação registrada</div>
          <button className="btn btn-gold" style={{ marginTop:16 }} onClick={openNew}>+ Registrar primeira locação</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {rentals.map(r=>{
            const [sbg,sclr]=statusColors[r.status]||['#2e2b4a','#aaa']
            const rTotal=calcTotal(r.items||[]), rPago=Number(r.amountPaid||0), rDebito=Math.max(0,rTotal-rPago)
            const overdue=calcOverdue(r), overdueDays=calcOverdueDays(r)
            const isLate=overdueDays>0&&r.status==='ativa'
            return (
              <div key={r.id} className="card" style={{ borderColor:isLate?'#8a4a00':rDebito>0&&r.status==='ativa'?'#5a2222':'#2e2b4a', transition:'border-color .3s' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:220 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, color:'#e8dfc8', fontSize:15 }}>👤 {r.tenantName}</span>
                      <span className="tag" style={{ background:sbg, color:sclr }}>{r.status}</span>
                      {isLate&&<span className="tag" style={{ background:'#3a2000', color:'#f0a020', border:'1px solid #8a4a00' }}>⏰ {overdueDays}d atraso</span>}
                      <span style={{ fontSize:11, color:'#4a4060' }}>#{(r.id||'').toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#8a7a9a', marginTop:5, display:'flex', flexWrap:'wrap', gap:'2px 14px' }}>
                      <span>📍 {r.address||'—'}</span>
                      <span>📞 {r.phone||'—'}</span>
                      <span>📅 Saída: {fmtDate(r.rentalDate)}</span>
                      <span>🔄 Retorno: {fmtDate(r.expectedReturnDate)||'—'}</span>
                      {r.actualReturnDate&&<span style={{ color:'#6ee76e' }}>✅ Devolvido: {fmtDate(r.actualReturnDate)}</span>}
                      <span>🧑 {r.exitBy||'—'}</span>
                    </div>
                    <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:4 }}>
                      {(r.items||[]).map(it=>{const inv=inventory.find(i=>i.id===it.itemId);return inv?(<span key={it.itemId} className="tag" style={{ background:'#1e1d35',color:'#b0a8c0' }}>{inv.name} ×{it.qty} · {R$(it.unitPrice)}</span>):null})}
                    </div>
                  </div>
                  <div style={{ flexShrink:0, minWidth:220 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:6 }}>
                      {[['Total',R$(rTotal),'#d4a843','#0f0e17','#2e2b4a'],['Pago',R$(rPago),'#6ee76e','#0f1a0f','#2e4a2e'],[rDebito>0?'Débito':'Quitado',R$(rDebito),rDebito>0?'#e05c5c':'#6ee76e',rDebito>0?'#1a0f0f':'#0f1a0f',rDebito>0?'#5a2222':'#2e4a2e']].map(([l,v,c,bg,bd])=>(
                        <div key={l} style={{ background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:'5px 6px',textAlign:'center' }}>
                          <div style={{ fontSize:9,color:'#6a6080',textTransform:'uppercase' }}>{l}</div>
                          <div style={{ fontSize:12,fontWeight:700,color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {overdue>0&&(
                      <div style={{ background:'#3a2000', border:'1px solid #8a4a00', borderRadius:8, padding:'5px 10px', marginBottom:6, textAlign:'center' }}>
                        <div style={{ fontSize:9,color:'#8a6040',textTransform:'uppercase' }}>⏰ Taxa de Atraso ({overdueDays}d)</div>
                        <div style={{ fontSize:13,fontWeight:700,color:'#f0a020' }}>{R$(overdue)}</div>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:5, justifyContent:'flex-end', flexWrap:'wrap' }}>
                      <button className="btn btn-blue"   style={{ fontSize:11,padding:'5px 9px' }} onClick={()=>openEdit(r)}>✏️ Ajustar</button>
                      <button className="btn btn-green"  style={{ fontSize:11,padding:'5px 9px' }} onClick={()=>printChecklist(r,inventory)}>🖨 Checklist</button>
                      {r.status==='ativa'&&!r.actualReturnDate&&(
                        <button className="btn btn-orange" style={{ fontSize:11,padding:'5px 9px' }} onClick={()=>handleSetReturn(r)}>📦 Devolvido</button>
                      )}
                      <select value={r.status} onChange={e=>onStatusChange(r.id,e.target.value)}
                        style={{ width:'auto',cursor:'pointer',padding:'5px 8px',fontSize:11,borderRadius:6 }}>
                        <option value="ativa">Ativa</option>
                        <option value="concluída">Concluída</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                      <button className="btn btn-danger" style={{ fontSize:11,padding:'5px 9px' }} onClick={()=>handleDelete(r.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm&&(
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:'serif', fontSize:20, color:'#d4a843', marginBottom:2 }}>{editingId?'✏️ Ajustar Pedido':'✦ Nova Locação'}</div>
            <div style={{ fontSize:11, color:'#6a6080', marginBottom:18 }}>{editingId?'Edite os dados, itens ou valores.':'Preencha os dados e monte o carrinho.'}</div>

            <div className="sec-label">Dados do Locatário</div>
            <div className="form-grid">
              <div style={{ gridColumn:'1/-1' }}><label>Nome do Locatário *</label><input value={form.tenantName} onChange={e=>setF('tenantName',e.target.value)} placeholder="Nome completo" /></div>
              <div style={{ gridColumn:'1/-1' }}><label>Endereço</label><input value={form.address} onChange={e=>setF('address',e.target.value)} placeholder="Rua, número, bairro, cidade" /></div>
              <div><label>Telefone</label><input value={form.phone} onChange={e=>setF('phone',e.target.value)} placeholder="(00) 00000-0000" /></div>
              <div><label>Responsável pela Saída</label><input value={form.exitBy} onChange={e=>setF('exitBy',e.target.value)} placeholder="Nome de quem entregou" /></div>
            </div>

            <div className="sec-label">📅 Datas & Diária</div>
            <div className="form-grid">
              <div><label>Data de Saída</label><input type="date" value={form.rentalDate} onChange={e=>setF('rentalDate',e.target.value)} onBlur={autoDailyRate} /></div>
              <div><label>Data de Retorno Prevista</label><input type="date" value={form.expectedReturnDate} onChange={e=>setF('expectedReturnDate',e.target.value)} onBlur={autoDailyRate} /></div>
              <div>
                <label>Taxa Diária (R$)</label>
                <input type="number" min="0" step="0.01" value={form.dailyRate} onChange={e=>setF('dailyRate',e.target.value)} placeholder="Auto-calculado" />
                <div style={{ fontSize:11,color:'#6a6080',marginTop:3 }}>Cobrada por dia de atraso na devolução</div>
              </div>
              {editingId&&(
                <div><label>Data de Retorno Real</label><input type="date" value={form.actualReturnDate} onChange={e=>setF('actualReturnDate',e.target.value)} /></div>
              )}
            </div>

            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginTop:18,marginBottom:10 }}>
              <div className="sec-label" style={{ margin:0 }}>🛒 Carrinho de Itens</div>
              {form.items.length>0&&<button className="btn btn-blue" style={{ fontSize:11,padding:'4px 10px' }} onClick={syncPrices}>🔄 Sincronizar Preços</button>}
            </div>

            {inventory.length===0 ? (
              <div style={{ background:'#1a1929',border:'1px solid #2e2b4a',borderRadius:8,padding:14,color:'#6a6080',fontSize:13,marginBottom:12 }}>⚠ Nenhum item no acervo.</div>
            ) : (
              <div style={{ display:'flex',gap:8,marginBottom:10 }}>
                <select value={sel.itemId} onChange={e=>setSel(p=>({...p,itemId:e.target.value}))} style={{ flex:1 }}>
                  <option value="">— Selecione um item —</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.material}) — {i.quantity} disp. {i.rentalPrice?`— ${R$(i.rentalPrice)}/un`:'— ⚠ sem preço'}</option>)}
                </select>
                <input type="number" min="1" value={sel.qty} onChange={e=>setSel(p=>({...p,qty:e.target.value}))} style={{ width:64 }} />
                <button className="btn btn-gold" onClick={addItem} style={{ whiteSpace:'nowrap',padding:'8px 14px' }}>+ Add</button>
              </div>
            )}

            {form.items.length>0&&(
              <div style={{ background:'#0f0e17',border:'1px solid #2e2b4a',borderRadius:10,overflow:'hidden',marginBottom:4 }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',padding:'6px 12px',background:'#1a1929',fontSize:10,color:'#6a6080',textTransform:'uppercase',letterSpacing:0.8 }}>
                  <span>Item</span><span style={{ textAlign:'center' }}>Qtd</span><span style={{ textAlign:'right' }}>Vl. Unit.</span><span style={{ textAlign:'right' }}>Subtotal</span><span></span>
                </div>
                {form.items.map(it=>{
                  const inv=inventory.find(i=>i.id===it.itemId), sub=it.unitPrice*it.qty
                  const diverge=inv&&Number(inv.rentalPrice)!==Number(it.unitPrice)
                  return (
                    <div key={it.itemId} style={{ display:'grid',gridTemplateColumns:'1fr 60px 100px 90px 32px',alignItems:'center',padding:'7px 12px',borderTop:'1px solid #1e1d35' }}>
                      <div>
                        <div style={{ color:'#e8dfc8',fontSize:13,fontWeight:600 }}>{inv?inv.name:'?'}</div>
                        <div style={{ fontSize:10,color:'#6a6080',display:'flex',gap:4 }}>{inv?inv.material:''}{diverge&&<span style={{ color:'#f0a020' }}>⚠ diverge ({R$(inv.rentalPrice)}/un)</span>}</div>
                      </div>
                      <div><input type="number" min="1" value={it.qty} onChange={e=>updateCartItem(it.itemId,'qty',e.target.value)} style={{ width:50,textAlign:'center',padding:'4px',fontSize:13 }} /></div>
                      <div><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e=>updateCartItem(it.itemId,'unitPrice',e.target.value)} style={{ width:90,textAlign:'right',padding:'4px 6px',fontSize:13 }} /></div>
                      <div style={{ textAlign:'right',color:'#d4a843',fontWeight:700,fontSize:14 }}>{R$(sub)}</div>
                      <div><button className="btn btn-danger" style={{ padding:'3px 6px',fontSize:11 }} onClick={()=>removeItem(it.itemId)}>✕</button></div>
                    </div>
                  )
                })}
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#1a1929',borderTop:'2px solid #2e2b4a' }}>
                  <span style={{ fontSize:12,color:'#8a7a9a' }}>{form.items.length} {form.items.length===1?'item':'itens'}</span>
                  <span style={{ fontWeight:700,color:'#d4a843',fontSize:16,fontFamily:'serif' }}>Total: {R$(formTotal)}</span>
                </div>
              </div>
            )}

            <div className="sec-label">💳 Pagamento</div>
            <div className="form-grid" style={{ marginBottom:0 }}>
              <div><label>Valor Pago (R$)</label><input type="number" step="0.01" min="0" value={form.amountPaid} onChange={e=>setF('amountPaid',e.target.value)} placeholder="0,00" /></div>
              <div style={{ display:'flex',alignItems:'flex-end' }}>
                <div style={{ width:'100%',background:formDebito>0?'#1a0f0f':'#0f1a0f',border:`1px solid ${formDebito>0?'#5a2222':'#2e4a2e'}`,borderRadius:8,padding:'10px 14px' }}>
                  <div style={{ fontSize:10,color:'#6a6080',textTransform:'uppercase',letterSpacing:1,marginBottom:2 }}>{formDebito>0?'⚠ Valor em Débito':formTotal>0?'✅ Quitado':'Débito'}</div>
                  <div style={{ fontSize:18,fontWeight:800,color:formDebito>0?'#e05c5c':'#6ee76e',fontFamily:'serif' }}>{R$(formDebito)}</div>
                </div>
              </div>
            </div>

            {formTotal>0&&(
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:10 }}>
                {[['TOTAL',R$(formTotal),'#d4a843','#0f0e17','#2e2b4a'],['PAGO',R$(formPaid),'#6ee76e','#0f1a0f','#2e4a2e'],['DÉBITO',R$(formDebito),formDebito>0?'#e05c5c':'#6ee76e',formDebito>0?'#1a0f0f':'#0f1a0f',formDebito>0?'#5a2222':'#2e4a2e']].map(([l,v,c,bg,bd])=>(
                  <div key={l} style={{ background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:'8px 10px',textAlign:'center' }}>
                    <div style={{ fontSize:10,color:'#6a6080' }}>{l}</div>
                    <div style={{ fontWeight:700,color:c,fontSize:15 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:'#1b0d0d',border:'1px solid #5a2222',borderRadius:8,padding:'9px 14px',marginTop:16,marginBottom:20 }}>
              <div style={{ color:'#e05c5c',fontSize:11,fontWeight:700 }}>⚠ Incluído automaticamente no checklist:</div>
              <div style={{ color:'#c0a0a0',fontSize:11,marginTop:3 }}>Multa de 100% por avaria · Taxa diária de {R$(form.dailyRate||0)} por atraso na devolução.</div>
            </div>

            <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Salvando…':editingId?'💾 Salvar Ajustes':'✦ Registrar Locação'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
