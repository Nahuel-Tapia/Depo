# Capítulo 4: Alcance y limitaciones del proyecto

Este capítulo detalla el alcance funcional y técnico del proyecto DEPO, estableciendo de manera precisa qué requerimientos y módulos están contemplados dentro del desarrollo del sistema. Asimismo, se definen los límites, exclusiones y restricciones operativas de la plataforma, diferenciando las capacidades actuales de las potencialidades futuras del software.

## 4.1. Introducción

En la ingeniería de software, delimitar el alcance del proyecto es una tarea crítica para garantizar la viabilidad del desarrollo y administrar las expectativas de los usuarios y evaluadores académicos. Definir qué hace y qué no hace el sistema evita desvíos de tiempo y sobrecarga de alcance (*scope creep*), permitiendo focalizar los esfuerzos de programación en resolver de manera óptima las necesidades esenciales del cliente.

Para el caso del sistema DEPO, el alcance está enfocado en cubrir el ciclo logístico y de abastecimiento de las escuelas del Ministerio de Educación de la Provincia de San Juan. Dado que se trata de un software que interactúa con áreas complejas como compras, logística y patrimonio, en este capítulo se traza una línea divisoria clara entre los módulos implementados en esta versión del sistema y aquellas áreas funcionales que corresponden a otros sistemas ministeriales o que se han catalogado como futuras expansiones de la plataforma.

## 4.2. Alcance Funcional del Sistema

El sistema DEPO comprende los siguientes módulos funcionales, implementados en su totalidad y operativos en el repositorio del proyecto:

### 4.2.1. Módulo de Seguridad, Autenticación y Autorización (RBAC)
- Autenticación segura de usuarios mediante correo electrónico y contraseña cifrada con algoritmos de hashing.
- Sesiones de usuario gestionadas mediante Json Web Tokens (JWT).
- Control de acceso basado en roles (RBAC) para seis perfiles distintos: *Administrador*, *Directivo*, *Supervisor*, *Director de Área*, *Área de Compras* y *Operador de Depósito*.
- Middleware en backend y rutas protegidas en frontend para impedir el acceso no autorizado a datos sensibles o funciones no permitidas por el rol.

### 4.2.2. Módulo de Gestión de Estructura Institucional y Zonal
- Registro y actualización de Edificios, incluyendo sus coordenadas de geolocalización (latitud y longitud) y división departamental.
- Administración del catálogo de escuelas (Instituciones) vinculadas a su nivel educativo, categoría, matrícula real de alumnos y kit de productos asignado.
- Configuración de Zonas Geográficas asignando supervisores a zonas y escuelas a zonas, permitiendo a los Directores de Área estructurar de forma flexible el territorio escolar de la provincia.

### 4.2.3. Módulo de Pedidos Anuales y Pedidos de Refuerzo
- Creación de Solicitudes Anuales por parte del Directivo, basadas en la carga automática del Kit de productos preestablecido para su escuela y ajustadas dinámicamente según la matrícula.
- Creación de Pedidos de Refuerzo extraordinarios de productos específicos cuando las necesidades del ciclo lectivo excedan el stock del pedido anual.
- Circuito de aprobación de pedidos con estados: `pendiente` (Directivo), `aprobado` o `rechazado` (Supervisor), `pendiente_director` y `aprobado_parcial` o `aprobado` final (Director de Área).

### 4.2.4. Módulo de Licitaciones, Adjudicación e Historial de Precios
- Consolidación automática de solicitudes de las Direcciones de Área aprobadas y listas para licitar.
- Funcionalidad para que el Área de Compras pueda ajustar cantidades finales a licitar antes de bloquear el listado.
- Carga de cotizaciones de proveedores y adjudicación a la mejor oferta.
- Registro del historial de precios unitarios reales pagados por producto en cada licitación (`compra_precio_historico`), accesible únicamente para roles autorizados (Compras y Administrador).

### 4.2.5. Módulo de Recepción de Mercadería y Control de Inventarios
- Registro de ingresos al depósito central por remito de camión de proveedor, permitiendo cargas totales o recepciones parciales.
- Gestión de fechas de vencimiento de los lotes de productos ingresados en el inventario.
- Módulo de alerta temprana visual de vencimientos próximos para prevenir pérdidas de insumos.
- Visualización detallada del stock distribuido en múltiples almacenes o depósitos locales.

### 4.2.6. Módulo de Distribución a Escuelas y Envíos por Departamento
- Creación de solicitudes de retiro por parte de los directivos escolares una vez que la mercadería está disponible.
- Opción de solicitar retiro presencial (con generación de código y comprobante) o marcar la opción de "solicitar envío".
- Tablero de control de "Envíos por Departamento" para el operador de depósito, que agrupa automáticamente las solicitudes de envío por departamento geográfico.
- Confirmación de egresos múltiples agrupados por departamento, validando stock de depósitos de origen y actualizando de forma atómica el estado de entrega del pedido.

