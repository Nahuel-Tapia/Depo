-- ============================================================================
-- SCRIPT PARA CORREGIR Y CREAR LA VISTA INSTITUCIONES
-- ============================================================================

-- 1. Verificar que existan las columnas necesarias en institucion
-- Si no existen, agregarlas

ALTER TABLE institucion 
ADD COLUMN IF NOT EXISTS email VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'publica',
ADD COLUMN IF NOT EXISTS matriculados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS factor_asignacion NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS notas TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 2. Renombrar columnas si es necesario para que coincidan con lo esperado
-- nivel_educativo → nivel
-- categoria → tipo (ya lo tenemos como tipo, pero nivel_educativo existe)

-- Primero, verificamos si nivel_educativo existe y crear nivel si no
ALTER TABLE institucion 
RENAME COLUMN nivel_educativo TO nivel;

-- 3. Crear la vista instituciones que mapea institucion + edificio
DROP VIEW IF EXISTS instituciones CASCADE;

CREATE VIEW instituciones AS
SELECT 
  i.id_institucion as id,
  i.cue,
  i.nombre,
  COALESCE(e.direccion, i.establecimiento_cabecera) as direccion,
  e.localidad,
  e.departamento,
  e.te_voip as telefono,
  i.email,
  i.nivel,
  i.tipo,
  i.matriculados,
  i.factor_asignacion,
  i.activo,
  i.notas,
  i.created_at,
  i.updated_at
FROM institucion i
LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
ORDER BY i.nombre ASC;

-- 4. Verificar que la vista se creó correctamente
SELECT COUNT(*) as total_instituciones FROM instituciones;
