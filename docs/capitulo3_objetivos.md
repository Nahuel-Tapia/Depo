# Capítulo 3: Objetivos generales y específicos

Este capítulo establece los objetivos que guiaron el diseño, desarrollo e implementación del sistema DEPO. Se define el propósito fundamental del proyecto a través del objetivo general y se desglosan las metas técnicas y operativas mediante los objetivos específicos. Además, se asocian indicadores cuantitativos y cualitativos para evaluar el impacto y grado de cumplimiento de la solución de software propuesta.

## 3.1. Introducción

La formulación precisa de los objetivos constituye el eje rector de cualquier proyecto de desarrollo de software, ya que define el rumbo técnico y funcional que debe tomar el equipo de ingeniería. En el contexto de una institución gubernamental como el Ministerio de Educación de la Provincia de San Juan, los objetivos no pueden limitarse únicamente a metas tecnológicas, sino que deben estar estrechamente vinculados a la resolución de problemas de gobernanza, eficiencia administrativa y control patrimonial.

Teniendo en cuenta el diagnóstico de ineficiencias del modelo analógico presentado en el capítulo anterior, el sistema DEPO se estructuró con el propósito de reemplazar la gestión manual por una plataforma web segura, escalable y auditable. Los objetivos que se detallan a continuación apuntan a transformar la cadena de suministro escolar en un proceso predecible, transparente y optimizado.

## 3.2. Objetivo General

El objetivo general del proyecto consiste en:

> Desarrollar, implementar y evaluar un sistema de software integral (denominado DEPO) para la gestión de stock, administración de pedidos, planificación de compras y distribución de recursos escolares en el ámbito del Ministerio de Educación de la Provincia de San Juan, optimizando los tiempos administrativos del circuito logístico y garantizando la trazabilidad de los bienes públicos en cumplimiento con las normativas provinciales de auditoría y protección de datos.

## 3.3. Objetivos Específicos

Para alcanzar el objetivo general propuesto, se definieron los siguientes objetivos específicos:

1. **Diseñar e implementar un sistema de control de accesos basado en roles (RBAC)** que integre a la totalidad de los actores del circuito (Directivos, Supervisores, Directores de Área, Compras, Operadores y Administradores), garantizando la visibilidad selectiva de la interfaz de usuario y de las rutas de la API en función del nivel de autorización y jurisdicción de cada perfil de usuario.
2. **Desarrollar un módulo de planificación y solicitudes escolares** que permita a los directivos generar pedidos anuales estandarizados a partir de kits de productos preestablecidos vinculados de manera matemática a la matrícula real de alumnos, eliminando la asimetría de información y la subjetividad en la estimación de la demanda escolar.
3. **Construir un circuito digital de aval y autorización jerárquica** que faculte a los supervisores a auditar y autorizar pedidos en su zona, y a los directores de área a realizar la aprobación final y la consolidación de planillas de compras anuales en formato digital, eliminando el traspaso de expedientes en soporte de papel físico.
4. **Implementar herramientas avanzadas para la gestión logística del Depósito Central**, que incluyan el registro digital de remitos por camión (ingresos totales o parciales asociados a proveedores específicos), el monitoreo de existencias por depósitos y lotes, y la emisión de alertas de vencimiento temprano para productos perecederos.
5. **Desarrollar un módulo logístico de distribución provincial por departamento geográfico** que agrupe las solicitudes de retiro autorizadas con modalidad de envío y facilite a los operadores el armado de egresos múltiples consolidados, reduciendo los tiempos de entrega y optimizando el uso de la flota de transporte oficial.
6. **Diseñar e integrar un módulo de bajas de stock y materiales rotos** que registre con rigor la salida de mercadería del inventario por causas de deterioro, rotura o pérdida, permitiendo adjuntar evidencia fotográfica (almacenada digitalmente) y documentar el motivo de la baja bajo un historial auditable.
7. **Implementar un canal digital de control patrimonial y reclamos** (patrimonio escolar) para que los directivos de los establecimientos educativos puedan reportar daños de infraestructura o mobiliario y gestionar sus reparaciones de manera directa con las autoridades del Ministerio, reduciendo los tiempos de respuesta.
8. **Proporcionar al departamento de compras herramientas de apoyo a la decisión**, que incluyan la cotización histórica de precios reales abonados a proveedores adjudicados en licitaciones anteriores y la visualización del stock actual del depósito central para evitar compras redundantes.
9. **Desarrollar módulos de visualización de datos georreferenciados y reportes estadísticos** (integrando gráficos dinámicos y mapas interactivos) para facilitar el monitoreo estratégico de consumos por departamento y nivel educativo por parte de las Direcciones de Área.
10. **Validar el funcionamiento del sistema en un entorno controlado** mediante el diseño y ejecución de un plan de pruebas de integración y humo (*smoke tests*) para asegurar la robustez de las APIs y la usabilidad de la interfaz frontend antes de su puesta en producción.

