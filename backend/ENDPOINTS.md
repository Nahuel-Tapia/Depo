# ENDPOINTS API - Depo Stock

Documentacion actualizada de la API expuesta por `backend/src/server.js`.

Base URL local:

```text
http://localhost:4000
```

## Notas importantes

- La fuente de verdad final sigue siendo el codigo en `backend/src/routes`.
- Este archivo describe el estado actual de la API y corrige diferencias historicas de la documentacion anterior.
- La mayoria de los endpoints requieren `Authorization: Bearer {token}`.
- El backend monta estos prefijos:

```text
/api/auth
/api/users
/api/roles
/api/permissions
/api/productos
/api/movimientos
/api/ajustes
/api/auditoria
/api/pedidos
/api/instituciones
/api/proveedores
/api/dashboard
/api/supervisor
/api/director-area
/api/compras
/api/directivo
/api/patrimonio
/api/zones
/api/entregas
/api/depositos
```

## Healthcheck

### `GET /api/health`

Respuesta:

```json
{
  "ok": true
}
```

## Autenticacion

### `POST /api/auth/login`

Acepta:

- `email` + `password`
- `dni` + `password`
- `cue` + `password`
- si `email` es numerico puro, tambien se interpreta como DNI/CUE

Ejemplo:

```json
{
  "email": "admin@depo.local",
  "password": "Admin123!"
}
```

Respuesta correcta: `200 OK`

```json
{
  "ok": true,
  "message": "Inicio de sesion correcto",
  "token": "JWT",
  "user": {
    "id": 10,
    "nombre": "Administrador",
    "apellido": "Inicial",
    "email": "admin@depo.local",
    "dni": "00000000",
    "role": "admin",
    "institucion": null,
    "nivel_educativo": null,
    "director_area_id": null,
    "jurisdiccion": null
  }
}
```

Errores frecuentes:

- `400` si faltan credenciales
- `401` si usuario o contrasena no coinciden

### `POST /api/auth/register`

Registro orientado a directivos.

Payload:

```json
{
  "nombre": "Maria Gomez",
  "email": "directivo@escuela.edu.ar",
  "cue": "700030200",
  "nivel_educativo": "Primario",
  "numero": "2644123456",
  "password": "Secret123"
}
```

Respuesta correcta: `201 Created`

```json
{
  "ok": true,
  "id": 123,
  "message": "Usuario creado correctamente. Ya puede iniciar sesion con su email"
}
```

Validaciones clave:

- email valido
- CUE de 9 digitos
- nivel educativo obligatorio
- la institucion debe existir
- no puede existir ya un directivo para la misma institucion y nivel

## Usuarios

### `GET /api/users/me`

Devuelve el usuario autenticado.

### `PATCH /api/users/me`

Actualiza perfil basico:

- `nombre`
- `apellido`
- `email`
- `telefono`

### `PATCH /api/users/me/password`

Payload:

```json
{
  "currentPassword": "Actual123",
  "newPassword": "Nueva123"
}
```

### `GET /api/users`

Lista usuarios visibles para el rol autenticado.

Notas:

- `admin` ve todos
- `director_area` ve solo supervisores vinculados a su direccion y nivel

### `POST /api/users`

Crea usuario.

Campos mas comunes:

- `nombre`
- `apellido`
- `email`
- `dni`
- `password`
- `role`
- `telefono`
- `institucion`
- `nivel`
- `director_area_id`
- `jurisdiccion`

Reglas importantes:

- `director_area` requiere `nivel`
- `supervisor` requiere `nivel` y `director_area_id`
- un `director_area` solo puede crear supervisores de su mismo nivel

### `PATCH /api/users/:id/role`

Cambia rol y contexto asociado.

### `PATCH /api/users/:id`

Edita datos completos del usuario.

### `PATCH /api/users/:id/active`

Activa o desactiva usuario.

Payload:

```json
{
  "activo": true
}
```

### `DELETE /api/users/:id`

Elimina usuario si no tiene relaciones bloqueantes.

## Roles y permisos

### `GET /api/roles`

Lista roles disponibles.

### `POST /api/roles`

Crea un rol nuevo.

### `GET /api/roles/:id/permissions`

Devuelve permisos del rol.

### `PUT /api/roles/:id/permissions`

Reemplaza permisos del rol.

### `GET /api/permissions/me`

Respuesta:

```json
{
  "role": "admin",
  "permissions": [
    "dashboard.view",
    "users.read",
    "productos.view"
  ]
}
```

### `GET /api/permissions/matrix`

Devuelve matriz rol -> permisos.

### `GET /api/permissions/catalog`

Devuelve catalogo total de permisos.

## Dashboard

### `GET /api/dashboard/stats`

Devuelve resumen general.

Notas:

- para `directivo` devuelve una version limitada
- para roles operativos incluye stock, proveedores y ultimos movimientos

