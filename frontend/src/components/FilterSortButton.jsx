import { useEffect, useRef, useState } from 'react'

export default function FilterSortButton({
  searchValue = '',
  searchPlaceholder = 'Buscar...',
  onSearchChange,
  filters = [],
  sortValue = '',
  sortOptions = [],
  onSortChange,
  onClear,
  activeCount = 0,
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Check if we're on mobile (matches the CSS breakpoint)
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event) => {
      // On mobile, don't close on outside click — only "Aplicar" closes
      if (isMobile()) return

      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (open && isMobile()) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="filter-sort" ref={panelRef}>
      <button
        type="button"
        className={`filter-sort-trigger ${activeCount > 0 ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="filter-sort-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>
        <span>Filtrar y ordenar</span>
        {activeCount > 0 && <span className="filter-sort-count">{activeCount}</span>}
      </button>

      {open && (
        <>
          {/* Dark overlay on mobile */}
          <div
            className="filter-sort-overlay"
            onClick={() => setOpen(false)}
          />
          <div className="filter-sort-panel">
            {typeof onSearchChange === 'function' && (
              <div className="filter-sort-field filter-sort-field-wide">
                <label>Filtrar</label>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                />
              </div>
            )}

            {filters.map((filter) => (
              <div key={filter.key} className="filter-sort-field">
                <label>{filter.label}</label>
                <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
                  <option value="">{filter.emptyLabel || 'Todos'}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ))}

            {sortOptions.length > 0 && typeof onSortChange === 'function' && (
              <div className="filter-sort-field">
                <label>Ordenar</label>
                <select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

            {typeof onClear === 'function' && (
              <div className="filter-sort-actions">
                <button type="button" className="secondary" onClick={onClear}>
                  Limpiar
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
