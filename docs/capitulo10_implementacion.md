# Capítulo 10: Implementación

Este capítulo detalla los aspectos prácticos de la construcción del sistema DEPO. Se presenta la estructura de directorios del código fuente tanto en el backend como en el frontend, y se explican las decisiones técnicas críticas tomadas durante el desarrollo. Asimismo, se describen los patrones de diseño e ingeniería de software implementados para asegurar que el sistema sea modular, seguro y escalable.

## 10.1. Introducción

La implementación de un sistema de software implica traducir los requerimientos y modelos de diseño lógico en código fuente ejecutable. En esta fase, los desarrolladores se enfrentan a decisiones prácticas sobre cómo organizar los archivos, gestionar la concurrencia, asegurar las transacciones y aplicar patrones de diseño que optimicen el mantenimiento y eviten el acoplamiento de componentes.

Para el proyecto DEPO, se ha implementado una estructura clara basada en buenas prácticas de desarrollo para JavaScript y Node.js. En las secciones siguientes, se documenta la organización del código del proyecto y las estrategias de software que posibilitaron materializar las reglas de negocio descritas en los casos de uso del Capítulo 9.

## 10.2. Estructura de Directorios del Código Fuente

El proyecto se organiza bajo una estructura de **Monorepo**, conteniendo tanto el servidor backend como la aplicación frontend en el mismo repositorio, pero con entornos de ejecución y dependencias claramente separados.

### 10.2.1. Estructura del Backend
El código del servidor Express se localiza en la carpeta `backend` y se organiza de la siguiente manera:
- `backend/src/server.js`: Punto de entrada de la aplicación. Configura el servidor HTTP, conecta a la base de datos PostgreSQL, aplica middlewares globales y expone los puertos de escucha.
- `backend/src/routes/`: Define las rutas de la API unificadas por recurso (ej: `usuarios.js`, `productos.js`, `pedidos.js`, `movimientos.js`, `licitaciones.js`).
- `backend/src/controllers/`: Contiene la lógica de negocio y las consultas SQL de persistencia asociadas a cada endpoint de las rutas.
- `backend/src/middleware/`: Contiene filtros de control de flujo HTTP, tales como la validación de tokens JWT (`auth.js`), el control de roles RBAC y el límite de tasa de solicitudes (`express-rate-limit`).
- `backend/src/config/`: Archivos de configuración de variables de entorno y del pool de conexiones a la base de datos (`db.js`).
- `backend/scripts/`: Scripts auxiliares de base de datos para la restauración de esquemas (`setup-database.js`), reinicio de administradores y generación de datos de prueba.

### 10.2.2. Estructura del Frontend
La aplicación interactiva en React se encuentra dentro del directorio `frontend` y se organiza bajo la siguiente estructura modular:
- `frontend/src/main.jsx`: Punto de inicio que monta la aplicación React en el DOM del navegador.
- `frontend/src/App.jsx`: Componente raíz que define el enrutamiento de la SPA (`react-router-dom`) y envuelve a los componentes con los proveedores de contexto globales.
- `frontend/src/context/`: Contiene los contextos de React (ej: `AuthContext.jsx`) para compartir el estado de autenticación y los datos del usuario entre componentes sin propagar props manualmente.
- `frontend/src/pages/`: Páginas principales de la aplicación (ej: `Login.jsx`, `Dashboard.jsx`, `Pedidos.jsx`, `Distribucion.jsx`, `Bajas.jsx`, `Patrimonio.jsx`).
- `frontend/src/components/`: Componentes visuales reutilizables de la interfaz de usuario (ej: botones, tablas dinámicas, tarjetas de KPI, layouts de navegación y paneles de mapas).
- `frontend/src/styles/`: Hojas de estilo Vanilla CSS modulares que configuran el sistema de diseño visual (`variables.css`, `premium.css`, `responsive.css`).

---

## 10.3. Decisiones Técnicas Relevantes

Durante el desarrollo de la plataforma se tomaron decisiones de ingeniería clave para responder a limitaciones operativas o requisitos de confiabilidad:

### 10.3.1. Entorno de Ejecución Unificado en Producción
Para simplificar el despliegue del sistema en servidores del Ministerio de Educación de San Juan, el backend Express se configuró para servir archivos estáticos. En modo de desarrollo, el backend corre en el puerto `4000` y el frontend en Vite corre en el puerto `5173`. Sin embargo, para producción, se ejecuta `npm run build` en el frontend, generando la carpeta optimizada `frontend/dist`. El servidor backend detecta la presencia de este directorio y lo sirve en la ruta raíz (`/`), unificando el software en un solo puerto operativo y simplificando el direccionamiento de red.

