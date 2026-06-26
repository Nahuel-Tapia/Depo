# Capítulo 2: Planteamiento del problema y justificación

Este capítulo profundiza en el diagnóstico de la situación problemática que dio origen al sistema DEPO. Se exponen de manera detallada las ineficiencias del modelo de gestión analógico y descentralizado del Ministerio de Educación de la Provincia de San Juan, desglosando los impactos negativos en los procesos de adquisición, almacenamiento, control patrimonial y distribución. Asimismo, se formulan la justificación técnica, metodológica, económica e institucional de la solución implementada.

## 2.1. Planteamiento del problema

La administración del flujo de suministros y bienes de consumo en una organización estatal que supervisa cientos de establecimientos educativos distribuidos en una amplia extensión territorial implica desafíos de gran envergadura. En la provincia de San Juan, el Ministerio de Educación se enfrenta a la tarea de abastecer a escuelas que varían notablemente en su infraestructura, matrícula y ubicación geográfica. La coexistencia de escuelas céntricas con escuelas rurales, de frontera y albergues genera demandas altamente diversificadas y críticas.

El problema central radica en la **inexistencia de un sistema de información integrado, auditable y en tiempo real** que controle la cadena de suministro escolar en todas sus fases, desde la estimación de la demanda de cada establecimiento hasta la entrega efectiva y el control de inventario final. Esta carencia da lugar a una serie de fricciones operativas, administrativas y de control que se detallan a continuación.

## 2.2. Desglose de Ineficiencias Operativas y Falta de Control

Para comprender la magnitud de la problemática en el organismo, es necesario analizar las ineficiencias presentes en cada eslabón del circuito de distribución tradicional:

### 2.2.1. Ineficiencia en la Estimación de la Demanda e Información Asimétrica
Bajo el esquema analógico, la formulación de los pedidos anuales por parte de los directivos escolares se realizaba de manera estimativa, careciendo de un marco paramétrico estandarizado. Cada directivo solicitaba insumos en base a percepciones históricas o criterios subjetivos, lo que generaba:
- **Sobreasignación de recursos**: Escuelas que acumulaban stock ocioso en sus armarios.
- **Desabastecimiento**: Escuelas que se quedaban sin insumos básicos a mitad del ciclo lectivo.
- **Inexistencia de kits normalizados**: No se utilizaban agrupaciones de productos estructurados según la tipología institucional y la matrícula real de alumnos, impidiendo una distribución justa y equitativa.

### 2.2.2. Falta de Trazabilidad y Seguridad en el Depósito Central
El almacenamiento físico carecía de herramientas digitales para registrar y auditar los movimientos de stock en tiempo real. Esta situación provocaba:
- **Pérdida de inventario y falta de control de vencimientos**: Alimentos destinados a comedores escolares y escuelas albergue se vencían en los estantes del depósito central debido a la falta de un sistema de alertas tempranas y un control de lotes bajo el método PEPS (Primero en Entrar, Primero en Salir).
- **Incertidumbre en existencias**: Los operadores no contaban con certeza sobre el stock real en el depósito, lo que entorpecía la planificación del área de Compras.
- **Vulnerabilidad de auditoría**: El registro de movimientos manuales en papel dificultaba la reconstrucción histórica del flujo de un producto ante auditorías del Tribunal de Cuentas.

### 2.2.3. Barreras Logísticas en Escuelas de Departamentos Alejados
El retiro presencial era la modalidad predeterminada, obligando a los directivos de zonas periféricas o departamentos alejados (como Valle Fértil, Jáchal, Iglesia o Calingasta) a viajar cientos de kilómetros hasta la Capital para retirar sus insumos. Esto conllevaba:
- **Pérdida de jornadas pedagógicas**: Los directivos debían abandonar sus funciones escolares para realizar trámites logísticos.
- **Costos de traslado particulares**: El uso de movilidad propia o fletes particulares costeados por cooperadoras escolares.
- **Subutilización de la flota oficial**: El Ministerio de Educación no podía programar envíos consolidados y eficientes por departamento geográfico debido a la falta de un tablero que agrupara las solicitudes de entrega pendientes en una misma región y permitiera programar egresos múltiples organizados.

### 2.2.4. Ausencia de Trazabilidad en Bajas de Material y Mobiliario Dañado
El descarte de mercadería dañada, vencida o inutilizable (scrap/desguace) se realizaba de manera informal. El personal no disponía de un módulo sistematizado para registrar las bajas con su respectivo motivo e historial de estados, ni de un mecanismo para adjuntar evidencia fotográfica del daño. Esto impedía diferenciar claramente los productos aptos de los defectuosos y fomentaba la acumulación de chatarra patrimonial en las escuelas sin un canal de desvinculación formal.

