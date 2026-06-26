# Capítulo 9: Casos de uso e historias de usuario

Este capítulo describe el comportamiento del sistema DEPO desde la perspectiva de las interacciones entre los usuarios (actores) y la plataforma. Se detallan los Casos de Uso (CU) críticos del negocio mediante especificaciones tabulares que describen flujos principales y alternativos. Asimismo, se presentan las Historias de Usuario (HU) desarrolladas bajo metodologías ágiles, acompañadas de sus respectivos criterios de aceptación redactados en lenguaje estructurado.

## 9.1. Introducción

El modelado del comportamiento del software permite verificar que el diseño de la arquitectura y la base de datos responda de manera exacta a las necesidades de la operatoria real del cliente. Mientras que el análisis de requerimientos del Capítulo 7 definió *qué* debe hacer el sistema, los Casos de Uso y las Historias de Usuario definen *cómo* interactúan los actores con el sistema para lograr sus objetivos diarios.

En la metodología Scrum, la descomposición de requerimientos en Historias de Usuario facilita la estimación del esfuerzo de desarrollo y sirve de base para la escritura de pruebas automatizadas y funcionales. En las secciones siguientes, se especifican tanto el flujo formal de casos de uso heredados de la ingeniería de software clásica como las historias de usuario del backlog de desarrollo.

---

## 9.2. Casos de Uso del Sistema (CU)

Se han seleccionado seis casos de uso fundamentales que representan los hitos transaccionales más complejos de la cadena de suministro escolar.

### 9.2.1. CU-01: Formular Solicitud Anual de Insumos
- **Actor Principal**: Directivo Escolar.
- **Precondiciones**: El directivo debe estar autenticado y su institución asociada a un kit de productos y una matrícula escolar válida.
- **Postcondiciones**: El pedido anual queda registrado en la base de datos en estado `pendiente`.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Selecciona la opción "Crear Pedido Anual" en su menú lateral. | Solicita los datos de matrícula vigentes y carga el kit de productos preestablecido. |
| **2** | Valida la matrícula escolar del establecimiento. | Calcula de forma automática la cantidad sugerida de productos en base al kit y a la matrícula. |
| **3** | Modifica cantidades justificadamente y presiona "Confirmar Pedido". | Valida que las cantidades no sean negativas e inserta los registros en `pedido` y `detalle_pedido` en estado `pendiente`. |
| **4** | - | Envía una notificación interna al Supervisor de su zona escolar. |

- *Flujo Alternativo 2.a*: Si la institución no posee un kit preestablecido asignado por su Dirección de Área, el sistema devuelve un error indicando al Directivo que contacte a su área administrativa, bloqueando la operación.

### 9.2.2. CU-02: Avalar Pedido de Escuela
- **Actor Principal**: Supervisor Zonal.
- **Precondiciones**: El supervisor debe estar autenticado y tener escuelas bajo su zona con pedidos en estado `pendiente`.
- **Postcondiciones**: El pedido pasa al estado `pendiente_director` o `rechazado`.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Ingresa a la bandeja de "Aprobaciones Pendientes". | Muestra el listado de solicitudes en estado `pendiente` de las escuelas bajo su jurisdicción. |
| **2** | Abre el detalle de un pedido escolar y revisa cantidades. | Presenta cantidades solicitadas y alertas si exceden la estimación paramétrica básica. |
| **3** | Presiona "Avalar Pedido" o "Rechazar Pedido" (cargando motivo). | Registra la firma en `aprobacion_seguimiento` y actualiza `pedido.estado` a `pendiente_director` o `rechazado`. |
| **4** | - | Notifica al Directivo de la escuela el cambio de estado de su solicitud. |

### 9.2.3. CU-03: Consolidar y Autorizar Planilla de Compras
- **Actor Principal**: Director de Área.
- **Precondiciones**: Existencia de solicitudes avaladas por supervisores en estado `pendiente_director`.
- **Postcondiciones**: La planilla anual de compras cambia a estado `enviada` a compras.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Ingresa a "Consolidado de Compras Anuales". | Agrupa todos los productos y cantidades de los pedidos en estado `pendiente_director` de su área. |
| **2** | Presiona "Generar Planilla Anual de Compras". | Crea el registro en `planilla_pedido_anual` e inserta los detalles unificados de escuelas y artículos. |
| **3** | Presiona "Enviar a Compras" para autorizar la licitación. | Bloquea la edición de todos los pedidos asociados, actualiza su estado a `aprobado` y pasa la planilla a `enviada`. |

