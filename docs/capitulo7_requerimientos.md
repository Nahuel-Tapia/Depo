# Capítulo 7: Análisis de requerimientos

Este capítulo expone el análisis detallado de los requerimientos de software que rigieron la construcción del sistema DEPO. La especificación se presenta estructurada en dos secciones principales: los Requerimientos Funcionales (RF), que describen los servicios, cálculos y flujos de trabajo que el sistema debe ejecutar; y los Requerimientos No Funcionales (RNF), que definen las restricciones de rendimiento, usabilidad, seguridad y confiabilidad a las que debe ajustarse la plataforma.

## 7.1. Introducción

El análisis de requerimientos constituye la fase fundacional del ciclo de vida del desarrollo de software. Su objetivo principal es traducir las necesidades del cliente y de los usuarios finales en especificaciones técnicas claras y medibles, evitando ambigüedades durante la codificación y las pruebas.

En el caso del sistema DEPO, la definición de requerimientos se realizó en estrecha colaboración con los actores del Ministerio de Educación de San Juan. Esto permitió plasmar la compleja lógica de las normativas provinciales y los procesos logísticos específicos de distribución escolar (como los kits asociados a la matrícula, la consolidación para compras y la distribución consolidada por departamentos geográficos). Los requerimientos se presentan a continuación catalogados de forma sistemática y clasificados por nivel de prioridad (Alta, Media, Baja).

## 7.2. Requerimientos Funcionales (RF)

Los requerimientos funcionales del sistema DEPO se agrupan por módulos operativos y se detallan a continuación:

### 7.2.1. Módulo de Seguridad y Gestión de Usuarios
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-01** | Autenticación de Usuarios | El sistema debe permitir a los usuarios iniciar sesión mediante correo electrónico y contraseña cifrada. | Alta |
| **RF-02** | Control de Accesos (RBAC) | El sistema debe restringir el acceso a las vistas de la interfaz y a las operaciones de la API según el rol asignado (Administrador, Directivo, Supervisor, Director de Área, Compras, Operador). | Alta |
| **RF-03** | Registro y Gestión de Cuentas | El administrador debe poder crear, suspender, activar y resetear contraseñas de cuentas de usuarios. | Alta |

### 7.2.2. Módulo de Estructura Escolar y Zonas Geográficas
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-04** | Gestión de Edificios | El sistema debe permitir registrar y editar Edificios, incluyendo sus coordenadas de geolocalización (latitud y longitud) y departamento. | Alta |
| **RF-05** | Gestión de Instituciones | El sistema debe permitir gestionar escuelas (Instituciones) asociándolas a su edificio, nivel educativo, categoría, matrícula y kit de productos. | Alta |
| **RF-06** | Configuración de Zonas | El Director de Área debe poder crear zonas escolares, asignarles escuelas e indicar qué supervisores son responsables de cada zona. | Media |

### 7.2.3. Módulo de Planificación y Pedidos
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-07** | Configuración de Kits | El Director de Área debe poder configurar kits de insumos (Kits de productos) especificando las cantidades sugeridas y fórmulas asociadas a la matrícula. | Alta |
| **RF-08** | Solicitud Anual Parametrizada | El Directivo debe poder generar la solicitud anual cargando el kit asignado a su escuela, el cual calcula las cantidades basándose en la matrícula registrada. | Alta |
| **RF-09** | Solicitud de Refuerzos | El Directivo debe poder realizar pedidos de refuerzo extraordinarios cargando artículos específicos fuera del kit anual. | Alta |
| **RF-10** | Aval de Supervisor | El Supervisor debe poder revisar los pedidos de sus escuelas para aprobarlos, rechazarlos o solicitar aclaraciones al Directivo. | Alta |
| **RF-11** | Aprobación de Dirección | El Director de Área debe poder realizar la aprobación final y bloqueo de edición de las solicitudes autorizadas por los supervisores. | Alta |

### 7.2.4. Módulo de Compras y Licitaciones
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-12** | Consolidación a Licitar | El sistema debe permitir al Director de Área consolidar las solicitudes aprobadas en un "Listado Final a Licitar", agrupando productos idénticos para compras por volumen. | Alta |
| **RF-13** | Gestión de Proveedores | El Área de Compras debe poder registrar y actualizar el catálogo de proveedores (CUIT, Razón Social, rubro, contacto). | Alta |
| **RF-14** | Adjudicación de Ofertas | El Área de Compras debe poder ingresar las ofertas de los proveedores por producto de la licitación y adjudicar automáticamente a la oferta más económica. | Alta |
| **RF-15** | Historial de Precios | El sistema debe registrar el precio real de adjudicación por producto en la tabla `compra_precio_historico` para análisis comparativo en futuras licitaciones. | Media |

### 7.2.5. Módulo de Depósito y Logística de Stock
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-16** | Recepción por Remito | El Operador debe poder registrar el ingreso de mercadería al depósito central ingresando el número de remito por camión y el proveedor. | Alta |
| **RF-17** | Recepción Parcial | El sistema debe permitir recepciones parciales de una misma licitación adjudicada, manteniendo el estado de pendiente para los saldos restantes. | Alta |
| **RF-18** | Gestión de Stock por Depósitos | El sistema debe controlar el inventario de manera independiente en múltiples almacenes (ej. Depósito Central, Scrap/Desguace). | Alta |
| **RF-19** | Control FIFO y Vencimientos | El sistema debe exigir la carga de fechas de vencimiento en las recepciones y priorizar la salida de lotes vencidos o próximos a vencer (FIFO). | Alta |

