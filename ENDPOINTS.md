# ENDPOINTS API - Depo Stock

Documentación detallada de todos los endpoints disponibles.

## Autenticación

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@depo.local",
  "password": "Admin123!"
}

Response (201):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Usuarios

### Listar usuarios
```
GET /api/users
Authorization: Bearer {token}

Response (200):
{
  "users": [
    {
      "id": 1,
      "nombre": "Administrador Inicial",
      "email": "admin@depo.local",
      "role": "admin",
      "activo": 1,
      "created_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Obtener usuario autenticado
```
GET /api/users/me
Authorization: Bearer {token}

Response (200):
{
  "user": {
    "id": 1,
    "nombre": "Administrador Inicial",
    "email": "admin@depo.local",
    "role": "admin"
  }
}
```

### Crear usuario
```
POST /api/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@depo.local",
  "password": "Password123!",
  "role": "operador"
}

Response (201):
{
  "id": 2
}
```

### Cambiar rol de usuario
```
PATCH /api/users/:id/role
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "consulta"
}

Response (200):
{
  "ok": true
}
```

### Activar/Desactivar usuario
```
PATCH /api/users/:id/active
Authorization: Bearer {token}
Content-Type: application/json

{
  "activo": 0
}

Response (200):
{
  "ok": true
}
```

---

## Productos

### Listar productos
```
GET /api/productos
Authorization: Bearer {token}