### 9.2.4. CU-04: Adjudicar Licitación Anual a Proveedores
- **Actor Principal**: Área de Compras.
- **Precondiciones**: Existencia de planillas en estado `enviada` y proveedores registrados.
- **Postcondiciones**: La licitación queda adjudicada y se genera el histórico de precios.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Selecciona las planillas a licitar y presiona "Abrir Licitación". | Genera un registro en `licitacion_publicada` con el consolidado total a comprar por producto. |
| **2** | Carga cotizaciones de proveedores por cada ítem de la licitación. | Muestra los precios unitarios comparativos y resalta la oferta más económica. |
| **3** | Presiona "Adjudicar Licitación". | Adjudica el ítem al proveedor seleccionado, guarda el registro de costo real en `compra_precio_historico` y notifica al operador de depósito la mercadería esperada. |

### 9.2.5. CU-05: Procesar Envíos por Departamento y Egreso Múltiple
- **Actor Principal**: Operador de Depósito.
- **Precondiciones**: Existencia de solicitudes de retiro en estado `pendiente` con flag `solicitar_envio` activo. Stock suficiente en el depósito seleccionado.
- **Postcondiciones**: Se registran egresos múltiples de stock y solicitudes actualizadas.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Ingresa a "Distribución a Escuelas" -> "Envíos por Departamento". | Muestra el listado de departamentos provinciales y cantidad de solicitudes de envío pendientes. |
| **2** | Selecciona un departamento y abre el detalle. | Muestra el consolidado de productos requeridos por las escuelas de ese departamento. |
| **3** | Selecciona depósito origen, ajusta cantidades a despachar y confirma. | Valida stock de origen. Resta stock, inserta registros en `movimiento_stock`, actualiza `pedido_entrega` y pasa las solicitudes a `entregada` o `aceptada`. |

- *Flujo Alternativo 3.a (Falta de Stock)*: Si la cantidad a despachar es superior al stock disponible en el depósito de origen seleccionado, el sistema bloquea la confirmación del egreso y devuelve una respuesta con código de estado HTTP `400` detallando los productos faltantes.

### 9.2.6. CU-06: Registrar Baja de Stock con Evidencia Fotográfica
- **Actor Principal**: Operador de Depósito.
- **Precondiciones**: Productos dañados detectados físicamente en el almacén.
- **Postcondiciones**: Ajuste negativo en stock e inserción de la baja con imagen adjunta.

| Paso | Acción del Actor | Respuesta del Sistema |
| :--- | :--- | :--- |
| **1** | Selecciona "Nueva Baja de Stock" en el menú de inventario. | Carga el formulario de declaración de baja de mercadería. |
| **2** | Selecciona depósito, producto, cantidad, motivo de la baja e ingresa observaciones. | Habilita el control de cámara/archivo de imagen. |
| **3** | Adjunta la fotografía del material deteriorado y presiona "Registrar Baja". | Resta las cantidades de `producto.stock_actual`, inserta la baja en `baja_movimientos` y guarda la foto base64 en `recepcion_danio_imagen`. |

---

## 9.3. Historias de Usuario (HU)

Las historias de usuario guían la implementación técnica y definen los criterios de aceptación en el desarrollo del sprint:

### HU-01: Autenticación y Asignación de Interfaz según Rol
- **Como** usuario del Ministerio o de un establecimiento educativo,
- **Quiero** autenticarme de manera segura en la aplicación,
- **Para** acceder únicamente a las funcionalidades y datos autorizados para mi rol.
- **Criterios de Aceptación**:
  - **Dado** que un usuario ingresa sus credenciales en la pantalla de login:
    - **Cuando** presiona "Ingresar" con credenciales correctas, **entonces** el sistema genera un token JWT en el navegador, redirige al Dashboard y muestra el menú correspondiente a su rol.
    - **Cuando** el usuario intenta acceder a una ruta de la API no autorizada para su rol (ej: un directivo intentando llamar a `/api/movimientos`), **entonces** el servidor debe denegar la petición devolviendo un código de estado HTTP `403 Forbidden`.