## Productos

### `GET /api/productos`

Lista productos con informacion de stock y deposito consolidado.

### `GET /api/productos/categorias`

Lista categorias.

### `GET /api/productos/:id`

Devuelve detalle basico del producto.

### `GET /api/productos/:id/stock-detalle`

Devuelve:

- distribucion por depositos
- vencimientos registrados por ingresos

### `POST /api/productos`

Payload real:

```json
{
  "nombre": "Lavandina",
  "unidad_medida": "litro",
  "stock_actual": 10,
  "stock_minimo": 2,
  "id_categoria": 1
}
```

Respuesta correcta:

```json
{
  "id": 99
}
```

### `PATCH /api/productos/:id`

Permite actualizar:

- `nombre`
- `unidad_medida`
- `stock_minimo`
- `id_categoria`
- `stock_actual`

### `DELETE /api/productos/:id`

Elimina el producto y limpia referencias historicas donde aplica.

## Movimientos

## Tipos validos

Los tipos reales son:

```text
ingreso
egreso
ajuste
devolucion
```

No usar `entrada` ni `salida`.

### `GET /api/movimientos`

Filtros soportados:

- `producto_id`
- `id_deposito`
- `tipo`
- `limit`
- `offset`

### `GET /api/movimientos/:id`

Detalle de un movimiento.

### `POST /api/movimientos`

Payload:

```json
{
  "producto_id": 1,
  "tipo": "ingreso",
  "cantidad": 25,
  "motivo": "Reabastecimiento"
}
```

Respuesta:

```json
{
  "id": 45
}
```

### `POST /api/movimientos/lote`

Crea varios movimientos simples del mismo tipo.

### `POST /api/movimientos/directo`

Endpoint transaccional para ingresos y egresos operativos.

Campos segun el caso:

- `tipo`
- `institucion_id`
- `cargo_retira`
- `proveedor_id`
- `motivo`
- `id_deposito`
- `productos[]`

### `GET /api/movimientos/stats/resumen`

Devuelve:

```json
{
  "stats": {
    "total_ingresos": "59",
    "total_egresos": "13",
    "total_ajustes": "0",
    "total_devoluciones": "0"
  }
}
```

## Ajustes

### `GET /api/ajustes`

Lista ajustes.

### `GET /api/ajustes/:id`

Obtiene un ajuste.

### `POST /api/ajustes`

Payload:

```json
{
  "producto_id": 1,
  "cantidad_nueva": 48,
  "motivo": "Correccion por inventario fisico"
}
```

## Auditoria

### `GET /api/auditoria`

Filtros:

- `usuario_id`
- `entidad`
- `accion`
- `limit`
- `offset`

### `GET /api/auditoria/:id`

Obtiene un registro.

### `GET /api/auditoria/usuario/:usuario_id`

Obtiene auditoria por usuario.

### `GET /api/auditoria/stats/resumen`

Filtros:

- `fecha_desde`
- `fecha_hasta`

## Instituciones

## Endpoints publicos

### `GET /api/instituciones/public/cue/:cue`

Busca institucion por CUE y devuelve modalidades detectadas.

### `GET /api/instituciones/public/list`

Lista instituciones para dropdowns y consultas publicas.

## Endpoints autenticados

### `GET /api/instituciones`

Lista instituciones con estado de retiro y estado de pedido.

### `GET /api/instituciones/historial`

Historial global con filtros.

### `GET /api/instituciones/:id`

Detalle de una institucion.

### `GET /api/instituciones/cue/:cue`

Busqueda autenticada por CUE.

### `POST /api/instituciones`

Crea institucion.

### `PATCH /api/instituciones/:id`

Actualiza institucion.

### `DELETE /api/instituciones/:id`

Elimina institucion.

### `GET /api/instituciones/:id/asignaciones`

Consulta asignaciones de stock por periodo.

### `POST /api/instituciones/:id/asignar`

Asigna stock a una institucion.

### `POST /api/instituciones/asignar-masivo`

Asignacion masiva a instituciones activas.

### `POST /api/instituciones/:id/entregar`

Registra entrega sobre asignacion.

### `GET /api/instituciones/resumen/:periodo`

Resumen agregado por periodo.

### `GET /api/instituciones/:id/historial`

Historial por institucion.

## Pedidos

Modulo amplio con logica por rol.

Endpoints principales:

- `GET /api/pedidos/kits`
- `POST /api/pedidos/kits`
- `PUT /api/pedidos/kits/:id`
- `DELETE /api/pedidos/kits/:id`
- `GET /api/pedidos`
- `GET /api/pedidos/cupos-anuales`
- `GET /api/pedidos/institucion/:institucion`
- `GET /api/pedidos/:id`
- `POST /api/pedidos`
- `PATCH /api/pedidos/:id/estado`
- `PATCH /api/pedidos/:id/cancelar`
- `PATCH /api/pedidos/:id/aprobar-director`