Response (200):
{
  "productos": [
    {
      "id": 1,
      "codigo": "PROD-001",
      "nombre": "Producto Ejemplo",
      "descripcion": "Descripción del producto",
      "precio": 100.50,
      "stock_actual": 50,
      "created_at": "2026-03-19T10:00:00Z",
      "updated_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Obtener producto
```
GET /api/productos/:id
Authorization: Bearer {token}

Response (200):
{
  "producto": {
    "id": 1,
    "codigo": "PROD-001",
    "nombre": "Producto Ejemplo",
    "descripcion": "Descripción del producto",
    "precio": 100.50,
    "stock_actual": 50,
    "created_at": "2026-03-19T10:00:00Z",
    "updated_at": "2026-03-19T10:00:00Z"
  }
}
```

### Crear producto
```
POST /api/productos
Authorization: Bearer {token}
Content-Type: application/json

{
  "codigo": "PROD-001",
  "nombre": "Producto Nuevo",
  "descripcion": "Descripción del nuevo producto",
  "precio": 99.99
}

Response (201):
{
  "id": 1
}
```

### Editar producto
```
PATCH /api/productos/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Producto Actualizado",
  "descripcion": "Nueva descripción",
  "precio": 120.00
}

Response (200):
{
  "ok": true
}
```

### Eliminar producto
```
DELETE /api/productos/:id
Authorization: Bearer {token}

Response (200):
{
  "ok": true
}
```

---

## Movimientos

### Listar movimientos
```
GET /api/movimientos?producto_id=1&tipo=entrada&limit=50&offset=0
Authorization: Bearer {token}

Response (200):
{
  "movimientos": [
    {
      "id": 1,
      "producto_id": 1,
      "codigo": "PROD-001",
      "nombre": "Producto Ejemplo",
      "tipo": "entrada",
      "cantidad": 50,
      "motivo": "Compra a proveedor",
      "usuario_nombre": "Administrador",
      "email": "admin@depo.local",
      "created_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Obtener movimiento
```
GET /api/movimientos/:id
Authorization: Bearer {token}

Response (200):
{
  "movimiento": {
    "id": 1,
    "producto_id": 1,
    "codigo": "PROD-001",
    "nombre": "Producto Ejemplo",
    "tipo": "entrada",
    "cantidad": 50,
    "motivo": "Compra a proveedor",
    "usuario_nombre": "Administrador",
    "email": "admin@depo.local",
    "created_at": "2026-03-19T10:00:00Z"
  }
}
```

### Crear movimiento (entrada o salida)
```
POST /api/movimientos
Authorization: Bearer {token}
Content-Type: application/json

{
  "producto_id": 1,
  "tipo": "entrada",
  "cantidad": 25,
  "motivo": "Reabastecimiento"
}

Response (201):
{
  "id": 2
}
```

**Tipos válidos:** `entrada`, `salida`

### Obtener estadísticas de movimientos
```
GET /api/movimientos/stats/resumen?producto_id=1
Authorization: Bearer {token}

Response (200):
{
  "stats": {
    "total_entradas": 50,
    "total_salidas": 10
  }
}
```

---

## Ajustes de Inventario

### Listar ajustes
```
GET /api/ajustes?producto_id=1&limit=50&offset=0
Authorization: Bearer {token}

Response (200):
{
  "ajustes": [
    {
      "id": 1,
      "producto_id": 1,
      "codigo": "PROD-001",
      "nombre": "Producto Ejemplo",
      "cantidad_anterior": 50,
      "cantidad_nueva": 48,
      "motivo": "Corrección por inventario físico",
      "usuario_nombre": "Operador",
      "email": "operador@depo.local",
      "created_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Obtener ajuste
```
GET /api/ajustes/:id
Authorization: Bearer {token}

Response (200):
{
  "ajuste": {
    "id": 1,
    "producto_id": 1,
    "codigo": "PROD-001",
    "nombre": "Producto Ejemplo",
    "cantidad_anterior": 50,
    "cantidad_nueva": 48,
    "motivo": "Corrección por inventario físico",
    "usuario_nombre": "Operador",
    "email": "operador@depo.local",
    "created_at": "2026-03-19T10:00:00Z"
  }
}
```

### Crear ajuste de inventario
```
POST /api/ajustes
Authorization: Bearer {token}
Content-Type: application/json

{
  "producto_id": 1,
  "cantidad_nueva": 48,
  "motivo": "Corrección por inventario físico"
}

Response (201):
{
  "id": 1
}
```

---

## Auditoría

### Listar auditoría
```
GET /api/auditoria?usuario_id=1&entidad=productos&accion=CREATE&limit=50&offset=0
Authorization: Bearer {token}

Response (200):
{
  "registros": [
    {
      "id": 1,
      "usuario_id": 1,
      "usuario_nombre": "Administrador",
      "email": "admin@depo.local",
      "entidad": "productos",
      "accion": "CREATE",
      "id_registro": 1,
      "cambios": "{\"codigo\":\"PROD-001\",\"nombre\":\"Producto Nuevo\"}",
      "created_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Obtener registro de auditoría
```
GET /api/auditoria/:id
Authorization: Bearer {token}

Response (200):
{
  "registro": {
    "id": 1,
    "usuario_id": 1,
    "usuario_nombre": "Administrador",
    "email": "admin@depo.local",
    "entidad": "productos",
    "accion": "CREATE",
    "id_registro": 1,
    "cambios": "{\"codigo\":\"PROD-001\",\"nombre\":\"Producto Nuevo\"}",
    "created_at": "2026-03-19T10:00:00Z"
  }
}
```

### Auditoría por usuario
```
GET /api/auditoria/usuario/:usuario_id?limit=50&offset=0
Authorization: Bearer {token}

Response (200):
{
  "registros": [
    {
      "id": 1,
      "usuario_id": 1,
      "usuario_nombre": "Administrador",
      "email": "admin@depo.local",
      "entidad": "productos",
      "accion": "CREATE",
      "id_registro": 1,
      "cambios": "{...}",
      "created_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Resumen de auditoría
```
GET /api/auditoria/stats/resumen?fecha_desde=2026-03-01&fecha_hasta=2026-03-31
Authorization: Bearer {token}

Response (200):
{
  "resumen": [
    {
      "entidad": "productos",
      "accion": "CREATE",
      "total": 5
    },
    {
      "entidad": "productos",
      "accion": "UPDATE",
      "total": 3
    }
  ]
}
```

---

## Permisos

### Obtener permisos del usuario autenticado
```
GET /api/permissions/me
Authorization: Bearer {token}

Response (200):
{
  "permissions": [
    "dashboard.view",
    "stock.view",
    "stock.edit",
    "stock.movement.create",
    "usuarios.read",
    "usuarios.create",
    "usuarios.role.update",
    "usuarios.status.update",
    "productos.view",
    "productos.create",
    "productos.edit",
    "productos.delete",
    "movimientos.view",
    "movimientos.create",
    "ajustes.view",
    "ajustes.create",
    "auditoria.view"
  ]
}
```

### Obtener matriz de permisos por rol
```
GET /api/permissions/matrix
Authorization: Bearer {token}

Response (200):
{
  "matrix": {
    "admin": [
      "dashboard.view",
      "stock.view",
      "stock.edit",
      "stock.movement.create",
      "usuarios.read",
      "usuarios.create",
      "usuarios.role.update",
      "usuarios.status.update",
      "productos.view",
      "productos.create",
      "productos.edit",
      "productos.delete",
      "movimientos.view",
      "movimientos.create",
      "ajustes.view",
      "ajustes.create",
      "auditoria.view"
    ],
    "operador": [...],
    "consulta": [...]
  }
}
```

---

## Códigos de Estado

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (sin token o token inválido)
- `403` - Forbidden (sin permisos suficientes)
- `404` - Not Found
- `409` - Conflict (código duplicado, etc.)
- `500` - Internal Server Error

---

## Ejemplos de Uso

### Crear flujo completo

1. **Login**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@depo.local","password":"Admin123!"}'
```

2. **Crear producto**
```bash
curl -X POST http://localhost:4000/api/productos \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"PROD-001","nombre":"Laptop","precio":1500}'
```

3. **Registrar entrada de stock**
```bash
curl -X POST http://localhost:4000/api/movimientos \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"producto_id":1,"tipo":"entrada","cantidad":10,"motivo":"Compra"}'
```

4. **Consultar auditoría**
```bash
curl -X GET http://localhost:4000/api/auditoria \
  -H "Authorization: Bearer {TOKEN}"
```