## 3.4. Metas e Indicadores de Logro

Para medir el éxito de la implementación de la plataforma DEPO y el cumplimiento de los objetivos planteados, se definieron los siguientes indicadores de logro institucionales y técnicos:

| Objetivo Relacionado | Indicador de Logro | Meta Esperada | método de Verificación |
| :--- | :--- | :--- | :--- |
| **OE 2 (Planificación)** | Porcentaje de escuelas asociadas a un Kit de productos parametrizado. | 100% de los establecimientos empadronados. | Consulta de base de datos (`institucion.kit_id IS NOT NULL`). |
| **OE 3 (Autorización)** | Tiempo promedio de aprobación de un pedido anual (desde el envío del Directivo al aval del Director de Área). | Reducción de 45 días (manual) a menos de 5 días hábiles (digital). | Reporte de auditoría de tiempos (`aprobacion_seguimiento.fecha_firma`). |
| **OE 4 (Inventario)** | Desviación de stock entre las auditorías físicas y los registros del sistema. | Margen de error menor al 1%. | Conciliación de inventario contra tabla `movimiento_stock`. |
| **OE 4 (Alertas)** | Porcentaje de pérdidas de insumos alimenticios por vencimiento en depósito. | 0% de pérdidas de alimentos en depósito central. | Registro de bajas por vencimiento (`baja_movimientos.motivo`). |
| **OE 5 (Logística)** | Eficiencia en rutas y despachos de entrega por departamento. | Agrupación automática del 100% de los pedidos con envío en el tablero logístico. | Verificación visual de solicitudes procesadas en egreso múltiple. |
| **OE 6 (Bajas)** | Trazabilidad fotográfica en bajas de materiales y activos. | 100% de las bajas de activos patrimoniales con imagen y justificación obligatoria. | Validación de registros en tabla `recepcion_danio_imagen` / `baja_movimientos`. |
| **OE 7 (Patrimonio)** | Tiempo de respuesta a reclamos por rotura de mobiliario. | Reducción de los plazos de respuesta en un 60%. | Historial de estados en `patrimonio_ticket.estado`. |

## 3.5. Síntesis del Capítulo

Este capítulo ha definido con precisión el alcance estratégico del sistema DEPO a través de la formulación de sus objetivos generales y específicos. Se constató que el propósito del sistema trasciende la mera gestión de un inventario genérico, apuntando a transformar de raíz el circuito de abastecimiento y control del Ministerio de Educación de San Juan. Se establecieron metas concretas en cuanto a digitalización, control logístico, trazabilidad patrimonial, apoyo a las compras estatales y reducción de tiempos administrativos, respaldados por indicadores que permitirán auditar la efectividad de la plataforma. Establecidos los objetivos del proyecto, el Capítulo 4 definirá los límites precisos del sistema mediante el análisis de su alcance y limitaciones.
