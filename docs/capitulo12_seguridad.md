# Capítulo 12: Seguridad informática

Este capítulo detalla las medidas de seguridad digital implementadas en el sistema DEPO para salvaguardar la confidencialidad, integridad y disponibilidad de la información de la plataforma. Se explican los mecanismos de autenticación y gestión de sesiones mediante Json Web Tokens (JWT), la estrategia de autorización basada en roles (RBAC), el cifrado de contraseñas mediante funciones de hashing (Bcrypt), la mitigación de ataques comunes (como inyección SQL) y el diseño de pistas de auditoría para garantizar la trazabilidad de las acciones de los usuarios.

## 12.1. Introducción

En el desarrollo de sistemas para la administración pública y organismos del Estado (como el Ministerio de Educación de San Juan), la seguridad informática constituye un requerimiento transversal no negociable. La plataforma DEPO procesa datos de carácter personal de agentes públicos y directivos escolares, maneja información sobre licitaciones de compras con impacto presupuestario y administra la distribución de inventarios estatales.

Garantizar que solo las personas autorizadas puedan consultar existencias, avalar solicitudes, cerrar licitaciones o despachar mercadería es fundamental para prevenir fraudes, evitar la fuga de información sensible y cumplir con las normativas legales de control de patrimonio público. En las secciones siguientes, se detallan las salvaguardas técnicas aplicadas a nivel de red, aplicación y base de datos para blindar el sistema.

## 12.2. Autenticación y Gestión de Sesiones

El sistema DEPO implementa una estrategia de **autenticación basada en tokens** para la validación y mantenimiento de las sesiones de los usuarios.

### 12.2.1. Json Web Tokens (JWT)
Al iniciar sesión, el usuario envía sus credenciales (correo electrónico y clave) a la API. Tras ser validadas contra la base de datos, el backend genera un token estructurado en formato JWT que es firmado digitalmente con una clave secreta robusta (guardada en la variable de entorno `JWT_SECRET`) utilizando el algoritmo **HMAC-SHA256 (HS256)**.
- **Payload del Token**: Contiene información no sensible de identificación y autorización del usuario: su identificador de base de datos (`id_usuario`), su correo electrónico (`email`), su rol asignado (`role`), su nivel educativo y la institución a la que pertenece si corresponde.
- **Mecanismo Stateless**: El token firmado se envía al frontend y se almacena localmente en el almacenamiento local del navegador (*localStorage*). En cada petición HTTP posterior dirigida a endpoints protegidos de la API, el frontend adjunta el token en la cabecera de autorización mediante el esquema Bearer (`Authorization: Bearer <token>`). El servidor valida la firma digital del token recibido de manera local. Si el token no ha sido alterado, se autoriza el procesamiento de la petición, evitando realizar consultas repetitivas de sesión a la base de datos y optimizando la velocidad del servidor.
- **Expiración y Revocación**: Para mitigar el riesgo de secuestro de sesión, los tokens poseen una validez temporal máxima preestablecida (8 horas). Una vez transcurrido este lapso, el token se invalida automáticamente, forzando un nuevo login del usuario.

## 12.3. Autorización y Control de Accesos (RBAC)

La autorización en DEPO se rige bajo el principio del **menor privilegio**, el cual establece que un usuario debe poseer únicamente aquellos permisos estrictamente necesarios para cumplir con sus tareas operativas cotidianas. Esto se materializa a través de un control de accesos basado en roles (RBAC - *Role-Based Access Control*).

### 12.3.1. Protección de la API en el Backend
Cada endpoint expuesto en el servidor Express se encuentra securizado mediante middlewares de autorización. Por ejemplo, el middleware `verificarRol` opera como un guardián de ruta:
- Cuando una petición HTTP golpea el endpoint de adjudicación de licitaciones (`POST /api/licitaciones/adjudicar`), el middleware decodifica el JWT, extrae el campo `role` del payload y valida si el valor es igual a `'compras'` o `'admin'`.
- Si el rol coincide con los privilegios permitidos, se ejecuta el controlador. Si el rol es diferente (ej. un directivo escolar intentando forzar la adjudicación), el middleware frena inmediatamente la petición y retorna una respuesta HTTP `403 Forbidden`, registrando el intento de acceso no autorizado.

