# Depo Stock (base inicial)

Proyecto base para control de stock del depósito.

Incluye:
- Login con JWT.
- Gestión de usuarios.
- Roles con permisos por acción.
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
- Puede ver, crear y editar usuarios.
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
| `users.read` | ✅ | ❌ | ❌ |
| `users.create` | ✅ | ❌ | ❌ |
| `users.role.update` | ✅ | ❌ | ❌ |
| `users.status.update` | ✅ | ❌ | ❌ |

---

## 5) Endpoints clave

- `POST /api/auth/login` → login.
- `GET /api/users/me` → datos del usuario autenticado.
- `GET /api/permissions/me` → permisos del usuario autenticado.
- `GET /api/permissions/matrix` → matriz de permisos por rol.
- `GET /api/users` → listar usuarios (solo con permiso).
- `POST /api/users` → crear usuario (solo con permiso).
- `PATCH /api/users/:id/role` → cambiar rol (solo con permiso).
- `PATCH /api/users/:id/active` → activar/desactivar (solo con permiso).

---

## 6) Próximo paso sugerido

Implementar módulos de:
- Productos
- Movimientos de ingreso/egreso
- Ajustes de inventario
- Historial/auditoría por usuario

---

## 7) Si no podés iniciar sesión

1. Asegurate de abrir: `http://localhost:4000`
2. Usar credenciales admin:
   - `admin@depo.local`
   - `Admin123!`
3. Si sigue fallando, resetear admin:
   - `npm run reset-admin`