### 7.2.6. Módulo de Distribución y Entregas
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-20** | Solicitud de Retiro | El Directivo debe poder generar la solicitud de retiro presencial en depósito obteniendo un código de retiro y remito imprimible. | Alta |
| **RF-21** | Envío por Departamento | El Directivo debe poder marcar la solicitud para envío, derivándola al tablero de distribución departamental. | Alta |
| **RF-22** | Egreso Múltiple Consolidado | El Operador debe poder seleccionar un departamento geográfico y realizar un egreso múltiple consolidado de las escuelas con solicitudes de envío aceptadas. | Alta |

### 7.2.7. Módulo de Bajas e Incidencias
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-23** | Registro de Bajas (Scrap) | El Operador debe poder declarar productos en mal estado o vencidos ingresando el motivo de la baja e historial de estados. | Alta |
| **RF-24** | Evidencia Fotográfica | El sistema debe permitir cargar y almacenar en base de datos imágenes de mercadería rota o dañada como comprobante físico de la baja. | Media |
| **RF-25** | Patrimonio Escolar | El Directivo debe poder reportar roturas de mobiliario o problemas de infraestructura (Patrimonio) generando tickets para su resolución por los supervisores. | Media |

### 7.2.8. Módulo de Informes y Mapas
| Identificador | Requerimiento Funcional | Descripción | Prioridad |
| :--- | :--- | :--- | :--- |
| **RF-26** | Dashboard y Visualización | El sistema debe presentar estadísticas de stock, egresos, vencimientos y estados de pedidos en un panel gráfico, además de georreferenciar las escuelas y zonas en un mapa. | Media |

---

## 7.3. Requerimientos No Funcionales (RNF)

Los requerimientos no funcionales definen los atributos de calidad del sistema:

### 7.3.1. Rendimiento y Eficiencia
- **RNF-01 (Tiempo de Respuesta)**: Las consultas de lectura en la API Express no deben superar los 500 milisegundos de tiempo de respuesta bajo condiciones normales de carga de red local.
- **RNF-02 (Concurrencia)**: El servidor Express bajo Node.js debe ser capaz de soportar hasta 100 peticiones concurrentes por segundo sin degradar significativamente el rendimiento, apoyado en el bucle de eventos asíncronos.

### 7.3.2. Usabilidad y Accesibilidad
- **RNF-03 (Interfaz Responsive)**: El diseño frontend en React debe adaptarse de forma fluida a dispositivos móviles (celulares y tablets) y computadoras de escritorio, utilizando técnicas de diseño responsivo.
- **RNF-04 (Pautas de Accesibilidad)**: La interfaz web debe cumplir con las pautas de accesibilidad WCAG 2.1 nivel AA (contraste de colores, etiquetas descriptivas para lectores de pantalla e interactividad por teclado), conforme a las exigencias de la legislación nacional para páginas del sector público.

### 7.3.3. Seguridad y Privacidad
- **RNF-05 (Cifrado de Datos Sensibles)**: Las contraseñas de los usuarios deben encriptarse obligatoriamente utilizando la función de derivación de claves Bcrypt con un costo de salting de 10 rondas antes de persistirse.
- **RNF-06 (Integridad de Tokens)**: Los Json Web Tokens (JWT) de sesión deben firmarse mediante un algoritmo HMAC-SHA256 con una clave secreta robusta almacenada en variables de entorno, y poseer un tiempo de expiración máximo de 8 horas.

### 7.3.4. Confiabilidad y Robustez
- **RNF-07 (Atomicidad de Transacciones)**: Todas las operaciones críticas de stock o estados de pedidos deben encapsularse en transacciones SQL de PostgreSQL, garantizando la consistencia ante caídas del servidor.
- **RNF-08 (Validación Semántica de Errores)**: El sistema debe validar de manera estricta las reglas de negocio antes de realizar egresos (verificación de stock suficiente y montos pendientes), retornando códigos HTTP `400` y descripciones funcionales del error en lugar de errores genéricos `500`.

### 7.3.5. Mantenibilidad y Portabilidad
- **RNF-09 (Mantenibilidad del Código)**: El código fuente del backend debe estar modularizado por responsabilidades (rutas, controladores, modelos, middlewares) y el frontend debe estructurarse mediante componentes React funcionales reutilizables.
- **RNF-10 (Compatibilidad Web)**: El frontend debe ser compatible con los navegadores modernos basados en Chromium (Google Chrome, Microsoft Edge) y Gecko (Mozilla Firefox) en sus versiones actualizadas.

## 7.4. Síntesis del Capítulo

En resumen, este capítulo ha detallado las especificaciones funcionales y técnicas del sistema DEPO. Se catalogaron 26 Requerimientos Funcionales, delimitando las acciones permitidas por módulo para cada uno de los roles del Ministerio de Educación de San Juan. Asimismo, se definieron 10 Requerimientos No Funcionales vinculados a los estándares de rendimiento, accesibilidad, seguridad, atomicidad y portabilidad de la plataforma. El establecimiento de estas especificaciones proporciona la base técnica e institucional necesaria para abordar en el Capítulo 8 el Diseño del Sistema, donde se detallarán los modelos de arquitectura y el diseño físico de la base de datos.