### 12.3.2. Restricción Visual en la Interfaz Frontend
En el frontend React, se aplica el mismo esquema de control de accesos para asegurar una experiencia limpia y segura:
- **Navegación Dinámica**: El menú de navegación se genera a partir del rol decodificado del contexto de autenticación (`AuthContext`). Se ocultan secciones completas (como el panel de compras para los operadores o las bandejas de aprobación para los directivos).
- **Protección de Rutas en React Router**: Si un usuario malintencionado intenta saltarse el menú escribiendo directamente la URL en la barra del navegador (ej. `http://localhost:5173/dashboard-compras`), las rutas protegidas del enrutador evalúan el rol del contexto global y redirigen automáticamente al usuario a una página de acceso no permitido o al login general.

## 12.4. Cifrado y Hashing de Datos

Para proteger la información frente a accesos físicos no autorizados a la base de datos o interceptaciones de red, el sistema implementa mecanismos criptográficos robustos:

### 12.4.1. Cifrado de Contraseñas con Bcrypt
Almacenar contraseñas en texto plano es una vulnerabilidad crítica. En el sistema DEPO, las claves se someten a un proceso de hashing unidireccional utilizando la función de derivación de claves **Bcrypt** antes de guardarse en la base de datos.
- **Rondas de Costo**: Se utilizan 10 rondas de procesamiento (*salt rounds*), lo que equilibra un tiempo de verificación rápido para el usuario con una alta resistencia frente a ataques de descifrado por fuerza bruta o hardware especializado (como GPUs).
- **Salting**: Bcrypt agrega automáticamente un valor aleatorio único (*salt*) a cada contraseña antes de aplicar el algoritmo de hash. Esto garantiza que dos usuarios que elijan la misma contraseña tengan hashes guardados completamente diferentes en la tabla `usuario`, previniendo ataques mediante tablas de arco iris precalculadas.

### 12.4.2. Prevención de Inyección SQL
Para blindar las consultas de la base de datos frente a la manipulación maliciosa de datos de entrada (Inyección SQL), el backend evita por completo concatenar valores de variables directamente en las sentencias SQL. En su lugar, utiliza **consultas parametrizadas** provistas por el cliente nativo de PostgreSQL (`pg`). Al estructurar la consulta como `SELECT * FROM usuario WHERE email = $1` y enviar el email en un arreglo de parámetros separado, el motor de base de datos trata la variable estrictamente como un valor literal y no como código ejecutable, neutralizando cualquier intento de inyección.

## 12.5. Trazabilidad y Logs de Auditoría

Un componente crucial de la seguridad en la gestión pública es la capacidad de reconstruir históricamente las acciones realizadas en el sistema (no repudio y auditabilidad). DEPO implementa pistas de auditoría estructuradas en su base de datos a través de las siguientes tablas transaccionales:

- **Tabla `aprobacion_seguimiento`**: Registra de forma indeleble qué usuario físico firmó la aprobación o el rechazo de cada pedido, la fecha exacta y el rol interviniente.
- **Tabla `movimiento_stock`**: Cada alteración física de inventario registra obligatoriamente el identificador del operario (`id_usuario`), el depósito origen, el producto, la cantidad y el documento respaldatorio (remito o baja). Esto impide modificar stock de manera anónima.
- **Tabla `baja_status_history`**: Mantiene el historial de auditoría de los cambios de estado de las solicitudes de baja de materiales rotos, registrando los comentarios de justificación del descarte de activos estatales.

## 12.6. Síntesis del Capítulo

Este duodécimo capítulo ha detallado las medidas de seguridad informática aplicadas en el sistema DEPO. Mediante el uso de Json Web Tokens (JWT) se garantizan sesiones seguras y escalables, complementadas por middlewares de backend y frontend que aplican estrictamente el control de accesos basado en roles (RBAC). El hashing unidireccional con Bcrypt y las consultas parametrizadas protegen las contraseñas y la base de datos contra intrusiones físicas e inyecciones SQL. Por último, el diseño de tablas específicas de trazabilidad asegura la auditabilidad del circuito, cumpliendo con los estándares de control interno del sector público. Con los aspectos técnicos de seguridad descritos, el Capítulo 13 desarrollará el marco Legal y Normativo aplicable en la República Argentina para sistemas que gestionan datos personales y recursos estatales.
