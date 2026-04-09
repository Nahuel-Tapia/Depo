import { useCallback } from 'react'

export default function PrintButton({ targetRef, title }) {
  const handlePrint = useCallback(() => {
    if (!targetRef?.current) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    const content = targetRef.current.innerHTML

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title || 'Reporte'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap');
          * { box-sizing: border-box; font-family: 'Ubuntu', sans-serif; }
          body { margin: 20px 30px; color: #1D252D; font-size: 12px; }
          .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #FF8200; padding-bottom: 10px; margin-bottom: 16px; }
          .print-header h2 { margin: 0; font-size: 16px; color: #1D252D; }
          .print-header .date { color: #6b7280; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 11px; }
          th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.3px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
          h3 { font-size: 13px; margin: 16px 0 8px; color: #1D252D; }
          button, .inline-actions, form, input, select, .sub-tabs, .sub-tab-btn { display: none !important; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h2>${title || 'Reporte'}</h2>
          <span class="date">${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${content}
      </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }, [targetRef, title])

  return (
    <button
      onClick={handlePrint}
      className="secondary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        fontSize: '0.78rem',
        width: 'auto',
        margin: '0',
        cursor: 'pointer',
      }}
    >
      🖨️ Imprimir
    </button>
  )
}
