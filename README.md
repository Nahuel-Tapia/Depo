# Depo Stock

Aplicación web para control básico de stock de depósito.

El proyecto incluye autenticación con JWT, administración de usuarios con roles, gestión de productos, registro de movimientos, ajustes de inventario, auditoría y módulos adicionales para pedidos, proveedores e instituciones.

## Estado del proyecto

Este repositorio contiene el código fuente y los archivos necesarios para levantar una base de trabajo.

La base de datos con la que desarrollé y probé el sistema la tengo localmente en mi PC. En este repositorio no incluyo una copia completa de esa base con datos reales. Lo que sí queda incluido es el código de la aplicación, el archivo de ejemplo de variables de entorno y el script SQL base disponible en `backend/base_prueba.sql`.

## Tecnologías

- Node.js
- Express
- PostgreSQL
- HTML, CSS y JavaScript en frontend estático

## Puesta en marcha

1. Crear el archivo `.env` a partir de `.env.example`.
2. Completar las credenciales reales de PostgreSQL en ese archivo.
3. Instalar dependencias con `npm install`.
4. Crear la base de datos si hace falta con `npm run db:create`.
5. Cargar la estructura base desde `backend/base_prueba.sql`.
6. Iniciar el servidor con `npm start`.
7. Abrir `http://localhost:4000`.

## Variables de entorno

Variables esperadas:

- `PORT`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## Acceso inicial

Usuario administrador por defecto:

- Email: `admin@depo.local`
- Contraseña: `Admin123!`

Si el acceso falla, puede recrearse con `npm run reset-admin`.

## Alcance funcional actual

- Login y sesión con JWT
- Gestión de usuarios y roles
- Matriz de permisos por acción
- CRUD de productos
- Registro de movimientos de stock
- Ajustes de inventario
- Auditoría de operaciones
- Endpoints para pedidos, proveedores e instituciones

## Notas para revisión

- El backend sirve el frontend estático desde la misma aplicación Express.
- La configuración actual del proyecto está orientada a PostgreSQL.
- No se incluye una exportación de la base de datos de trabajo ni datos productivos dentro del repositorio.

## Estructura principal

- `backend/src`: servidor, rutas, middleware y acceso a datos
- `backend/scripts`: scripts auxiliares de base de datos y usuarios
- `frontend/public`: archivos estáticos del frontend

## Pendientes razonables

- Incorporar pruebas automatizadas
- Formalizar un proceso de despliegue
- Completar validaciones y documentación operativa de algunos módulos
