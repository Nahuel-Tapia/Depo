# Guía de Roles y Funciones: Sistema de Gestión Depo

Este documento detalla las capacidades y flujos de trabajo para cada rol dentro del sistema, ideal para capacitación y exposición del proyecto.

---

## 1. Directivo (Nivel Escuela)
**Objetivo**: Gestionar las necesidades de insumos de su institución.

*   **Solicitud Anual**: Generar el pedido de suministros para todo el ciclo lectivo basado en el Kit asignado a su tipo de escuela.
*   **Solicitud de Refuerzos**: Realizar pedidos extraordinarios de productos específicos cuando el stock anual sea insuficiente.
*   **Modalidad de Entrega**:
    *   Puede generar solicitud para **retiro presencial**.
    *   Puede marcar **solicitar envio** para que el operador procese su entrega dentro del flujo por departamento.
*   **Seguimiento Logístico**: 
    *   Visualizar el estado de su pedido en tiempo real (Pendiente, Autorizado, Licitación, En Depósito Central).
    *   Verificar cantidades recibidas vs. cantidades solicitadas.
*   **Descarga de Comprobantes**: Imprimir comprobantes de retiro una vez que la mercadería está lista para ser buscada o entregada.

---

## 2. Supervisor (Gestión Intermedia)
**Objetivo**: Validar la pertinencia de los pedidos de su zona.

*   **Bandeja de Aprobación**: Revisar los pedidos (Anuales y Refuerzos) de las escuelas bajo su jurisdicción.
*   **Gestión de Excepciones**:
    *   **Aprobar**: Pasa el pedido al siguiente nivel (Director de Área).
    *   **Rechazar**: Cancela el pedido indicando un motivo.
    *   **Pedir Aclaración**: Devuelve el pedido al Directivo para que corrija o justifique datos, sin cancelarlo.
*   **Patrimonio Escolar**: Gestionar tickets de mobiliario y activos fijos de sus escuelas.

---

## 3. Director de Área (Planificación y Control)
**Objetivo**: Consolidar la demanda y gestionar la estructura del sistema.

*   **Autorización Final**: Último paso de aprobación antes de que los pedidos pasen a ser licitados.
*   **Consolidación de Planilla Anual**: Visualizar el "Listado Final a Licitar", que agrupa todos los pedidos de todas las escuelas para negociar volúmenes con proveedores.
*   **Configuración de Kits**: Definir qué productos y en qué cantidades componen los Kits (ej: Kit Comedor, Kit Albergue, Kit Copa de Leche).
*   **Gestión de Zonas**: Asignar escuelas a supervisores y organizar la estructura territorial.

---

## 4. Área de Compras (Gestión Comercial y Adjudicación)
**Objetivo**: Transformar pedidos en mercadería real al mejor costo y volumen optimizado.

*   **Gestión de Proveedores**: Mantener la base de datos de proveedores (CUIT, Razón Social, Rubro, Contacto).
*   **Listado Final a Licitar**:
    *   Visualizar el consolidado total de productos requeridos por todas las escuelas.
    *   Consultar el **Stock Actual** del depósito como referencia visual para decidir la cantidad final a comprar.
    *   Editar las cantidades finales a licitar y **Cerrar Licitación** para bloquear la edición y habilitar la adjudicación.
*   **Licitación y Adjudicación**: 
    *   Cargar precios de proveedores y adjudicar productos (mejor oferta).
    *   *Unificación*: Los productos con el mismo nombre se muestran agrupados para facilitar la adjudicación masiva.
    *   *Flexibilidad*: Permite regresar al paso anterior (reabrir listado) si se necesita corregir cantidades antes de finalizar la adjudicación.
*   **Gestión de Entregas**: "Enviar a Depósito" la información de las licitaciones cerradas para que el operador sepa qué debe recibir y de qué proveedor.
*   **Auditoría de Precios**: Único rol (junto al Admin) con acceso a los costos y comparativas económicas.


---

## 5. Operador de Depósito (Logística y Stock)
**Objetivo**: Control físico de la mercadería y su distribución.

*   **Recepción de Licitación**: 
    *   Registrar el ingreso de camiones de proveedores.
    *   Cargar fechas de vencimiento y cantidades recibidas (totales o parciales).
    *   *Consolidación*: Los productos se reciben agrupados por nombre para agilizar la recepción.
    *   *Seguridad*: El operador no ve precios, solo cantidades y productos.
*   **Distribución a Escuelas**: 
    *   Armar las "salidas" de mercadería hacia cada escuela según lo que se les adjudicó.
    *   Generar remitos virtuales de entrega.
*   **Envíos por Departamento (Nuevo)**:
    *   Vista agrupada por departamento para solicitudes marcadas con envío.
    *   Pantalla de detalle por departamento con resumen por solicitud: solicitado, ya entregado y pendiente.
    *   Sección de instituciones faltantes por solicitar retiro para gestión preventiva.
    *   Confirmación de egreso múltiple por departamento con selección de depósito origen.
    *   Errores funcionales en confirmación se informan como validaciones (`400`) con mensaje claro.
*   **Control de Inventario**: 
    *   Visualizar stock actual por depósito.
    *   **Detalle de Stock**: Ver en qué depósitos está distribuida la mercadería y sus fechas de vencimiento desde la lista de productos.
    *   Gestionar movimientos manuales (ajustes por pérdida, rotura, etc.).
*   **Alertas Tempranas**: Monitorear el widget de vencimientos próximos para evitar desperdicio de alimentos.

---

## 6. Administrador (Gestión de Plataforma)
**Objetivo**: Garantizar la operatividad técnica del sistema.

*   **Gestión de Usuarios**: Crear cuentas, resetear contraseñas y asignar roles.
*   **Auditoría Total**: Acceso a todos los módulos para corrección de errores o soporte técnico.
*   **Configuración de Productos**: Mantener el catálogo maestro de productos y unidades de medida.

---

### Flujo Crítico de un Pedido Anual (Resumen):
1. **Directivo** pide → 2. **Supervisor** valida → 3. **Director Área** autoriza → 4. **Compras** licita y adjudica → 5. **Operador** recibe del proveedor → 6. **Operador** entrega a la escuela.

### Flujo de Retiro/Envío (Post Adjudicación)
1. **Directivo** crea solicitud de retiro.
2. Si marca **solicitar envío**, la solicitud entra al tablero de **Envíos por Departamento**.
3. **Operador** abre detalle del departamento y arma cantidades a despachar.
4. **Operador** confirma egreso múltiple.
5. El sistema actualiza movimientos, cantidades entregadas y estado de solicitud.
