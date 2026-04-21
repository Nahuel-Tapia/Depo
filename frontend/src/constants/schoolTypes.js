export const SCHOOL_TYPE_OPTIONS = [
  { value: 'normal', label: 'Jornada Normal' },
  { value: 'jornada_extendida', label: 'Jornada Completa' },
  { value: 'albergue', label: 'Escuela Albergue' }
]

export function getSchoolTypeLabel(value) {
  return SCHOOL_TYPE_OPTIONS.find((item) => item.value === value)?.label || 'Jornada Normal'
}
