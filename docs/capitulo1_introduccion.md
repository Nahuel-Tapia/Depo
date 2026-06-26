# Capítulo 1: Introducción y contexto institucional

Este capítulo presenta una visión general del sistema DEPO, delimitando su propósito como herramienta tecnológica de gestión de stock, pedidos y distribución. Asimismo, se describe la estructura del Ministerio de Educación de la Provincia de San Juan como organismo contratante y beneficiario directo, analizando su alcance geográfico e institucional y examinando el flujo tradicional de la cadena de suministro escolar que motivó la concepción del proyecto.

## 1.1. Introducción

En el ámbito de la gestión pública provincial, la administración eficiente de los recursos materiales destinados a las instituciones educativas representa un pilar fundamental para garantizar la equidad y la calidad del servicio escolar. La provisión regular de insumos de limpieza, papelería, librería, alimentos para comedores y mobiliario escolar requiere de un esfuerzo coordinado de planificación, adquisición y distribución física. Históricamente, estos procesos logísticos se han enfrentado a problemáticas complejas de coordinación e información asimétrica entre los establecimientos demandantes, las dependencias de supervisión intermedia, el área de compras y los operarios del depósito central.

El proyecto **DEPO** surge como una solución tecnológica integral diseñada específicamente para digitalizar, trazar y optimizar el ciclo de abastecimiento del Ministerio de Educación de la Provincia de San Juan. A través de una plataforma web estructurada con un control de accesos basado en roles (RBAC - *Role-Based Access Control*), el sistema integra a todos los actores clave del circuito: directivos de escuelas, supervisores zonales, directores de área, personal técnico del departamento de compras y operadores del depósito de almacenamiento. 

A diferencia de los sistemas genéricos de control de inventario, DEPO incorpora la lógica de negocio particular de la administración escolar pública argentina, tales como el diseño de kits preconfigurados por matrícula de alumnos, la validación jerárquica de solicitudes extraordinarias (pedidos de refuerzo), el circuito de licitación y adjudicación pública a proveedores, y la distribución territorializada por departamento geográfico. De esta manera, el sistema no solo controla las existencias físicas en el depósito central, sino que también funciona como un canal de auditoría y transparencia para el uso de los bienes del Estado.

## 1.2. Contexto Institucional del Ministerio de Educación de San Juan

El Ministerio de Educación de la Provincia de San Juan, con sede en el Centro Cívico de la ciudad capital de San Juan, es el organismo gubernamental responsable de planificar, ejecutar y evaluar las políticas educativas de la provincia. Su misión principal es asegurar el derecho constitucional de enseñar y aprender, garantizando una educación inclusiva y de calidad en todo el territorio provincial.

Para cumplir con sus objetivos, el Ministerio cuenta con una estructura jerárquica encabezada por el Ministro de Educación, secundado por secretarías técnicas y administrativas. La administración física y distribución de recursos para las escuelas depende operativamente de la **Subsecretaría de Coordinación Administrativa y Financiera**, a través de su **Dirección de Suministros** y del **Depósito Central del Ministerio de Educación**.

El alcance logístico del organismo es vasto y complejo debido a la heterogeneidad geográfica de la provincia de San Juan, la cual se organiza en 19 departamentos: Capital, Rawson, Chimbas, Rivadavia, Santa Lucía, Pocito, Caucete, Jáchal, Albardón, Sarmiento, 25 de Mayo, San Martín, Calingasta, 9 de Julio, Iglesia, Valle Fértil, Ullum, Zonda y Angaco. El sistema escolar debe abastecer tanto a grandes conglomerados urbanos (Gran San Juan) como a escuelas ubicadas en zonas de cordillera y alta montaña (ej. departamentos de Iglesia y Calingasta) o áreas rurales dispersas (ej. Valle Fértil).

Las instituciones educativas beneficiarias se clasifican según diversos niveles y modalidades:
- **Educación Inicial (ENI)**.
- **Educación Primaria**.
- **Educación Secundaria Orientada y Artística**.
- **Educación Técnica y de Formación Profesional**.
- **Educación Especial**.
- **Escuelas de Capacitación Laboral**.
- **Escuelas Albergue y de Contexto de Encierro**.

Cada una de estas tipologías institucionales posee necesidades específicas de insumos y una frecuencia de consumo diferenciada, condicionada fuertemente por su matrícula escolar (número de estudiantes registrados) y su ubicación geográfica. Por ejemplo, las Escuelas Albergue requieren no solo insumos de limpieza y librería, sino también provisiones alimentarias y de hotelería complejas que exigen un control estricto de vencimientos y una entrega prioritaria.

## 1.3. Estructura de la Cadena de Suministro Escolar y Flujo Logístico Inicial

Previo a la conceptualización y desarrollo del sistema DEPO, la cadena de suministro y distribución de insumos del Ministerio de Educación operaba mediante un esquema tradicional de soporte analógico, caracterizado por planillas de cálculo descentralizadas, notas en papel físico, llamadas telefónicas y gestiones presenciales. Este flujo tradicional presentaba las siguientes etapas:

