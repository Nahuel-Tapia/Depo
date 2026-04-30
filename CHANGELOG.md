# Registro de Cambios - Depo

## 30 de Abril 2026 - Flujo de Aprobación, Registro y Flexibilidad de CUE

### 1. Sistema de Aprobación Dual y Resumen Anual
**Backend y Frontend**
- Se implementó un flujo de aprobación jerárquico para solicitudes anuales: **Supervisor** aprueba -> `pendiente_director`; **Director de Área** aprueba -> `aprobado` (Final).
- Se creó la interfaz **"Resumen Solicitud Anual"** con consolidado de productos y detalle por escuela.
- Se agregaron columnas de auditoría a la tabla `pedido` para el seguimiento de la aprobación del Director.
- Reestructuración del Navbar y limpieza de la UI en el panel del Director de Área.

### 2. Autenticación y Registro (Correcciones Críticas)
**Backend (`backend/src/routes/auth.js`)**
- Se corrigió un error 500 en el registro. Ahora los errores de duplicados (Email/CUE) se detectan correctamente (case-insensitive) y devuelven `409 Conflict`.
- Se agregaron logs detallados para diagnóstico en el servidor.

### 3. Base de Datos y Flexibilidad de CUE
**Base de Datos (`usuario` table)**
- Se eliminó la restricción `UNIQUE` de la columna `dni` (CUE para directivos). Esto permite que escuelas con el mismo CUE pero **distinto nivel educativo** operen de forma independiente.

### 4. Solicitudes y Pedidos (Roles Supervisor y Director de Área)
**Backend (`backend/src/routes/supervisor.js` y `directorArea.js`)**
- Se restauró la función `ensureSupervisorSchema` en el backend, solucionando errores 500 al listar solicitudes.
- Se habilitó la visibilidad de solicitudes para el Director de Área en el endpoint consolidado de supervisión, vinculando instituciones a través de sus zonas coordinadas.
- Se corrigió un error crítico de visibilidad para supervisores con múltiples departamentos en su jurisdicción o múltiples niveles educativos (ahora se procesan como listas separadas por coma).
- Se optimizó el filtrado en la vista de "Solicitud Anual" del Director de Área para distinguir entre pedidos pendientes de supervisor, pendientes de director e historial aprobado.

---

---

## 29 de Abril 2026

### 1. Módulo de Patrimonio (Nuevo)

**Backend (`backend/src/routes/patrimonio.js` y `backend/src/server.js`)**

- Se implementó el nuevo sistema de gestión de patrimonio para el registro de activos institucionales.
- Endpoints creados para: listado de patrimonio, creación de registros, actualización de estado y baja de bienes.
- Registro de la nueva ruta en el servidor principal.

### 2. Mejoras Críticas para el Rol Supervisor

**Frontend (`frontend/src/components/Inicio.jsx` y `frontend/src/components/SupervisorDashboard.jsx`)**

- El panel de inicio y el dashboard ahora muestran explícitamente la **Zona** asignada y el **Nivel Educativo** del supervisor.
- Mejora en la visualización de datos contextuales para una navegación más clara.

**Backend (`backend/src/routes/supervisor.js`)**

- Refactorización profunda para garantizar que el supervisor solo acceda a datos de su jurisdicción y nivel.
- Mejora en la lógica de asignación de instituciones y validación de permisos por zona.

### 3. Gestión de Pedidos y Solicitudes

**Frontend (`frontend/src/components/supervisor/SupervisorSolicitudes.jsx`)**

- Simplificación de las peticiones a la API para agilizar la carga de solicitudes.
- Se eliminaron redundancias en el manejo del estado local.

**Backend (`backend/src/routes/pedidos.js`)**

- Se agregó validación estricta: un supervisor solo puede gestionar pedidos de instituciones vinculadas a su zona.
- Se implementó la funcionalidad de **Solicitud de Aclaración**, permitiendo una comunicación bidireccional antes de aprobar o rechazar un pedido.
- Sincronización automática de stock al marcar pedidos como "entregados".

### 4. Continuación de gestión de zonas para Director de Area

**Frontend (`frontend/src/components/DirectorAreaZonas.jsx`)**

