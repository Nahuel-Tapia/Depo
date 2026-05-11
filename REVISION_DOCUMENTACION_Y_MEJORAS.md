# Revision de Documentacion y Mejoras Prioritarias

Este documento resume la revision del proyecto y ordena las mejoras en un plan de trabajo aplicable.

## Estado general

La aplicacion arranca y responde en endpoints principales, pero la documentacion principal no representa con precision el estado real del sistema.

Se verifico:

- Login real con `admin@depo.local`
- `GET /api/health`
- `GET /api/users/me`
- `GET /api/permissions/me`
- `GET /api/roles`
- `GET /api/productos`
- `GET /api/movimientos`
- `GET /api/dashboard/stats`
- `GET /api/instituciones/public/list`
- Build del frontend con `npm run build` en `frontend`

## Prioridad 1

### 1. Corregir README principal

Problema:

- El README describe un frontend estatico, pero el proyecto actual usa React + Vite.
- La puesta en marcha no explica bien la diferencia entre backend, frontend y esquema real de base.
- Da a entender que `backend/base_prueba.sql` representa el sistema completo, cuando hoy el sistema real tiene mas modulos y tablas.

Impacto:

- Un clon nuevo puede quedar mal configurado aunque el usuario siga los pasos.
- La documentacion genera falsas expectativas sobre el alcance real del proyecto.

Acciones:

- Actualizar stack tecnico real.
- Separar modo minimo de arranque y modo completo.
- Explicar que el frontend de desarrollo corre en `frontend`.
- Explicar que el backend sirve `frontend/dist` o `frontend/public` segun disponibilidad.
- Aclarar limitaciones reales de `base_prueba.sql`.

Criterio de cierre:

- Un tercero puede leer el README y levantar el proyecto sin adivinar pasos ocultos.

### 2. Corregir la documentacion de API

Problema:

- `backend/ENDPOINTS.md` no coincide con la implementacion real.
- Login documentado con `201`, pero responde `200`.
- Movimientos documentados con `entrada/salida`, pero la API usa `ingreso/egreso/ajuste/devolucion`.
- Faltan muchos modulos reales: compras, depositos, entregas, director-area, supervisor, patrimonio, zones.

Impacto:

- Cualquier integracion basada en ese archivo falla o se construye con supuestos incorrectos.

Acciones:

- Actualizar respuestas, estados y payloads reales.
- Incorporar endpoints nuevos por modulo.
- Marcar explicitamente endpoints legacy, placeholders y endpoints en evolucion.
- Ideal: migrar a OpenAPI o Postman versionado.

Criterio de cierre:

- Los ejemplos del documento pueden ejecutarse sin ajuste manual.

### 3. Arreglar scripts de inicio para Windows

Problema:

- `INICIAR.bat` intenta correr `npm run dev` dentro de `backend`, pero no existe `backend/package.json`.
- Los scripts PowerShell matan todos los procesos `node`, incluso ajenos al proyecto.

Impacto:

- El arranque documentado no es confiable.
- Puede romper otros trabajos abiertos en la maquina.

Acciones:

- Hacer que `INICIAR.bat` use la raiz para backend y `frontend` para Vite.
- Limitar `start-dev.ps1` y `stop-dev.ps1` a procesos del proyecto.
- Agregar verificacion real de puertos y logs de error legibles.

Criterio de cierre:

- Los scripts arrancan y cierran solo este proyecto.

## Prioridad 2

### 4. Definir oficialmente los modos de base de datos

Problema:

- Hoy hay mezcla entre esquema base, dump completo y migraciones/adaptaciones runtime.

Impacto:

- Es dificil saber cual es la base correcta para desarrollo, demo o produccion.

Acciones:

- Documentar claramente:
  - modo base: `backend/base_prueba.sql`
  - modo completo: dump/esquema extendido
  - scripts que completan columnas o tablas faltantes al iniciar
- Aclarar dependencias entre scripts y version de PostgreSQL esperada.

Criterio de cierre:

- Cualquier desarrollador sabe que dataset usar para cada caso.

### 5. Marcar funcionalidades reales vs placeholders

Problema:

- Algunos endpoints y pantallas existen, pero todavia no representan una funcionalidad cerrada.
- Ejemplo: `director-area/informes`.

Impacto:

- La documentacion funcional promete modulos que todavia estan incompletos.

Acciones:

- Agregar estado por modulo:
  - estable
  - funcional con alcance parcial
  - placeholder
  - pendiente
- Reflejar eso en las guias funcionales.

Criterio de cierre:

- Los usuarios internos distinguen claramente que esta listo y que no.

### 6. Alinear documentacion funcional con roles reales

Problema:

- Las guias de roles son utiles, pero hoy mezclan vision objetivo con implementacion actual.

Impacto:

- Se confunde roadmap con funcionalidad ya disponible.

Acciones:

- Mantener una seccion "flujo ideal" y otra "estado implementado hoy".
- Cruzar cada rol con sus tabs reales y endpoints asociados.

Criterio de cierre:

- La documentacion de negocio coincide con la experiencia real del sistema.

## Prioridad 3

### 7. Mejorar build y validaciones

Problema:

- `npm run build` en raiz solo hace chequeo sintactico del backend.

Impacto:

- Da una falsa sensacion de build completo.

Acciones:

- Hacer que el build de raiz ejecute:
  - validacion backend
  - build frontend
- Opcional: agregar smoke checks de arranque.

Criterio de cierre:

- Un build exitoso representa al sistema completo.

### 8. Incorporar pruebas automatizadas minimas

Problema:

- No hay cobertura automatizada para las rutas mas sensibles.

Impacto:

- La documentacion se desalineara otra vez con facilidad.

Acciones:

- Agregar pruebas de:
  - login
  - permisos
  - usuarios
  - productos
  - movimientos
  - dashboard

Criterio de cierre:

- Cambios en endpoints rompen CI antes de romper documentacion o frontend.

### 9. Localizar assets externos

Problema:

- Login, registro y dashboard usan imagen remota.

Impacto:

- Si ese host falla, la UI pierde recursos importantes.

Acciones:

- Mover logos a `frontend/public`.
- Reemplazar URLs remotas por rutas locales.

Criterio de cierre:

- La app funciona visualmente sin depender de recursos externos.

## Orden recomendado de implementacion

1. README principal
2. ENDPOINTS API
3. Scripts de arranque/cierre
4. Documentacion de base de datos
5. Estado real por modulo
6. Build de raiz
7. Smoke tests
8. Assets locales

## Nota final

La prioridad principal no es "embellecer docs", sino hacer que documentacion, scripts y comportamiento real cuenten la misma historia.