1. **Relevamiento de Necesidades**: Cada directivo escolar estimaba de forma anual o semestral la cantidad de insumos requerida para su establecimiento. Dicha estimación solía realizarse de manera informal, sin un algoritmo de cálculo que vinculase de manera directa la matrícula real del establecimiento con un estándar técnico de consumo. Las solicitudes se plasmaban en planillas de papel denominadas "Notas de Pedido".
2. **Autorización Intermedia (Supervisión)**: Las Notas de Pedido debían ser entregadas físicamente a la oficina del Supervisor de la zona correspondiente. El supervisor evaluaba la razonabilidad del pedido de forma subjetiva, firmando el documento en conformidad. Ante la falta de datos históricos centralizados, el control de cupos o excesos resultaba inviable.
3. **Consolidación en la Dirección de Área**: Las áreas ministeriales (Dirección de Educación Primaria, Dirección de Educación Secundaria, etc.) recibían las solicitudes autorizadas de sus respectivos supervisores. El personal administrativo consolidaba los requerimientos en un archivo de Excel unificado para elevarlo al departamento de compras. Este proceso manual era propenso a errores de transcripción y pérdida de registros físicos.
4. **Adjudicación y Compra**: El área de Compras abría un expediente de licitación pública basándose en el consolidado general de Excel. Los proveedores presentaban ofertas en sobres cerrados y, tras la adjudicación, entregaban los productos de manera directa o en el Depósito Central del Ministerio. La falta de vinculación entre lo comprado y lo solicitado originalmente dificultaba la detección de faltantes o desvíos en el momento de la entrega.
5. **Recepción e Inventariado**: En el Depósito Central, los operadores registraban la llegada de camiones con mercadería anotando las entregas en libros de actas manuales o planillas locales. No existía una trazabilidad en tiempo real sobre la fecha de vencimiento de los productos perecederos (ej. alimentos para comedores) ni alertas sobre el stock mínimo de insumos de alta demanda.
6. **Distribución Física**: Los directivos de las escuelas debían trasladarse físicamente al Depósito Central, en muchas ocasiones utilizando movilidad propia o contratada de forma particular, para retirar los insumos adjudicados. El remito de egreso se firmaba por duplicado en papel autocopiativo. Si la escuela solicitaba el envío debido a la distancia (ej. escuelas de departamentos alejados), el armado de las hojas de ruta y la consolidación de cargas se coordinaban manualmente, generando demoras en los plazos de entrega y subutilización de la flota de transporte provincial.

Este flujo logístico fragmentado y analógico generaba un alto costo administrativo, demoras en el abastecimiento escolar, falta de control patrimonial y una severa falta de transparencia y auditoría en la entrega de bienes estatales.

## 1.4. Justificación de la Intervención Tecnológica en el Organismo

La digitalización integral del flujo logístico a través de DEPO se justifica desde múltiples dimensiones dentro de la gestión pública del Ministerio de Educación de San Juan:

- **Optimización de Recursos Públicos**: Al vincular la entrega de insumos a parámetros objetivos (matrícula escolar y kits técnicos preconfigurados por Dirección de Área), se evita la sobreasignación de recursos a ciertas instituciones y el desabastecimiento en otras, maximizando el rendimiento presupuestario de las licitaciones estatales.
- **Trazabilidad y Auditoría**: Cada movimiento de stock (ingresos, egresos por entrega presencial, egresos por departamento geográfico, traslados entre depósitos o ajustes por baja) queda registrado con el usuario responsable, la fecha exacta y el documento respaldatorio (remito o ticket). Esto cumple con las exigencias del Tribunal de Cuentas de la provincia respecto a la fiscalización del patrimonio público.
- **Reducción de Costos Operativos y Plazos**: La automatización de la consolidación de solicitudes para licitaciones y la generación digital de las hojas de distribución por departamento geográfico optimizan el uso del transporte del Ministerio y liberan tiempo administrativo tanto de directivos como de supervisores y operadores del depósito.
- **Alineación Académica UCCuyo**: Desde la perspectiva del desarrollo de software, la creación del sistema DEPO constituye la aplicación práctica de los conocimientos adquiridos a lo largo de la carrera. Se abordan problemáticas reales de la ingeniería de software tales como el diseño de bases de datos relacionales robustas en PostgreSQL, la implementación de servicios API REST seguros mediante Node.js y Express, el desarrollo de interfaces responsivas y de alto rendimiento en React, y la aplicación de estrictas medidas de seguridad digital y normativas legales nacionales (como la Ley de Protección de Datos Personales).

## 1.5. Síntesis del Capítulo

En síntesis, este primer capítulo ha establecido el marco introductorio de la investigación y desarrollo del proyecto DEPO. Se determinó que el sistema busca resolver los graves inconvenientes de trazabilidad, demoras y falta de automatización del circuito de abastecimiento escolar en el Ministerio de Educación de San Juan. Se caracterizó al organismo receptor de la tecnología, detallando la complejidad que implica abastecer a los 19 departamentos de la provincia y a las diversas modalidades educativas. Finalmente, se analizó el flujo tradicional en papel y planillas de cálculo aisladas, sentando las bases para fundamentar detalladamente en el siguiente capítulo los problemas específicos del circuito operativo que serán objeto de solución informática.
