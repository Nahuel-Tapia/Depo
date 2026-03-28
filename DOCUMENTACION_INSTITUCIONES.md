# 📊 GUÍA COMPLETA - SISTEMA DE GESTIÓN DE INSTITUCIONES

## 1. 🏗️ ARQUITECTURA DEL SISTEMA

El sistema está dividido en tres capas:

### **Backend (Node.js + Express + PostgreSQL)**
- **Puerto:** 4000
- **Base de datos:** PostgreSQL (depo_produccion)
- **Rutas principales:**
  - `/api/instituciones` - Operaciones de instituciones (requiere autenticación)
  - `/api/instituciones/public/list` - Listar instituciones (público)
  - `/api/instituciones/public/cue/:cue` - Buscar por CUE (público)

### **Frontend (HTML + CSS + JavaScript)**
- **Puerto:** 4000 (mismo servidor sirve archivos estáticos)
- **Archivos principales:**
  - `index.html` - Aplicación principal
  - `app.js` - Lógica de aplicación

### **Base de Datos (PostgreSQL)**
- **Tabla principal:** `institucion` (con 1335 registros importados)
- **Tabla relacionada:** `edificio` (información de direcciones)
- **Vista:** `instituciones` (mapea datos para la API)

---

## 2. 🗄️ ESTRUCTURA DE DATOS

### Tabla `institucion`
```
Columnas:
- id_institucion (INTEGER, PRIMARY KEY)
- cue (VARCHAR, UNIQUE)
- nombre (VARCHAR)
- email (VARCHAR)
- nivel (VARCHAR) - antes: nivel_educativo
- tipo (VARCHAR)
- matriculados (INTEGER)
- factor_asignacion (NUMERIC)
- notas (TEXT)
- activo (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- id_edificio (FOREIGN KEY → edificio)
```

### Vista `instituciones` (para API)
```
Mapea desde institucion + edificio:
- id (id_institucion como entero)
- cue
- nombre
- direccion (desde edificio)
- localidad (desde edificio)
- departamento (desde edificio)
- telefono (te_voip desde edificio)
- email
- nivel
- tipo
- matriculados
- factor_asignacion
- activo
- notas
- created_at
- updated_at
```

---

## 3. 🔌 ENDPOINTS DEL BACKEND

### Públicos (sin autenticación)

#### GET `/api/instituciones/public/list`
Devuelve lista de todas las instituciones para dropdowns
```json
{
  "instituciones": [
    { "id": 951, "nombre": "ANEXO CACIQUE PISMANTA" },
    { "id": 529, "nombre": "11 DE SEPTIEMBRE" }
  ]
}
```

#### GET `/api/instituciones/public/cue/:cue`
Busca institución por CUE
```json
{
  "cue": "700008001",
  "nombre": "ANEXO CACIQUE PISMANTA"
}
```

### Privados (requieren token JWT)

#### GET `/api/instituciones`
Retorna todas las instituciones con permisos
```json
{
  "instituciones": [
    {
      "id": "951",
      "cue": "700008001",
      "nombre": "ANEXO CACIQUE PISMANTA",
      "nivel": "PRIMARIO",
      "localidad": "PISMANTA",
      "matriculados": 0,
      "factor_asignacion": 1.0,
      "activo": true
    }
  ]
}
```

#### GET `/api/instituciones/:id`
Obtiene una institución específica

#### POST `/api/instituciones`
Crea nueva institución (requiere permiso `instituciones.create`)

#### PATCH `/api/instituciones/:id`
Actualiza institución (requiere permiso `instituciones.edit`)

#### DELETE `/api/instituciones/:id`
Elimina institución (requiere permiso `instituciones.delete`)

---

## 4. 🎨 INTERFAZ DEL FRONTEND

### Pantalla de Instituciones

```
┌─────────────────────────────────────────────────────────────┐
│                  🏫 INSTITUCIONES                            │
├─────────────────────────────────────────────────────────────┤
│ CUE    │ Nombre          │ Nivel   │ Localidad │ Activos │  │
├─────────────────────────────────────────────────────────────┤
│ 700... │ ANEXO CACIQUE   │ PRIMARY │ PISMANTA  │   Sí    │  │
│ 700... │ 11 DE SEPT.     │ PRIMARY │ B° S. M.  │   Sí    │  │
│        │ 12 DE AGOSTO    │ PRIMARY │ CUARTO... │   Sí    │  │
└─────────────────────────────────────────────────────────────┘
```

**Acciones disponibles (según permisos):**
- ✏️ Editar - Modificar datos de institución
- 🔄 Activar/Desactivar - Cambiar estado
- 📊 Asignaciones - Ver/gestionar stock asignado
- 🗑️ Eliminar - Remover institución

---

## 5. 📝 FLUJO DE DATOS

### Carga de Instituciones

```
1. Usuario abre navegador → http://localhost:4000
   ↓
2. Frontend carga app.js, inicializa state.instituciones = []
   ↓
3. Usuario hace click en tab "Instituciones"
   ↓
4. Función loadInstituciones() se ejecuta:
   - Verifica permiso "instituciones.view"
   - Realiza GET /api/instituciones con token JWT
   ↓
5. Backend verifica autenticación y permisos
   ↓
6. Backend consulta VER instituciones:
   SELECT ... FROM instituciones WHERE ...
   ↓
7. Backend devuelve JSON con array de instituciones
   ↓
8. Frontend recibe datos:
   state.instituciones = [...]
   ↓
9. Función renderInstituciones() itera y crea <tr>
   ↓
10. Tabla se rellena y es visible para el usuario
```

### Ejemplo de un registro

