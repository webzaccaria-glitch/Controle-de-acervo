import { useState } from 'react'
import { uid, R$, checkPin, setPin, getPin } from './utils.js'

export default function InventoryTab({ inventory, rentals, onAdd, onUpdate, onDelete }) {
  const [unlocked, setUnlocked]   = useState(false)
  const [pinInput, setPinInput]   = useState('')
  const [pinError, setPinError]   = useState('')
  const [changingPin, setChanging]= useState(false)
  const [newPin, setNewPin]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [filterMat, setFilterMat] = useState('all')

  // ── PIN Gate ──────────────────────────────────────────────────────────────
  const handlePin = () => {
    if (checkPin(pinInput)) { setUnlocked(true); setPinError(''); setPinInput('') }
    else { setPinError('PIN incorreto. Tente novamente.'); setPinInput('') }
  }
  const handleChangePin = () => {
    if (newPin.length < 4) { setPinError('PIN deve ter no mínimo 4 dígitos.'); return }
    setPin(newPin); setNewPin(''); setChanging(false); setPinError('')
    alert('PIN alterado com sucesso!')
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const blank = { name:'', quantity:1, rentalPrice:'', painted:false, material:'madeira', category:'', notes:'', replacementCost:'', expectedUses:100 }
  const [form, setForm] = useState(blank)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const openNew  = () => { setForm(blank); setEditing(null); setShowForm(true) }
  const openEdit = (it) => { setForm({...it}); setEditing(it.id); setShowForm(true) }
  const close    = () => { setShowForm(false); setEditing(null) }
  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    editing ? await onUpdate({...form,id:editing}) : await onAdd({...form,id:uid()})
    setSaving(false); close()
  }
  const handleDelete = async (id) => { if(window.confirm('Excluir este item?')) await onDelete(id) }

  // ── PIN gate screen ───────────────────────────────────────────────────────
  if (!unlocked) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
      <div className="card" style={{ maxWidth:380, width:'100%', textAlign:'center', padding:36 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
        <div style={{ fontFamily:'serif', fontSize:20, color:'#d4a843', marginBottom:6 }}>Área Administrativa</div>
        <div style={{ fontSize:13, color:'#6a6080', marginBottom:24 }}>Esta área é restrita. Digite o PIN para continuar.</div>
        {!changingPin ? (
          <>
            <input type="password" inputMode="numeric" maxLength={8} value={pinInput}
              onChange={e=>setPinInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handlePin()}
              placeholder="Digite o PIN" style={{ textAlign:'center', letterSpacing:6, fontSize:18, marginBottom:8 }} />
            {pinError && <div style={{ color:'#e05c5c', fontSize:12, marginBottom:8 }}>{pinError}</div>}
            <button className="btn btn-gold" style={{ width:'100%', justifyContent:'center', marginBottom:10 }} onClick={handlePin}>
              Entrar
            </button>
            <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12 }} onClick={()=>{setChanging(true);setPinError('')}}>
              🔑 Alterar PIN
            </button>
            <div style={{ fontSize:11, color:'#4a4060', marginTop:16 }}>PIN padrão: <code style={{color:'#d4a843'}}>1234</code></div>
          </>
        ) : (
          <>
            <div style={{ fontSize:13, color:'#8a7a9a', marginBottom:12 }}>Digite o PIN atual e depois o novo:</div>
            <input type="password" inputMode="numeric" maxLength={8} value={pinInput}
              onChange={e=>setPinInput(e.target.value)} placeholder="PIN atual" style={{ textAlign:'center', marginBottom:8 }} />
            <input type="password" inputMode="numeric" maxLength={8} value={newPin}
              onChange={e=>setNewPin(e.target.value)} placeholder="Novo PIN" style={{ textAlign:'center', marginBottom:8 }} />
            {pinError && <div style={{ color:'#e05c5c', fontSize:12, marginBottom:8 }}>{pinError}</div>}
            <button className="btn btn-gold" style={{ width:'100%', justifyContent:'center', marginBottom:8 }} onClick={()=>{
              if (!checkPin(pinInput)) { setPinError('PIN atual incorreto.'); return }
              handleChangePin()
            }}>Salvar novo PIN</button>
            <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12 }} onClick={()=>{setChanging(false);setPinError('');setPinInput('');setNewPin('')}}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  )

  const matColors = { madeira:['#7c5c2e','#d4a843'], ferro:['#2e3d5e','#6ea8fe'], 'acrílico':['#2a4a3e','#52d9a6'] }
  const filtered  = inventory.filter(i =>
    (filterMat==='all'||i.material===filterMat) &&
    (i.name.toLowerCase().includes(search.toLowerCase())||(i.category||'').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      {/* Header de admin */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#6ee76e', background:'#1b3a1b', border:'1px solid #2e4a2e', borderRadius:20, padding:'2px 10px' }}>🔓 Admin</span>
          <span style={{ fontSize:12, color:'#6a6080' }}>Área de gerenciamento do acervo</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize:11, padding:'4px 10px' }} onClick={()=>setUnlocked(false)}>🔒 Bloquear</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:20 }}>
        {[['📦','Tipos',inventory.length],['🔢','Peças',inventory.reduce((a,i)=>a+Number(i.quantity||0),0)],['🎨','Pintados',inventory.filter(i=>i.painted).length],['🪵','Madeira',inventory.filter(i=>i.material==='madeira').length],['⚙️','Ferro',inventory.filter(i=>i.material==='ferro').length],['💎','Acrílico',inventory.filter(i=>i.material==='acrílico').length]].map(([ic,label,val])=>(
          <div key={label} className="card" style={{ textAlign:'center', padding:'10px 8px' }}>
            <div style={{ fontSize:18 }}>{ic}</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#d4a843', fontFamily:'serif' }}>{val}</div>
            <div style={{ fontSize:10, color:'#6a6080', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input placeholder="🔍 Buscar item ou categoria…" value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
        <select value={filterMat} onChange={e=>setFilterMat(e.target.value)} style={{ width:150 }}>
          <option value="all">Todos os materiais</option>
          <option value="madeira">🪵 Madeira</option>
          <option value="ferro">⚙️ Ferro</option>
          <option value="acrílico">💎 Acrílico</option>
        </select>
        <button className="btn btn-gold" onClick={openNew}>+ Novo Item</button>
      </div>

      {/* List */}
      {filtered.length===0 ? (
        <div className="card" style={{ textAlign:'center', padding:40, color:'#4a4060' }}>
          <div style={{ fontSize:36 }}>📭</div>
          <div style={{ marginTop:8, fontFamily:'serif', fontSize:18 }}>Nenhum item encontrado</div>
          <button className="btn btn-gold" style={{ marginTop:14 }} onClick={openNew}>+ Adicionar primeiro item</button>
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {filtered.map(it=>{
            const [bg,accent]=matColors[it.material]||['#2e2b4a','#aaa']
            const semPreco=!it.rentalPrice||Number(it.rentalPrice)===0
            const useCount=rentals.filter(r=>r.status!=='cancelada'&&(r.items||[]).some(x=>x.itemId===it.id)).length
            const pct=Math.min(100,Math.round((useCount/Math.max(Number(it.expectedUses)||100,1))*100))
            return (
              <div key={it.id} className="card"
                style={{ display:'flex', alignItems:'center', gap:14, borderColor:semPreco?'#5a3a00':'#2e2b4a', transition:'border-color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=semPreco?'#5a3a00':'#2e2b4a'}>
                <div style={{ width:44,height:44,borderRadius:10,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>
                  {it.material==='madeira'?'🪵':it.material==='ferro'?'⚙️':'💎'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:'#e8dfc8', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name}</div>
                  <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                    <span className="tag" style={{ background:bg, color:accent }}>{it.material.charAt(0).toUpperCase()+it.material.slice(1)}</span>
                    <span className="tag" style={{ background:it.painted?'#1b3a1b':'#222', color:it.painted?'#6ee76e':'#777' }}>{it.painted?'🎨 Pintado':'⬜ Sem pintura'}</span>
                    {semPreco
                      ? <span className="tag" style={{ background:'#3a2800', color:'#f0a020', border:'1px solid #8a5500' }}>⚠ Sem preço</span>
                      : <span className="tag" style={{ background:'#1c2a1c', color:'#a0d8a0' }}>💰 {R$(it.rentalPrice)}/un</span>}
                    <span className="tag" style={{ background:'#1a1929', color:'#8a7a9a', border:'1px solid #2e2b4a' }}>🔄 {useCount} uso(s)</span>
                  </div>
                  {Number(it.replacementCost)>0 && (
                    <div style={{ marginTop:5 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#6a6080', marginBottom:2 }}>
                        <span>Desgaste</span><span>{pct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${pct}%`, background:pct>80?'#e05c5c':pct>50?'#f0a020':'#6ee76e' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'center', padding:'0 12px', borderLeft:'1px solid #2e2b4a', flexShrink:0 }}>
                  <div style={{ fontSize:24,fontWeight:800,color:accent,fontFamily:'serif' }}>{it.quantity}</div>
                  <div style={{ fontSize:10,color:'#6a6080',textTransform:'uppercase',letterSpacing:1 }}>unid.</div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:12 }} onClick={()=>openEdit(it)}>✏️</button>
                  <button className="btn btn-danger" style={{ padding:'6px 10px', fontSize:12 }} onClick={()=>handleDelete(it.id)}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:'serif', fontSize:20, color:'#d4a843', marginBottom:18 }}>{editing?'✏️ Editar Item':'✦ Novo Item do Acervo'}</div>
            <div className="form-grid">
              <div style={{ gridColumn:'1/-1' }}><label>Nome do Item *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Mesa Provençal, Lustre de Ferro…" /></div>
              <div><label>Quantidade em Estoque</label><input type="number" min="0" value={form.quantity} onChange={e=>set('quantity',Number(e.target.value))} /></div>
              <div>
                <label>💰 Preço de Locação (R$/un) *</label>
                <input type="number" min="0" step="0.01" value={form.rentalPrice} onChange={e=>set('rentalPrice',e.target.value)} placeholder="0,00" />
                {(!form.rentalPrice||Number(form.rentalPrice)===0)&&<div style={{ fontSize:11,color:'#f0a020',marginTop:4 }}>⚠ Informe o preço para sincronizar com o carrinho.</div>}
              </div>
              <div><label>Material</label><select value={form.material} onChange={e=>set('material',e.target.value)}><option value="madeira">🪵 Madeira</option><option value="ferro">⚙️ Ferro</option><option value="acrílico">💎 Acrílico</option></select></div>
              <div><label>Categoria</label><input value={form.category} onChange={e=>set('category',e.target.value)} placeholder="Ex: Mobiliário, Iluminação…" /></div>
              <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:20 }}>
                <input type="checkbox" id="cb_p" checked={form.painted} onChange={e=>set('painted',e.target.checked)} />
                <label htmlFor="cb_p" style={{ margin:0, cursor:'pointer', fontSize:14, textTransform:'none', letterSpacing:0, color:'#e8dfc8' }}>🎨 Item está pintado</label>
              </div>

              {/* Desgaste */}
              <div style={{ gridColumn:'1/-1' }}>
                <div className="sec-label" style={{ marginTop:8 }}>📊 Controle de Desgaste</div>
              </div>
              <div>
                <label>Custo de Reposição (R$)</label>
                <input type="number" min="0" step="0.01" value={form.replacementCost} onChange={e=>set('replacementCost',e.target.value)} placeholder="Quanto custa repor este item?" />
              </div>
              <div>
                <label>Vida Útil Esperada (usos)</label>
                <input type="number" min="1" value={form.expectedUses} onChange={e=>set('expectedUses',Number(e.target.value))} placeholder="Ex: 100" />
                <div style={{ fontSize:11,color:'#6a6080',marginTop:4 }}>Quantas locações antes de precisar repor?</div>
              </div>
              {Number(form.replacementCost)>0&&Number(form.expectedUses)>0&&(
                <div style={{ gridColumn:'1/-1', background:'#0f0e17', border:'1px solid #2e2b4a', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:12,color:'#8a7a9a' }}>Custo por uso: <span style={{ color:'#d4a843',fontWeight:700 }}>{R$(Number(form.replacementCost)/Number(form.expectedUses))}</span></div>
                </div>
              )}

              <div style={{ gridColumn:'1/-1' }}><label>Observações</label><textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Cor, estado, detalhes…" style={{ resize:'vertical' }} /></div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSave} disabled={saving}>{saving?'Salvando…':editing?'💾 Salvar':'✦ Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
