# Depo Stock (base inicial)

Proyecto base para control de stock del depósito.

Incluye:
- Login con JWT.
- Gestión de usuarios.
- Roles con permisos por acción.
- Módulo de productos (CRUD).
- Módulo de movimientos de ingreso/egreso.
- Módulo de ajustes de inventario.
- Registro completo de auditoría por usuario.
- Interfaz web simple con colores inspirados en el logo del Ministerio.

---

## 1) Requisitos

- Node.js 18 o superior.

---

## 2) Cómo levantar el sistema

1. Copiar variables de entorno:
   - `copy .env.example .env`
2. Instalar paquetes:
   - `npm install`
3. Ejecutar:
   - `npm start`
4. Abrir en navegador:
   - `http://localhost:4000`

---

## 3) Usuario inicial

- Email: `admin@depo.local`
- Contraseña: `Admin123!`

> Cambiar contraseña y `JWT_SECRET` antes de usar en producción.

---

## 4) Roles y permisos

### `admin`
- Puede ver, crear, editar y eliminar usuarios.
- Puede cambiar roles y activar/desactivar cuentas.
- Tiene todos los permisos de stock.

### `operador`
- Puede trabajar sobre stock (ver/editar/registrar movimientos).
- No puede administrar usuarios.

### `consulta`
- Solo lectura (dashboard y stock).
- No puede editar stock ni administrar usuarios.

### Matriz rápida

| Permiso | admin | operador | consulta |
|---|---|---|---|
| `dashboard.view` | ✅ | ✅ | ✅ |
| `stock.view` | ✅ | ✅ | ✅ |
| `stock.edit` | ✅ | ✅ | ❌ |
| `stock.movement.create` | ✅ | ✅ | ❌ |
| `productos.view` | ✅ | ✅ | ✅ |
| `productos.create` | ✅ | ✅ | ❌ |
| `productos.edit` | ✅ | ✅ | ❌ |
| `productos.delete` | ✅ | ❌ | ❌ |
| `movimientos.view` | ✅ | ✅ | ✅ |
| `movimientos.create` | ✅ | ✅ | ❌ |
| `ajustes.view` | ✅ | ✅ | ✅ |
| `ajustes.create` | ✅ | ✅ | ❌ |
| `auditoria.view` | ✅ | ✅ | ✅ |
| `users.read` | ✅ | ❌ | ❌ |
| `users.create` | ✅ | ❌ | ❌ |
| `users.role.update` | ✅ | ❌ | ❌ |
| `users.status.update` | ✅ | ❌ | ❌ |
| `users.delete` | ✅ | ❌ | ❌ |

---

## 5) Endpoints clave

### Autenticación
- `POST /api/auth/login` → login.

### Usuarios
- `GET /api/users/me` → datos del usuario autenticado.
- `GET /api/users` → listar usuarios (solo con permiso).
- `POST /api/users` → crear usuario (solo con permiso).
- `PATCH /api/users/:id/role` → cambiar rol (solo con permiso).
- `PATCH /api/users/:id/active` → activar/desactivar (solo con permiso).
- `DELETE /api/users/:id` → eliminar usuario (solo admin).

### Permisos
- `GET /api/permissions/me` → permisos del usuario autenticado.
- `GET /api/permissions/matrix` → matriz de permisos por rol.

### Productos
- `GET /api/productos` → listar productos.
- `GET /api/productos/:id` → obtener producto.
- `POST /api/productos` → crear producto (requiere permiso `productos.create`).
- `PATCH /api/productos/:id` → editar producto (requiere permiso `productos.edit`).
- `DELETE /api/productos/:id` → eliminar producto (requiere permiso `productos.delete`).

### Movimientos
- `GET /api/movimientos` → listar movimientos (filtrar por producto_id, tipo).
- `GET /api/movimientos/:id` → obtener movimiento.
- `POST /api/movimientos` → crear movimiento entrada/salida (requiere permiso `movimientos.create`).
- `GET /api/movimientos/stats/resumen` → estadísticas de movimientos.

### Ajustes
- `GET /api/ajustes` → listar ajustes (filtrar por producto_id).
- `GET /api/ajustes/:id` → obtener ajuste.
- `POST /api/ajustes` → crear ajuste de inventario (requiere permiso `ajustes.create`).

### Auditoría
- `GET /api/auditoria` → listar auditoría (filtrar por usuario_id, entidad, accion).
- `GET /api/auditoria/:id` → obtener registro de auditoría.
- `GET /api/auditoria/usuario/:usuario_id` → auditoría por usuario específico.
- `GET /api/auditoria/stats/resumen` → resumen de cambios.

---

## 6) Próximos pasos sugeridos

✅ **Implementados:**
- Módulo de productos (CRUD)
- Módulo de movimientos (ingreso/egreso)
- Módulo de ajustes de inventario
- Historial/auditoría por usuario

📋 **Futuras mejoras:**
- Interfaz web para productos, movimientos y auditoría
- Reportes y gráficos de stock
- Integración con sistemas externos
- Backup automático de base de datos
- Notificaciones de stock bajo

---

## 7) Si no podés iniciar sesión

1. Asegurate de abrir: `http://localhost:4000`
2. Usar credenciales admin:
   - `admin@depo.local`
   - `Admin123!`
3. Si sigue fallando, resetear admin:
   - `npm run reset-admin`
