# Capítulo 5: Marco teórico

Este capítulo presenta el marco teórico y tecnológico que fundamenta el desarrollo del sistema DEPO. Se abordan los conceptos esenciales de la arquitectura de software utilizada, describiendo las características de React y Vite en el frontend, Node.js y Express en el backend, y el motor de base de datos relacional PostgreSQL. Asimismo, se exponen los principios de seguridad informática aplicados (JWT y Bcrypt) y los fundamentos logísticos de gestión de inventarios y distribución territorial que sustentan la lógica de negocio del sistema.

## 5.1. Introducción

El desarrollo de sistemas de software orientados a la administración pública requiere la selección de tecnologías que garanticen robustez, escalabilidad, seguridad de la información y una experiencia de usuario fluida. En el plano académico y profesional de la ingeniería de software, estas decisiones se sustentan en patrones de diseño y modelos arquitectónicos consolidados.

Para el proyecto DEPO, se ha optado por una arquitectura cliente-servidor desacoplada basada en el desarrollo de una API RESTful en el backend y una SPA (*Single Page Application*) en el frontend. Esta separación de responsabilidades no solo optimiza el rendimiento y el consumo de recursos, sino que también facilita el mantenimiento del sistema a largo plazo y permite adaptar de forma independiente la interfaz de usuario ante cambios normativos o funcionales sin alterar la lógica de persistencia de datos.

## 5.2. Tecnologías de Desarrollo Frontend

La interfaz de usuario del sistema DEPO ha sido construida utilizando herramientas modernas que priorizan el rendimiento de renderizado y la modularidad del código.

### 5.2.1. React (Biblioteca para Interfaces de Usuario)
React es una biblioteca de JavaScript de código abierto desarrollada originalmente por Facebook (actualmente Meta) para construir interfaces de usuario interactivas basadas en componentes. Sus fundamentos académicos clave incluyen:
- **Arquitectura Basada en Componentes**: Permite encapsular la interfaz en bloques de código autónomos y reutilizables (componentes), que gestionan su propio estado. Esto reduce la duplicación de código y mejora la mantenibilidad.
- **Virtual DOM (Document Object Model)**: React mantiene una representación virtual del DOM en memoria. Cuando el estado de un componente cambia, la biblioteca calcula la diferencia mínima (*reconciliation*) entre el DOM virtual y el DOM real, aplicando únicamente los cambios estrictamente necesarios. Este enfoque minimiza el costo de actualización del navegador, logrando interfaces ágiles y responsivas.
- **Flujo de Datos Unidireccional**: La información en React fluye en un solo sentido, desde los componentes padres hacia los componentes hijos a través de propiedades (*props*). Esto simplifica el seguimiento del flujo de datos y facilita la detección de errores de estado.

### 5.2.2. Vite (Herramienta de Construcción Frontend)
Vite es un motor de desarrollo y empaquetado moderno para aplicaciones web que reemplaza de forma eficiente a herramientas tradicionales como Webpack. Sus ventajas metodológicas radican en:
- **Uso de ES Modules Nativos en Desarrollo**: En lugar de empaquetar toda la aplicación antes de iniciar el servidor de desarrollo, Vite aprovecha el soporte nativo de módulos en los navegadores modernos para servir el código fuente bajo demanda, logrando tiempos de arranque casi instantáneos.
- **HMR (Hot Module Replacement)**: Vite realiza reemplazos de módulos calientes de forma extremadamente veloz, actualizando solo el componente modificado en pantalla sin recargar la página completa ni perder el estado del formulario.
- **Empaquetado Optimizado con Rollup**: Para producción, Vite utiliza Rollup para generar archivos estáticos optimizados con técnicas de *tree-shaking* (eliminación de código muerto) y división de código (*code-splitting*), garantizando una carga rápida del frontend incluso en conexiones de internet lentas.

### 5.2.3. Leaflet y React Leaflet (Georreferenciación)
Leaflet es una biblioteca open source de JavaScript para mapas interactivos adaptados a dispositivos móviles. En DEPO, se utiliza para geolocalizar los establecimientos educativos del Ministerio de Educación de San Juan y delimitar las zonas escolares. La integración mediante *React Leaflet* expone los elementos de Leaflet como componentes reactivos, permitiendo actualizar dinámicamente los marcadores del mapa según las consultas de la base de datos.

## 5.3. Tecnologías de Desarrollo Backend

El backend de la aplicación funciona como el servidor de datos y lógica de negocio, estructurado sobre el entorno de ejecución Node.js y el framework Express.

### 5.3.1. Node.js (Entorno de Ejecución)
Node.js es un entorno de ejecución de JavaScript orientado a eventos asíncronos construido sobre el motor V8 de Google Chrome. Su arquitectura se fundamenta en:
- **Bucle de Eventos de Hilo Único (Single-Threaded Event Loop)**: En lugar de asignar un hilo del sistema operativo por cada conexión entrante (como hacen servidores tradicionales como Apache), Node.js gestiona múltiples peticiones concurrentes utilizando un único hilo que delega las operaciones de entrada/salida (I/O) al sistema operativo.
- **E/S No Bloqueante (Non-blocking I/O)**: Las consultas a la base de datos, lecturas de archivos o llamadas de red se ejecutan de forma asíncrona. El servidor continúa procesando otras solicitudes mientras espera las respuestas, lo que resulta altamente eficiente para aplicaciones intensivas en datos en tiempo real.