```javascript
{
  "id": "951",
  "cue": "700008001",
  "nombre": " ANEXO CACIQUE PISMANTA",
  "direccion": "Av. Principal 123",
  "localidad": "PISMANTA",
  "departamento": "CAPITAL",
  "telefono": "03865-123456",
  "email": null,
  "nivel": "PRIMARIO",
  "tipo": "publica",
  "matriculados": 0,
  "factor_asignacion": 1.0,
  "activo": true,
  "notas": null,
  "created_at": "2026-03-28T07:30:00.000Z",
  "updated_at": "2026-03-28T07:30:00.000Z"
}
```

---

## 6. 🔐 SISTEMA DE PERMISOS

Permisos relacionados con instituciones:
- `instituciones.view` - Ver lista de instituciones
- `instituciones.edit` - Editar datos de institución
- `instituciones.delete` - Eliminar institución
- `instituciones.asignar` - Gestionar asignación de stock

Roles por defecto:
- **Admin** - Todos los permisos
- **Directivo** - Ver y editar (su institución)
- **Operador** - Ver y algunas ediciones
- **Consulta** - Solo ver

---

## 7. 🚀 CÓMO EJECUTAR

### Iniciar servidor
```bash
cd c:\Users\Docente\Desktop\Depo
npm start
```

El servidor iniciará en http://localhost:4000

### Acceder a la aplicación
```
URL: http://localhost:4000
Login: email: admin@depo.local
       password: admin123
```

### Página de testing
```
URL: http://localhost:4000/test-instituciones.html
- Permite testear cada endpoint
- Muestra respuestas JSON
- Tabla con datos de instituciones
```

---

## 8. 📊 ESTADÍSTICAS ACTUALES

- **Total de instituciones:** 1,335
- **Campos por institución:** 16
- **Registros en edificio:** 1,335 (relacionados)
- **Direcciones importadas:** Completas
- **Factor de asignación:** Calculado automáticamente según matrícula

---

## 9. 🔧 ARCHIVOS CLAVE

### Backend
```
backend/
├── src/
│   ├── server.js ......................... Servidor Express
│   ├── db.pg.js .......................... Conexión PostgreSQL
│   ├── config/database.js ................ Configuración DB
│   ├── middleware/auth.js ................ Autenticación
│   ├── permissions.js .................... Permisos
│   └── routes/
│       ├── instituciones.js .............. Rutas CRUD instituciones
│       ├── auth.js
│       ├── users.js
│       └── ...
└── base_prueba.sql ....................... Esquema inicial
```

### Frontend
```
frontend/public/
├── index.html ............................ Interfaz principal
├── css/styles.css ........................ Estilos
├── js/app.js ............................ Lógica principal
└── test-instituciones.html ............... Página de testing
```

### Base de datos
```
PostgreSQL
├── Tabla: institucion .................... 1,335 registros
├── Tabla: edificio ....................... 1,335 registros
└── Vista: instituciones .................. Mapeo para API
```

---

## 10. 📋 CAMBIOS REALIZADOS

### SQL
- ✅ Creada vista `instituciones` que mapea `institucion` + `edificio`
- ✅ Agregadas columnas faltantes a `institucion`:
  - email, tipo, matriculados, factor_asignacion, notas
  - created_at, updated_at
- ✅ Renombrada columna `nivel_educativo` → `nivel`

### Backend (src/routes/instituciones.js)
- ✅ UPDATE ahora usa tabla `institucion` (no la vista)
- ✅ DELETE ahora usa tabla `institucion` (no la vista)
- ✅ INSERT usa tabla `institucion`
- ✅ SELECT usa vista `instituciones`

### Frontend (js/app.js)
- ✅ Removidos debug logs innecesarios
- ✅ Limpiada función `loadInstituciones()`
- ✅ Limpiada función `renderInstituciones()`
- ✅ Agregado null check en `renderPermissions()`

---

## 11. ✨ CARACTERÍSTICAS

### Búsqueda y Listado
- ✅ Ver todas las instituciones en tabla
- ✅ Búsqueda pública por CUE
- ✅ Dropdown para seleccionar institución

### Gestión
- ✅ Editar datos de institución
- ✅ Activar/Desactivar institución
- ✅ Eliminar institución
- ✅ Ver asignaciones de stock

### Auditoría
- ✅ Registro de cambios (CREATE, UPDATE, DELETE)
- ✅ Registro de usuario que realizó el cambio
- ✅ Timestamp de operación

---

## 12. 🐛 TROUBLESHOOTING

### "No se ven las instituciones"
1. Verificar que PostgreSQL está corriendo
2. Verificar que el backend está en puerto 4000: `npm start`
3. Abrir http://localhost:4000/test-instituciones.html
4. Hacer click en "Endpoint Público" para verificar que hay datos

### "Error autenticación"
1. Verificar credenciales: admin@depo.local / admin123
2. Verificar que la tabla `usuario` tiene el admin
3. Revisar .env que tiene DB_PASSWORD correcto

### "Error: connection refused"
1. PostgreSQL no está corriendo
2. Verificar puerto 5432: `netstat -ano | findstr :5432`
3. Iniciar PostgreSQL desde Services o pgAdmin

---

## 13. 📞 PRÓXIMOS PASOS

1. **Implementar búsqueda:** Agregar filtro en tabla
2. **Exportar datos:** Agregar botón para descargar como CSV
3. **Importar más:** Cargar datos adicionales desde archivos
4. **Reportes:** Generar reportes de instituciones por localidad
5. **Mapas:** Integrar Mapbox para mostrar ubica de instituciones

---

**Última actualización:** 28 de Marzo de 2026
**Estado:** ✅ Funcional y Operativo
**Total de Instituciones:** 1,335
