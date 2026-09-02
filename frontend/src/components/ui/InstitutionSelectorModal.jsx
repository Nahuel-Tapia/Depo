import { useState, useMemo } from 'react'
import Modal from './Modal'

export default function InstitutionSelectorModal({
  isOpen,
  onClose,
  instituciones = [],
  onSelect,
  selectedId = null,
  title = "Seleccionar Institución Educativa"
}) {
  const [search, setSearch] = useState('')
  const [selectedNivel, setSelectedNivel] = useState('todos')

  const nivelesDisponibles = useMemo(() => {
    const set = new Set()
    instituciones.forEach(i => {
      if (i.nivel_educativo) set.add(i.nivel_educativo.trim())
    })
    return ['todos', ...Array.from(set).sort()]
  }, [instituciones])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return instituciones.filter(inst => {
      const matchNivel = selectedNivel === 'todos' || 
        (inst.nivel_educativo && inst.nivel_educativo.trim().toLowerCase() === selectedNivel.toLowerCase())
      
      if (!matchNivel) return false

      if (!term) return true

      const name = (inst.nombre || '').toLowerCase()
      const cue = (inst.cue || '').toLowerCase()
      const nivel = (inst.nivel_educativo || '').toLowerCase()
      const dep = (inst.departamento || inst.domicilio || inst.localidad || '').toLowerCase()
      
      return name.includes(term) || cue.includes(term) || nivel.includes(term) || dep.includes(term)
    })
  }, [instituciones, search, selectedNivel])

  const handleSelect = (inst) => {
    onSelect(inst)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Search input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar por CUE, nombre de escuela, nivel o departamento..."
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

        {/* Nivel filter chips */}
        {nivelesDisponibles.length > 2 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>Nivel:</span>
            {nivelesDisponibles.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedNivel(n)}
                style={{
                  width: 'auto',
                  margin: 0,
                  padding: '4px 10px',
                  borderRadius: 16,
                  fontSize: '0.78rem',
                  fontWeight: selectedNivel === n ? 600 : 400,
                  background: selectedNivel === n ? '#f97316' : '#f1f5f9',
                  color: selectedNivel === n ? '#ffffff' : '#334155',
                  border: '1px solid',
                  borderColor: selectedNivel === n ? '#ea580c' : '#e2e8f0',
                  cursor: 'pointer',
                  minHeight: 'auto'
                }}
              >
                {n === 'todos' ? 'Todos los Niveles' : n}
              </button>
            ))}
          </div>
        )}

        {/* Counter summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
          <span>{filtered.length} institución{filtered.length !== 1 ? 'es' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</span>
          {search && <span>Filtrado por: "{search}"</span>}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🏫</div>
              <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron instituciones</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>Intente ajustar el término de búsqueda o el filtro de nivel</p>
            </div>
          ) : (
            filtered.map(inst => {
              const isSelected = selectedId && String(inst.id) === String(selectedId)
              return (
                <div
                  key={inst.id}
                  onClick={() => handleSelect(inst)}
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
                        {inst.nombre}
                      </span>
                      {inst.cue && (
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          letterSpacing: '0.3px'
                        }}>
                          CUE: {inst.cue}
                        </span>
                      )}
                      {inst.nivel_educativo && (
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          {inst.nivel_educativo}
                        </span>
                      )}
                    </div>

                    {(inst.departamento || inst.domicilio) && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: 12 }}>
                        {inst.departamento && <span>📍 {inst.departamento}</span>}
                        {inst.domicilio && <span>🏠 {inst.domicilio}</span>}
                      </div>
                    )}
                  </div>

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
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
