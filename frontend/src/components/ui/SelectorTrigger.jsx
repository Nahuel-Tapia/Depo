export default function SelectorTrigger({
  label,
  selectedItem = null,
  placeholder = "Haz clic para seleccionar...",
  onClick,
  onClear = null,
  getDisplayTitle = (item) => item?.nombre || '',
  getDisplaySubtitle = (item) => {
    if (!item) return ''
    const parts = []
    if (item.cue) parts.push(`CUE: ${item.cue}`)
    if (item.codigo_sku || item.sku) parts.push(`SKU: ${item.codigo_sku || item.sku}`)
    if (item.nivel_educativo) parts.push(item.nivel_educativo)
    if (item.marca) parts.push(`Marca: ${item.marca}`)
    if (item.ubicacion_estante) parts.push(`Estante: ${item.ubicacion_estante}`)
    return parts.join(' • ')
  },
  required = false
}) {
  const hasSelection = Boolean(selectedItem)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ margin: 0, fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {hasSelection ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: '#fff7ed',
            border: '1px solid #ffedd5',
            borderRadius: 8,
            gap: 12
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getDisplayTitle(selectedItem)}
            </span>
            {getDisplaySubtitle(selectedItem) && (
              <span style={{ fontSize: '0.78rem', color: '#ea580c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getDisplaySubtitle(selectedItem)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, shrink: 0 }}>
            <button
              type="button"
              onClick={onClick}
              style={{
                width: 'auto',
                margin: 0,
                padding: '4px 10px',
                fontSize: '0.78rem',
                borderRadius: 6,
                background: '#ffffff',
                color: '#ea580c',
                border: '1px solid #ffedd5',
                cursor: 'pointer',
                minHeight: 'auto',
                fontWeight: 600
              }}
            >
              🔄 Cambiar
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                style={{
                  width: 'auto',
                  margin: 0,
                  padding: '4px 8px',
                  fontSize: '0.78rem',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: 'auto'
                }}
                title="Quitar selección"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          style={{
            width: '100%',
            margin: 0,
            padding: '10px 14px',
            fontSize: '0.9rem',
            borderRadius: 8,
            background: '#ffffff',
            color: '#64748b',
            border: '1px dashed #cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.15s ease',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f97316'
            e.currentTarget.style.color = '#ea580c'
            e.currentTarget.style.background = '#fff7ed'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.color = '#64748b'
            e.currentTarget.style.background = '#ffffff'
          }}
        >
          <span>🔍 {placeholder}</span>
          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569', fontWeight: 600 }}>
            Elegir
          </span>
        </button>
      )}
    </div>
  )
}
