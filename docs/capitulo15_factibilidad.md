# Capítulo 15: Análisis de factibilidad

Este capítulo expone el análisis de factibilidad y viabilidad del sistema DEPO para el Ministerio de Educación de la Provincia de San Juan. Se evalúan tres dimensiones fundamentales: la factibilidad técnica (disponibilidad de tecnologías y competencias de soporte), la factibilidad económica (costos de desarrollo, hosting, ahorros operativos y retorno de inversión) y la factibilidad operativa (adecuación a la cultura organizacional del organismo y aceptación por parte de los usuarios).

## 15.1. Introducción

Antes de proceder a la adopción definitiva de una solución tecnológica en una organización estatal, resulta indispensable realizar un estudio de factibilidad que evalúe si el proyecto es realizable, financieramente sostenible y operativo para el día a día institucional. Las decisiones de digitalización no deben sustentarse únicamente en criterios de modernización, sino en análisis objetivos de costo-beneficio y adecuación técnica.

En el caso de DEPO, al tratarse de un software orientado a centralizar la logística escolar en San Juan, la factibilidad evalúa el impacto que tiene la plataforma tanto en la infraestructura física del Ministerio de Educación como en la operatoria de sus agentes distribuidos en el territorio. Las secciones siguientes desglosan cada una de estas dimensiones de viabilidad.

## 15.2. Factibilidad Técnica

La factibilidad técnica evalúa si los recursos tecnológicos disponibles y los conocimientos del equipo de desarrollo e infraestructura son adecuados para implementar, alojar y mantener la plataforma.

- **Stack Tecnológico Estándar y Maduro**: React, Node.js y PostgreSQL son tecnologías sumamente extendidas y consolidadas en el mercado. Esto garantiza que la Dirección de Informática del Ministerio de Educación no dependa de un único proveedor para el mantenimiento futuro, existiendo una amplia disponibilidad de profesionales capacitados en este stack técnico.
- **Herramientas de Código Abierto (Open Source)**: Ninguno de los componentes requeridos (Node.js, PostgreSQL, Linux, Nginx, Leaflet) exige el pago de licencias comerciales de software. Esto elimina barreras presupuestarias iniciales y recurrentes.
- **Compatibilidad con Infraestructura Provincial**: El sistema no exige hardware de altas prestaciones ni servidores propietarios. El despliegue es completamente compatible con las infraestructuras de virtualización estándar basadas en servidores Linux operadas en el Centro de Cómputos de San Juan.
- **Competencias Técnicas del Desarrollador**: Los conocimientos adquiridos durante la carrera de desarrollo de software en la UCCuyo capacitan al desarrollador para programar la lógica del backend, el diseño de la base de datos relacional y los componentes reactivos del frontend, habiéndose completado exitosamente la fase de programación y validación funcional.

Por consiguiente, se determina que el proyecto presenta una **alta factibilidad técnica**.

---

## 15.3. Factibilidad Económica

La factibilidad económica evalúa los costos asociados al desarrollo, puesta en marcha y mantenimiento del software, contrastándolos con los beneficios financieros y operativos (retorno de inversión - ROI) que percibe el organismo.

### 15.3.1. Costos de Desarrollo y Puesta en Marcha
Dado que el proyecto se encuadra en un Trabajo Final de Tecnicatura, el costo de desarrollo para el Ministerio de Educación es **nulo (sin costo)**. No obstante, para fines analíticos, se presenta una estimación del valor de mercado de una solución equivalente construida a medida por una consultora de software en la República Argentina:
- **Fase de Análisis y Diseño de Base de Datos**: $1.500 USD.
- **Programación Backend (API Express) y Seguridad (JWT/RBAC)**: $4.500 USD.
- **Programación Frontend (SPA React) e Integración Geográfica**: $4.500 USD.
- **Fase de QA/Testing y Pruebas con Playwright**: $1.500 USD.
- **Capacitación, Documentación y Despliegue**: $1.500 USD.
- **Costo de Mercado Total Estimado**: **$13.500 USD**.

