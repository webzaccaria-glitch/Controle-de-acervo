import { useState, useEffect } from "react";
import { save, load } from "./storage.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const R$ = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const calcTotal  = (items) => (items || []).reduce((s, i) => s + (Number(i.unitPrice || 0) * Number(i.qty || 0)), 0);
const calcDebito = (r) => Math.max(0, calcTotal(r.items) - Number(r.amountPaid || 0));

// ── Print Checklist ───────────────────────────────────────────────────────────
function printChecklist(rental, inventory) {
  const saida  = rental.items || [];
  const total  = calcTotal(saida);
  const pago   = Number(rental.amountPaid || 0);
  const debito = Math.max(0, total - pago);

  const makeRows = (mode) => saida.map(it => {
    const inv    = inventory.find(i => i.id === it.itemId);
    const nome   = inv ? inv.name    : "Item";
    const mat    = inv ? inv.material: "";
    const pintado= inv ? (inv.painted ? "Sim" : "Não") : "";
    const sub    = Number(it.unitPrice || 0) * Number(it.qty || 0);
    if (mode === "saida") return `<tr>
      <td>${nome}</td><td>${mat}</td><td>${pintado}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${R$(it.unitPrice)}</td>
      <td style="text-align:right;font-weight:600">${R$(sub)}</td>
      <td class="cb"></td><td>&nbsp;</td></tr>`;
    return `<tr>
      <td>${nome}</td><td>${mat}</td><td>${pintado}</td>
      <td style="text-align:center">${it.qty}</td>
      <td class="cb"></td><td>&nbsp;</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Checklist — ${rental.tenantName || "Locação"}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Source Sans 3',sans-serif;color:#1a1a2e;padding:32px 40px;font-size:13px;}
  .logo{text-align:center;margin-bottom:24px;border-bottom:3px double #b8860b;padding-bottom:16px;}
  .logo h1{font-family:'Playfair Display',serif;font-size:28px;color:#b8860b;}
  .logo p{font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:4px;}
  h2{font-family:'Playfair Display',serif;font-size:15px;color:#1a1a2e;margin:18px 0 8px;border-left:4px solid #b8860b;padding-left:10px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
  .field{background:#faf8f2;border:1px solid #e0d8c0;border-radius:4px;padding:6px 10px;}
  .field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a7a50;}
  .field span{font-weight:600;font-size:13px;}
  .fin{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:8px 0 18px;}
  .fc{border-radius:6px;padding:10px 14px;text-align:center;}
  .fc label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a7a50;display:block;margin-bottom:4px;}
  .fc .v{font-size:16px;font-weight:700;}
  .ft{background:#faf8f2;border:1px solid #e0d8c0;}
  .fp{background:#f0fff4;border:1px solid #b7e4c7;} .fp .v{color:#2d6a4f;}
  .fd{background:#fff5f5;border:1px solid #f5c0c0;} .fd .v{color:#c0392b;}
  .fq{background:#f0fff4;border:1px solid #b7e4c7;} .fq .v{color:#2d6a4f;}
  table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px;}
  th{background:#1a1a2e;color:#f5e6c0;padding:7px 8px;text-align:left;font-weight:600;font-size:11px;}
  td{padding:6px 8px;border-bottom:1px solid #e8e0cc;}
  tr:nth-child(even) td{background:#faf8f2;}
  .cb{width:28px;text-align:center;}
  .tot{text-align:right;font-size:12px;margin-bottom:16px;color:#555;}
  .alert{border:2px solid #c0392b;border-radius:6px;padding:12px 16px;margin:18px 0;background:#fff5f5;}
  .alert strong{color:#c0392b;font-size:13px;display:block;margin-bottom:4px;}
  .alert p{font-size:12px;line-height:1.6;color:#3a1010;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:32px;}
  .sig{border-top:1.5px solid #333;padding-top:8px;} .sig p{font-size:11px;color:#555;margin-top:2px;} .sig .nm{font-weight:600;font-size:12px;}
  .badge{display:inline-block;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:20px;margin-left:8px;}
  .footer{text-align:center;margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #e0d8c0;padding-top:10px;}
  @media print{body{padding:16px 20px;} button{display:none;}}
</style></head><body>
<div class="logo"><h1>✦ Controle de Locação ✦</h1><p>Checklist de Saída &amp; Devolução de Materiais</p></div>

<h2>Dados da Locação</h2>
<div class="grid2">
  <div class="field"><label>Locatário</label><span>${rental.tenantName || "—"}</span></div>
  <div class="field"><label>Telefone</label><span>${rental.phone || "—"}</span></div>
  <div class="field" style="grid-column:1/-1"><label>Endereço</label><span>${rental.address || "—"}</span></div>
  <div class="field"><label>Data da Locação</label><span>${fmtDate(rental.rentalDate)}</span></div>
  <div class="field"><label>Responsável pela Saída</label><span>${rental.exitBy || "—"}</span></div>
  <div class="field"><label>Nº do Contrato</label><span>#${(rental.id || "").toUpperCase()}</span></div>
</div>

<h2>Resumo Financeiro</h2>
<div class="fin">
  <div class="fc ft"><label>Total do Pedido</label><span class="v">${R$(total)}</span></div>
  <div class="fc fp"><label>Valor Pago</label><span class="v">${R$(pago)}</span></div>
  <div class="fc ${debito > 0 ? "fd" : "fq"}">
    <label>${debito > 0 ? "⚠ Valor em Débito" : "✓ Quitado"}</label>
    <span class="v">${R$(debito)}</span>
  </div>
</div>

<h2>Checklist de Saída <span class="badge" style="background:#b8860b">Saída</span></h2>
<table><thead><tr>
  <th>Item</th><th>Material</th><th>Pintado</th><th>Qtd</th><th>Vl. Unit.</th><th>Subtotal</th><th>✓</th><th>Observações de Saída</th>
</tr></thead><tbody>${makeRows("saida")}</tbody></table>
<div class="tot"><strong>Total: ${R$(total)}</strong></div>

<h2>Checklist de Devolução <span class="badge" style="background:#2d6a4f">Retorno</span></h2>
<table><thead><tr>
  <th>Item</th><th>Material</th><th>Pintado</th><th>Qtd Devolvida</th><th>✓</th><th>Estado / Avarias na Devolução</th>
</tr></thead><tbody>${makeRows("retorno")}</tbody></table>

<div class="alert">
  <strong>⚠ Cláusula de Responsabilidade por Avaria</strong>
  <p>O locatário declara ter recebido os itens listados acima em perfeito estado de conservação e assume total responsabilidade pela guarda e uso adequado dos materiais durante o período de locação.<br/><br/>
  <strong>Em caso de qualquer tipo de avaria, dano, quebra, perda ou deterioração</strong> das peças locadas, o locatário se compromete a pagar uma multa de <strong>100% (cem por cento) do valor da locação</strong> referente ao item danificado, além do custo de reparo ou reposição da peça, conforme avaliação do locador.<br/><br/>
  A devolução dos materiais deverá ocorrer nas mesmas condições em que foram recebidos.</p>
</div>

<div class="sigs">
  <div class="sig"><br/><br/><br/><p>Assinatura do Locatário</p><p class="nm">${rental.tenantName || ""}</p><p>Data: _____ / _____ / ________</p></div>
  <div class="sig"><br/><br/><br/><p>Responsável pela Entrega / Devolução</p><p class="nm">${rental.exitBy || ""}</p><p>Data: _____ / _____ / ________</p></div>
</div>

<div class="footer">Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} &nbsp;·&nbsp; Este documento tem validade de contrato mediante assinatura das partes.</div>
</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0f0e17; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1a1929; } ::-webkit-scrollbar-thumb { background: #d4a843; border-radius: 3px; }
  input:not([type="checkbox"]), select, textarea {
    background: #1a1929; border: 1px solid #2e2b4a;
    color: #e8dfc8; border-radius: 6px; padding: 8px 12px;
    width: 100%; font-family: inherit; font-size: 14px; outline: none; transition: border-color .2s;
  }
  input:not([type="checkbox"]):focus, select:focus, textarea:focus { border-color: #d4a843; }
  input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #d4a843; }
  select option { background: #1a1929; }
  label { display: block; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: #8a7a9a; margin-bottom: 4px; font-weight: 600; }
  .btn { cursor: pointer; border: none; border-radius: 6px; padding: 9px 18px; font-family: inherit; font-weight: 600; font-size: 13px; transition: all .2s; display: inline-flex; align-items: center; gap: 6px; }
  .btn-gold  { background: linear-gradient(135deg,#d4a843,#b8860b); color: #0f0e17; }
  .btn-gold:hover  { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px #d4a84340; }
  .btn-ghost { background: transparent; border: 1px solid #2e2b4a; color: #b0a8c0; }
  .btn-ghost:hover { border-color: #d4a843; color: #d4a843; }
  .btn-danger{ background: #3d1c1c; color: #e05c5c; border: 1px solid #5a2222; }
  .btn-danger:hover{ background: #5a2222; }
  .btn-green { background: linear-gradient(135deg,#2d6a4f,#1b4332); color: #d8f3dc; border: none; }
  .btn-green:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .btn-blue  { background: linear-gradient(135deg,#1e3a5f,#0d2440); color: #a8d4ff; border: 1px solid #2e4a6a; }
  .btn-blue:hover  { filter: brightness(1.2); transform: translateY(-1px); }
  .card { background: #16152a; border: 1px solid #1e1d35; border-radius: 12px; padding: 20px; }
  .tag  { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .modal-overlay { position: fixed; inset: 0; background: #000000aa; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { background: #16152a; border: 1px solid #2e2b4a; border-radius: 16px; width: 100%; max-width: 660px; max-height: 92vh; overflow-y: auto; padding: 28px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .sec-label { font-size: 11px; color: #d4a843; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin: 18px 0 10px; border-left: 3px solid #d4a843; padding-left: 8px; }
  @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
`;

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("inventory");
  const [inventory, setInventory] = useState(() => load("acervo_inventory", []));
  const [rentals, setRentals]   = useState(() => load("acervo_rentals", []));

  const saveInventory = (d) => { setInventory(d); save("acervo_inventory", d); };
  const saveRentals   = (d) => { setRentals(d);   save("acervo_rentals",   d); };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0e17", fontFamily:"'Source Sans 3', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a1929,#0f0e17)", borderBottom:"1px solid #2e2b4a", padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:24, color:"#d4a843", lineHeight:1 }}>✦ Acervo de Festas</div>
          <div style={{ fontSize:11, color:"#6a6080", letterSpacing:2, textTransform:"uppercase", marginTop:3 }}>Controle de Estoque & Locação</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[["inventory","📦 Acervo"],["rentals","🎪 Locações"]].map(([k,l]) => (
            <button key={k} className="btn" onClick={() => setTab(k)}
              style={{ background:tab===k?"linear-gradient(135deg,#d4a843,#b8860b)":"transparent", color:tab===k?"#0f0e17":"#8a7a9a", border:tab===k?"none":"1px solid #2e2b4a", fontWeight:700 }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"24px", maxWidth:1100, margin:"0 auto" }}>
        {tab === "inventory"
          ? <InventoryTab inventory={inventory} onSave={saveInventory} />
          : <RentalsTab   rentals={rentals} inventory={inventory} onSave={saveRentals} />}
      </div>
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({ inventory, onSave }) {
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [search, setSearch]       = useState("");
  const [filterMat, setFilterMat] = useState("all");

  const blank = { name:"", quantity:1, rentalPrice:"", painted:false, material:"madeira", category:"", notes:"" };
  const [form, setForm] = useState(blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]:v }));

  const openNew  = () => { setForm(blank); setEditing(null); setShowForm(true); };
  const openEdit = (it) => { setForm({ ...it }); setEditing(it.id); setShowForm(true); };
  const close    = () => setShowForm(false);

  const handleSave = () => {
    if (!form.name.trim()) return;
    editing ? onSave(inventory.map(i => i.id===editing ? { ...form, id:editing } : i))
            : onSave([...inventory, { ...form, id:uid(), createdAt:new Date().toISOString() }]);
    close();
  };
  const handleDelete = (id) => { if (window.confirm("Excluir este item?")) onSave(inventory.filter(i => i.id!==id)); };

  const matColors = { madeira:["#7c5c2e","#d4a843"], ferro:["#2e3d5e","#6ea8fe"], "acrílico":["#2a4a3e","#52d9a6"] };
  const filtered  = inventory.filter(i =>
    (filterMat==="all" || i.material===filterMat) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) || (i.category||"").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:12, marginBottom:24 }}>
        {[
          ["📦","Tipos",       inventory.length],
          ["🔢","Peças",       inventory.reduce((a,i)=>a+Number(i.quantity||0),0)],
          ["🎨","Pintados",    inventory.filter(i=>i.painted).length],
          ["🪵","Madeira",     inventory.filter(i=>i.material==="madeira").length],
          ["⚙️","Ferro",       inventory.filter(i=>i.material==="ferro").length],
          ["💎","Acrílico",    inventory.filter(i=>i.material==="acrílico").length],
        ].map(([ic,label,val]) => (
          <div key={label} className="card" style={{ textAlign:"center", padding:"12px 8px" }}>
            <div style={{ fontSize:20 }}>{ic}</div>
            <div style={{ fontSize:22, fontWeight:700, color:"#d4a843", fontFamily:"serif" }}>{val}</div>
            <div style={{ fontSize:10, color:"#6a6080", marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input placeholder="🔍 Buscar item ou categoria…" value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
        <select value={filterMat} onChange={e=>setFilterMat(e.target.value)} style={{ width:160 }}>
          <option value="all">Todos os materiais</option>
          <option value="madeira">🪵 Madeira</option>
          <option value="ferro">⚙️ Ferro</option>
          <option value="acrílico">💎 Acrílico</option>
        </select>
        <button className="btn btn-gold" onClick={openNew}>+ Novo Item</button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:48, color:"#4a4060" }}>
          <div style={{ fontSize:40 }}>📭</div>
          <div style={{ marginTop:8, fontFamily:"serif", fontSize:18 }}>Nenhum item encontrado</div>
          <button className="btn btn-gold" style={{ marginTop:16 }} onClick={openNew}>+ Adicionar primeiro item</button>
        </div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {filtered.map(it => {
            const [bg, accent] = matColors[it.material] || ["#2e2b4a","#aaa"];
            const semPreco = !it.rentalPrice || Number(it.rentalPrice)===0;
            return (
              <div key={it.id} className="card"
                style={{ display:"flex", alignItems:"center", gap:14, borderColor:semPreco?"#5a3a00":"#2e2b4a", transition:"border-color .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=semPreco?"#5a3a00":"#2e2b4a"}>
                <div style={{ width:46, height:46, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                  {it.material==="madeira"?"🪵":it.material==="ferro"?"⚙️":"💎"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:"#e8dfc8", fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</div>
                  <div style={{ fontSize:12, color:"#6a6080", marginTop:2 }}>
                    {it.category && <span style={{ marginRight:8 }}>📂 {it.category}</span>}
                    {it.notes    && <span style={{ fontStyle:"italic" }}>{it.notes.slice(0,55)}{it.notes.length>55?"…":""}</span>}
                  </div>
                  <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap" }}>
                    <span className="tag" style={{ background:bg, color:accent }}>{it.material.charAt(0).toUpperCase()+it.material.slice(1)}</span>
                    <span className="tag" style={{ background:it.painted?"#1b3a1b":"#222", color:it.painted?"#6ee76e":"#777" }}>
                      {it.painted?"🎨 Pintado":"⬜ Sem pintura"}
                    </span>
                    {semPreco
                      ? <span className="tag" style={{ background:"#3a2800", color:"#f0a020", border:"1px solid #8a5500" }}>⚠ Sem preço</span>
                      : <span className="tag" style={{ background:"#1c2a1c", color:"#a0d8a0" }}>💰 {R$(it.rentalPrice)}/un</span>
                    }
                  </div>
                </div>
                <div style={{ textAlign:"center", padding:"0 14px", borderLeft:"1px solid #2e2b4a", flexShrink:0 }}>
                  <div style={{ fontSize:26, fontWeight:800, color:accent, fontFamily:"serif" }}>{it.quantity}</div>
                  <div style={{ fontSize:10, color:"#6a6080", textTransform:"uppercase", letterSpacing:1 }}>unid.</div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button className="btn btn-ghost" style={{ padding:"6px 12px", fontSize:12 }} onClick={()=>openEdit(it)}>✏️</button>
                  <button className="btn btn-danger" style={{ padding:"6px 12px", fontSize:12 }} onClick={()=>handleDelete(it.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:"serif", fontSize:20, color:"#d4a843", marginBottom:18 }}>
              {editing ? "✏️ Editar Item" : "✦ Novo Item do Acervo"}
            </div>
            <div className="form-grid">
              <div style={{ gridColumn:"1/-1" }}>
                <label>Nome do Item *</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Mesa Provençal, Lustre de Ferro…" />
              </div>
              <div>
                <label>Quantidade em Estoque</label>
                <input type="number" min="0" value={form.quantity} onChange={e=>set("quantity",Number(e.target.value))} />
              </div>
              <div>
                <label>💰 Preço de Locação (R$/un) *</label>
                <input type="number" min="0" step="0.01" value={form.rentalPrice}
                  onChange={e=>set("rentalPrice",e.target.value)} placeholder="0,00" />
                {(!form.rentalPrice || Number(form.rentalPrice)===0) && (
                  <div style={{ fontSize:11, color:"#f0a020", marginTop:4 }}>⚠ Informe o preço para sincronizar com o carrinho.</div>
                )}
              </div>
              <div>
                <label>Material</label>
                <select value={form.material} onChange={e=>set("material",e.target.value)}>
                  <option value="madeira">🪵 Madeira</option>
                  <option value="ferro">⚙️ Ferro</option>
                  <option value="acrílico">💎 Acrílico</option>
                </select>
              </div>
              <div>
                <label>Categoria</label>
                <input value={form.category} onChange={e=>set("category",e.target.value)} placeholder="Ex: Mobiliário, Iluminação…" />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:20 }}>
                <input type="checkbox" id="cb_p" checked={form.painted} onChange={e=>set("painted",e.target.checked)} />
                <label htmlFor="cb_p" style={{ margin:0, cursor:"pointer", fontSize:14, textTransform:"none", letterSpacing:0, color:"#e8dfc8" }}>🎨 Item está pintado</label>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label>Observações</label>
                <textarea rows={2} value={form.notes} onChange={e=>set("notes",e.target.value)}
                  placeholder="Cor, estado, detalhes…" style={{ resize:"vertical" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:18 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold"  onClick={handleSave}>{editing?"💾 Salvar":"✦ Adicionar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rentals Tab ───────────────────────────────────────────────────────────────
function RentalsTab({ rentals, inventory, onSave }) {
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const blank = { tenantName:"", address:"", phone:"", rentalDate:"", amountPaid:"", exitBy:"", items:[] };
  const [form, setForm] = useState(blank);
  const [sel, setSel]   = useState({ itemId:"", qty:1 });
  const setF = (k, v) => setForm(p => ({ ...p, [k]:v }));

  const openNew  = () => { setForm({ ...blank, rentalDate:new Date().toISOString().slice(0,10) }); setEditingId(null); setShowForm(true); };
  const openEdit = (r)  => { setForm({ ...r }); setEditingId(r.id); setShowForm(true); };
  const close    = () => { setShowForm(false); setEditingId(null); };

  const syncPrices = () => setForm(p => ({
    ...p, items: p.items.map(it => {
      const inv = inventory.find(i => i.id===it.itemId);
      return inv && inv.rentalPrice ? { ...it, unitPrice:Number(inv.rentalPrice) } : it;
    })
  }));

  const formTotal  = calcTotal(form.items);
  const formPaid   = Number(form.amountPaid || 0);
  const formDebito = Math.max(0, formTotal - formPaid);

  const addItem = () => {
    if (!sel.itemId) return;
    const inv = inventory.find(i => i.id===sel.itemId); if (!inv) return;
    const qty       = Math.max(1, Math.min(Number(sel.qty)||1, inv.quantity));
    const unitPrice = Number(inv.rentalPrice || 0);
    const exists    = form.items.find(i => i.itemId===sel.itemId);
    if (exists) setForm(p=>({...p,items:p.items.map(i=>i.itemId===sel.itemId?{...i,qty:Math.min(i.qty+qty,inv.quantity),unitPrice}:i)}));
    else        setForm(p=>({...p,items:[...p.items,{itemId:sel.itemId,qty,unitPrice}]}));
    setSel({ itemId:"", qty:1 });
  };

  const removeItem     = (id)      => setForm(p=>({...p,items:p.items.filter(i=>i.itemId!==id)}));
  const updateCartItem = (id,f,v)  => setForm(p=>({...p,items:p.items.map(i=>{
    if (i.itemId!==id) return i;
    const inv = inventory.find(x=>x.id===id);
    if (f==="qty")       return {...i,qty:       Math.max(1,Math.min(Number(v)||1,inv?inv.quantity:999))};
    if (f==="unitPrice") return {...i,unitPrice: Number(v)||0};
    return i;
  })}));

  const handleSave = () => {
    if (!form.tenantName.trim()) return alert("Preencha o nome do locatário.");
    if (form.items.length===0)   return alert("Adicione ao menos um item.");
    const updated = { ...form, totalOrder:formTotal };
    editingId ? onSave(rentals.map(r=>r.id===editingId?{...updated,id:editingId}:r))
              : onSave([{...updated,id:uid(),createdAt:new Date().toISOString(),status:"ativa"},...rentals]);
    close();
  };
  const handleDelete = (id) => { if(window.confirm("Excluir esta locação?")) onSave(rentals.filter(r=>r.id!==id)); };

  const statusColors = { ativa:["#1b3a1b","#6ee76e"], "concluída":["#1a2a4a","#6ea8fe"], cancelada:["#3a1c1c","#e05c5c"] };
  const totalFat = rentals.reduce((a,r)=>a+calcTotal(r.items||[]),0);
  const totalDeb = rentals.filter(r=>r.status==="ativa").reduce((a,r)=>a+calcDebito(r),0);

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:24 }}>
        {[
          ["🎪","Total de Locações",rentals.length,"#d4a843"],
          ["✅","Locações Ativas",  rentals.filter(r=>r.status==="ativa").length,"#6ee76e"],
          ["💰","Faturamento Total", R$(totalFat),"#d4a843"],
          ["⚠️","Débito em Aberto",  R$(totalDeb),totalDeb>0?"#e05c5c":"#6ee76e"],
        ].map(([ic,label,val,clr]) => (
          <div key={label} className="card" style={{ textAlign:"center" }}>
            <div style={{ fontSize:20 }}>{ic}</div>
            <div style={{ fontSize:typeof val==="string"&&val.length>8?15:22, fontWeight:700, color:clr, fontFamily:"serif", marginTop:2 }}>{val}</div>
            <div style={{ fontSize:10, color:"#6a6080", marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
        <button className="btn btn-gold" onClick={openNew}>+ Nova Locação</button>
      </div>

      {rentals.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:48, color:"#4a4060" }}>
          <div style={{ fontSize:40 }}>🎪</div>
          <div style={{ marginTop:8, fontFamily:"serif", fontSize:18 }}>Nenhuma locação registrada</div>
          <button className="btn btn-gold" style={{ marginTop:16 }} onClick={openNew}>+ Registrar primeira locação</button>
        </div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {rentals.map(r => {
            const [sbg,sclr] = statusColors[r.status] || ["#2e2b4a","#aaa"];
            const rTotal  = calcTotal(r.items||[]);
            const rPago   = Number(r.amountPaid||0);
            const rDebito = Math.max(0,rTotal-rPago);
            return (
              <div key={r.id} className="card" style={{ borderColor:rDebito>0&&r.status==="ativa"?"#5a2222":"#2e2b4a", transition:"border-color .3s" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:220 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, color:"#e8dfc8", fontSize:15 }}>👤 {r.tenantName}</span>
                      <span className="tag" style={{ background:sbg, color:sclr }}>{r.status}</span>
                      <span style={{ fontSize:11, color:"#4a4060" }}>#{(r.id||"").toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#8a7a9a", marginTop:5, display:"flex", flexWrap:"wrap", gap:"2px 14px" }}>
                      <span>📍 {r.address||"—"}</span>
                      <span>📞 {r.phone||"—"}</span>
                      <span>📅 {fmtDate(r.rentalDate)}</span>
                      <span>🧑 {r.exitBy||"—"}</span>
                    </div>
                    <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {(r.items||[]).map(it=>{
                        const inv=inventory.find(i=>i.id===it.itemId);
                        return inv ? <span key={it.itemId} className="tag" style={{ background:"#1e1d35", color:"#b0a8c0" }}>{inv.name} ×{it.qty} · {R$(it.unitPrice)}</span> : null;
                      })}
                    </div>
                  </div>

                  <div style={{ flexShrink:0, minWidth:210 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:8 }}>
                      {[["Total",R$(rTotal),"#d4a843","#0f0e17","#2e2b4a"],["Pago",R$(rPago),"#6ee76e","#0f1a0f","#2e4a2e"],[rDebito>0?"Débito":"Quitado",R$(rDebito),rDebito>0?"#e05c5c":"#6ee76e",rDebito>0?"#1a0f0f":"#0f1a0f",rDebito>0?"#5a2222":"#2e4a2e"]].map(([l,v,c,bg,bd])=>(
                        <div key={l} style={{ background:bg, border:`1px solid ${bd}`, borderRadius:8, padding:"6px 8px", textAlign:"center" }}>
                          <div style={{ fontSize:9, color:"#6a6080", textTransform:"uppercase" }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:5, justifyContent:"flex-end", flexWrap:"wrap" }}>
                      <button className="btn btn-blue"   style={{ fontSize:11, padding:"5px 10px" }} onClick={()=>openEdit(r)}>✏️ Ajustar</button>
                      <button className="btn btn-green"  style={{ fontSize:11, padding:"5px 10px" }} onClick={()=>printChecklist(r,inventory)}>🖨 Checklist</button>
                      <select value={r.status} onChange={e=>onSave(rentals.map(x=>x.id===r.id?{...x,status:e.target.value}:x))}
                        style={{ width:"auto", cursor:"pointer", padding:"5px 8px", fontSize:11, borderRadius:6 }}>
                        <option value="ativa">Ativa</option>
                        <option value="concluída">Concluída</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                      <button className="btn btn-danger" style={{ fontSize:11, padding:"5px 10px" }} onClick={()=>handleDelete(r.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:"serif", fontSize:20, color:"#d4a843", marginBottom:2 }}>
              {editingId ? "✏️ Ajustar Pedido" : "✦ Nova Locação"}
            </div>
            <div style={{ fontSize:11, color:"#6a6080", marginBottom:18 }}>
              {editingId ? "Edite os dados, itens ou valores — depois imprima o checklist atualizado." : "Preencha os dados, monte o carrinho e registre."}
            </div>

            <div className="sec-label">Dados do Locatário</div>
            <div className="form-grid">
              <div style={{ gridColumn:"1/-1" }}><label>Nome do Locatário *</label><input value={form.tenantName} onChange={e=>setF("tenantName",e.target.value)} placeholder="Nome completo" /></div>
              <div style={{ gridColumn:"1/-1" }}><label>Endereço</label><input value={form.address} onChange={e=>setF("address",e.target.value)} placeholder="Rua, número, bairro, cidade" /></div>
              <div><label>Telefone</label><input value={form.phone} onChange={e=>setF("phone",e.target.value)} placeholder="(00) 00000-0000" /></div>
              <div><label>Data da Locação</label><input type="date" value={form.rentalDate} onChange={e=>setF("rentalDate",e.target.value)} /></div>
              <div style={{ gridColumn:"1/-1" }}><label>Responsável pela Saída</label><input value={form.exitBy} onChange={e=>setF("exitBy",e.target.value)} placeholder="Nome de quem entregou" /></div>
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginTop:18, marginBottom:10 }}>
              <div className="sec-label" style={{ margin:0 }}>🛒 Carrinho de Itens</div>
              {form.items.length>0 && (
                <button className="btn btn-blue" style={{ fontSize:11, padding:"4px 10px" }} onClick={syncPrices}>🔄 Sincronizar Preços</button>
              )}
            </div>

            {inventory.length===0 ? (
              <div style={{ background:"#1a1929", border:"1px solid #2e2b4a", borderRadius:8, padding:14, color:"#6a6080", fontSize:13, marginBottom:12 }}>
                ⚠ Nenhum item no acervo. Adicione na aba <strong>📦 Acervo</strong>.
              </div>
            ) : (
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <select value={sel.itemId} onChange={e=>setSel(p=>({...p,itemId:e.target.value}))} style={{ flex:1 }}>
                  <option value="">— Selecione um item —</option>
                  {inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.material}) — {i.quantity} disp. {i.rentalPrice?`— ${R$(i.rentalPrice)}/un`:"— ⚠ sem preço"}</option>)}
                </select>
                <input type="number" min="1" value={sel.qty} onChange={e=>setSel(p=>({...p,qty:e.target.value}))} style={{ width:64 }} />
                <button className="btn btn-gold" onClick={addItem} style={{ whiteSpace:"nowrap", padding:"8px 14px" }}>+ Add</button>
              </div>
            )}

            {form.items.length>0 && (
              <div style={{ background:"#0f0e17", border:"1px solid #2e2b4a", borderRadius:10, overflow:"hidden", marginBottom:4 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 100px 90px 32px", padding:"6px 12px", background:"#1a1929", fontSize:10, color:"#6a6080", textTransform:"uppercase", letterSpacing:0.8 }}>
                  <span>Item</span><span style={{ textAlign:"center" }}>Qtd</span><span style={{ textAlign:"right" }}>Vl. Unit.</span><span style={{ textAlign:"right" }}>Subtotal</span><span></span>
                </div>
                {form.items.map(it=>{
                  const inv=inventory.find(i=>i.id===it.itemId), sub=it.unitPrice*it.qty;
                  const diverge=inv&&Number(inv.rentalPrice)!==Number(it.unitPrice);
                  return (
                    <div key={it.itemId} style={{ display:"grid", gridTemplateColumns:"1fr 60px 100px 90px 32px", alignItems:"center", padding:"7px 12px", borderTop:"1px solid #1e1d35" }}>
                      <div>
                        <div style={{ color:"#e8dfc8", fontSize:13, fontWeight:600 }}>{inv?inv.name:"?"}</div>
                        <div style={{ fontSize:10, color:"#6a6080", display:"flex", gap:4 }}>
                          {inv?inv.material:""}
                          {diverge && <span style={{ color:"#f0a020" }}>⚠ diverge ({R$(inv.rentalPrice)}/un)</span>}
                        </div>
                      </div>
                      <div><input type="number" min="1" value={it.qty} onChange={e=>updateCartItem(it.itemId,"qty",e.target.value)} style={{ width:50, textAlign:"center", padding:"4px", fontSize:13 }} /></div>
                      <div><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e=>updateCartItem(it.itemId,"unitPrice",e.target.value)} style={{ width:90, textAlign:"right", padding:"4px 6px", fontSize:13 }} /></div>
                      <div style={{ textAlign:"right", color:"#d4a843", fontWeight:700, fontSize:14 }}>{R$(sub)}</div>
                      <div><button className="btn btn-danger" style={{ padding:"3px 6px", fontSize:11 }} onClick={()=>removeItem(it.itemId)}>✕</button></div>
                    </div>
                  );
                })}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"#1a1929", borderTop:"2px solid #2e2b4a" }}>
                  <span style={{ fontSize:12, color:"#8a7a9a" }}>{form.items.length} {form.items.length===1?"item":"itens"}</span>
                  <span style={{ fontWeight:700, color:"#d4a843", fontSize:16, fontFamily:"serif" }}>Total: {R$(formTotal)}</span>
                </div>
              </div>
            )}

            <div className="sec-label">💳 Pagamento</div>
            <div className="form-grid" style={{ marginBottom:0 }}>
              <div><label>Valor Pago (R$)</label><input type="number" step="0.01" min="0" value={form.amountPaid} onChange={e=>setF("amountPaid",e.target.value)} placeholder="0,00" /></div>
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <div style={{ width:"100%", background:formDebito>0?"#1a0f0f":"#0f1a0f", border:`1px solid ${formDebito>0?"#5a2222":"#2e4a2e"}`, borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#6a6080", textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{formDebito>0?"⚠ Valor em Débito":formTotal>0?"✅ Quitado":"Débito"}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:formDebito>0?"#e05c5c":"#6ee76e", fontFamily:"serif" }}>{R$(formDebito)}</div>
                </div>
              </div>
            </div>

            {formTotal>0 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:10 }}>
                {[["TOTAL",R$(formTotal),"#d4a843","#0f0e17","#2e2b4a"],["PAGO",R$(formPaid),"#6ee76e","#0f1a0f","#2e4a2e"],["DÉBITO",R$(formDebito),formDebito>0?"#e05c5c":"#6ee76e",formDebito>0?"#1a0f0f":"#0f1a0f",formDebito>0?"#5a2222":"#2e4a2e"]].map(([l,v,c,bg,bd])=>(
                  <div key={l} style={{ background:bg, border:`1px solid ${bd}`, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:"#6a6080" }}>{l}</div>
                    <div style={{ fontWeight:700, color:c, fontSize:15 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:"#1b0d0d", border:"1px solid #5a2222", borderRadius:8, padding:"9px 14px", marginTop:16, marginBottom:20 }}>
              <div style={{ color:"#e05c5c", fontSize:11, fontWeight:700 }}>⚠ Incluído automaticamente no checklist:</div>
              <div style={{ color:"#c0a0a0", fontSize:11, marginTop:3 }}>Multa de 100% do valor da locação em caso de avaria.</div>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-gold"  onClick={handleSave}>{editingId?"💾 Salvar Ajustes":"✦ Registrar Locação"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
