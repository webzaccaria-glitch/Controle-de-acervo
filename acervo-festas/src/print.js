import { R$, fmtDate, calcTotal, calcOverdue, calcOverdueDays } from './utils.js'

export function printChecklist(rental, inventory) {
  const saida  = rental.items || []
  const total  = calcTotal(saida)
  const pago   = Number(rental.amountPaid || 0)
  const debito = Math.max(0, total - pago)
  const overdue = calcOverdue(rental)
  const overdueDays = calcOverdueDays(rental)

  const makeRows = (mode) => saida.map(it => {
    const inv    = inventory.find(i => i.id===it.itemId)
    const nome   = inv ? inv.name     : 'Item'
    const mat    = inv ? inv.material : ''
    const pint   = inv ? (inv.painted?'Sim':'Não') : ''
    const sub    = Number(it.unitPrice||0)*Number(it.qty||0)
    if (mode==='saida') return `<tr>
      <td>${nome}</td><td>${mat}</td><td>${pint}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${R$(it.unitPrice)}</td>
      <td style="text-align:right;font-weight:600">${R$(sub)}</td>
      <td class="cb"></td><td>&nbsp;</td></tr>`
    return `<tr>
      <td>${nome}</td><td>${mat}</td><td>${pint}</td>
      <td style="text-align:center">${it.qty}</td>
      <td class="cb"></td><td>&nbsp;</td></tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Checklist — ${rental.tenantName||'Locação'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@300;400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Source Sans 3',sans-serif;color:#1a1a2e;padding:32px 40px;font-size:13px;}
  .logo{text-align:center;margin-bottom:24px;border-bottom:3px double #b8860b;padding-bottom:16px;}.logo h1{font-family:'Playfair Display',serif;font-size:28px;color:#b8860b;}.logo p{font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:4px;}
  h2{font-family:'Playfair Display',serif;font-size:15px;color:#1a1a2e;margin:18px 0 8px;border-left:4px solid #b8860b;padding-left:10px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}.field{background:#faf8f2;border:1px solid #e0d8c0;border-radius:4px;padding:6px 10px;}.field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a7a50;}.field span{font-weight:600;font-size:13px;}
  .fin{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 18px;}.fc{border-radius:6px;padding:10px 14px;text-align:center;}.fc label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a7a50;display:block;margin-bottom:4px;}.fc .v{font-size:15px;font-weight:700;}
  .ft{background:#faf8f2;border:1px solid #e0d8c0;}.fp{background:#f0fff4;border:1px solid #b7e4c7;}.fp .v{color:#2d6a4f;}.fd{background:#fff5f5;border:1px solid #f5c0c0;}.fd .v{color:#c0392b;}.fq{background:#f0fff4;border:1px solid #b7e4c7;}.fq .v{color:#2d6a4f;}.fo{background:#fff8f0;border:1px solid #f5d0a0;}.fo .v{color:#b86000;}
  table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px;}th{background:#1a1a2e;color:#f5e6c0;padding:7px 8px;text-align:left;font-weight:600;font-size:11px;}td{padding:6px 8px;border-bottom:1px solid #e8e0cc;}tr:nth-child(even) td{background:#faf8f2;}.cb{width:28px;text-align:center;}
  .tot{text-align:right;font-size:12px;margin-bottom:16px;color:#555;}
  .alert{border:2px solid #c0392b;border-radius:6px;padding:12px 16px;margin:18px 0;background:#fff5f5;}.alert strong{color:#c0392b;font-size:13px;display:block;margin-bottom:4px;}.alert p{font-size:12px;line-height:1.6;color:#3a1010;}
  .alert-orange{border:2px solid #e07000;border-radius:6px;padding:12px 16px;margin:12px 0;background:#fff8f0;}.alert-orange strong{color:#e07000;font-size:13px;display:block;margin-bottom:4px;}.alert-orange p{font-size:12px;line-height:1.6;color:#3a1a00;}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:32px;}.sig{border-top:1.5px solid #333;padding-top:8px;}.sig p{font-size:11px;color:#555;margin-top:2px;}.sig .nm{font-weight:600;font-size:12px;}
  .badge{display:inline-block;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:20px;margin-left:8px;}
  .footer{text-align:center;margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #e0d8c0;padding-top:10px;}
  @media print{body{padding:16px 20px;}button{display:none;}}
</style></head><body>
<div class="logo"><h1>✦ Controle de Locação ✦</h1><p>Checklist de Saída &amp; Devolução de Materiais</p></div>

<h2>Dados da Locação</h2>
<div class="grid2">
  <div class="field"><label>Locatário</label><span>${rental.tenantName||'—'}</span></div>
  <div class="field"><label>Telefone</label><span>${rental.phone||'—'}</span></div>
  <div class="field" style="grid-column:1/-1"><label>Endereço</label><span>${rental.address||'—'}</span></div>
  <div class="field"><label>Data da Locação</label><span>${fmtDate(rental.rentalDate)}</span></div>
  <div class="field"><label>Retorno Previsto</label><span>${fmtDate(rental.expectedReturnDate)}</span></div>
  <div class="field"><label>Responsável pela Saída</label><span>${rental.exitBy||'—'}</span></div>
  <div class="field"><label>Nº do Contrato</label><span>#${(rental.id||'').toUpperCase()}</span></div>
</div>

<h2>Resumo Financeiro</h2>
<div class="fin">
  <div class="fc ft"><label>Total do Pedido</label><span class="v">${R$(total)}</span></div>
  <div class="fc fp"><label>Valor Pago</label><span class="v">${R$(pago)}</span></div>
  <div class="fc ${debito>0?'fd':'fq'}"><label>${debito>0?'⚠ Em Débito':'✓ Quitado'}</label><span class="v">${R$(debito)}</span></div>
  <div class="fc fo"><label>Taxa Diária</label><span class="v">${R$(rental.dailyRate)}/dia</span></div>
</div>

${overdue>0?`<div class="alert-orange"><strong>⚠ Atraso na Devolução — ${overdueDays} dia(s)</strong><p>Valor adicional por atraso: <strong>${R$(overdue)}</strong>. O material deveria ter sido devolvido em ${fmtDate(rental.expectedReturnDate)}.</p></div>`:''}

<h2>Checklist de Saída <span class="badge" style="background:#b8860b">Saída</span></h2>
<table><thead><tr><th>Item</th><th>Material</th><th>Pintado</th><th>Qtd</th><th>Vl. Unit.</th><th>Subtotal</th><th>✓</th><th>Observações de Saída</th></tr></thead><tbody>${makeRows('saida')}</tbody></table>
<div class="tot"><strong>Total: ${R$(total)}</strong></div>

<h2>Checklist de Devolução <span class="badge" style="background:#2d6a4f">Retorno</span></h2>
<table><thead><tr><th>Item</th><th>Material</th><th>Pintado</th><th>Qtd Devolvida</th><th>✓</th><th>Estado / Avarias na Devolução</th></tr></thead><tbody>${makeRows('retorno')}</tbody></table>

<div class="alert">
  <strong>⚠ Cláusula de Responsabilidade por Avaria</strong>
  <p>O locatário declara ter recebido os itens listados acima em perfeito estado de conservação e assume total responsabilidade pela guarda e uso adequado dos materiais durante o período de locação.<br/><br/>
  <strong>Em caso de qualquer tipo de avaria, dano, quebra, perda ou deterioração</strong> das peças locadas, o locatário se compromete a pagar uma multa de <strong>100% (cem por cento) do valor da locação</strong> referente ao item danificado, além do custo de reparo ou reposição da peça, conforme avaliação do locador.<br/><br/>
  O não cumprimento do prazo de devolução implica cobrança de <strong>${R$(rental.dailyRate||0)} por dia de atraso</strong>.<br/><br/>
  A devolução dos materiais deverá ocorrer nas mesmas condições em que foram recebidos.</p>
</div>

<div class="sigs">
  <div class="sig"><br/><br/><br/><p>Assinatura do Locatário</p><p class="nm">${rental.tenantName||''}</p><p>Data: _____ / _____ / ________</p></div>
  <div class="sig"><br/><br/><br/><p>Responsável pela Entrega / Devolução</p><p class="nm">${rental.exitBy||''}</p><p>Data: _____ / _____ / ________</p></div>
</div>
<div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} &nbsp;·&nbsp; Este documento tem validade de contrato mediante assinatura das partes.</div>
</body></html>`

  const w = window.open('','_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(()=>w.print(),600)
}
