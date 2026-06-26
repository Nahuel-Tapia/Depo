# Capítulo 18: Anexos

Este capítulo contiene material técnico complementario y de referencia que da soporte a las explicaciones provistas en el cuerpo principal de la documentación del sistema DEPO. Se estructuran de la siguiente manera:

- **Anexo A**: Scripts de Creación de Tablas de la Base de Datos (esquema unificado).
- **Anexo B**: Código Fuente del Script de Pruebas de Humo Automatizadas (Playwright).
- **Anexo C**: Guía Rápida de Comandos para Puesta en Marcha y Arranque del Sistema.

---

## Anexo A: Esquema Físico de Creación de la Base de Datos (PostgreSQL)

A continuación, se adjunta un extracto de las sentencias DDL (Data Definition Language) de la base de datos localizadas en `backend/schema.sql` que definen la estructura transaccional del inventario y las restricciones del negocio:

```sql
-- 1. TIPOS / ENUMS OPERATIVOS
CREATE TYPE estado_tramite AS ENUM (
    'pendiente', 
    'en_revision', 
    'aprobado_parcial', 
    'aprobado', 
    'rechazado', 
    'entregado', 
    'finalizado', 
    'cancelado',
    'pendiente_director'
);

CREATE TYPE tipo_movimiento AS ENUM (
    'ingreso', 
    'egreso', 
    'ajuste', 
    'devolucion',
    'traslado'
);

-- 2. TABLA MAESTRA DE PRODUCTOS
CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(20),
    marca VARCHAR(120),
    stock_actual INT DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
    id_categoria INT REFERENCES categoria(id_categoria) ON DELETE SET NULL
);

-- 3. TABLA DE CONTROL DE MOVIMIENTOS DE INVENTARIO
CREATE TABLE movimiento_stock (
    id_movimiento SERIAL PRIMARY KEY,
    id_producto INT REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    tipo tipo_movimiento,
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_producto VARCHAR(50), 
    id_institucion INT REFERENCES institucion(id_institucion) ON DELETE SET NULL, 
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL, 
    id_proveedor INT REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT, 
    fecha_vencimiento DATE,
    id_deposito INT REFERENCES deposito(id) ON DELETE SET NULL,
    id_deposito_destino INT REFERENCES deposito(id) ON DELETE SET NULL,
    motivo TEXT
);
```

---

## Anexo B: Script de Smoke Testing Automatizado (Playwright)

Código fuente del archivo de pruebas automatizadas `scratch/api-smoke.spec.js` utilizado para verificar la disponibilidad de los endpoints críticos del backend Express antes de cada empaquetado:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('API Smoke Tests - Depo Stock', () => {
  const baseURL = 'http://localhost:4000';
  let token = '';

  test('Debe responder exitosamente al healthcheck', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('Debe autenticar al administrador por defecto', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'admin@depo.local',
        password: 'Admin123!'
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toBeDefined();
    token = body.token;
  });

  test('Debe rechazar peticiones sin token en rutas protegidas', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/productos`);
    expect(response.status()).toBe(401);
  });
});
```

---

## Anexo C: Guía de Comandos para Puesta en Marcha del Entorno

### C.1. Instalación de Dependencias
Ejecutar los siguientes comandos en la raíz del monorepo y dentro del directorio del frontend React:
```bash
# Instalación del backend y dependencias de testing
npm install

# Instalación del frontend React
cd frontend
npm install
```

### C.2. Configuración de Base de Datos
1. Crear el archivo de variables de entorno `.env` en la raíz del proyecto a partir de `.env.example`.
2. Cargar las credenciales de PostgreSQL en el `.env`.
3. Ejecutar el comando de inicialización de base de datos para restaurar el esquema completo:
```bash
npm run setup
```

### C.3. Arranque en Entorno de Desarrollo
Para correr los entornos de manera separada con recarga en caliente:
```bash
# Servidor Backend (en http://localhost:4000)
npm run dev

# Servidor Frontend Vite (en http://localhost:5173, ejecutar en otra consola)
cd frontend
npm run dev
```

### C.4. Compilación y Arranque Unificado en Producción
Para desplegar el sistema en modo de producción sirviendo la SPA compilada a través de la API:
```bash
# Compilar el frontend en frontend/dist
cd frontend
npm run build

# Volver a la raíz del proyecto y arrancar el servidor unificado
cd ..
npm start
```
El sistema completo estará disponible para producción en la URL unificada: `http://localhost:4000/`.
