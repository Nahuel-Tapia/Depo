export const printMovimiento = (movimientoOrGroup, instituciones = []) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return

  const isGroup = Array.isArray(movimientoOrGroup);
  const movs = isGroup ? movimientoOrGroup : [movimientoOrGroup];
  const primer = movs[0];

  const institucionMatch = instituciones.find(i => i.nombre === primer.institucion_nombre)
  const cueStr = institucionMatch && institucionMatch.cue ? institucionMatch.cue : '-'

  const institucionNombre = primer.institucion_nombre || '-'

  const dateObj = primer.created_at ? new Date(primer.created_at) : new Date()
  const day = dateObj.getDate()
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  const month = monthNames[dateObj.getMonth()]
  const year = dateObj.getFullYear()
  const fechaStr = `San Juan, ${day} de ${month} del ${year}`

  const rowsHTML = movs.map((m, i) => `<tr>
    <td style="text-align: center;">${i + 1}</td>
    <td style="text-align: center;">${m.cantidad ?? '-'}</td>
    <td>${m.producto_nombre || m.producto || '-'}</td>
    <td>${m.estado_producto || m.estado || '-'}</td>
  </tr>`).join('');

  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Remito de Egreso #${primer.id || ''}</title>
        <style>
          * { box-sizing: border-box; font-family: Arial, sans-serif; }
          body { margin: 40px; color: #111827; font-size: 14px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .header-left { display: flex; align-items: center; gap: 16px; }
          .header-left img { height: 60px; width: auto; }
          .header-text { line-height: 1.4; }
          .title { text-align: center; font-size: 24px; font-weight: bold; margin: 30px 0; text-decoration: underline; letter-spacing: 1px; }
          .date { text-align: right; margin-bottom: 30px; font-style: italic; font-size: 15px; }
          .info-section { margin-bottom: 30px; line-height: 1.8; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th, td { border: 1px solid #000; padding: 10px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; text-align: center; }
          .signatures { display: flex; justify-content: space-around; margin-top: 80px; }
          .signature-line { border-top: 1px solid #000; padding-top: 8px; text-align: center; width: 250px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/faviconmin.png" alt="Logo" />
            <div class="header-text">
              <div style="font-weight: bold; font-size: 18px;">Depósito Central</div>
              <div style="font-size: 14px; color: #444;">Hipólito Yrigoyen 1515(E) - Santa Lucía 4302361</div>
            </div>
          </div>
          <div style="font-weight: bold; font-size: 18px;">
            REMITO N° ${primer.id || ''}
          </div>
        </div>

        <div class="date">${fechaStr}</div>

        <div class="info-section">
          <div><strong>CUE de la Institución:</strong> ${cueStr}</div>
          <div><strong>Nombre de la Institución:</strong> ${institucionNombre}</div>
          ${primer.cargo_retira ? '<div><strong>Retira:</strong> ' + primer.cargo_retira + '</div>' : ''}
          ${primer.motivo ? '<div><strong>Motivo:</strong> ' + primer.motivo + '</div>' : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Reng</th>
              <th style="width: 80px;">Cant.</th>
              <th>Descripción del Producto</th>
              <th style="width: 120px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-line">Firma de quien entrega</div>
          <div class="signature-line">Firma de quien recibe</div>
        </div>
      </body>
      </html>
    `)

  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)
}

