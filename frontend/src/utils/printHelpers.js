export const printMovimiento = (movimientoOrGroup) => {
  const printWindow = window.open('', '_blank', 'width=700,height=600')
  if (!printWindow) return

  const isGroup = Array.isArray(movimientoOrGroup);
  const movs = isGroup ? movimientoOrGroup : [movimientoOrGroup];
  const primer = movs[0];

  const institucionCargo = primer.institucion_nombre && primer.cargo_retira
    ? `${primer.institucion_nombre} (${primer.cargo_retira})`
    : primer.institucion_nombre || primer.cargo_retira || '-'

  const fecha = primer.created_at
    ? new Date(primer.created_at).toLocaleString('es-AR')
    : (primer.fecha ? new Date(primer.fecha).toLocaleString('es-AR') : '-')

  const rowsHTML = movs.map(m => `<tr><td>${m.producto_nombre || m.producto || '-'}</td><td>${m.cantidad ?? '-'}</td><td>${m.estado_producto || m.estado || '-'}</td><td>${m.proveedor_nombre || m.proveedor || '-'}</td></tr>`).join('');

  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Movimiento #${primer.id || ''}</title>
        <style>
          * { box-sizing: border-box; font-family: Arial, sans-serif; }
          body { margin: 24px; color: #111827; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #FF8200; padding-bottom: 10px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .header-left img { height: 40px; width: auto; }
          .header-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
          th { background: #f3f4f6; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 54px; }
          .signature { border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/faviconmin.png" alt="Logo San Juan" />
            <div>
              <div style="font-weight: bold; font-size: 1.1rem;">San Juan Gobierno</div>
              <div style="font-size: 0.9rem; color: #666;">Ministerio de Educación</div>
            </div>
          </div>
          <div class="header-right">
            <div style="font-weight: bold; font-size: 1.1rem;">Comprobante de Movimiento</div>
            <div style="font-size: 0.9rem; color: #666;">Tipo: ${primer.tipo || '-'}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div><strong>Institución/Cargo:</strong> ${institucionCargo}</div>
          <div><strong>Motivo:</strong> ${primer.motivo || '-'}</div>
          <div><strong>Registrado por:</strong> ${primer.usuario_nombre || primer.usuario || '-'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
        </div>

        <h4>Productos</h4>
        <table>
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Proveedor</th></tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature">Firma de quien entrega</div>
          <div class="signature">Firma y sello del directivo</div>
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
