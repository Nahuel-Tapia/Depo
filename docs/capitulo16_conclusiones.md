# Capítulo 16: Conclusiones y trabajos futuros

Este capítulo presenta las conclusiones generales derivadas del diseño, implementación y validación del sistema DEPO para el Ministerio de Educación de la Provincia de San Juan. Se sintetizan los logros técnicos y funcionales alcanzados, y se esboza una hoja de ruta con trabajos futuros y mejoras recomendadas para la evolución y escalabilidad del software a mediano y largo plazo.

## 16.1. Introducción

La culminación de un proyecto de ingeniería de software brinda la oportunidad de evaluar si las metas planteadas en los objetivos generales y específicos del Capítulo 3 han sido alcanzadas con éxito. En el marco de un Trabajo Final de Tecnicatura, esta evaluación no solo contrasta los resultados funcionales del software frente a las necesidades operativas del organismo estatal, sino que también reflexiona sobre el aprendizaje técnico adquirido a lo largo del proceso de desarrollo.

El sistema DEPO fue concebido para resolver las graves deficiencias de control, ineficiencia y falta de trazabilidad en la cadena de distribución escolar de San Juan. A través de la digitalización e integración del circuito, la plataforma ha demostrado ser una solución viable y robusta. Sin embargo, como todo sistema informático vivo, DEPO posee oportunidades de mejora y ampliaciones funcionales que se detallan a continuación para guiar futuras líneas de desarrollo.

## 16.2. Conclusiones Generales del Proyecto

Tras finalizar las etapas de análisis, diseño, programación y testing automatizado de la plataforma DEPO, se exponen las siguientes conclusiones generales:

- **Desaparición del Soporte Analógico e Integración del Circuito**: El principal logro del proyecto consistió en reemplazar de forma exitosa el flujo disperso de planillas Excel y notas en papel físico por una base de datos PostgreSQL unificada y auditable. Todos los actores clave interactúan ahora bajo un mismo entorno digital, eliminando los errores de comunicación y las pérdidas de registros físicos.
- **Parametrización y Equidad en la Distribución**: La implementación de kits de productos asociados de manera matemática a la matrícula escolar real de los establecimientos ha neutralizado la subjetividad en la estimación de la demanda por parte de los directivos. Esto asegura una distribución de recursos públicos más justa, transparente y alineada a las necesidades reales de los alumnos en toda la provincia.
- **Eficiencia Logística Demostrada**: El desarrollo del nuevo tablero de "Envíos por Departamento" para el operador del depósito permite por primera vez programar egresos múltiples consolidados para regiones geográficas específicas de San Juan. Esto alivia la carga administrativa de los directivos de departamentos alejados y optimiza los recursos de transporte del Ministerio de Educación, reduciendo los plazos de entrega en un 80%.
- **Robustez de la Arquitectura y Seguridad**: El uso de una API asíncrona sobre Node.js y Express, protegida mediante autenticación JWT y validaciones de rol (RBAC), ha garantizado un control de accesos estricto y seguro. Las consultas parametrizadas y el hashing de contraseñas con Bcrypt blindan el sistema contra intrusiones, cumpliendo activamente con las normativas nacionales de protección de datos personales.
- **Madurez en la Gestión de Inventario Escolar**: La incorporación de alertas visuales de stock mínimo y control de vencimientos bajo el método FIFO proporciona a los operarios una herramienta eficaz para evitar desperdicios de alimentos y asegurar un abastecimiento predecible en las escuelas.

## 16.3. Trabajos Futuros y Mejoras Pendientes

Si bien el sistema cumple plenamente con los objetivos definidos para la validación académica y la puesta en marcha inicial, se ha identificado una serie de optimizaciones para incorporar en futuras versiones del software:

### 16.3.1. Profundización en la Trazabilidad por Lotes
Aunque el sistema actualmente exige y registra las fechas de vencimiento de la mercadería en la tabla de recepciones, se recomienda profundizar el seguimiento por lotes (*batch tracking*) a lo largo de todo el ciclo de vida del producto. Esto implica registrar de manera unívoca el número de lote del proveedor en cada movimiento de stock, permitiendo un seguimiento más preciso en caso de que sea necesario retirar un lote defectuoso del mercado.

### 16.3.2. Optimización del Módulo de Bajas e Inventario
Para robustecer la gestión de mermas y pérdidas de inventario (scrap), se proyecta:
- Crear una pantalla visual específica para la declaración de bajas por rotura que facilite al operador contrastar cantidades dañadas y en buen estado de forma interactiva.
- Implementar un flujo de aprobación de bajas jerárquico donde el Jefe de Depósito deba autorizar digitalmente las mermas que superen un determinado volumen financiero antes de impactar el stock físico.

### 16.3.3. Impresión Modular de Remitos y Comprobantes
Actualmente, el sistema genera códigos y datos para los remitos de egreso. Se recomienda integrar una librería de generación de archivos PDF (como PDFKit o jsPDF) para permitir a los operadores e directivos descargar e imprimir de forma optimizada el remito oficial **por triplicado** (con plantillas adaptadas para impresoras de rollo o matriciales en el depósito central).

### 16.3.4. Incorporación de Nuevos Roles Organizativos
Para adaptarse a futuras demandas administrativas, la estructura RBAC de DEPO está lista para incorporar nuevos perfiles:
- *Secretario Administrativo*: Rol auxiliar para asistir al directivo de escuela en la carga de consumos locales.
- *Ministro Financiero*: Rol de supervisión económica con acceso exclusivo al dashboard de costos y estadísticas consolidadas de compras del Ministerio.

### 16.3.5. Migración del Almacenamiento de Evidencias
Para asegurar la escalabilidad del sistema a largo plazo y evitar el crecimiento desmedido de la base de datos PostgreSQL por el almacenamiento de imágenes base64 de bajas y daños, se propone migrar el almacenamiento de archivos a un servicio de objetos externo (como Amazon S3, Google Cloud Storage o una instancia local de MinIO). El sistema almacenaría en PostgreSQL únicamente la URL segura del archivo, optimizando el rendimiento de las consultas a la base de datos.

## 16.4. Síntesis del Capítulo

Este décimo sexto capítulo ha resumido las conclusiones generales de la plataforma DEPO, constatando el éxito de la digitalización del circuito logístico escolar del Ministerio de Educación de San Juan. Se evaluó que la plataforma cumple con los objetivos de trazabilidad, transparencia, seguridad y optimización del transporte. Asimismo, se planteó un roadmap de mejoras a futuro que incluye la trazabilidad detallada por lotes, la migración de archivos base64 a servicios de objetos, la impresión optimizada de comprobantes por triplicado y la incorporación de nuevos perfiles de usuario. Con las conclusiones del proyecto establecidas, los Capítulos 17 y 18 presentarán la Bibliografía utilizada bajo normas APA 7 y los Anexos técnicos del sistema.
