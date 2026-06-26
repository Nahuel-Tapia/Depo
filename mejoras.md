# Plan de Mejoras para el Sistema de Depósito

## Actualización y Cierre de Pendientes (2026-06-25)
Se ha completado la revisión técnica de la base de código y la base de datos PostgreSQL, confirmando la correcta implementación y consistencia de:
- **Gestión de Bajas e Imágenes**: Módulo transaccional de descarte de stock por roturas (`baja_movimientos`) con soporte para evidencias fotográficas en base64 (`recepcion_danio_imagen`).
- **Historial de Precios**: Registro histórico automático de precios de licitación para auditoría comercial (`compra_precio_historico`).
- **Logística Consolidada**: Tablero de control de envíos por departamento y egresos múltiples verificando stock disponible con códigos HTTP `400` para errores funcionales.

---

## Actualizacion rapida (2026-05-15)

Implementado en sistema y documentacion:

- Solicitud de retiro con opcion de solicitar envio.
- Distribucion operativa por departamento para solicitudes con envio.
- Detalle por departamento con faltantes por solicitar retiro.
- Normalizacion de errores funcionales de egreso multiple como `400`.

Este documento mantiene los pendientes de mediano y largo plazo.

Este documento resume y organiza las notas proporcionadas para futuras implementaciones y optimizaciones del sistema.

---

## 1. Gestión de Licitaciones y Compras
- **Plazo de Entrega**: Establecer un límite de 30 días para la entrega de la licitación una vez que se le comunica al proveedor ganador.
- **Logística de Ingreso**: La mercadería llega a granel; el sistema debe permitir registrar este ingreso para luego proceder al armado y entrega.
- **Circuito de Pago**: El área de Compras solo liberará el pago al proveedor una vez que Depósito emita un recibo/comprobante confirmando la recepción completa de la adjudicación.
- **Diferenciación de Conceptos**: Clarificar en el sistema que la *Adjudicación* es lo que se espera recibir, mientras que el *Remito* es lo que efectivamente ingresa.

## 2. Recepción de Mercadería y Control de Remitos
- **Registro de Remito por Camión**: Cada camión que ingresa representa un remito distinto, incluso si pertenecen al mismo pedido. Se debe poder guardar el número de remito individualmente.
- **Asociación de Proveedor**: Vincular directamente al proveedor con su respectivo número de remito (información que llega desde Compras).
- **Controles Estrictos**: Al momento del ingreso, el personal debe verificar cantidad y marca.
- **Ingresos Parciales**: Si una compra no ingresa completa, cada ingreso parcial debe generar un remito individual. La confirmación total se envía a Compras solo al completarse.
- **Firma y Sello**: Los documentos de recepción deben contemplar el espacio para firma y sello oficial.

## 3. Gestión de Stock, Lotes y Bajas
- **Trazabilidad por Lotes**: La fecha de vencimiento debe gestionarse por lote de producto (ya iniciado, pero requiere profundizarse en todo el sistema).
- **Módulo de Materiales Rotos / Bajas**:
  - Crear un apartado específico para dar de baja mercadería dañada.
  - Especificar qué unidades están en buen estado y cuáles en mal estado.
  - Campo para detallar el *motivo* de la baja.
  - Lo que esté en buen estado se guarda en stock; lo dañado se procesa para baja.
- **Evidencia Visual**: Agregar un campo de observaciones en las bajas que permita adjuntar o registrar fotos del material roto.
- **Revisión de Stock**: Investigar y solucionar problemas generales reportados con el stock en los depósitos.

## 4. Roles, Permisos y Seguridad
- **Visibilidad Selectiva**: Ocultar secciones del menú y de la interfaz según el rol del usuario.
- **Nuevos Roles**:
  - *Secretario Administrativo*
  - *Ministro Financiero*
- **Jerarquía en Depósito**: Crear o potenciar el rol de *Jefe de Depósito* con capacidad para elevar o gestionar ciertos permisos de su equipo.

## 5. Interfaz de Usuario y Reportes
- **Informes para Directivos**: Generar un reporte específico para los directivos de las escuelas con el detalle de lo que les corresponde retirar.
- **Módulo de Movimientos**: 
  - Agregar un botón para *editar* movimientos (con las restricciones de auditoría necesarias).
  - Corregir el bug donde a veces aparece "Varios" en lugar del nombre real del proveedor.
- **Módulo de Productos**: Agregar filtros de búsqueda más avanzados.
- **Comprobantes Triplicados**: El comprobante de entrega debe emitirse por triplicado, destinado a:
  1. Directivo (Escuela)
  2. Depósito
  3. Tribunal de Cuentas

## 6. Puntos a Clarificar o Investigar
- **Cápsula**: Se menciona este término. ¿Se refiere a un tipo de depósito específico (ya existe en los tipos) o a un módulo nuevo?
- **Problemas con Movilidades**: Se reportan problemas con el transporte/logística. Evaluar si se requiere un módulo de gestión de flota o traslados externos.
