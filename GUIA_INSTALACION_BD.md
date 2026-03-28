# Guía de Instalación - Base de Datos DEPO Stock

## Requisitos Previos

- **PostgreSQL 16 o superior** instalado
- **Node.js 18+** instalado
- **pgAdmin 4** (opcional, para administración visual)

---

## Paso 1: Instalar PostgreSQL

1. Descargar PostgreSQL desde: https://www.postgresql.org/download/windows/
2. Durante la instalación:
   - Usuario: `postgres`
   - Contraseña: `postgres` (recordar esta contraseña)
   - Puerto: `5432` (por defecto)
3. Completar la instalación (no es necesario instalar Stack Builder)

---

## Paso 2: Crear la Base de Datos

### Opción A: Usando pgAdmin

1. Abrir **pgAdmin 4**
2. Conectarse al servidor PostgreSQL (contraseña: `postgres`)
3. Click derecho en "Databases" → "Create" → "Database"
4. Nombre: `depo_stock`
5. Click en "Save"

### Opción B: Usando Terminal

```powershell
# En PowerShell como administrador
cd "C:\Program Files\PostgreSQL\18\bin"
.\psql -U postgres -c "CREATE DATABASE depo_stock;"
```

---

## Paso 3: Ejecutar el Script SQL

### En pgAdmin:

1. Click derecho en la base `depo_stock` → "Query Tool"
2. Copiar y pegar **TODO** el contenido del archivo `backend/base_prueba.sql`
3. Click en el botón "Execute" (▶️) o presionar F5
4. Debería mostrar: "Query returned successfully"

---

## Paso 4: Agregar Columnas Necesarias

Después de ejecutar `base_prueba.sql`, ejecutar estas queries adicionales en el Query Tool:

```sql
-- Agregar columnas faltantes a la tabla usuario
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'consulta';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Crear vista de instituciones (requerida por el backend)
CREATE OR REPLACE VIEW instituciones AS 
SELECT 
    id_institucion as id,
    nombre,
    cue,
    NULL as direccion,
    NULL as localidad,
    NULL as departamento,
    NULL as telefono,
    NULL as email,
    NULL as nivel,
    'publica' as tipo,
    0 as matriculados,
    1.0 as factor_asignacion,
    TRUE as activo,
    NULL as notas,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM institucion;
```

---

## Paso 5: Crear Usuario Administrador

Ejecutar esta query para crear el admin (la contraseña será `Admin123!`):

```sql
INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo)
VALUES (
    'Administrador',
    'Inicial', 
    '00000000',
    'admin@depo.local',
    '$2a$10$iLMAech98.oPEF.iLMjTweV8qoF0g/deuTkHccQAWfB2qzxZzUcBe',
    'admin',
    TRUE
);
```

> **Credenciales del Admin:**
> - Email: `admin@depo.local`
> - Contraseña: `Admin123!`

---

## Paso 6: Configurar Variables de Entorno

Crear o completar el archivo `.env` en la raíz del proyecto con los datos reales de tu instalación de PostgreSQL:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=depo_stock
DB_USER=postgres
DB_PASSWORD=tu_contraseña_aqui
JWT_SECRET=clave-secreta-para-tokens
```

---

## Paso 7: Instalar Dependencias y Ejecutar

```powershell
# En la carpeta del proyecto
cd C:\Users\Docente\Depo

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor estará disponible en: **http://localhost:4000**

---

## Paso 8: Probar el Sistema

1. Abrir navegador en `http://localhost:4000`
2. Iniciar sesión con:
   - Email: `admin@depo.local`
   - Contraseña: `Admin123!`

---

## Solución de Problemas

### Error: "password authentication failed"
- Verificar que `DB_PASSWORD` en `.env` sea la contraseña real del usuario PostgreSQL definido en `DB_USER`
- Si tu instalación usa otro usuario, actualizar también `DB_USER`

### Error: "database depo_stock does not exist"
- Crear la base de datos siguiendo el Paso 2

### Error: "relation usuario does not exist"
- Ejecutar el script `base_prueba.sql` del Paso 3

### El servidor no inicia
- Verificar que PostgreSQL esté corriendo (buscar "postgresql" en Servicios de Windows)
- Verificar que el puerto 5432 no esté bloqueado

---

## Estructura de la Base de Datos

| Tabla | Descripción |
|-------|-------------|
| `usuario` | Usuarios del sistema |
| `institucion` | Escuelas/instituciones |
| `producto` | Productos del inventario |
| `pedido` | Solicitudes de productos |
| `movimiento_stock` | Registro de entradas/salidas |
| `categoria` | Categorías de productos |
| `rol` | Roles disponibles |

---

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total |
| `directivo` | Gestión de su institución |
| `operador` | Operaciones de stock |
| `consulta` | Solo lectura |

---

## Contacto

Si tenés problemas, contactar al equipo de desarrollo.