Notas:

- hay flujo diferenciado entre pedidos anuales y refuerzos
- intervienen `directivo`, `supervisor`, `director_area` y roles operativos

## Supervisor

Endpoints principales:

- `GET /api/supervisor/instituciones`
- `GET /api/supervisor/dashboard/stats`
- `PATCH /api/supervisor/instituciones/:id/tipo-kit`
- `GET /api/supervisor/pedidos-pendientes`
- `GET /api/supervisor/solicitudes`
- `GET /api/supervisor/instituciones/:id/historial`

## Director de Area

Endpoints principales:

- `GET /api/director-area/catalogo`
- `GET /api/director-area/asignaciones`
- `DELETE /api/director-area/asignacion/:id`
- `POST /api/director-area/asignar`
- `DELETE /api/director-area/desasignar`
- `GET /api/director-area/supervisores`
- `POST /api/director-area/supervisores`
- `GET /api/director-area/edificios`
- `GET /api/director-area/edificio/:edificioId/escuelas`
- `GET /api/director-area/zonas-edificio`
- `GET /api/director-area/informes`
- `GET /api/director-area/solicitudes`
- `POST /api/director-area/zonas`
- `PATCH /api/director-area/zonas/:zonaId`
- `DELETE /api/director-area/zonas/:zonaId`
- `POST /api/director-area/zonas/:zonaId/supervisores`

Nota:

- `GET /api/director-area/informes` hoy responde una estructura vacia de placeholder.

## Compras

Endpoints principales:

- `GET /api/compras/planillas`
- `GET /api/compras/planillas/:id`
- `POST /api/compras/planillas`
- `PATCH /api/compras/planillas/:id/enviar`
- `PATCH /api/compras/planillas/:id/aceptar`
- `PATCH /api/compras/planillas/:id/procesar`
- `DELETE /api/compras/planillas/:id`
- `GET /api/compras/licitacion/consolidado`
- `GET /api/compras/licitacion/anual/consolidado`
- `GET /api/compras/licitacion/anual/estado-directores`
- `GET /api/compras/licitacion/anual/enviada-status`
- `GET /api/compras/licitacion/anual/escuelas-pendientes`
- `POST /api/compras/licitacion/anual/enviar-final`
- `GET /api/compras/licitacion/anual/final-items`
- `GET /api/compras/licitacion/anual/publicada-status`
- `POST /api/compras/licitacion/anual/publicar`
- `DELETE /api/compras/licitacion/anual/publicar/:anio`
- `GET /api/compras/licitacion/anual/cerradas`
- `POST /api/compras/licitacion/anual/enviar-deposito`
- `GET /api/compras/adjudicacion`
- `POST /api/compras/adjudicacion`

## Depositos

Endpoints principales:

- `GET /api/depositos`
- `GET /api/depositos/:id/productos`
- `GET /api/depositos/stock-por-producto`
- `GET /api/depositos/:id/stock`
- `POST /api/depositos/mover`
- `POST /api/depositos/:id/ingreso`
- `POST /api/depositos/:id/egreso`
- `GET /api/depositos/licitacion/recepciones`
- `GET /api/depositos/licitacion/recepciones/:id`
- `POST /api/depositos/licitacion/registrar-ingreso`
- `GET /api/depositos/vencimientos-proximos`
- `GET /api/depositos/distribucion/pendientes`
- `GET /api/depositos/distribucion/pendientes/:id`
- `POST /api/depositos/distribucion/registrar-salida`

## Entregas

Endpoints principales:

- `GET /api/entregas/pedidos-disponibles`
- `GET /api/entregas/solicitudes/productos-disponibles`
- `GET /api/entregas/solicitudes/mis`
- `POST /api/entregas/solicitudes`
- `PATCH /api/entregas/solicitudes/:id/aceptar`
- `GET /api/entregas/solicitudes/pendientes`
- `GET /api/entregas/solicitudes/:id/comprobante`
- `POST /api/entregas/solicitudes/:id/entregar`
- `POST /api/entregas/retirar`
- `GET /api/entregas/historial/:id_pedido`

## Proveedores

### Endpoints

- `GET /api/proveedores`
- `POST /api/proveedores`
- `PATCH /api/proveedores/:id`
- `DELETE /api/proveedores/:id`

## Directivo

### Endpoints

- `GET /api/directivo/alertas`

## Patrimonio

### Endpoints

- `GET /api/patrimonio/tickets`
- `PATCH /api/patrimonio/tickets/:ticketId/estado`

## Zones

Compatibilidad adicional:

- `POST /api/zones`
- `POST /api/zones/:zoneId/escuelas`
- `POST /api/zones/:zoneId/supervisores`

## Codigos de estado comunes

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error
