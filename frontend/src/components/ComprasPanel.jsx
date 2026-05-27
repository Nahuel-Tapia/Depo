import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const ESTADO_BADGE = {
  enviada: 'pendiente',
  aceptada: 'aprobado',
  adjudicada: 'entregado',
  cerrada: 'entregado',
  borrador: 'pendiente'
}

const NIVELES = ['Inicial', 'Primaria', 'Secundaria', 'Especial', 'Superior', 'Adultos']

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(value))
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.director_area_id) params.set('director_area_id', filters.director_area_id)
  if (filters.nivel) params.set('nivel', filters.nivel)
  if (filters.estado) params.set('estado', filters.estado)
  return params.toString() ? `?${params.toString()}` : ''
}

function Filters({ filters, setFilters, directores, compact = false }) {
  const wrapperStyle = compact
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }

  return (
    <div style={wrapperStyle}>
      <div>
        <label>Director de Area</label>
        <select value={filters.director_area_id} onChange={(e) => setFilters((prev) => ({ ...prev, director_area_id: e.target.value }))}>
          <option value="">Todos</option>
          {directores.map((director) => (
            <option key={director.id} value={director.id}>{director.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Nivel educativo</label>
        <select value={filters.nivel} onChange={(e) => setFilters((prev) => ({ ...prev, nivel: e.target.value }))}>
          <option value="">Todos</option>
          {NIVELES.map((nivel) => (
            <option key={nivel} value={nivel}>{nivel}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Estado</label>
        <select value={filters.estado} onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value }))}>
          <option value="">Todos</option>
          <option value="enviada">Enviada</option>
          <option value="aceptada">Aceptada</option>
          <option value="adjudicada">Adjudicada</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </div>
    </div>
  )
}

export default function ComprasPanel({ section = 'pedidos', onNavigate }) {
  const { token, user, masterDirectorAreaId } = useAuth()
  const printRef = useRef(null)

  const [filters, setFilters] = useState({ director_area_id: '', nivel: '', estado: '' })
  const [catalogPlanillas, setCatalogPlanillas] = useState([])
  const [planillas, setPlanillas] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [consolidado, setConsolidado] = useState([])
  const [estadoDirectores, setEstadoDirectores] = useState([])
  const [adjudicacion, setAdjudicacion] = useState([])
  const [refuerzoPendientes, setRefuerzoPendientes] = useState([])
  const [historialAdjudicaciones, setHistorialAdjudicaciones] = useState([])
  const [historialExpandido, setHistorialExpandido] = useState({})
  const [proveedores, setProveedores] = useState([])
  const [formByProduct, setFormByProduct] = useState({})
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [itemsFinales, setItemsFinales] = useState([])
  const [publicacionStatus, setPublicacionStatus] = useState({ publicada: false, data: null })
  const [selectedLicitacionId, setSelectedLicitacionId] = useState('')
  const [devolucionState, setDevolucionState] = useState({})
  const [devolucionModal, setDevolucionModal] = useState(null)
  const [detalleSearch, setDetalleSearch] = useState('')
  const [consolidadoSearch, setConsolidadoSearch] = useState('')
  const [editQty, setEditQty] = useState({})
  const [showConfirmPublicar, setShowConfirmPublicar] = useState(false)
  const [motivoLicitacion, setMotivoLicitacion] = useState(`Licitación Anual ${new Date().getFullYear()}`)

  const licitacionStorageKey = 'compras.selectedLicitacionId'

  useEffect(() => {
    if (user?.role === 'master' && masterDirectorAreaId) {
      setFilters((prev) =>
        prev.director_area_id === masterDirectorAreaId ? prev : { ...prev, director_area_id: masterDirectorAreaId }
      )
    }
  }, [user?.role, masterDirectorAreaId])

  const loadCatalogData = async () => {
    const proveedoresRes = await apiFetch('/api/proveedores', { token })
    const proveedoresData = proveedoresRes.ok ? await proveedoresRes.json() : { proveedores: [] }
    setProveedores(proveedoresData.proveedores || [])
  }

  const loadAdjudicacionData = async (licitacionId = selectedLicitacionId) => {
    const licitacionIdNum = Number(licitacionId || 0)
    if (!licitacionIdNum) {
      setAdjudicacion([])
      return
    }

    try {
      const anio = new Date().getFullYear()
      const adjudicacionRes = await apiFetch(`/api/compras/adjudicacion?anio=${anio}&licitacion_id=${licitacionIdNum}`, { token })
      const adjudicacionData = adjudicacionRes.ok ? await adjudicacionRes.json() : { items: [] }

      if (!adjudicacionRes.ok) {
        throw new Error(adjudicacionData.error || 'No se pudo cargar la adjudicación')
      }

      setAdjudicacion(adjudicacionData.items || [])
      if (adjudicacionData.proveedores) {
        setProveedores(adjudicacionData.proveedores || [])
      }

      setFormByProduct((prev) => {
        const next = { ...prev }
        for (const item of adjudicacionData.items || []) {
          const key = String(item.producto_id)
          next[key] = {
            proveedor_id: next[key]?.proveedor_id || String(item.proveedor_actual_id || ''),
            precio_compra_real: next[key]?.precio_compra_real || (item.precio_actual ? String(item.precio_actual) : '')
          }
        }
        return next
      })
    } catch (err) {
      setAdjudicacion([])
      setMsg({ text: err.message || 'No se pudo cargar la adjudicación', type: 'error' })
    }
  }

  const loadWorkflowData = async (activeFilters = filters) => {
    setLoading(true)
    try {
      const anio = new Date().getFullYear()
      const tipoLicitacion = section === 'refuerzos' ? 'refuerzo' : section === 'listado-final' ? 'anual' : ''

      const shouldLoadHistorial = section === 'adjudicacion'
      const [consolidadoRes, statusRes, finalRes, pubRes, planillasRes, refuerzosRes, historialRes] = await Promise.all([
        apiFetch(`/api/compras/licitacion/anual/consolidado?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/estado-directores?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/final-items?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/publicada-status?anio=${anio}${tipoLicitacion ? `&tipo=${tipoLicitacion}` : ''}`, { token }),
        apiFetch(`/api/compras/planillas?anio=${anio}`, { token }),
        apiFetch(`/api/compras/refuerzos/pendientes-licitacion?anio=${anio}`, { token }),
        shouldLoadHistorial ? apiFetch('/api/compras/adjudicacion/historial', { token }) : Promise.resolve({ ok: true, json: async () => ({ licitaciones: [] }) }),
      ])

      const consolidadoData = consolidadoRes.ok ? await consolidadoRes.json() : { items: [] }
      const statusData = statusRes.ok ? await statusRes.json() : { directores: [] }
      const finalData = finalRes.ok ? await finalRes.json() : { items: [] }
      const pubData = pubRes.ok ? await pubRes.json() : { publicada: false }
      const planillasData = planillasRes.ok ? await planillasRes.json() : { planillas: [] }
      const refuerzosData = refuerzosRes.ok ? await refuerzosRes.json() : { items: [] }
      const historialData = historialRes.ok ? await historialRes.json() : { licitaciones: [] }

      setConsolidado(consolidadoData.items || [])
      setEstadoDirectores(statusData.directores || [])
      setItemsFinales(finalData.items || [])
      setPublicacionStatus(pubData)
      setPlanillas(planillasData.planillas || [])
      setRefuerzoPendientes(refuerzosData.items || [])
      setHistorialAdjudicaciones(historialData.licitaciones || [])
      setMotivoLicitacion(
        String(pubData?.data?.motivo || pubData?.data?.titulo || `Licitación Anual ${anio}`).trim()
      )

      const licitaciones = pubData?.licitaciones || []
      const licitacionesActivas = licitaciones.filter((licitacion) => !['en_deposito', 'completada'].includes(licitacion.estado))
      const rememberedId = typeof window !== 'undefined' ? window.sessionStorage.getItem(licitacionStorageKey) : ''
      const preferredId = selectedLicitacionId || rememberedId || ''
      const nextSelectedId = licitacionesActivas.some((licitacion) => String(licitacion.id) === String(preferredId))
        ? String(preferredId)
        : (licitacionesActivas[0] ? String(licitacionesActivas[0].id) : '')

      if (String(nextSelectedId) !== String(selectedLicitacionId)) {
        setSelectedLicitacionId(nextSelectedId)
        if (typeof window !== 'undefined') {
          if (nextSelectedId) window.sessionStorage.setItem(licitacionStorageKey, String(nextSelectedId))
          else window.sessionStorage.removeItem(licitacionStorageKey)
        }
      } else if (nextSelectedId) {
        await loadAdjudicacionData(nextSelectedId)
      } else {
        setAdjudicacion([])
      }
      
      // Inicializar cantidades editables con las originales (sin descontar stock automáticamente)
      const initialEdit = {}
      const itemsToUse = consolidadoData.items || []
      itemsToUse.forEach(item => {
        initialEdit[item.producto_id] = item.cantidad_total
      })
      setEditQty(initialEdit)

    } catch (err) {
      setMsg({ text: err.message || 'No se pudo cargar la informacion', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalogData()
    loadWorkflowData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    loadWorkflowData(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.director_area_id, filters.nivel, filters.estado])

  useEffect(() => {
    if (!selectedLicitacionId) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(licitacionStorageKey)
      }
      setAdjudicacion([])
      return
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(licitacionStorageKey, String(selectedLicitacionId))
    }
    loadAdjudicacionData(selectedLicitacionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLicitacionId])

  const directores = useMemo(() => {
    const map = new Map()
    for (const planilla of catalogPlanillas) {
      if (!planilla.director_area_id) continue
      map.set(String(planilla.director_area_id), {
        id: String(planilla.director_area_id),
        nombre: `${planilla.director_nombre || ''} ${planilla.director_apellido || ''}`.trim()
      })
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [catalogPlanillas])

  const groupedDetalle = useMemo(() => {
    if (!detalle?.detalles) return []
    const grouped = detalle.detalles.reduce((acc, item) => {
      if (!acc[item.institucion]) {
        acc[item.institucion] = {
          institucion: item.institucion,
          cue: item.cue,
          nivel: item.nivel,
          items: []
        }
      }
      acc[item.institucion].items.push(item)
      return acc
    }, {})
    return Object.values(grouped)
  }, [detalle])

  const filteredConsolidado = useMemo(() => {
    const q = String(consolidadoSearch || '').toLowerCase().trim()
    if (!q) return consolidado
    return consolidado.filter(item => 
      String(item.producto || '').toLowerCase().includes(q)
    )
  }, [consolidado, consolidadoSearch])

  const filteredDetalleItems = useMemo(() => {
    if (!detalle?.detalles) return []
    const q = String(detalleSearch || '').toLowerCase().trim()
    if (!q) return detalle.detalles
    return detalle.detalles.filter(item => 
      String(item.producto || '').toLowerCase().includes(q) ||
      String(item.institucion || '').toLowerCase().includes(q) ||
      String(item.cue || '').toLowerCase().includes(q)
    )
  }, [detalle, detalleSearch])

  const licitaciones = useMemo(() => publicacionStatus.licitaciones || [], [publicacionStatus])

  const licitacionesActivas = useMemo(
    () => licitaciones.filter((licitacion) => !['en_deposito', 'completada'].includes(licitacion.estado)),
    [licitaciones]
  )

  const selectedLicitacion = useMemo(() => {
    if (!licitacionesActivas.length) return null
    return licitacionesActivas.find((licitacion) => String(licitacion.id) === String(selectedLicitacionId)) || licitacionesActivas[0]
  }, [licitacionesActivas, selectedLicitacionId])

  const licitacionesHistoricas = useMemo(
    () => historialAdjudicaciones.filter((licitacion) => ['adjudicada', 'en_deposito', 'completada'].includes(licitacion.estado)),
    [historialAdjudicaciones]
  )

  const licitacionesAnualesActivas = useMemo(
    () => licitaciones.filter((licitacion) => String(licitacion.tipo || 'anual') === 'anual'),
    [licitaciones]
  )

  const licitacionesRefuerzoActivas = useMemo(
    () => licitaciones.filter((licitacion) => String(licitacion.tipo || 'anual') === 'refuerzo'),
    [licitaciones]
  )

  const listadoPendienteAnual = useMemo(() => {
    const consumidoPorProducto = new Map()

    for (const licitacion of licitacionesAnualesActivas) {
      const rawItems = typeof licitacion.items === 'string' ? JSON.parse(licitacion.items) : (licitacion.items || [])
      for (const item of rawItems) {
        const productoId = Number(item.producto_id)
        if (!productoId) continue
        const cantidad = Number(item.cantidad_a_licitar || item.cantidad_solicitada || 0)
        consumidoPorProducto.set(productoId, (consumidoPorProducto.get(productoId) || 0) + cantidad)
      }
    }

    return consolidado
      .map((item) => {
        const consumido = consumidoPorProducto.get(Number(item.producto_id)) || 0
        const pendiente = Math.max(0, Number(item.cantidad_total || 0) - consumido)
        return pendiente > 0 ? { ...item, cantidad_total: pendiente, cantidad_pendiente: pendiente } : null
      })
      .filter(Boolean)
  }, [consolidado, licitacionesAnualesActivas])

  const listadoPendienteRefuerzo = useMemo(() => {
    const consumidoPorProducto = new Map()

    for (const licitacion of licitacionesRefuerzoActivas) {
      const rawItems = typeof licitacion.items === 'string' ? JSON.parse(licitacion.items) : (licitacion.items || [])
      for (const item of rawItems) {
        const productoId = Number(item.producto_id)
        if (!productoId) continue
        const cantidad = Number(item.cantidad_a_licitar || item.cantidad_solicitada || 0)
        consumidoPorProducto.set(productoId, (consumidoPorProducto.get(productoId) || 0) + cantidad)
      }
    }

    return refuerzoPendientes
      .map((item) => {
        const consumido = consumidoPorProducto.get(Number(item.producto_id)) || 0
        const pendiente = Math.max(0, Number(item.cantidad_total || 0) - consumido)
        return pendiente > 0 ? { ...item, cantidad_total: pendiente, cantidad_a_licitar: pendiente } : null
      })
      .filter(Boolean)
  }, [refuerzoPendientes, licitacionesRefuerzoActivas])

  const handleVerDetalle = async (id) => {
    if (detalle?.planilla?.id === id) {
      setDetalle(null)
      return
    }

    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el detalle')
      setDetalle(data)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleAceptarPlanilla = async (id) => {
    setUpdatingId(id)
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}/aceptar`, {
        token,
        method: 'PATCH'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const faltantes = (data.validacion_cobertura?.faltantes || [])
          .map((item) => `${item.nombre}${item.cue ? ` (${item.cue})` : ''}`)
          .join(', ')
        throw new Error(faltantes ? `${data.error} Faltan: ${faltantes}` : (data.error || 'No se pudo aceptar'))
      }
      setMsg({ text: `Planilla #${id} aceptada y disponible para la licitacion.`, type: 'success' })
      if (detalle?.planilla?.id === id) setDetalle(null)
      await loadCatalogData()
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDevolverPlanilla = async (planillaId) => {
    const motivo = devolucionState[planillaId]?.motivo || ''
    setDevolucionState(prev => ({ ...prev, [planillaId]: { ...prev[planillaId], loading: true } }))
    try {
      const res = await apiFetch(`/api/compras/planillas/${planillaId}/devolver`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ motivo }),
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo devolver la planilla')
      setMsg({ text: `Planilla devuelta al director de área.`, type: 'success' })
      setDevolucionState(prev => {
        const next = { ...prev }
        delete next[planillaId]
        return next
      })
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
      setDevolucionState(prev => ({ ...prev, [planillaId]: { ...prev[planillaId], loading: false } }))
    }
  }

  const handleExportCSV = () => {
    if (!consolidado.length) return
    const headers = ['Producto', 'Cantidad Total', 'Unidad de Medida']
    const rows = consolidado.map(item => [
      item.producto,
      item.cantidad_total,
      item.unidad_medida
    ])
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `licitacion_${new Date().getFullYear()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFormChange = (productoId, field, value) => {
    setFormByProduct((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        [field]: value
      }
    }))
  }

  const handleEditQty = (idProducto, val) => {
    setEditQty(prev => ({
      ...prev,
      [idProducto]: Number(val)
    }))
  }

  const toggleHistorialDetalle = (licitacionId) => {
    setHistorialExpandido((prev) => ({
      ...prev,
      [licitacionId]: !prev[licitacionId]
    }))
  }

  const handlePublicar = async () => {
    setSaving(true)
    try {
      const anio = new Date().getFullYear()
      const motivoSanitizado = String(motivoLicitacion || '').trim() || `Licitación Anual ${anio}`
      const itemsSource = section === 'refuerzos' ? listadoPendienteRefuerzo : listadoPendienteAnual
      const payload = {
        anio,
        tipo: section === 'refuerzos' ? 'refuerzo' : 'anual',
        titulo: motivoSanitizado,
        motivo: motivoSanitizado,
        items: itemsSource.map(item => ({
          ...item,
          cantidad_a_licitar: editQty[item.producto_id] !== undefined ? editQty[item.producto_id] : item.cantidad_total
        }))
      }
      const res = await apiFetch('/api/compras/licitacion/anual/publicar', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setShowConfirmPublicar(false)
        if (data?.licitacion?.id) {
          setSelectedLicitacionId(String(data.licitacion.id))
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(licitacionStorageKey, String(data.licitacion.id))
          }
        }
        await loadWorkflowData()
        if (onNavigate) onNavigate('compras-adjudicacion')
        setMsg({ text: 'Nueva licitación creada. Continúa en Adjudicación y Cierre.', type: 'success' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Error al publicar')
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleReabrir = async () => {
    if (!selectedLicitacion?.id) return
    if (!window.confirm('¿Estás seguro que deseas eliminar esta licitación? La adjudicación de esa licitación se perderá.')) return
    
    setLoading(true)
    try {
      const res = await apiFetch(`/api/compras/licitacion/anual/publicar/${selectedLicitacion.id}`, {
        token,
        method: 'DELETE'
      })
      if (res.ok) {
        setSelectedLicitacionId('')
        await loadWorkflowData()
        setMsg({ text: 'Licitación eliminada. Puedes generar otra desde el listado final.', type: 'success' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Error al reabrir')
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
      setLoading(false)
    }
  }

  const handleEnviarADeposito = async () => {
    if (!selectedLicitacion?.id) return

    setSaving(true)
    try {
      const res = await apiFetch('/api/compras/licitacion/anual/enviar-deposito', {
        token,
        method: 'POST',
        body: JSON.stringify({ id: selectedLicitacion.id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la licitación a depósito')

      setMsg({ text: 'La licitación se envió a depósito correctamente.', type: 'success' })
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarAdjudicacion = async () => {
    if (!selectedLicitacion?.id) {
      setMsg({ text: 'Debes seleccionar una licitación para adjudicar.', type: 'error' })
      return
    }

    const incomplete = adjudicacion.find((item) => {
      const current = formByProduct[String(item.producto_id)] || {}
      return !current.proveedor_id || !current.precio_compra_real
    })

    if (incomplete) {
      setMsg({ text: `Completa proveedor y precio para ${incomplete.producto}.`, type: 'error' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        licitacion_id: Number(selectedLicitacion.id),
        items: adjudicacion.map((item) => {
          const current = formByProduct[String(item.producto_id)] || {}
          return {
            producto_id: item.producto_id,
            proveedor_id: Number(current.proveedor_id),
            precio_compra_real: Number(current.precio_compra_real)
          }
        })
      }

      const res = await apiFetch('/api/compras/adjudicacion', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la adjudicacion')

      setMsg({ text: 'La adjudicacion se guardo correctamente.', type: 'success' })
      await loadCatalogData()
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const headerBySection = {
    licitacion: {
      title: `Licitacion Anual ${new Date().getFullYear()}`,
      subtitle: 'Consolidado general de pedidos aprobados por directores de area.'
    },
    'listado-final': {
      title: 'Listado Final a Licitar',
      subtitle: licitacionesAnualesActivas.length > 0
        ? `Ya hay ${licitacionesAnualesActivas.length} licitación${licitacionesAnualesActivas.length === 1 ? '' : 'es'} anual${licitacionesAnualesActivas.length === 1 ? '' : 'es'} creada${licitacionesAnualesActivas.length === 1 ? '' : 's'}. El listado solo muestra pendientes no licitados.`
        : 'Listado detallado por institución para validación y ajuste de cantidades finales.'
    },
    refuerzos: {
      title: 'Licitaciones Refuerzos',
      subtitle: 'Solo aparecen productos de refuerzo sin stock disponible en depósito central.'
    },
    adjudicacion: {
      title: 'Adjudicacion y Cierre de Compra',
      subtitle: 'Gestiona varias licitaciones del mismo año, adjudica cada una y envíalas a depósito por separado.'
    }
  }

  const header = headerBySection[section] || headerBySection.licitacion

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{header.title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>{header.subtitle}</p>
        </div>
        <PrintButton targetRef={printRef} title={header.title} />
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <div ref={printRef} style={{ marginTop: 18 }}>
        {section === 'licitacion' && (
          <div>
            <section className="card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto', width: '100%', borderRadius: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', color: '#1e3a8a' }}><TrafficLightIcon /></span> Estado de envío por Director de Área
              </h3>
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px' }}>DIRECCIÓN DE ÁREA</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px' }}>ESTADO</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px' }}>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoDirectores.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No hay direcciones de área registradas.
                      </td>
                    </tr>
                  ) : (
                    estadoDirectores.map((dir) => {
                      const pid = dir.planilla_id
                      return (
                        <tr key={dir.direccion_area} style={{ borderBottom: '1px solid rgba(29,37,45,0.05)' }}>
                          <td style={{ fontWeight: 700, padding: '12px 16px' }}>{dir.direccion_area || 'Sin dirección'}</td>
                          <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                            {dir.enviado ? (
                              <span style={{ color: '#0f5132', background: '#d1fae5', padding: '4px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                ✓ Enviado
                              </span>
                            ) : (
                              <span style={{ color: '#92400e', background: '#fef3c7', padding: '4px 12px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                ⏳ Pendiente
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 16px', minWidth: 150 }}>
                            {dir.enviado && pid ? (
                              <button
                                onClick={() => setDevolucionModal({
                                  planillaId: pid,
                                  motivo: '',
                                  loading: false,
                                  directorArea: dir.direccion_area
                                })}
                                style={{
                                  background: 'rgba(185, 28, 28, 0.08)',
                                  color: '#b91c1c',
                                  border: '1px solid rgba(185, 28, 28, 0.2)',
                                  borderRadius: 8,
                                  padding: '6px 14px',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  transition: 'all 0.2s ease',
                                  margin: 0,
                                  width: 'auto'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(185, 28, 28, 0.15)'}
                                onMouseOut={e => e.currentTarget.style.background = 'rgba(185, 28, 28, 0.08)'}
                              >
                                Devolver
                              </button>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </section>

            <section className="card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto', width: '100%', borderRadius: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', color: '#1e3a8a' }}><HistoryIcon /></span> Historial de Resúmenes Enviados
              </h3>
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px' }}>AÑO</th>
                    <th style={{ padding: '12px 16px' }}>DIRECTOR DE ÁREA</th>
                    <th style={{ padding: '12px 16px' }}>NIVEL</th>
                    <th style={{ padding: '12px 16px' }}>ESTADO</th>
                    <th style={{ padding: '12px 16px' }}>FECHA ENVÍO</th>
                    <th style={{ padding: '12px 16px' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {planillas.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No hay resúmenes enviados aún.
                      </td>
                    </tr>
                  ) : (
                    planillas.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(29,37,45,0.05)' }}>
                        <td style={{ padding: '12px 16px' }}>{p.anio}</td>
                        <td style={{ fontWeight: 600, padding: '12px 16px' }}>{`${p.director_nombre || ''} ${p.director_apellido || ''}`.trim()}</td>
                        <td style={{ padding: '12px 16px' }}>{p.nivel_educativo || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge badge-${ESTADO_BADGE[p.estado] || 'pendiente'}`}>
                            {p.estado}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{p.enviada_at ? new Date(p.enviada_at).toLocaleString('es-AR') : '-'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button 
                            className="secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 8, margin: 0, width: 'auto' }}
                            onClick={() => handleVerDetalle(p.id)}
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card" style={{ padding: 24, minHeight: 'auto', width: '100%', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(30, 58, 138, 0.08)',
                    color: '#1e3a8a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <ClipboardIcon />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dark)', fontWeight: 700 }}>Consolidado general</h3>
                </div>
                
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', maxWidth: '600px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar producto consolidado..."
                    value={consolidadoSearch}
                    onChange={e => setConsolidadoSearch(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      minWidth: '200px',
                      maxWidth: '300px'
                    }}
                  />
                  <button className="secondary" onClick={handleExportCSV} disabled={!consolidado.length} style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: 8, margin: 0, width: 'auto' }}>
                    📥 Exportar Consolidado (CSV)
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="sv-empty-state">Generando consolidado...</div>
              ) : filteredConsolidado.length === 0 ? (
                <div className="sv-empty-state">No se encontraron productos en el consolidado.</div>
              ) : (
                <table style={{ marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 16px' }}>PRODUCTO</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px' }}>CANTIDAD TOTAL</th>
                      <th style={{ padding: '12px 16px' }}>UNIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConsolidado.map((item) => (
                      <tr key={item.producto_id} style={{ borderBottom: '1px solid rgba(29,37,45,0.05)' }}>
                        <td style={{ fontWeight: 600, padding: '12px 16px' }}>{item.producto}</td>
                        <td style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', padding: '12px 16px' }}>
                          {item.cantidad_total}
                        </td>
                        <td style={{ color: 'var(--muted)', padding: '12px 16px' }}>{item.unidad_medida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {section === 'listado-final' && (
          <section className="card" style={{ padding: 24, minHeight: 'auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>
                📝 Listado Final a Licitar
              </h3>
              {listadoPendienteAnual.length > 0 && (
                <button className="primary" onClick={() => setShowConfirmPublicar(true)}>
                  ➕ Crear licitación
                </button>
              )}
            </div>

            {licitacionesAnualesActivas.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong style={{ display: 'block', marginBottom: 6 }}>Licitaciones creadas este año</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {licitacionesAnualesActivas.map((licitacion) => (
                    <span key={licitacion.id} className={`badge badge-${ESTADO_BADGE[licitacion.estado] || 'pendiente'}`}>
                      #{licitacion.id} {licitacion.titulo || licitacion.motivo || `Licitación ${licitacion.id}`} - {licitacion.estado}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="sv-empty-state">Cargando listado...</div>
            ) : listadoPendienteAnual.length === 0 ? (
              <div className="sv-empty-state">No quedan productos pendientes por licitar en el flujo anual.</div>
            ) : (
              <>
                <table style={{ marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>PRODUCTO</th>
                      <th style={{ textAlign: 'center' }}>CANTIDAD TOTAL</th>
                      <th style={{ textAlign: 'center' }}>STOCK ACTUAL</th>
                      <th style={{ textAlign: 'center', width: 140 }}>CANT. A LICITAR</th>
                      <th>UNIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listadoPendienteAnual.map((item) => {
                      const currentVal = editQty[item.producto_id]
                      return (
                        <tr key={item.producto_id}>
                          <td style={{ fontWeight: 600 }}>{item.producto}</td>
                          <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--muted)' }}>
                            {item.cantidad_total}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#ca8a04' }}>
                            {item.stock_actual}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              value={currentVal !== undefined ? currentVal : ''}
                              onChange={(e) => handleEditQty(item.producto_id, e.target.value)}
                              style={{ textAlign: 'center', fontWeight: 700, border: '1px solid #94a3b8', borderRadius: '6px', padding: '6px', width: '90px', margin: '0 auto', background: '#f8fafc' }}
                              title="Editar cantidad a licitar"
                            />
                          </td>
                          <td style={{ color: 'var(--muted)' }}>{item.unidad_medida}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}

        {section === 'refuerzos' && (
          <section className="card" style={{ padding: 24, minHeight: 'auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>🚨 Refuerzos sin stock</h3>
              {listadoPendienteRefuerzo.length > 0 && (
                <button className="primary" onClick={() => setShowConfirmPublicar(true)}>
                  ➕ Crear licitación de refuerzo
                </button>
              )}
            </div>

            {licitacionesRefuerzoActivas.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong style={{ display: 'block', marginBottom: 6 }}>Licitaciones de refuerzo creadas</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {licitacionesRefuerzoActivas.map((licitacion) => (
                    <span key={licitacion.id} className={`badge badge-${ESTADO_BADGE[licitacion.estado] || 'pendiente'}`}>
                      #{licitacion.id} {licitacion.titulo || licitacion.motivo || `Refuerzo ${licitacion.id}`} - {licitacion.estado}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="sv-empty-state">Cargando refuerzos...</div>
            ) : listadoPendienteRefuerzo.length === 0 ? (
              <div className="sv-empty-state">No hay productos de refuerzo sin stock para licitar.</div>
            ) : (
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>PRODUCTO</th>
                    <th style={{ textAlign: 'center' }}>CANTIDAD REFUERZO</th>
                    <th style={{ textAlign: 'center' }}>STOCK ACTUAL</th>
                    <th style={{ textAlign: 'center' }}>PEDIDOS</th>
                    <th>ESCUELAS</th>
                    <th style={{ textAlign: 'center', width: 140 }}>CANT. A LICITAR</th>
                  </tr>
                </thead>
                <tbody>
                  {listadoPendienteRefuerzo.map((item) => {
                    const currentVal = editQty[item.producto_id]
                    return (
                      <tr key={`refuerzo-${item.producto_id}`}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{item.producto}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>{item.unidad_medida}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.cantidad_total}</td>
                        <td style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{item.stock_actual}</td>
                        <td style={{ textAlign: 'center' }}>{item.pedidos_origen}</td>
                        <td style={{ color: 'var(--muted)' }}>{item.instituciones}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={currentVal !== undefined ? currentVal : item.cantidad_total}
                            onChange={(e) => handleEditQty(item.producto_id, e.target.value)}
                            style={{ textAlign: 'center', fontWeight: 700, border: '1px solid #94a3b8', borderRadius: '6px', padding: '6px', width: '90px', margin: '0 auto', background: '#f8fafc' }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {section === 'adjudicacion' && (
          <section className="card" style={{ padding: 18, minHeight: 'calc(100vh - 220px)', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0 }}>Licitaciones para adjudicar y enviar</h3>
              {selectedLicitacion?.id && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedLicitacion.estado === 'adjudicada' && (
                    <button className="primary" onClick={handleEnviarADeposito} disabled={saving}>
                      {saving ? 'Enviando...' : '📦 Enviar a depósito'}
                    </button>
                  )}
                  {!['en_deposito', 'completada'].includes(selectedLicitacion.estado) && (
                    <button className="secondary" onClick={handleReabrir}>
                      🗑 Eliminar licitación
                    </button>
                  )}
                </div>
              )}
            </div>

            {licitacionesActivas.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 420px) 1fr', gap: 12, alignItems: 'end', marginBottom: 16 }}>
                <div>
                  <label>Licitación activa</label>
                  <select value={selectedLicitacionId} onChange={(e) => setSelectedLicitacionId(e.target.value)}>
                    {licitacionesActivas.map((licitacion) => (
                      <option key={licitacion.id} value={licitacion.id}>
                        [{licitacion.tipo || 'anual'}] #{licitacion.id} - {licitacion.titulo || licitacion.motivo || `Licitación ${licitacion.id}`} - {licitacion.estado}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedLicitacion && (
                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <strong>{selectedLicitacion.titulo || selectedLicitacion.motivo || `Licitación #${selectedLicitacion.id}`}</strong>
                    <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                      Tipo: {selectedLicitacion.tipo || 'anual'}
                    </div>
                    <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                      Estado: <span className={`badge badge-${ESTADO_BADGE[selectedLicitacion.estado] || 'pendiente'}`}>{selectedLicitacion.estado}</span>
                    </div>
                    <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                      Fecha: {selectedLicitacion.fecha_publicacion ? new Date(selectedLicitacion.fecha_publicacion).toLocaleString('es-AR') : '-'}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!licitacionesActivas.length ? (
              <div className="sv-empty-state" style={{ marginTop: 20 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }}>🔒</span>
                <strong style={{ display: 'block', marginBottom: 5, fontSize: '1.2rem', color: '#334155' }}>Sin licitaciones activas</strong>
                <p style={{ color: 'var(--muted)', margin: 0 }}>Las licitaciones enviadas a depósito salen de esta bandeja y quedan disponibles en el historial de abajo.</p>
              </div>
            ) : (
              <>
                <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                  Selecciona una licitación, adjudica proveedor ganador y registra el precio real. Luego podrás enviarla al depósito por separado.
                </p>

                {loading ? (
                  <div className="sv-empty-state">Cargando adjudicacion...</div>
                ) : adjudicacion.length === 0 ? (
                  <div className="sv-empty-state">No hay productos disponibles para adjudicar.</div>
                ) : (
                  <>
                    <table style={{ marginBottom: 14 }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad total</th>
                          <th>Proveedor ganador</th>
                          <th>Precio anterior</th>
                          <th>Precio real</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjudicacion.map((item) => {
                          const form = formByProduct[String(item.producto_id)] || {}
                          return (
                            <tr key={item.producto_id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{item.producto}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>{item.unidad_medida}</div>
                              </td>
                              <td>{item.cantidad_total}</td>
                              <td style={{ minWidth: 220 }}>
                                <select
                                  value={form.proveedor_id || ''}
                                  onChange={(e) => handleFormChange(String(item.producto_id), 'proveedor_id', e.target.value)}
                                >
                                  <option value="">Seleccionar proveedor</option>
                                  {proveedores.map((proveedor) => (
                                    <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <div>{formatCurrency(item.precio_anterior)}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                  {item.anio_referencia ? `Licitacion ${item.anio_referencia}` : 'Sin historial'}
                                </div>
                              </td>
                              <td style={{ minWidth: 160 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={form.precio_compra_real || ''}
                                  onChange={(e) => handleFormChange(String(item.producto_id), 'precio_compra_real', e.target.value)}
                                  placeholder="0,00"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={handleGuardarAdjudicacion} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar adjudicacion'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            <div style={{ marginTop: 28, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>Historial de licitaciones</h3>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  Incluye adjudicadas y enviadas a depósito con su detalle de compra.
                </span>
              </div>

              {!licitacionesHistoricas.length ? (
                <div className="sv-empty-state">Todavía no hay licitaciones en historial.</div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  {licitacionesHistoricas.map((licitacion) => (
                    <section key={`hist-${licitacion.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16 }}>
                      {(() => {
                        const expanded = Boolean(historialExpandido[licitacion.id])
                        const detalleCount = licitacion.detalle?.length || 0
                        return (
                          <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                            #{licitacion.id} {licitacion.titulo || licitacion.motivo || `Licitación ${licitacion.id}`}
                          </div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 4 }}>
                            Tipo: {licitacion.tipo || 'anual'} | Año: {licitacion.anio} | Creador: {licitacion.creador || 'Sin dato'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div>
                            <span className={`badge badge-${ESTADO_BADGE[licitacion.estado] || 'pendiente'}`}>{licitacion.estado}</span>
                          </div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.84rem', marginTop: 6 }}>
                            Publicada: {licitacion.fecha_publicacion ? new Date(licitacion.fecha_publicacion).toLocaleString('es-AR') : '-'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Productos</div>
                          <div style={{ fontWeight: 800 }}>{licitacion.total_items_snapshot || 0}</div>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Monto estimado</div>
                          <div style={{ fontWeight: 800 }}>{formatCurrency(licitacion.monto_estimado)}</div>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Total recibido</div>
                          <div style={{ fontWeight: 800 }}>{licitacion.total_recibido}</div>
                        </div>
                        <div style={{ padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Último movimiento</div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{licitacion.ultima_recepcion ? new Date(licitacion.ultima_recepcion).toLocaleString('es-AR') : (licitacion.adjudicada_at ? new Date(licitacion.adjudicada_at).toLocaleString('es-AR') : '-')}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: expanded ? 12 : 0, flexWrap: 'wrap' }}>
                        <div style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                          {detalleCount} producto{detalleCount === 1 ? '' : 's'} adjudicado{detalleCount === 1 ? '' : 's'}
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => toggleHistorialDetalle(licitacion.id)}
                          style={{ minHeight: 'auto', padding: '8px 14px' }}
                        >
                          {expanded ? 'Ocultar productos' : 'Ver productos'}
                        </button>
                      </div>

                      {!licitacion.detalle?.length ? (
                        <div style={{ color: 'var(--muted)' }}>Sin detalle adjudicado registrado.</div>
                      ) : expanded ? (
                        <table style={{ marginBottom: 0 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              <th>Producto</th>
                              <th style={{ textAlign: 'center' }}>Cantidad</th>
                              <th>Proveedor</th>
                              <th style={{ textAlign: 'right' }}>Precio</th>
                              <th style={{ textAlign: 'right' }}>Subtotal</th>
                              <th style={{ textAlign: 'center' }}>Recibido</th>
                            </tr>
                          </thead>
                          <tbody>
                            {licitacion.detalle.map((item) => (
                              <tr key={`hist-item-${licitacion.id}-${item.producto_id}`}>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{item.producto}</div>
                                  <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.unidad_medida}</div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cantidad_adjudicada}</td>
                                <td>{item.proveedor_nombre || '-'}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(item.precio_compra_real)}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(item.subtotal_estimado)}</td>
                                <td style={{ textAlign: 'center' }}>{item.cantidad_recibida}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                          </>
                        )
                      })()}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      {showConfirmPublicar && (
        <div className="sv-modal-overlay">
          <div className="sv-modal">
            <h2 className="sv-modal-title" style={{ color: 'var(--primary)' }}>➕ ¿Crear nueva licitación?</h2>
            <div className="sv-modal-body">
              <p>
                {section === 'refuerzos'
                  ? 'Se tomará un snapshot de los productos de refuerzo sin stock para crear una nueva licitación de refuerzo.'
                  : 'Se tomará un snapshot del listado final anual pendiente para crear una nueva licitación.'}
              </p>
              <label style={{ display: 'block', marginTop: 12, fontWeight: 700 }}>Motivo de Licitación (título visible en Recepción)</label>
              <input
                type="text"
                value={motivoLicitacion}
                onChange={(e) => setMotivoLicitacion(e.target.value)}
                placeholder={section === 'refuerzos' ? 'Ej: Licitación Refuerzo Productos Sin Stock' : 'Ej: Licitación Anual Artículos de Limpieza'}
                style={{ width: '100%', marginTop: 8 }}
                maxLength={255}
              />
              <p style={{ fontWeight: 700, color: '#0f766e' }}>Podrás adjudicar y enviar esta licitación de forma independiente.</p>
            </div>
            <div className="sv-modal-footer">
              <button className="secondary" onClick={() => setShowConfirmPublicar(false)} disabled={saving}>
                Cancelar
              </button>
              <button className="primary" onClick={handlePublicar} disabled={saving}>
                {saving ? 'Creando...' : 'Crear licitación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Devolución de Planilla */}
      {devolucionModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(29, 37, 45, 0.4)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            borderRadius: '16px',
            background: '#ffffff',
            boxShadow: 'var(--shadow-premium)',
            margin: '16px'
          }}>
            <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontSize: '1.1rem', fontWeight: 700 }}>
              <span style={{ fontSize: '1.25rem' }}>↩</span> Devolver Planilla
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: 'var(--muted)' }}>
              ¿Estás seguro que deseas devolver la planilla de <strong>{devolucionModal.directorArea}</strong>? El Director de Área deberá corregirla y enviarla nuevamente.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.85rem' }}>
                Motivo de Devolución
              </label>
              <textarea
                rows={3}
                placeholder="Escribe el motivo detallado de la devolución..."
                value={devolucionModal.motivo}
                onChange={e => setDevolucionModal(prev => ({ ...prev, motivo: e.target.value }))}
                style={{
                  width: '100%',
                  fontSize: '0.9rem',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setDevolucionModal(null)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem', margin: 0, width: 'auto' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={devolucionModal.loading}
                onClick={async () => {
                  setDevolucionModal(prev => ({ ...prev, loading: true }))
                  try {
                    const res = await apiFetch(`/api/compras/planillas/${devolucionModal.planillaId}/devolver`, {
                      token,
                      method: 'PATCH',
                      body: JSON.stringify({ motivo: devolucionModal.motivo }),
                      headers: { 'Content-Type': 'application/json' }
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data.error || 'No se pudo devolver la planilla')
                    setMsg({ text: `Planilla devuelta al director de área.`, type: 'success' })
                    setDevolucionModal(null)
                    await loadWorkflowData(filters)
                  } catch (err) {
                    setMsg({ text: err.message, type: 'error' })
                    setDevolucionModal(prev => ({ ...prev, loading: false }))
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  margin: 0,
                  width: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {devolucionModal.loading ? 'Devolviendo...' : '↩ Devolver Planilla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Planilla */}
      {detalle && detalle.planilla && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(29, 37, 45, 0.4)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '850px',
            padding: '28px',
            borderRadius: '16px',
            background: '#ffffff',
            boxShadow: 'var(--shadow-premium)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            margin: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--dark)', fontWeight: 700 }}>
                  Detalle del Resumen #{detalle.planilla.id}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--muted)' }}>
                  Director: <strong>{detalle.planilla.director_nombre} {detalle.planilla.director_apellido}</strong> | Nivel: <strong>{detalle.planilla.nivel_educativo}</strong>
                </p>
              </div>
              <button 
                onClick={() => { setDetalle(null); setDetalleSearch(''); }}
                style={{
                  background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)', padding: '0 4px', margin: 0, width: 'auto'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="🔍 Buscar por producto o institución..."
                value={detalleSearch}
                onChange={e => setDetalleSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ marginBottom: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>PRODUCTO</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px' }}>CANTIDAD</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>UNIDAD</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>INSTITUCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetalleItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                        No se encontraron productos coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredDetalleItems.map((det) => (
                      <tr key={`${det.producto_id}-${det.cue}`} style={{ borderBottom: '1px solid rgba(29,37,45,0.05)' }}>
                        <td style={{ fontWeight: 600, padding: '12px 16px' }}>{det.producto}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', padding: '12px 16px' }}>{det.cantidad}</td>
                        <td style={{ color: 'var(--muted)', padding: '12px 16px' }}>{det.unidad_medida}</td>
                        <td style={{ padding: '12px 16px' }}>{det.institucion} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>({det.cue})</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                Mostrando {filteredDetalleItems.length} de {detalle.detalles.length} filas
              </span>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => { setDetalle(null); setDetalleSearch(''); }}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: '0.85rem', margin: 0, width: 'auto' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Iconos SVG de apoyo locales
function TrafficLightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="7" />
      <circle cx="12" cy="7" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="17" r="2.5" fill="currentColor" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <polyline points="3 3 3 8 8 8" />
      <line x1="12" y1="7" x2="12" y2="12" />
      <line x1="12" y1="12" x2="16" y2="14" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}