- Se completó la edición de zonas existentes reutilizando el formulario de alta.
- Se agregó eliminación de zonas desde la misma grilla.
- Se agregó administración de supervisores por zona para poder reasignarlos luego de crearla.
- El listado ahora muestra departamento, instituciones y supervisores asignados por cada zona.
- Las instituciones ya usadas en otras zonas del mismo Director no se ofrecen para nuevas asignaciones, salvo cuando se edita la zona actual.

**Backend (`backend/src/routes/directorArea.js`)**

- `PATCH /api/director-area/zonas/:zonaId` queda integrado con la UI para actualizar nombre, departamento e instituciones.
- `DELETE /api/director-area/zonas/:zonaId` queda integrado con la UI para baja de zonas.
- Se agregó validación para impedir que una misma institución quede vinculada a múltiples zonas activas del mismo Director de Área.
- La respuesta de zonas incluye supervisores asociados para que el frontend pueda precargar y editar asignaciones.

### 5. Verificación y Build

- `npm run build` ejecutado con éxito.
- El build del frontend regeneró `frontend/dist/index.html` y los assets compilados correspondientes (`index-DXA1AaLw.js`).

### 6. Gestión de Usuarios para Director de Area

**Frontend (`frontend/src/components/Usuarios.jsx`)**

- Se habilitó la apertura del formulario de creación de usuarios para el rol `director_area`.
- El campo `Rol` queda fijo en `Supervisor` cuando crea un usuario un Director de Area.
- El campo `Nivel educativo` se presenta como lista desplegable bloqueada con el nivel del Director de Area logueado.
- La lista de usuarios visible para Director de Area ahora muestra solo sus supervisores asociados y del mismo nivel educativo.
- Se agregó un modal de edición completa para supervisores permitiendo actualizar nombre, apellido, email, DNI, teléfono, jurisdicción y contraseña.
- Se removió para Director de Area la acción de cambio de rol sobre usuarios.

**Backend (`backend/src/routes/users.js`)**

- `GET /api/users` ahora filtra por contexto del usuario logueado cuando el rol es `director_area`, devolviendo solo supervisores del mismo nivel y vinculados por `director_area_id`.
- `POST /api/users` refuerza la validación para que un Director de Area solo pueda crear supervisores de su mismo nivel y asociados a su propia dirección de area.
- `PATCH /api/users/:id` se agregó para permitir la edición completa de supervisores con validación de pertenencia.
- `PATCH /api/users/:id/role` ahora rechaza con `403` cualquier intento de cambio de rol realizado por un Director de Area.
- `PATCH /api/users/:id/active` valida que el Director de Area solo pueda activar o desactivar supervisores que le pertenecen.


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

### 6. Flujo Completo de Zonas (Director de Área)

- Backend:
  - POST /api/director-area/zonas ahora admite la creación de zonas asociadas a departamentos específicos, valida que el nivel educativo del Director coincida con el de la zona y verifica las instituciones enviadas para asegurarse de que pertenecen al departamento y al nivel del Director. Devuelve el id de la zona creada.
  - GET /api/director-area/zonas-edificio devuelve departamentos, instituciones (con nivel_educativo) y zonas, con filtrado estricto por nivel educativo y departamento.
  - Endpoints para /informes y /solicitudes añadidos como placeholders para evitar 404s y dejar espacio para futuras consultas reales.
  - Mejora de mensajes de error para que sean claros y útiles, con logs para debugging en desarrollo.
- Frontend:
  - DirectorAreaZonas.jsx implementa un flujo paso a paso: seleccionar departamento, seleccionar instituciones filtradas por departamento y nivel educativo del Director, crear zona y abrir un modal para asignar Supervisores a la zona recién creada.
  - Filtrado estricto de instituciones por nivel y departamento; muestra el nivel educativo junto a cada institución para diferenciar duplicados de nombre/cu con distintos niveles.
  - Implementación de la asignación de Supervisores tras la creación de la Zona mediante un modal, con verificación de selección y guardado de asignaciones.
- Notas:
  - Las instituciones que comparten nombre y cue pero tienen niveles educativos diferentes ya no causan ambigüedad, ya que el ID es el identificador único y se muestra el nivel para distinguirlas en la UI.
  - Se mantiene una ruta de soporte para informes/solicitudes para evitar errores 404, con posibilidad de implementarlas con datos reales cuando se definan las estructuras en BD.
