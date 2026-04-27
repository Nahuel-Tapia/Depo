# Sistema de Roles y Permisos - Depo

## 1. Roles Definidos

| Rol | Descripción | Requiere Nivel Educativo |
|-----|-------------|--------------------------|
| **admin** | Administrador del sistema con acceso completo | No |
| **control_ministerio** | Control del Ministerio - vista de auditoría | No |
| **director_area** | Director de Área - gestión de supervisión | **Sí** |
| **directivo** | Directivo de institución educativa | No |
| **supervisor** | Supervisor de patrimonio escolar | **Sí** (vinculado al nivel del Director de Área) |
| **operador** | Operador de Stock - gestión de inventario | No |
| **consulta** | Solo consulta - vista sin modificaciones | No |
| **area_compras** | Área de compras - gestión de licitaciones | No |

## 2. Restricciones de Creación de Usuarios

### Admin
- Puede crear cualquier rol
- Requiere nivel educativo para `director_area` y `supervisor`

### Director de Área
- Puede crear **SOLO usuarios con rol supervisor**
- El supervisor debe tener el **mismo nivel educativo** que el director de área
- El supervisor se vincula automáticamente al director de área creador
- La jurisdicción se hereda del director de área

### 其他 Roles
- No pueden crear usuarios ( salvo los anteriores )

## 3. Flujo de Creación de Usuarios

```
ADMIN:
  Crea director_area → debe indicar nivel educativo
  Crea supervisor → debe indicar nivel + director_area + jurisdiccion

DIRECTOR_AREA:
  Crea supervisor → nivel educativo se autocomplete con el del director
                   director_area_id se autocomplete con su ID
                   jurisdiccion se autocomplete con su jurisdicción
```

## 4. Permisos por Rol

### Admin
- Dashboard, Stock (ver/editar/movimientos), Usuarios (crear/editar/rol/estado/eliminar)
- Productos (CRUD), Movimientos, Ajustes, Auditoría
- Pedidos (ver/gestionar), Supervisión, Instituciones (CRUD/asignar)
- Proveedores (CRUD), Límites, Planillas (ver/gestionar/enviar)

### Control Ministerio
- Dashboard, Stock, Productos, Movimientos
- Auditoría, Pedidos, Instituciones, Límites

### Director Área
- Dashboard, Usuarios (ver/crear supervisor), Productos
- Instituciones, Pedidos, Supervisión, Planillas
- **Solo puede supervisores de su nivel educativo**

### Directivo
- Dashboard, Productos, Pedidos (crear), Auditoría

### Supervisor
- Dashboard, Pedidos (ver/gestionar), Instituciones

### Operador
- Dashboard, Stock (ver/editar/movimientos), Productos (CRUD)
- Movimientos, Ajustes, Auditoría, Proveedores (CRUD)

### Consulta
- Dashboard, Stock, Productos, Movimientos, Ajustes, Auditoría

### Área Compras
- Dashboard, Planillas, Stock, Productos, Instituciones, Proveedores

## 5. Permisos del Sistema

```
DASHBOARD_VIEW, STOCK_VIEW, STOCK_EDIT, STOCK_MOVEMENT_CREATE
USERS_READ, USERS_CREATE, USERS_ROLE_UPDATE, USERS_STATUS_UPDATE, USERS_DELETE
PRODUCTOS_VIEW, PRODUCTOS_CREATE, PRODUCTOS_EDIT, PRODUCTOS_DELETE
MOVIMIENTOS_VIEW, MOVIMIENTOS_CREATE
AJUSTES_VIEW, AJUSTES_CREATE
AUDITORIA_VIEW
PEDIDOS_VIEW, PEDIDOS_CREATE, PEDIDOS_MANAGE
SUPERVISION_MANAGE, SUPERVISION_REPORTS_REQUEST
INSTITUCIONES_VIEW, INSTITUCIONES_CREATE, INSTITUCIONES_EDIT, INSTITUCIONES_DELETE, INSTITUCIONES_ASIGNAR
PROVEEDORES_VIEW, PROVEEDORES_CREATE, PROVEEDORES_EDIT, PROVEEDORES_DELETE
LIMITES_VIEW, LIMITES_EDIT
PLANILLA_VIEW, PLANILLA_MANAGE, PLANILLA_ENVIAR
```

## 6. Flujo de Información

```
                    ┌──────────────┐
                    │   Usuario   │
                    └──────┬──────┘
                           │ Login
                           ▼
              ┌────────────────────────┐
              │   Auth (JWT Token)     │
              │  - nivel_educativo   │
              │  - director_area_id  │
              │  - jurisdiccion     │
              └────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  Dashboard │  │  Router   │  │  Permisos  │
    │   (stats)  │  │ (tablas)  │  │ (roles)   │
    └────────────┘  └────────────┘  └────────────┘
```

### Rutas API Principales

| Prefix | Funcionalidad |
|--------|---------------|
| `/api/auth` | Autenticación (login/register) |
| `/api/users` | Gestión de usuarios (POST /api/users crea usuario) |
| `/api/roles` | Listado de roles |
| `/api/permissions` | Permisos del sistema |
| `/api/productos` | Catálogo de productos |
| `/api/movimientos` | Movimientos de stock |
| `/api/pedidos` | Pedidos de escuelas |
| `/api/instituciones` | Escuelas/instituciones |
| `/api/supervisor` | Funciones de supervisor |
| `/api/director-area` | Gestión de director de área |
| `/api/compras` | Planillas de compra |
| `/api/auditoria` | Log de auditoría |
| `/api/dashboard` | Estadísticas |

## 7. Estructura de Datos de Usuario

```sql
usuario {
  id_usuario,
  nombre,
  apellido,
  email,
  dni,
  role,           -- admin, controla_ministerio, director_area, directivo, supervisor, operador, consulta, area_compras
  password,
  telefono,
  activo,
  id_institucion, -- FK a institución (solo para role=directivo)
  nivel_educativo,    -- Solo para director_area y supervisor
  director_area_id,    -- FK a usuario (solo para supervisor)
  jurisdiccion        -- Solo para supervisor y algunos director_area
}
```

## 8. Definición de Permisos

Los permisos se definen en `backend/src/permissions.js`:
- `PERMISSIONS`: Constantes de permisos
- `DEFAULT_ROLE_PERMISSIONS`: Mapeo rol → permisos por defecto

La verificación de permisos se realiza en el frontend mediante el hook `useAuth()` que expõe `hasPermission(permiso)`.

## 9. Validaciones en Backend (users.js - POST /api/users)

1. **director_area**: Requiere `nivel` obligatorio
2. **supervisor**: Requiere:
   - `nivel` obligatorio
   - `director_area_id` obligatorio
   - `jurisdiccion` obligatorio
   - El `director_area_id` debe existir y estar activo
   - El nivel del supervisor debe coincidir con el nivel del director de área