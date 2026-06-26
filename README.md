# Depo Stock

Aplicacion web para gestion de stock, pedidos y distribucion para instituciones educativas.

Hoy el proyecto ya no es una base "simple" de stock: incluye autenticacion JWT, roles y permisos, pedidos anuales y de refuerzo, supervision por niveles, compras, recepcion de licitaciones, depositos, distribucion y modulos operativos por rol.

## Stack real

- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Frontend: React + Vite

## Estructura principal

- `backend/src`: servidor, rutas, middleware y acceso a datos
- `backend/scripts`: scripts auxiliares de base de datos y usuarios
- `backend/base_prueba.sql`: esquema base minimo
- `backend/depo_stock_dump.sql`: dump mas cercano al estado funcional completo
- `frontend/src`: aplicacion React
- `frontend/public`: assets publicos
- `frontend/dist`: build generado para produccion

## Modos de trabajo

### 1. Desarrollo

En desarrollo se usa:

- backend en `http://localhost:4000`
- frontend Vite en `http://localhost:5173`

El backend y el frontend corren por separado.

### 2. Ejecucion unificada

Cuando existe `frontend/dist`, el backend sirve ese build estatico.

Si `frontend/dist` no existe, el backend cae a `frontend/public`, lo cual solo sirve como fallback minimo y no reemplaza el frontend React completo.

## Requisitos

- Node.js
- PostgreSQL accesible desde la maquina local o la red

## Variables de entorno

Crear `.env` en la raiz a partir de `.env.example`.

Variables esperadas:

- `PORT`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## Instalacion

Instalar dependencias en ambos niveles:

```bash
npm install
cd frontend
npm install
```

## Base de datos

Hay dos escenarios posibles:

### Escenario A. Esquema base minimo

Usar `backend/base_prueba.sql` si solo se necesita una estructura inicial para desarrollo controlado.

Importante:

- este archivo no representa todo el sistema actual
- varios modulos reales requieren tablas y columnas adicionales
- algunas rutas agregan columnas faltantes al iniciar, pero no reemplazan un esquema funcional completo

### Escenario B. Esquema mas completo

Usar `backend/depo_stock_dump.sql` si se necesita un entorno mas cercano al estado funcional real del proyecto.

Recomendacion:

- para revisar todos los modulos, trabajar con el esquema mas completo
- para pruebas aisladas de backend base, `base_prueba.sql` puede alcanzar

## Puesta en marcha

### Backend

Desde la raiz:

```bash
npm run dev
```

o:

```bash
npm start
```

### Frontend

Desde `frontend`:

```bash
npm run dev
```

### Scripts Windows

En Windows tambien podes usar:

- `INICIAR.bat`
- `CERRAR.bat`
- `start-dev.ps1`
- `stop-dev.ps1`

Los scripts estan pensados para arrancar y detener solo este proyecto.

## URLs

- Backend: `http://localhost:4000`
- Frontend Vite: `http://localhost:5173`
- Healthcheck: `http://localhost:4000/api/health`

## Acceso inicial

Usuario administrador por defecto:

- Email: `admin@depo.local`
- Contrasena: `Admin123!`

Si el acceso falla:

```bash
npm run reset-admin
```

## Alcance funcional actual

Entre los modulos presentes hoy en el repositorio:

- Login, registro directivo y sesion con JWT
- Gestion de usuarios, roles y permisos
- Productos, movimientos y stock por depositos
- Pedidos anuales y pedidos de refuerzo
- Supervisor, Director de Area y gestion de zonas
- Compras, licitacion y adjudicacion
- Recepcion de licitaciones y distribucion a escuelas
- Instituciones, proveedores, auditoria y patrimonio

## Flujo logistico actualizado (Mayo 2026)

El circuito de entregas ahora contempla dos modalidades de salida para instituciones:

- Retiro presencial (flujo tradicional)
- Envio por departamento (flujo nuevo)

### Envio por departamento

1. El directivo crea la solicitud de retiro y marca la opcion de solicitar envio.
2. El sistema agrupa solicitudes pendientes por departamento.
3. El operador entra en Distribucion a Escuelas -> Envio por Departamento.
4. Desde el detalle del departamento, arma cantidades por solicitud y producto.
5. El sistema registra el egreso multiple y actualiza estados/entregas.

Notas operativas:

- El detalle incluye resumen por solicitud (solicitado, entregado, pendiente).
- Se muestra un bloque de instituciones faltantes por solicitar retiro en ese departamento.
- Las validaciones funcionales del egreso multiple ahora devuelven `400` con mensaje explicito (ya no `500` para errores de negocio).

## Documentacion recomendada

Para revisar el estado actual del sistema usar:

- `docs/documento_completo_depo.md` (Documento de Tesis/Informe Técnico Consolidado)
- Carpeta `docs/` (Contiene los 18 capítulos individuales de la documentación técnica y académica)
- `README.md` (visión general y arranque rápido)
- `backend/ENDPOINTS.md` (referencia actualizada de la API)
- `GUIA_ROLES_SISTEMA.md` (flujo operativo detallado por rol)
- `DIAGRAMA_Y_FLUJO_SISTEMA.md` (diagramas de secuencias, flujos de envío y casos de uso)
- `ROLES_Y_PERMISOS.md` (matriz de permisos y lógica RBAC)

## Build

Backend:

```bash
npm run build
```

Nota:

- hoy este comando solo valida sintaxis del backend
- el build real del frontend se ejecuta dentro de `frontend`

Frontend:

```bash
cd frontend
npm run build
```

## Estado de la documentacion

La documentacion del repositorio esta siendo alineada con el estado real del sistema.

Si estas revisando la API, toma como referencia principal:

- `backend/ENDPOINTS.md`
- las rutas reales dentro de `backend/src/routes`

## Notas

- El proyecto esta orientado a PostgreSQL.
- No se incluyen datos productivos reales en el repositorio.
- Algunas guias funcionales describen el flujo objetivo y no siempre el nivel exacto de implementacion de cada modulo.