### 5.3.2. Express (Framework de Servidor)
Express es un framework web minimalista y flexible para Node.js que proporciona un conjunto robusto de características para aplicaciones web y móviles. Su diseño se basa en:
- **Arquitectura de Middleware**: El procesamiento de una petición HTTP en Express se realiza mediante una cadena de funciones intermedias (*middlewares*) que pueden inspeccionar, modificar o rechazar la solicitud antes de que llegue al controlador final. Ejemplos de uso en DEPO incluyen la limitación de tasa de peticiones (*rate limiting*), el parseo de JSON, la habilitación de CORS (*Cross-Origin Resource Sharing*) y el middleware de validación de tokens de seguridad JWT.
- **Ruteo Declarativo**: Permite organizar de forma clara y modular las rutas de la API RESTful (ej. `/api/productos`, `/api/movimientos`) asociándolas a los verbos HTTP correspondientes (GET, POST, PUT, DELETE).

## 5.4. Base de Datos Relacionales: PostgreSQL

Para la persistencia de datos, el proyecto utiliza PostgreSQL, un sistema de gestión de bases de datos relacionales de código abierto de clase empresarial. Sus fundamentos teóricos aplicados en el sistema DEPO incluyen:
- **Cumplimiento ACID**: PostgreSQL garantiza las propiedades de Atomicidad, Consistencia, Aislamiento y Durabilidad. Esto asegura que todas las transacciones complejas (por ejemplo, el registro de un egreso múltiple de mercadería que involucra restar stock en `producto`, insertar registros en `movimiento_stock` y actualizar `solicitud_retiro`) se ejecuten por completo o se cancelen en su totalidad (*rollback*) ante fallos, evitando la corrupción de datos.
- **Integridad Referencial y Restricciones (Constraints)**: El esquema implementa claves primarias y foráneas con directivas de eliminación en cascada o establecimiento de nulos (`ON DELETE CASCADE` / `ON DELETE SET NULL`), además de restricciones de verificación (`CHECK`) para asegurar que variables críticas como `stock_actual` o `cantidad_solicitada` nunca tomen valores negativos.
- **Índices y Optimización de Consultas**: Uso de índices B-Tree en columnas frecuentemente consultadas (como claves foráneas de relación) para acelerar las búsquedas de historial de movimientos y pedidos.

## 5.5. Seguridad en Aplicaciones Web

La protección de los datos y el control de accesos se implementan mediante dos tecnologías estándar en la industria.

### 5.5.1. JSON Web Tokens (JWT)
JWT es un estándar abierto (RFC 7519) que define un método compacto y autónomo para transmitir información de forma segura entre las partes como un objeto JSON. La información es confiable porque está firmada digitalmente con una clave secreta del servidor.
- **Estructura**: Consta de tres partes separadas por puntos: cabecera (*Header*), carga útil (*Payload*) y firma (*Signature*).
- **Mecanismo Stateless**: El servidor no necesita almacenar la sesión del usuario en memoria; al recibir la petición HTTP con el token en la cabecera de autorización, el servidor verifica la firma y extrae los permisos y el identificador de usuario directamente del payload, logrando una arquitectura altamente escalable.

### 5.5.2. Bcrypt (Derivación de Clave)
Las contraseñas de los usuarios nunca se almacenan en texto plano en la base de datos. Se utiliza Bcrypt, una función de hashing de contraseñas diseñada específicamente para resistir ataques de fuerza bruta. Incorpora un valor aleatorio (*salt*) para evitar ataques mediante tablas de arco iris y permite ajustar el costo de cómputo para ralentizar los intentos de descifrado maliciosos.

## 5.6. Conceptos y Algoritmos Logísticos de Gestión de Inventarios

La lógica de negocio de DEPO se asienta sobre teorías logísticas clásicas adaptadas a la gestión de recursos del Estado:

### 5.6.1. Gestión de Stock Mínimo y Punto de Pedido
El inventario maestro implementa el concepto de *Stock Mínimo* (umbral crítico de seguridad). Cuando el stock de un insumo de limpieza o librería en el depósito cae por debajo de este límite, el sistema activa alertas visuales para notificar al área de compras la necesidad de iniciar un nuevo proceso de licitación pública, evitando roturas de stock.

### 5.6.2. Método FIFO / PEPS (Primero en Entrar, Primero en Salir)
En la gestión de bienes consumibles, especialmente en el rubro alimentario destinado a comedores y copas de leche de escuelas vulnerables, se implementa el principio de **FIFO (First In, First Out)** o **PEPS (Primero en Entrar, Primero en Salir)**. El sistema asocia a cada lote ingresado mediante remito una fecha de vencimiento (`recepcion_licitacion.fecha_vencimiento`). Al momento del despacho, el software asiste al operador priorizando la salida de los productos cuya fecha de vencimiento sea más cercana, reduciendo el desperdicio.

### 5.6.3. Consolidación de Carga y Egreso Múltiple por Departamento
Desde la perspectiva de la distribución, el sistema implementa la técnica de consolidación logistica por departamento. El agrupamiento geográfico de solicitudes pendientes de envío permite convertir un conjunto disperso de pequeños despachos en una sola operación consolidada de egreso múltiple para una región determinada (ej. Jáchal o Valle Fértil). Esto reduce drásticamente el costo por kilómetro recorrido en el transporte del Ministerio de Educación.

## 5.7. Síntesis del Capítulo

Este quinto capítulo ha desarrollado el marco teórico y tecnológico de la plataforma DEPO, sustentando técnicamente la elección de React, Vite, Node.js, Express y PostgreSQL para configurar una arquitectura robusta, escalable y asíncrona. Asimismo, se expusieron los mecanismos de seguridad (JWT y Bcrypt) y los fundamentos logísticos (FIFO, stock mínimo y consolidación de carga) que rigen la lógica del negocio. Este marco tecnológico proporciona las bases conceptuales necesarias para abordar en el Capítulo 6 la metodología de desarrollo utilizada durante la planificación y construcción del sistema.
