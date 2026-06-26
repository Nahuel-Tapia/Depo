# Capítulo 6: Metodología de desarrollo

Este capítulo describe la metodología y el ciclo de vida de desarrollo de software (SDLC) aplicados para la planificación, construcción y validación del sistema DEPO. Se detalla la adopción del marco de trabajo ágil Scrum, definiendo los roles intervinientes, la duración y estructura de los sprints, las ceremonias realizadas y los artefactos de control producidos a lo largo del proyecto.

## 6.1. Introducción

La ingeniería de software moderna establece que el éxito de un desarrollo no depende únicamente de la destreza técnica de los programadores o del stack tecnológico seleccionado, sino principalmente del orden metodológico implementado para gestionar el cambio y entregar valor de forma incremental. En entornos gubernamentales, donde los requerimientos pueden verse influenciados por normativas vigentes, dinámicas institucionales u operativas cambiantes, las metodologías ágiles ofrecen la flexibilidad necesaria para adaptarse a las necesidades reales sin comprometer la calidad del producto final.

Para el desarrollo del sistema DEPO, se seleccionó un ciclo de vida incremental e iterativo estructurado bajo el marco de trabajo **Scrum**. Esta metodología facilitó la división del sistema en módulos funcionales mínimos viables que pudieron ser desarrollados, probados e integrados de forma consecutiva. De este modo, se evitó la rigidez del modelo tradicional en cascada (*Waterfall*), permitiendo al equipo reaccionar rápidamente ante comentarios y sugerencias del Ministerio de Educación de San Juan y de la cátedra de la Tecnicatura de la UCCuyo.

## 6.2. Ciclo de Vida del Desarrollo de Software (SDLC)

El proyecto adoptó un modelo de ciclo de vida **iterativo e incremental**. A diferencia del enfoque secuencial, este modelo asume que el sistema se construye a través de aproximaciones sucesivas (iteraciones), donde cada ciclo lectivo o fase de desarrollo produce una versión operativa del software enriquecida con respecto a la anterior (incremento). 

Las etapas del ciclo de vida seguidas en cada iteración incluyeron:
1. **Planificación y Análisis**: Definición de los objetivos de la iteración y especificación de requerimientos detallados.
2. **Diseño de Arquitectura y Datos**: Diseño del esquema de base de datos relacional y definición de las firmas de los endpoints de la API.
3. **Codificación**: Desarrollo de componentes en el frontend y controladores/middlewares en el backend.
4. **Pruebas e Integración**: Ejecución de smoke checks e integración del código en la rama principal.
5. **Revisión y Retrospectiva**: Demostración de las funcionalidades al usuario o evaluadores y evaluación de mejoras en el proceso de trabajo.

## 6.3. Adaptación del Marco Scrum al Proyecto

El desarrollo del sistema DEPO se estructuró adaptando los roles, ceremonias y artefactos definidos en la Guía Oficial de Scrum a la escala de un Trabajo Final de Tecnicatura:

### 6.3.1. Roles de Scrum en el Proyecto
Dada la escala del proyecto, la asignación de roles se adaptó de la siguiente manera:
- **Product Owner (PO)**: Representado por los referentes técnicos y logísticos de la Dirección de Suministros y del Depósito Central del Ministerio de Educación de San Juan. Su rol consistió en definir las necesidades de negocio (ej. la incorporación del flujo de envío por departamento o la gestión de remitos parciales), priorizar el Product Backlog y validar que los incrementos de software resolvieran sus necesidades.
- **Scrum Master (SM)**: Ejercido por el estudiante/desarrollador, responsable de asegurar la adherencia a la metodología ágil, remover impedimentos técnicos y de comunicación, y garantizar la consistencia técnica de las entregas académicas ante la UCCuyo.
- **Equipo de Desarrollo (Developers)**: Conformado por el estudiante de desarrollo, encargado de codificar el frontend, el backend, estructurar la base de datos PostgreSQL e implementar las pruebas de humo automatizadas.
- **Stakeholders (Interesados)**: Compuesto por los directivos de las escuelas piloto de San Juan, los supervisores zonales y los docentes evaluadores de la universidad, quienes brindaron feedback valioso sobre la usabilidad y adecuación normativa de la plataforma.

### 6.3.2. Sprints (Iteraciones)
El desarrollo del proyecto se dividió en **8 Sprints** consecutivos, con una duración fija de **2 semanas** (10 días hábiles) por sprint. Este marco temporal permitió mantener un ritmo de desarrollo constante y asegurar entregas periódicas de valor funcional.

