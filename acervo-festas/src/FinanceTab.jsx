import { useState } from 'react'
import { R$, fmtDate, calcTotal, calcDebito, calcOverdue, filterByPeriod, getDepreciation } from './utils.js'

const PERIODS = [['day','Hoje'],['week','Esta Semana'],['month','Este Mês'],['all','Tudo']]

export default function FinanceTab({ rentals, inventory }) {
  const [period, setPeriod] = useState('month')

  const filtered = filterByPeriod(rentals.filter(r=>r.status!=='cancelada'), period)

  const totalBilled  = filtered.reduce((a,r)=>a+calcTotal(r.items||[]),0)
  const totalPaid    = filtered.reduce((a,r)=>a+Number(r.amountPaid||0),0)
  const totalDebt    = filtered.reduce((a,r)=>a+calcDebito(r),0)
  const totalOverdue = filtered.reduce((a,r)=>a+calcOverdue(r),0)
  const totalFinal   = totalPaid + totalOverdue

  return (
    <div>
      {/* Period selector */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {PERIODS.map(([k,l])=>(
          <button key={k} className="btn" onClick={()=>setPeriod(k)}
            style={{ background:period===k?'linear-gradient(135deg,#d4a843,#b8860b)':'#16152a', color:period===k?'#0f0e17':'#8a7a9a', border:period===k?'none':'1px solid #2e2b4a', fontWeight:700 }}>
            {l}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#6a6080', alignSelf:'center' }}>
          {filtered.length} locaç{filtered.length===1?'ão':'ões'}
        </span>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:28 }}>
        {[
          ['💰','Faturado',      R$(totalBilled), '#d4a843','#1a150a','#4a3800'],
          ['✅','Recebido',      R$(totalPaid),   '#6ee76e','#0f1a0f','#2e4a2e'],
          ['⚠️','Em Débito',     R$(totalDebt),   totalDebt>0?'#e05c5c':'#6ee76e', totalDebt>0?'#1a0f0f':'#0f1a0f', totalDebt>0?'#5a2222':'#2e4a2e'],
          ['⏰','Taxas de Atraso',R$(totalOverdue),totalOverdue>0?'#f0a020':'#6ee76e','#1a1000',totalOverdue>0?'#8a4a00':'#2e4a2e'],
          ['📊','Total Recebido', R$(totalFinal),  '#a8d4ff','#0a1020','#1e3a5f'],
        ].map(([ic,label,val,clr,bg,bd])=>(
          <div key={label} style={{ background:bg, border:`1px solid ${bd}`, borderRadius:12, padding:'16px 12px', textAlign:'center' }}>
            <div style={{ fontSize:22 }}>{ic}</div>
            <div style={{ fontSize:typeof val==='string'&&val.length>10?14:18, fontWeight:700, color:clr, fontFamily:'serif', marginTop:4 }}>{val}</div>
            <div style={{ fontSize:10, color:'#6a6080', marginTop:3, textTransform:'uppercase', letterSpacing:0.8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Transactions table */}
      <div style={{ fontFamily:'serif', fontSize:17, color:'#d4a843', marginBottom:14 }}>📋 Locações do Período</div>
      {filtered.length===0 ? (
        <div className="card" style={{ textAlign:'center', padding:32, color:'#4a4060' }}>
          <div style={{ fontSize:32 }}>📭</div>
          <div style={{ marginTop:8 }}>Nenhuma locação neste período.</div>
        </div>
      ) : (
        <div style={{ background:'#16152a', border:'1px solid #2e2b4a', borderRadius:12, overflow:'hidden', marginBottom:32 }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 90px 90px 80px', padding:'8px 16px', background:'#1a1929', fontSize:10, color:'#6a6080', textTransform:'uppercase', letterSpacing:0.8 }}>
            <span>Locatário</span><span style={{ textAlign:'center' }}>Data</span><span style={{ textAlign:'right' }}>Total</span><span style={{ textAlign:'right' }}>Pago</span><span style={{ textAlign:'right' }}>Débito</span><span style={{ textAlign:'right' }}>Atraso</span>
          </div>
          {filtered.map((r,idx)=>{
            const rTotal=calcTotal(r.items||[]), rPago=Number(r.amountPaid||0)
            const rDeb=Math.max(0,rTotal-rPago), rOver=calcOverdue(r)
            const overdueDays=Math.round(rOver/Math.max(Number(r.dailyRate)||1,1))
            return (
              <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 90px 90px 80px', alignItems:'center', padding:'10px 16px', borderTop:'1px solid #1e1d35', background:idx%2===0?'transparent':'#0f0e1710' }}>
                <div>
                  <div style={{ color:'#e8dfc8', fontSize:13, fontWeight:600 }}>{r.tenantName}</div>
                  <div style={{ fontSize:11, color:'#6a6080' }}>{r.status} · {r.items?.length||0} item(s)</div>
                </div>
                <div style={{ textAlign:'center', fontSize:12, color:'#8a7a9a' }}>{fmtDate(r.rentalDate)}</div>
                <div style={{ textAlign:'right', color:'#d4a843', fontWeight:600, fontSize:13 }}>{R$(rTotal)}</div>
                <div style={{ textAlign:'right', color:'#6ee76e', fontSize:13 }}>{R$(rPago)}</div>
                <div style={{ textAlign:'right', color:rDeb>0?'#e05c5c':'#6ee76e', fontSize:13 }}>{R$(rDeb)}</div>
                <div style={{ textAlign:'right', color:rOver>0?'#f0a020':'#6a6080', fontSize:13 }}>{rOver>0?R$(rOver):'—'}</div>
              </div>
            )
          })}
          {/* Footer total */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 90px 90px 80px', padding:'10px 16px', borderTop:'2px solid #2e2b4a', background:'#1a1929' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#e8dfc8' }}>TOTAL</div>
            <div></div>
            <div style={{ textAlign:'right', color:'#d4a843', fontWeight:700 }}>{R$(totalBilled)}</div>
            <div style={{ textAlign:'right', color:'#6ee76e', fontWeight:700 }}>{R$(totalPaid)}</div>
            <div style={{ textAlign:'right', color:totalDebt>0?'#e05c5c':'#6ee76e', fontWeight:700 }}>{R$(totalDebt)}</div>
            <div style={{ textAlign:'right', color:totalOverdue>0?'#f0a020':'#6a6080', fontWeight:700 }}>{totalOverdue>0?R$(totalOverdue):'—'}</div>
          </div>
        </div>
      )}

      {/* Depreciation */}
      <div style={{ fontFamily:'serif', fontSize:17, color:'#d4a843', marginBottom:14 }}>📊 Desgaste de Material</div>
      {inventory.filter(i=>Number(i.replacementCost)>0).length===0 ? (
        <div className="card" style={{ padding:20, color:'#6a6080', fontSize:13 }}>
          Nenhum item com custo de reposição cadastrado.<br/>
          <span style={{ fontSize:12 }}>Vá em <strong style={{ color:'#d4a843' }}>📦 Acervo</strong>, edite os itens e informe o custo de reposição e vida útil esperada.</span>
        </div>
      ) : (
        <div style={{ background:'#16152a', border:'1px solid #2e2b4a', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 90px 100px 90px', padding:'8px 16px', background:'#1a1929', fontSize:10, color:'#6a6080', textTransform:'uppercase', letterSpacing:0.8 }}>
            <span>Item</span><span style={{ textAlign:'center' }}>Usos</span><span style={{ textAlign:'right' }}>Custo/Uso</span><span style={{ textAlign:'right' }}>Acumulado</span><span style={{ textAlign:'center' }}>Vida Útil</span><span style={{ textAlign:'right' }}>Reposição</span>
          </div>
          {inventory.filter(i=>Number(i.replacementCost)>0).map((it,idx)=>{
            const dep=getDepreciation(it,rentals)
            const barColor=dep.pct>80?'#e05c5c':dep.pct>50?'#f0a020':'#6ee76e'
            return (
              <div key={it.id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 90px 100px 90px', alignItems:'center', padding:'12px 16px', borderTop:'1px solid #1e1d35', background:idx%2===0?'transparent':'#0f0e1710' }}>
                <div>
                  <div style={{ color:'#e8dfc8', fontSize:13, fontWeight:600 }}>{it.name}</div>
                  <div style={{ fontSize:11, color:'#6a6080' }}>{it.material} · {it.quantity} unid.</div>
                </div>
                <div style={{ textAlign:'center', fontSize:14, fontWeight:700, color:'#a8d4ff' }}>{dep.useCount}</div>
                <div style={{ textAlign:'right', fontSize:13, color:'#d4a843' }}>{R$(dep.costPerUse)}</div>
                <div style={{ textAlign:'right', fontSize:13, color:dep.pct>80?'#e05c5c':'#f0a020', fontWeight:600 }}>{R$(dep.accumulated)}</div>
                <div style={{ padding:'0 8px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#6a6080', marginBottom:3 }}>
                    <span>{dep.remaining} rest.</span><span>{dep.pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${dep.pct}%`, background:barColor }} />
                  </div>
                  {dep.pct>=100&&<div style={{ fontSize:10,color:'#e05c5c',marginTop:3,fontWeight:700 }}>⚠ Reposição necessária!</div>}
                </div>
                <div style={{ textAlign:'right', fontSize:13, color:'#8a7a9a' }}>{R$(dep.replacementCost)}</div>
              </div>
            )
          })}
          {/* Summary */}
          <div style={{ padding:'12px 16px', borderTop:'2px solid #2e2b4a', background:'#1a1929', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:12, color:'#8a7a9a' }}>
              Total depreciado acumulado:&nbsp;
              <span style={{ color:'#f0a020', fontWeight:700 }}>
                {R$(inventory.filter(i=>Number(i.replacementCost)>0).reduce((a,it)=>{const d=getDepreciation(it,rentals);return a+d.accumulated},0))}
              </span>
            </span>
            <span style={{ fontSize:12, color:'#8a7a9a' }}>
              Custo de reposição total do acervo:&nbsp;
              <span style={{ color:'#d4a843', fontWeight:700 }}>
                {R$(inventory.filter(i=>Number(i.replacementCost)>0).reduce((a,it)=>a+Number(it.replacementCost)*Number(it.quantity||1),0))}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
