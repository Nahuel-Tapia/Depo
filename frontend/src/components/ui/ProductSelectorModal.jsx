import { useState, useMemo } from 'react'
import Modal from './Modal'

export default function ProductSelectorModal({
  isOpen,
  onClose,
  productos = [],
  onSelect,
  selectedId = null,
  title = "Seleccionar Producto del Catálogo",
  showStock = true
}) {
  const [search, setSearch] = useState('')
  const [selectedMarca, setSelectedMarca] = useState('todas')

  const marcasDisponibles = useMemo(() => {
    const set = new Set()
    productos.forEach(p => {
      if (p.marca) set.add(p.marca.trim())
    })
    return ['todas', ...Array.from(set).sort()]
  }, [productos])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return productos.filter(p => {
      const matchMarca = selectedMarca === 'todas' || 
        (p.marca && p.marca.trim().toLowerCase() === selectedMarca.toLowerCase())
      
      if (!matchMarca) return false

      if (!term) return true

      const name = (p.nombre || '').toLowerCase()
      const sku = (p.codigo_sku || p.sku || '').toLowerCase()
      const marca = (p.marca || '').toLowerCase()
      const ubic = (p.ubicacion_estante || p.ubicacion || '').toLowerCase()
      const desc = (p.descripcion || '').toLowerCase()
      
      return name.includes(term) || sku.includes(term) || marca.includes(term) || ubic.includes(term) || desc.includes(term)
    })
  }, [productos, search, selectedMarca])

  const handleSelect = (prod) => {
    onSelect(prod)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Search input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre de producto, SKU, marca o ubicación de estante..."
            style={{
              paddingLeft: 38,
              paddingRight: search ? 36 : 12,
              fontSize: '0.92rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              width: '100%'
            }}
            autoFocus
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.95rem' }}>
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                margin: 0,
                width: 'auto',
                minHeight: 'auto',
                fontSize: '0.85rem'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Marca filter chips */}
        {marcasDisponibles.length > 2 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>Marca:</span>
            {marcasDisponibles.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMarca(m)}
                style={{
                  width: 'auto',
                  margin: 0,
                  padding: '4px 10px',
                  borderRadius: 16,
                  fontSize: '0.78rem',
                  fontWeight: selectedMarca === m ? 600 : 400,
                  background: selectedMarca === m ? '#f97316' : '#f1f5f9',
                  color: selectedMarca === m ? '#ffffff' : '#334155',
                  border: '1px solid',
                  borderColor: selectedMarca === m ? '#ea580c' : '#e2e8f0',
                  cursor: 'pointer',
                  minHeight: 'auto'
                }}
              >
                {m === 'todas' ? 'Todas las Marcas' : m}
              </button>
            ))}
          </div>
        )}

        {/* Counter summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
          <span>{filtered.length} producto{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}</span>
          {search && <span>Filtrado por: "{search}"</span>}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 390, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>📦</div>
              <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron productos</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>Intente buscar con otro nombre, SKU o marca</p>
            </div>
          ) : (
            filtered.map(prod => {
              const isSelected = selectedId && String(prod.id) === String(selectedId)
              const stockVal = Number(prod.stock_central ?? prod.stock_actual ?? prod.stock ?? 0)
              const sku = prod.codigo_sku || prod.sku

              return (
                <div
                  key={prod.id}
                  onClick={() => handleSelect(prod)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: isSelected ? '#f97316' : '#e2e8f0',
                    background: isSelected ? '#fff7ed' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#f97316'
                      e.currentTarget.style.background = '#fefce8'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.background = '#ffffff'
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.93rem' }}>
                        {prod.nombre}
                      </span>

                      {sku && (
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          letterSpacing: '0.3px'
                        }}>
                          SKU: {sku}
                        </span>
                      )}

                      {prod.marca && (
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          🏷️ {prod.marca}
                        </span>
                      )}

                      {prod.es_perecedero && (
                        <span style={{
                          background: '#fee2e2',
                          color: '#991b1b',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          ⏳ Perecedero
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {prod.ubicacion_estante && <span>📍 Ubicación: <strong>{prod.ubicacion_estante}</strong></span>}
                      {prod.descripcion && <span>📝 {prod.descripcion}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {showStock && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: stockVal > 0 ? '#15803d' : '#dc2626'
                        }}>
                          {stockVal} u.
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Stock Depósito</div>
                      </div>
                    )}

                    <button
                      type="button"
                      style={{
                        width: 'auto',
                        margin: 0,
                        padding: '6px 14px',
                        fontSize: '0.82rem',
                        borderRadius: 6,
                        background: isSelected ? '#ea580c' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#0f172a',
                        border: '1px solid',
                        borderColor: isSelected ? '#ea580c' : '#cbd5e1',
                        whiteSpace: 'nowrap',
                        minHeight: 'auto'
                      }}
                    >
                      {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