### 15.3.2. Costos de Infraestructura y Mantenimiento Recurrente
Al alojarse en el Centro de Cómputos Provincial o en servidores existentes del Ministerio, los costos de infraestructura adicionales se consideran marginales o nulos:
- **Costo de Licencias**: $0 USD (software open source).
- **Costo de Alojamiento (Hosting)**: Integrado en el presupuesto general de IT del Gobierno de San Juan.

### 15.3.3. Beneficios Económicos y Ahorros Operativos (ROI)
La implementación de DEPO genera ahorros significativos que amortizan rápidamente la inversión simulada del software:
- **Ahorro en Combustible y Viáticos de Logística**: Al consolidar las cargas y despachos en el tablero de "Envíos por Departamento", se reduce el número de viajes oficiales del Ministerio de Educación y se elimina la necesidad de que los directivos escolares se trasladen de forma particular desde departamentos alejados (ej. Calingasta o Valle Fértil) al depósito central. Esto representa una reducción estimada del 30% en viáticos de transporte logístico.
- **Optimización de Licitaciones de Compras**: El sistema de compras permite contrastar la demanda total parametrizada frente al stock actual disponible en el depósito central. Esto evita la adquisición de insumos redundantes, generando un ahorro presupuestario directo estimado en un 15% en las compras de resmas de papel, útiles y artículos de limpieza.
- **Reducción de Pérdidas por Vencimiento**: Las alertas visuales tempranas y el control de lotes bajo el método FIFO reducen al mínimo el desperdicio de alimentos y productos lácteos perecederos para comedores escolares.

Por lo tanto, se concluye que el sistema posee una **excelente factibilidad económica**, arrojando un retorno de inversión altamente positivo para el presupuesto de educación provincial.

---

## 15.4. Factibilidad Operativa

La factibilidad operativa analiza el nivel de aceptación, adaptabilidad y facilidad de uso que presentará la plataforma para los agentes públicos del Ministerio.

- **Respeto a la Estructura Jerárquica Existente**: El circuito digital de autorizaciones (Directivo solicita → Supervisor avala → Director de Área autoriza) calca exactamente el organigrama y flujo administrativo actual del Ministerio. Esto reduce la resistencia al cambio, ya que los usuarios no deben aprender nuevos circuitos de poder, sino operar el circuito conocido de forma digital y ágil.
- **Reducción del Esfuerzo Administrativo**: Los directivos escolares no necesitan realizar cálculos manuales para estimar sus necesidades de insumos, ya que el sistema calcula automáticamente las sugerencias basándose en su matrícula cargada y kits preestablecidos. Asimismo, los operarios de depósito cuentan con un tablero simplificado agrupado para gestionar despachos consolidados.
- **Interfaz de Usuario Intuitiva y Responsiva**: El diseño frontend en React con variables de diseño CSS optimizadas asegura pantallas legibles, con menús que se adaptan dinámicamente según el rol. El plan de capacitación estructurado en el Capítulo 14 mitiga las barreras de alfabetización digital en personal de mayor antigüedad.

Por lo tanto, la **factibilidad operativa del sistema es sumamente favorable**.

## 15.5. Síntesis del Capítulo

Este décimo quinto capítulo ha demostrado la viabilidad integral de la plataforma DEPO. Se determinó que el proyecto presenta factibilidad técnica gracias a la madurez de React, Node.js y PostgreSQL, y a que no genera costos de licencias comerciales. El análisis económico demostró que, aunque el desarrollo para el Ministerio de Educación es gratuito por su carácter académico, el software generará importantes ahorros en viáticos de transporte escolar y optimización de licitaciones públicas de insumos. Por último, la adecuación operativa al organigrama oficial y la simplificación de tareas aseguran una alta adopción de la herramienta por parte de los funcionarios de San Juan. Habiéndose verificado la factibilidad del proyecto, el Capítulo 16 expondrá las Conclusiones de la documentación y los trabajos futuros a desarrollar.