### 4.2.7. Módulo de Bajas de Stock y Materiales Dañados (Scrap)
- Módulo para dar de baja productos vencidos, rotos o perdidos en el Depósito Central o almacenes.
- Registro obligatorio del motivo de la baja e historial de cambio de estados de la solicitud de baja.
- Almacenamiento y vinculación de evidencia fotográfica (imágenes codificadas en base64) para respaldar las bajas de inventario.

### 4.2.8. Módulo de Patrimonio Escolar y Reporte de Incidencias
- Creación de tickets de patrimonio por parte de los directivos escolares para reportar daños en activos fijos (bancos, sillas, armarios, etc.).
- Bandeja de entrada para que supervisores y directores de área puedan priorizar, observar y resolver los tickets de reclamo patrimonial.

### 4.2.9. Módulo de Visualización Geográfica y Estadísticas (Dashboard)
- Dashboard dinámico para Directores de Área y el Ministerio que presenta estadísticas consolidadas de consumo, stock actual y estados de trámites.
- Integración de mapas interactivos que muestran la ubicación física de las escuelas y la asignación territorial de las zonas escolares de San Juan.

## 4.3. Límites y Exclusiones del Proyecto

Para mantener el proyecto acotado a las necesidades primarias y evitar desvíos, se establecieron los siguientes límites y exclusiones explícitas:

- **Sin Gestión y Seguimiento de Flota Vehicular por GPS**: El sistema agrupa los pedidos por departamento y genera reportes de carga para el transporte, pero no incluye el seguimiento satelital de los camiones de reparto en tiempo real ni la optimización automática de rutas mediante algoritmos matemáticos complejos de transporte (ej. VRP - *Vehicle Routing Problem*).
- **Sin Integración con el Sistema de Administración Financiera Provincial (SIAF)**: DEPO gestiona los precios históricos de compra para referencia del personal de compras, pero no se conecta con los sistemas de contabilidad pública o tesorería de la Provincia de San Juan para tramitar pagos, devengados de facturas o transferencias bancarias a proveedores.
- **Sin Pasarela de Pagos Electrónicos**: La adquisición de productos se efectúa a través del circuito administrativo estatal (licitación y adjudicación), por lo que la plataforma no contempla integraciones con pasarelas de pago electrónico (ej. MercadoPago, Visa, etc.) ni transacciones de dinero online.
- **Sin Automatización de Captura de Stock por Sensores (RFID/Barras)**: El registro de la entrada y salida de mercadería del depósito central se realiza mediante carga manual del operario a través de la interfaz web, no estando contemplada la lectura automática de etiquetas RFID, códigos de barras o básculas de peso integradas en el hardware.

## 4.4. Limitaciones Tecnológicas y Operativas

El software presenta las siguientes limitaciones de infraestructura y operación:

- **Dependencia de Conectividad**: Dado que la aplicación se ejecuta como una plataforma web unificada con base de datos centralizada, requiere conectividad constante a internet por parte de los directivos escolares y los operadores de depósito. Aquellas escuelas ubicadas en parajes rurales de alta montaña sin acceso a internet deberán canalizar sus solicitudes de manera diferida o a través de sus respectivos supervisores.
- **Formato de Evidencias en Base de Datos**: Para simplificar la arquitectura inicial, las imágenes de baja de stock y daños se almacenan en formato de texto plano codificado en base64 en la base de datos PostgreSQL (`recepcion_danio_imagen.datos`). Aunque es funcional para el volumen de un prototipo académico y pruebas, esta práctica puede degradar el rendimiento de la base de datos a gran escala, requiriendo a futuro una migración de las imágenes a un servicio de almacenamiento de objetos externo (ej. AWS S3 o MinIO).
- **Entorno de Despliegue Local**: El sistema ha sido verificado para su ejecución local utilizando Node.js y un contenedor o base de datos PostgreSQL local. No se incluye en el alcance actual la configuración avanzada de infraestructuras de alta disponibilidad (como Kubernetes, balanceadores de carga o replicación multirregión de base de datos).

## 4.5. Síntesis del Capítulo

Este capítulo ha definido el alcance del sistema DEPO, precisando los nueve módulos funcionales que conforman la plataforma web, los cuales responden a las ineficiencias de stock, logística y control detalladas en el Capítulo 2. Asimismo, se delimitaron los alcances técnicos del software al excluir la contabilidad presupuestaria estatal, los pagos electrónicos y el monitoreo satelital de la flota, y al detallar las limitaciones asociadas al almacenamiento de imágenes y la dependencia de internet. Definido el alcance funcional y sus límites, el Capítulo 5 desarrollará el Marco Teórico, proporcionando el sustento académico y tecnológico de las herramientas seleccionadas para el desarrollo del sistema.