### 10.3.2. Mecanismo de Transacciones Atómicas en PostgreSQL
Operaciones críticas como la confirmación de egresos múltiples por departamento o el registro de ingresos parciales de licitaciones implican modificar múltiples tablas de manera coordinada. Para evitar inconsistencias de datos, el backend utiliza transacciones SQL explícitas (`BEGIN`, `COMMIT`, `ROLLBACK`) a través del pool de conexiones de `pg`. Ante cualquier error intermedio en la ejecución de la regla de negocio (ej. falla al restar stock en un producto específico), la transacción completa se cancela mediante `ROLLBACK` en la base de datos, garantizando la integridad.

### 10.3.3. Almacenamiento de Evidencias en Base de Datos
Para evitar la complejidad de configurar servidores de almacenamiento de archivos externos (ej. buckets S3) en la infraestructura local del Ministerio de Educación de San Juan, se optó por codificar las imágenes de mercadería rota y actas en formato Base64 en el frontend. El string resultante se envía en formato JSON al backend y se almacena directamente en un campo de texto largo de PostgreSQL (`recepcion_danio_imagen.datos`). Esta decisión reduce el número de dependencias externas de infraestructura del prototipo y facilita las copias de seguridad de la base de datos, que contienen tanto los metadatos como las evidencias visuales integradas.

---

## 10.4. Patrones de Diseño Aplicados

Para dotar al sistema de una arquitectura robusta y extensible, se implementaron diversos patrones de diseño de software reconocidos en la industria:

### 10.4.1. Patrón Controlador de Rutas (Variación del MVC)
En el backend se aplicó una variante del patrón Modelo-Vista-Controlador (MVC), abstrayendo la vista (que es servida por el frontend SPA). El backend se organiza separando la definición de rutas HTTP (Ruteadores de Express) de la ejecución lógica y el acceso a los datos (Controladores). Los controladores encapsulan las consultas SQL nativas, aislando la lógica del protocolo HTTP y facilitando la legibilidad del código.

### 10.4.2. Patrón Middleware (Cadena de Responsabilidad)
Express implementa de manera nativa el patrón de *Chain of Responsibility* a través de su arquitectura de middlewares. Cada solicitud HTTP entrante recorre una tubería de funciones que validan consecutivamente diferentes aspectos de la petición:
1. `cors()`: Verifica el origen de la petición.
2. `rateLimit()`: Protege contra ataques de denegación de servicio controlando la tasa de peticiones.
3. `verificarToken`: Middleware personalizado que extrae y valida el JWT de la cabecera HTTP.
4. `verificarRol`: Middleware personalizado que valida si el rol del token coincide con los permisos requeridos para la ruta solicitada.
Solo si la solicitud supera con éxito cada eslabón de la cadena de responsabilidad, el flujo se delega al controlador final.

### 10.4.3. Patrón Singleton (Pool de Conexiones a Base de Datos)
La conexión a la base de datos PostgreSQL debe ser única y compartida a lo largo del ciclo de vida del servidor para evitar la saturación de sockets en el sistema operativo. Se implementó una instancia única del pool de conexiones (`pg.Pool`) en `backend/src/config/db.js`, la cual es importada y reutilizada por cada uno de los controladores mediante el sistema de caching de módulos de Node.js, emulando el comportamiento del patrón Singleton.

### 10.4.4. Patrón React Context API (Gestión de Estado Global)
Para evitar el acoplamiento y el paso repetitivo de propiedades a través de múltiples niveles de componentes visuales (*prop drilling*), se implementó la Context API de React. El componente `AuthProvider` envuelve a toda la aplicación, almacenando el estado del usuario autenticado, su token de sesión y sus permisos. Cualquier componente secundario (como la barra de navegación o los layouts de páginas) puede suscribirse a este contexto y reaccionar ante cambios en la sesión de forma desacoplada.

## 10.5. Síntesis del Capítulo

En conclusión, este décimo capítulo ha documentado los aspectos prácticos y de ingeniería de software involucrados en la implementación del sistema DEPO. Se detalló la organización del monorepo mediante estructuras modulares en frontend y backend, y se justificaron decisiones críticas de desarrollo como la unificación del entorno de producción, la atomicidad de transacciones SQL y el almacenamiento de evidencias en base64. Asimismo, se expuso la aplicación de patrones arquitectónicos clave (MVC, Singleton, Middleware y Context). Con la implementación técnica plenamente descrita, el Capítulo 11 presentará el Plan de Pruebas y Testing implementados para asegurar el correcto funcionamiento del software.
