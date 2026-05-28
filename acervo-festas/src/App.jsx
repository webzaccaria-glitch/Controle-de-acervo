import { useState, useEffect } from 'react'
import { supabase, dbToInventory, inventoryToDB, dbToRental, rentalToDB } from './supabase.js'
import { STYLES } from './utils.js'
import InventoryTab from './InventoryTab.jsx'
import RentalsTab   from './RentalsTab.jsx'
import FinanceTab   from './FinanceTab.jsx'

export default function App() {
  const [tab, setTab]             = useState('rentals')
  const [inventory, setInventory] = useState([])
  const [rentals, setRentals]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const loadAll = async () => {
    setLoading(true); setError(null)
    const [invRes, rentRes] = await Promise.all([
      supabase.from('inventory').select('*').order('created_at',{ascending:false}),
      supabase.from('rentals').select('*').order('created_at',{ascending:false}),
    ])
    if (invRes.error||rentRes.error) {
      setError('Erro ao carregar dados. Verifique sua conexão.')
    } else {
      setInventory((invRes.data||[]).map(dbToInventory))
      setRentals((rentRes.data||[]).map(dbToRental))
    }
    setLoading(false)
  }
  useEffect(()=>{ loadAll() },[])

  // ── Inventory CRUD ──────────────────────────────────────────────────────────
  const addInventory    = async (item) => {
    const {data,error} = await supabase.from('inventory').insert([inventoryToDB(item)]).select()
    if (!error) setInventory(p=>[dbToInventory(data[0]),...p])
  }
  const updateInventory = async (item) => {
    const {error} = await supabase.from('inventory').update(inventoryToDB(item)).eq('id',item.id)
    if (!error) setInventory(p=>p.map(i=>i.id===item.id?item:i))
  }
  const deleteInventory = async (id) => {
    const {error} = await supabase.from('inventory').delete().eq('id',id)
    if (!error) setInventory(p=>p.filter(i=>i.id!==id))
  }

  // ── Rentals CRUD ────────────────────────────────────────────────────────────
  const addRental    = async (r) => {
    const {data,error} = await supabase.from('rentals').insert([rentalToDB(r)]).select()
    if (!error) setRentals(p=>[dbToRental(data[0]),...p])
  }
  const updateRental = async (r) => {
    const {error} = await supabase.from('rentals').update(rentalToDB(r)).eq('id',r.id)
    if (!error) setRentals(p=>p.map(x=>x.id===r.id?r:x))
  }
  const deleteRental = async (id) => {
    const {error} = await supabase.from('rentals').delete().eq('id',id)
    if (!error) setRentals(p=>p.filter(r=>r.id!==id))
  }
  const updateRentalStatus = async (id,status) => {
    const {error} = await supabase.from('rentals').update({status}).eq('id',id)
    if (!error) setRentals(p=>p.map(r=>r.id===id?{...r,status}:r))
  }

  if (loading) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0e17',gap:16 }}>
      <div style={{ color:'#d4a843',fontFamily:'serif',fontSize:26 }}>✦ Acervo de Festas</div>
      <div style={{ color:'#6a6080',fontSize:14 }}>Conectando ao banco de dados…</div>
    </div>
  )

  if (error) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0f0e17',gap:16 }}>
      <div style={{ color:'#e05c5c',fontSize:18 }}>⚠ {error}</div>
      <button onClick={loadAll} style={{ background:'#d4a843',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontWeight:700,fontFamily:'inherit' }}>Tentar novamente</button>
    </div>
  )

  const TABS = [
    ['rentals',  '🎪 Locações'],
    ['finance',  '💰 Finanças'],
    ['inventory','📦 Acervo 🔒'],
  ]

  return (
    <div style={{ minHeight:'100vh',background:'#0f0e17',fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1a1929,#0f0e17)',borderBottom:'1px solid #2e2b4a',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif",fontSize:22,color:'#d4a843',lineHeight:1 }}>✦ Acervo de Festas</div>
          <div style={{ fontSize:10,color:'#6a6080',letterSpacing:2,textTransform:'uppercase',marginTop:3 }}>Controle de Estoque & Locação</div>
        </div>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {TABS.map(([k,l])=>(
            <button key={k} className="btn" onClick={()=>setTab(k)}
              style={{ background:tab===k?'linear-gradient(135deg,#d4a843,#b8860b)':'transparent',color:tab===k?'#0f0e17':'#8a7a9a',border:tab===k?'none':'1px solid #2e2b4a',fontWeight:700,fontSize:12,padding:'7px 14px' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'20px',maxWidth:1100,margin:'0 auto' }}>
        {tab==='inventory' && <InventoryTab inventory={inventory} rentals={rentals} onAdd={addInventory} onUpdate={updateInventory} onDelete={deleteInventory} />}
        {tab==='rentals'   && <RentalsTab   rentals={rentals} inventory={inventory} onAdd={addRental} onUpdate={updateRental} onDelete={deleteRental} onStatusChange={updateRentalStatus} />}
        {tab==='finance'   && <FinanceTab   rentals={rentals} inventory={inventory} />}
      </div>
    </div>
  )
}