### HU-02: Creación de Solicitud de Retiro con Modalidad de Envío
- **Como** Directivo de escuela,
- **Quiero** poder generar una solicitud de retiro y marcar la opción de solicitar envío a mi establecimiento,
- **Para** evitar trasladarme físicamente al depósito central y programar la logística oficial.
- **Criterios de Aceptación**:
  - **Dado** que un directivo tiene un pedido anual aprobado en el sistema:
    - **Cuando** crea una solicitud de retiro, **entonces** el sistema le permite activar la opción "Solicitar Envío" y debe asociar automáticamente el departamento geográfico del edificio escolar al registro (`solicitud_retiro.departamento_envio`).
    - **Dado** que la solicitud de retiro se ha guardado, **entonces** el sistema la lista en estado `pendiente` y bloquea la creación de otras solicitudes concurrentes para el mismo pedido anual.

### HU-03: Tablero de Distribución Departamental y Egreso Múltiple
- **Como** Operador de depósito,
- **Quiero** ver un listado unificado de pedidos de envío agrupados por departamento provincial,
- **Para** procesar el armado de cargas y despachar mercadería de forma masiva a las escuelas de una misma zona.
- **Criterios de Aceptación**:
  - **Dado** que el operador ingresa al módulo de "Envíos por Departamento":
    - **Cuando** selecciona un departamento, **entonces** la interfaz muestra el detalle de cantidades solicitadas y entregadas por escuela, y el stock del depósito seleccionado.
    - **Cuando** el operador confirma la distribución masiva con cantidades válidas y stock disponible, **entonces** el backend procesa de forma atómica la resta del inventario en el almacén de origen, registra los remitos y actualiza el estado de las solicitudes.
    - **Cuando** el operador intenta confirmar y existe stock insuficiente para uno o más artículos, **entonces** el backend frena la transacción entera, devuelve un error HTTP `400` detallando qué productos causan el conflicto, y la interfaz destaca visualmente el error.

### HU-04: Registro de Baja de Insumos Rotos con Fotografía
- **Como** Operador de depósito,
- **Quiero** dar de baja productos vencidos o rotos del inventario adjuntando una foto como evidencia,
- **Para** justificar documentalmente los ajustes negativos de stock ante el control patrimonial.
- **Criterios de Aceptación**:
  - **Dado** que el operador completa el formulario de baja indicando el depósito de origen, el producto, la cantidad y el motivo de descarte:
    - **Cuando** adjunta una imagen y presiona "Registrar", **entonces** la imagen se codifica en base64 y se almacena en la tabla de evidencias vinculada al movimiento, restando automáticamente el stock físico.
    - **Cuando** el operador intenta registrar la baja sin adjuntar la imagen de evidencia en caso de activos fijos patrimoniales, **entonces** el sistema bloquea el envío y muestra un mensaje de campo requerido.

### HU-05: Visualización de Precios Históricos y Stock Actual en Compras
- **Como** referente del Área de Compras,
- **Quiero** consultar el historial de precios reales pagados por un producto y el stock disponible en depósito al momento de adjudicar licitaciones,
- **Para** tomar decisiones de compra eficientes y no adquirir insumos redundantes.
- **Criterios de Aceptación**:
  - **Dado** que el usuario de compras se encuentra en la pantalla de licitaciones y adjudicación de un producto:
    - **Cuando** visualiza el producto a adjudicar, **entonces** la pantalla muestra el stock actual de ese artículo en el depósito central y una lista de los precios adjudicados en licitaciones de los últimos tres ciclos lectivos.
    - **Dado** que el usuario de compras tiene rol exclusivo de compras o administrador, **entonces** y solo entonces el sistema habilita el acceso a esta información presupuestaria.

---

## 9.4. Síntesis del Capítulo

Este noveno capítulo ha modelado funcional y detalladamente las interacciones operativas del sistema DEPO. Se definieron seis Casos de Uso estructurados en forma tabular, los cuales detallan los procesos críticos de formulación de pedidos, avales, compras, egresos masivos por departamentos y bajas de inventario. Asimismo, se formularon cinco Historias de Usuario alineadas con la metodología ágil Scrum, complementadas con criterios de aceptación formalizados bajo la estructura Dado-Cuando-Entonces. Este modelado del comportamiento del software brinda la especificación lógica necesaria para abordar en el Capítulo 10 las Decisiones de Implementación y patrones aplicados en la construcción real de la plataforma.