### 6.3.3. Ceremonias de Scrum
Para coordinar el trabajo y asegurar la inspección y adaptación constante, se simularon y llevaron a cabo las siguientes ceremonias:
- **Sprint Planning (Planificación del Sprint)**: Realizada al inicio de cada sprint para definir el *Sprint Goal* (Meta del Sprint) y seleccionar los elementos del Product Backlog que el desarrollador se comprometía a implementar, desglosándolos en tareas técnicas concretas dentro del *Sprint Backlog*.
- **Daily Scrum (Reunión Diaria)**: Reuniones rápidas de sincronización diaria auto-gestionadas por el desarrollador para evaluar el avance respecto al Sprint Goal y detectar impedimentos (por ejemplo, problemas de integración en la visualización de los mapas de Leaflet o de rendimiento en base de datos).
- **Sprint Review (Revisión del Sprint)**: Reunión de fin de Sprint donde se presentaba el incremento de software funcional al Product Owner y asesores académicos, obteniendo su feedback directo y validando las historias de usuario terminadas.
- **Sprint Retrospective (Retrospectiva del Sprint)**: Espacio de análisis al cierre del Sprint enfocado en evaluar la efectividad de las herramientas de desarrollo, la calidad del código y la velocidad de entrega, definiendo acciones concretas de mejora para el siguiente ciclo.

### 6.3.4. Artefactos de Scrum
- **Product Backlog (Pila del Producto)**: Lista ordenada y viva de todas las funcionalidades, mejoras, correcciones y requisitos técnicos pendientes del sistema. Administrado en formato digital y priorizado según el valor de negocio de la Dirección de Suministros.
- **Sprint Backlog (Pila del Sprint)**: Conjunto de historias de usuario y tareas técnicas seleccionadas para el sprint en curso.
- **Incremento (Increment)**: El resultado de cada sprint, consistente en un software funcional, integrado y testeado que cumple estrictamente con la definición de terminado (*Definition of Done - DoD*).
- **Definition of Done (DoD)**: El incremento se considera terminado si cumple con: compilación sin errores del frontend React y backend Node.js, paso exitoso de las validaciones de base de datos PostgreSQL, ausencia de vulnerabilidades críticas de seguridad, y aprobación funcional visual por parte del Product Owner.

## 6.4. Cronograma de Sprints y Roadmap del Proyecto

La construcción del sistema DEPO se estructuró a lo largo de 16 semanas operativas (8 Sprints) de la siguiente manera:

- **Sprint 1: Cimiento Arquitectónico y Seguridad**
  - Meta: Configurar el entorno de desarrollo y la base del sistema de usuarios.
  - Resultados: Inicialización de la API Express y app React, creación del esquema de base de datos inicial y desarrollo del módulo de autenticación JWT y control de roles (RBAC).
- **Sprint 2: Estructura Organizativa y Catálogo**
  - Meta: Implementar la base territorial e institucional de San Juan.
  - Resultados: ABM de Edificios (con geolocalización), Instituciones, Productos, Categorías y asignación de zonas geográficas a supervisores.
- **Sprint 3: Planificación Anual y Circuito de Avales**
  - Meta: Digitalizar el proceso de solicitudes anuales de insumos.
  - Resultados: Módulo de creación de kits, generación de solicitudes parametrizadas por matrícula escolar, y bandeja de revisión/aprobación para Supervisores y Directores de Área.
- **Sprint 4: Módulo de Compras y Licitaciones**
  - Meta: Digitalizar la consolidación de demanda e interacción comercial.
  - Resultados: Consolidación de planillas anuales a licitar, ABM de Proveedores, módulo de carga de precios y adjudicación automática a la oferta más económica.
- **Sprint 5: Logística de Recepción y Control de Bodega**
  - Meta: Controlar el ingreso físico de insumos al depósito.
  - Resultados: Módulo de remitos de licitación por camión, ingresos parciales, control de existencias por depósitos múltiples e implementación de alertas por vencimientos de lotes (FIFO).
- **Sprint 6: Distribución y Egreso Zonal (Modalidades de Entrega)**
  - Meta: Facilitar el despacho a escuelas optimizando la logística de transporte.
  - Resultados: Implementación de la solicitud de retiro presencial con código de barras/código de seguridad, y desarrollo del tablero de "Envío por Departamento" con egreso múltiple consolidado.
- **Sprint 7: Bajas de Stock y Control Patrimonial**
  - Meta: Asegurar la trazabilidad en descartes y reclamos físicos.
  - Resultados: Módulo de bajas de mercadería deteriorada (scrap) con almacenamiento de fotos en base64 y justificación, y sistema de tickets de patrimonio escolar.
- **Sprint 8: Visualización, Pruebas de Humo y Cierre**
  - Meta: Incorporar soporte analítico, validar el software y cerrar el desarrollo.
  - Resultados: Implementación de reportes gráficos y georreferenciación interactiva en el Dashboard de Direcciones de Área, ejecución de smoke tests automatizados y documentación del sistema.

## 6.5. Síntesis del Capítulo

En resumen, la adopción del marco metodológico Scrum permitió guiar el desarrollo del sistema DEPO bajo una perspectiva de entrega iterativa, incremental y enfocada en el usuario. La estructuración del roadmap en 8 sprints quincenales aseguró que las complejidades logísticas, de compras y de patrimonio fuesen abordadas de forma progresiva, garantizando la integración continua y el testeo constante de la plataforma. Con la metodología de desarrollo plenamente definida, el Capítulo 7 abordará el Análisis de Requerimientos, detallando los requerimientos funcionales y no funcionales que rigieron el diseño técnico de la plataforma.