### 2.2.5. Gestión Patrimonial Desconectada y Falta de Canal de Reclamos
Las escuelas no contaban con un canal ágil para reportar daños en el mobiliario escolar (bancos, mesas, armarios). Los incidentes patrimoniales debían comunicarse por notas físicas en papel que debían recorrer un largo circuito burocrático hasta la Dirección de Relevamiento de Necesidades Edilicias o el área de Patrimonio del Ministerio. Como consecuencia, las reparaciones o sustituciones se demoraban meses, afectando el dictado normal de clases.

### 2.2.6. Vacíos en la Toma de Decisiones del Área de Compras
El departamento de compras operaba de forma aislada a la realidad del depósito central y de las escuelas:
- **Licitaciones a ciegas**: Se consolidaban cantidades para licitación sin poder contrastar la demanda total frente al stock actual disponible en el depósito central, incurriendo en compras redundantes de productos ya existentes en bodega.
- **Historial de precios inexistente**: No se contaba con un registro digitalizado de los precios unitarios reales de compra adjudicados en licitaciones de años anteriores, lo que impedía evaluar la evolución de costos y la razonabilidad de las ofertas de los proveedores.

## 2.3. Justificación Técnica y Metodológica

Desde la perspectiva del desarrollo de software, la creación de DEPO se justifica mediante la implementación de una arquitectura cliente-servidor robusta y moderna, estructurada bajo estándares técnicos que garantizan la mantenibilidad y escalabilidad del sistema. 

El uso de **Node.js y Express** en el backend proporciona un entorno de ejecución de alto rendimiento para el manejo de múltiples solicitudes simultáneas de los distintos departamentos. La base de datos relacional **PostgreSQL** permite modelar con precisión la compleja red de relaciones jerárquicas del sistema (instituciones, zonas, usuarios, roles, pedidos, licitaciones y movimientos de stock), asegurando la integridad referencial y facilitando auditorías detalladas a través de índices optimizados y restricciones de control (*check constraints*).

En el frontend, la utilización de **React y Vite** permite construir una interfaz de usuario dinámica, fluida e interactiva. La integración de librerías como **Recharts** para el módulo de estadísticas y **Leaflet** para la geolocalización de escuelas y zonas optimiza la visualización de la información para la toma de decisiones por parte de los directivos de área y el Ministerio. La metodología ágil **Scrum** proporciona el marco de desarrollo adecuado para iterar de manera incremental, validando cada módulo funcional en estrecha colaboración con el usuario final.

## 2.4. Justificación Económica e Institucional

A nivel institucional y económico, la inversión en el desarrollo del sistema DEPO genera un impacto directo en las finanzas de la administración pública provincial:

- **Reducción del Gasto en Adquisiciones**: Al unificar la licitación y permitirle al área de compras cotejar la demanda contra el stock físico real disponible en el depósito central, se evitan sobrecompras y se aprovecha la economía de escala en las negociaciones con los proveedores.
- **Optimización Logística y Ahorro en Combustible**: El nuevo módulo de "Envío por Departamento" permite agrupar solicitudes y planificar entregas masivas utilizando de forma eficiente la flota vehicular del Ministerio. Esto disminuye significativamente los costos de viáticos y combustible, a la vez que alivia la carga financiera y operativa de los directivos escolares de departamentos alejados.
- **Seguridad Alimentaria y Sanitaria**: El control estricto de fechas de vencimiento y alertas de stock mínimo reduce drásticamente el desperdicio de productos perecederos (como copas de leche y raciones alimentarias para escuelas de jornada completa y albergues), asegurando que los insumos lleguen a los alumnos en condiciones óptimas.
- **Transparencia y Rendición de Cuentas**: Al digitalizar el circuito de aprobaciones (Directivo → Supervisor → Director de Área) y registrar con precisión la adjudicación de proveedores y la emisión de remitos por triplicado (escuela, depósito y Tribunal de Cuentas), el Ministerio de Educación de San Juan fortalece sus mecanismos de control interno y agiliza la rendición ante los organismos de fiscalización del Estado.

## 2.5. Síntesis del Capítulo

En conclusión, este segundo capítulo ha expuesto detalladamente los problemas crónicos del circuito logístico tradicional de suministros del Ministerio de Educación de San Juan, identificando ineficiencias en el control de stock, la estimación de la demanda, la distribución en departamentos alejados y la gestión patrimonial. La justificación presentada demuestra que DEPO no es únicamente un desarrollo técnico para el cumplimiento académico, sino una herramienta indispensable para mejorar la eficiencia del gasto público, garantizar el correcto abastecimiento en las aulas y brindar total transparencia a los procesos logísticos y de compras del Estado provincial. Con el problema plenamente formulado y justificado, el próximo capítulo establecerá los objetivos generales y específicos que guiarán el diseño detallado del sistema.
