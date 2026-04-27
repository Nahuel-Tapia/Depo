# Registro de Cambios - Depo

## 27 de Abril 2026

### 1. Corrección del flujo de creación de usuarios

**Problema identificado:**
- El rol `director_area` debe poder crear usuarios con rol `supervisor` únicamente
- Los supervisores deben estar vinculados al mismo nivel educativo del director de área
- El formulario de creación de usuarios estaba incompleto (faltaba el fetch)

**Correcciones realizadas:**

#### Frontend (`frontend/src/components/Usuarios.jsx`)

1. **Función `handleCreate` completada**
   - Antes no hacía el fetch a la API, agora envía POST a `/api/users`
   - Validaciones específicas por rol

2. **Validación de nivel educativo**
   - Agregada verificación de que el director de área tenga `nivel_educativo` configurado
   - Si no lo tiene, muestra mensaje de contactar al administrador

3. **Autocomplete automático para director_area**
   - `nivelFinal`: se toma de `user.nivel_educativo`
   - `directorAreaIdFinal`: se toma de `user.id`
   - `jurisdiccionFinal`: se toma de `user.jurisdiccion`

#### Backend (`backend/src/routes/users.js`)

- Validaciones ya estaban implementadas (POST /api/users, líneas 249-273)
  - `nivel` obligatorio para `director_area` y `supervisor`
  - `director_area_id` obligatorio para `supervisor`
  - `jurisdiccion` obligatorio para `supervisor`
  - Verifica que el nivel del supervisor coincida con el del director de área

### 2. Gestión de Edificios (Zones por Departamento)

**Nuevo sistema implementado:**
- Las "zonas" ahora son los **departamentos** de la tabla `edificio`
- Solo se muestran instituciones del **mismo nivel educativo** del director de área
- Permite asignar supervisores a instituciones específicas dentro de un edificio

**Cambios en Backend (`backend/src/routes/directorArea.js`):**

1. **Nuevo endpoint `/api/director-area/edificios`**
   - Devuelve lista de edificios con instituciones del nivel del director
   - agrupa por campo `departamento`

2. **Nuevo endpoint `/api/director-area/edificio/:edificioId/escuelas`**
   - Devuelve las instituciones de un edificio específico
   - Solo del nivel del director de área

**Cambios en Frontend (`frontend/src/components/DirectorAreaZonas.jsx`):**

1. **Nueva interfaz de gestión de edificios**
   - Selector grouped por departamento
   - Muestra todas las instituciones del edificio seleccionado
   - Permite asignar supervisor a cada institución

**Flujo:**
1. Director de área selecciona un edificio (agrupado por departamento)
2. Sistema muestra las instituciones de ese edificio
3. Director selecciona un supervisor y lo asigna a cada institución
4. La asignación se guarda en tabla `supervisor_escuela_asignacion`

### 3. Corrección de syntax errors en Usuarios.jsx

**Problema:**
- El archivo Usuarios.jsx tenía código corrupto por ediciones anteriores
- Errores de sintaxis JSX por etiquetas mal cerradas y estructuras duplicadas

**Solución:**
- Reescribí completamente el archivo `frontend/src/components/Usuarios.jsx`
- Estructura limpia con el formulario de creación de usuarios

### 4. Reesructuración de Gestión de Zonas para Director de Área

**Cambios realizados:**

#### Frontend (`DirectorAreaZonas.jsx`)

1. **Cambio de nombre**
   - De "Gestión de Edificios" a "Gestión de Zonas"

2. **Selector de departamento**
   - Ahora es un selector dropdown con todos los departamentos disponibles
   - El nombre de la zona queda vinculado al departamento

3. **Asignación condicional de instituciones**
   - Solo instituciones del departamento seleccionado
   - Solo del mismo nivel educativo del director
   - Las ya asignadas a otras zonas no aparecen

4. **Flujo secuencial**
   - Paso 1: Seleccionar departamento
   - Paso 2: Seleccionar instituciones (checkbox)
   - Paso 3: Crear zona
   - Paso 4: Modal para asignar supervisor (automático tras crear)

5. **Validaciones**
   - Si el Director no tiene nivel educativo, muestra advertencia
   - Debe seleccionar al menos una institución
   - Debe seleccionar un supervisor antes de asignar

#### Backend (`directorArea.js`)

1. **Nuevas tablas**:
   - `zona` - almacena las zonas
   - `zona_institucion` - relación zona-institución
   - `zona_supervisor` - relación zona-supervisor

2. **Nuevos endpoints**:
   - `GET /api/director-area/zonas-edificio` - devuelve departamentos, instituciones y zonas existentes
   - `POST /api/director-area/zonas` - crea una zona con instituciones
   - `POST /api/director-area/zonas/:id/supervisores` - asigna supervisores a una zona

### 5. Documentación

**Archivos:**
- `ROLES_Y_PERMISOS.md` - describe los 8 roles del sistema, permisos y restricciones
- `CHANGELOG.md` - este registro de cambios