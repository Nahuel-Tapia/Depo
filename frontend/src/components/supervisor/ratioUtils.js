export function calculateRatio(cantidad, matricula) {
  const qty = Number(cantidad) || 0
  const students = Number(matricula) || 0
  if (students <= 0) return qty > 0 ? 999 : 0
  return qty / students
}

export function getRatioLevel(ratio) {
  if (ratio >= 0.2) return 'alto'
  if (ratio >= 0.1) return 'medio'
  return 'bajo'
}

export function getRatioMeta(cantidad, matricula) {
  const ratio = calculateRatio(cantidad, matricula)
  const level = getRatioLevel(ratio)

  const map = {
    bajo: { label: 'Normal', className: 'ratio-bajo' },
    medio: { label: 'Atencion', className: 'ratio-medio' },
    alto: { label: 'Alto', className: 'ratio-alto' }
  }

  return {
    ratio,
    level,
    ...map[level]
  }
}

export function formatRatio(ratio) {
  if (!Number.isFinite(ratio)) return '-'
  return ratio.toFixed(3)
}
