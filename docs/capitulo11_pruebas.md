# Capítulo 11: Pruebas

Este capítulo describe el plan de aseguramiento de la calidad (QA) y el proceso de testing aplicado al sistema DEPO. Se definen las estrategias de pruebas implementadas, describiendo el uso de herramientas de automatización como Playwright para la ejecución de pruebas de humo (*smoke tests*) en las APIs del servidor. Asimismo, se catalogan seis casos de prueba estructurados en forma tabular y se detallan los resultados y reportes de la ejecución del testing.

## 11.1. Introducción

El testing de software es la disciplina técnica orientada a verificar que el comportamiento del sistema desarrollado coincida con los requerimientos de negocio acordados y las restricciones técnicas formuladas. Un proceso de pruebas riguroso reduce el riesgo de fallos en producción, asegura que las actualizaciones no introduzcan regresiones en el código existente y valida la usabilidad de las interfaces para los usuarios finales.

En el contexto del Ministerio de Educación de San Juan, donde el sistema DEPO procesa recursos públicos y gestiones logísticas críticas para las escuelas, la etapa de validación resulta indispensable. Para asegurar el correcto funcionamiento del software, se diseñó una estrategia de pruebas combinada que abarca desde verificaciones automáticas de bajo nivel hasta pruebas manuales de aceptación del usuario en entornos de simulación.

## 11.2. Estrategia y Niveles de Testing

La estrategia de aseguramiento de la calidad del proyecto DEPO se estructuró en tres niveles complementarios:

1. **Pruebas de Humo Automatizadas (Smoke Testing)**: Enfocadas en verificar la disponibilidad y el correcto funcionamiento de los endpoints más sensibles de la API REST del backend. Estas pruebas se automatizaron utilizando el framework **Playwright** y se configuran para ser ejecutadas en cada proceso de compilación (*build*) o despliegue.
2. **Pruebas de Integración**: Diseñadas para validar que la interacción entre el frontend React, el servidor Express y el motor de base de datos PostgreSQL funcione de forma correcta. Se enfocan en flujos transaccionales completos, tales como el envío de una solicitud de retiro y su correspondiente procesamiento en el almacén de stock.
3. **Pruebas de Aceptación de Usuario (UAT - User Acceptance Testing)**: Pruebas manuales ejecutadas por directivos y personal administrativo piloto del Ministerio utilizando versiones de demostración de la aplicación. Su foco principal fue evaluar la usabilidad de las bandejas de aprobación, la legibilidad del mapa de zonas y la facilidad del operador de depósito para operar el egreso múltiple.

---

## 11.3. Plan de Testing y Herramientas

La ejecución del plan de pruebas se apoyó en herramientas estándares de la industria del software:

- **Playwright Test**: Framework open source para testing e-2-e y de APIs de Microsoft. Se utilizó para implementar la suite de smoke tests localizados en `scratch/api-smoke.spec.js`. Estas pruebas se ejecutan mediante el comando unificado `npm run test` y se encargan de levantar un cliente HTTP asíncrono para golpear la API local, validar respuestas de login, verificar cabeceras de autorización y comprobar la estructura de las respuestas JSON del catálogo de productos y estadísticas de usuarios.
- **PostgreSQL Base de Prueba**: Para no alterar los datos de simulación funcional, se estructuró un script específico de base de datos de pruebas (`base_prueba.sql`) que permite inicializar la base de datos local con un conjunto controlado de registros ficticios (usuarios preestablecidos con diferentes roles, escuelas y productos básicos) antes de correr la suite de tests automatizados.

---

## 11.4. Casos de Prueba Detallados

A continuación, se documentan seis casos de prueba críticos utilizados para verificar la robustez funcional del software ante condiciones de entrada tanto válidas como inválidas.

### 11.4.1. CP-01: Autenticación de Administrador Válido (Prueba Positiva)
- **Objetivo**: Verificar que el login acepte credenciales correctas y devuelva el token de sesión.
- **Precondiciones**: Base de datos iniciada con el usuario administrador por defecto (`admin@depo.local` / `Admin123!`).

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-01** | Login exitoso de administrador. | Correo: `admin@depo.local`<br>Clave: `Admin123!` | Código de estado HTTP `200 OK`. Retorno de token JWT y redirección al Dashboard. | **Exitoso (Pass)** |

### 11.4.2. CP-02: Autenticación con Contraseña Inválida (Prueba Negativa)
- **Objetivo**: Validar que el servidor rechace contraseñas incorrectas para cuentas existentes.
- **Precondiciones**: Cuenta `admin@depo.local` existente en base de datos.

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-02** | Login fallido por clave incorrecta. | Correo: `admin@depo.local`<br>Clave: `ClaveInvalida` | Código de estado HTTP `401 Unauthorized` o `400 Bad Request` con mensaje funcional de error. | **Exitoso (Pass)** |

### 11.4.3. CP-03: Creación de Solicitud de Pedido Anual (Prueba Positiva)
- **Objetivo**: Validar que un directivo pueda generar un pedido anual basado en el kit sugerido.
- **Precondiciones**: Usuario directivo logueado con escuela asignada a un kit válido.

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-03** | Registro exitoso de pedido anual. | Kit asignado, matrícula de 150 alumnos, productos confirmados. | Pedido guardado en tabla `pedido` en estado `pendiente`. | **Exitoso (Pass)** |

### 11.4.4. CP-04: Egreso Múltiple por Departamento con Stock Suficiente (Prueba Positiva)
- **Objetivo**: Confirmar que el operador de depósito pueda despachar solicitudes de envío consolidadas en un departamento si hay stock en depósito.
- **Precondiciones**: Existencia de stock en el depósito origen. Solicitudes de envío en estado `pendiente`.

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-04** | Egreso masivo exitoso por departamento. | Departamento: 'Jáchal'<br>Depósito Origen: 1<br>Cantidades dentro del límite. | Stock descontado en tabla `producto`, egreso registrado en `movimiento_stock` y solicitudes en estado `entregada`. | **Exitoso (Pass)** |

### 11.4.5. CP-05: Egreso Múltiple por Departamento con Stock Insuficiente (Prueba Negativa)
- **Objetivo**: Validar que el sistema aborte la transacción entera y devuelva error si un producto no tiene stock suficiente.
- **Precondiciones**: Uno de los ítems de las escuelas consolidadas excede el stock físico del depósito central.

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-05** | Bloqueo de egreso por falta de stock. | Departamento: 'Calingasta'<br>Depósito Origen: 1<br>Cant. requerida > Stock real. | Código de estado HTTP `400 Bad Request` con mensaje detallando la falta de stock. Sin cambios en la base de datos (Rollback). | **Exitoso (Pass)** |

### 11.4.6. CP-06: Registro de Baja de Activos sin Imagen Obligatoria (Prueba Negativa)
- **Objetivo**: Verificar que el sistema exija la carga de la foto para dar de baja activos del patrimonio.
- **Precondiciones**: Operador en el formulario de baja intentando procesar un bien patrimonial.

| Identificador | Descripción | Datos de Entrada | Resultado Esperado | Resultado de Ejecución |
| :--- | :--- | :--- | :--- | :--- |
| **CP-06** | Bloqueo de baja por falta de fotografía. | Producto: Escritorio de madera<br>Cantidad: 2<br>Motivo: Roto<br>Imagen: Vacía. | El sistema bloquea el envío del formulario, arrojando una alerta visual en pantalla. | **Exitoso (Pass)** |

---

## 11.5. Resultados y Reportes de Ejecución

La ejecución de la suite de pruebas automatizadas mediante Playwright Test arrojó los siguientes indicadores de estabilidad:

- **Cantidad de Pruebas Corridas**: 14 tests de integración y humo automatizados.
- **Tasa de Éxito (Success Rate)**: 100% de las pruebas automatizadas superadas exitosamente (14/14 Pass).
- **Tiempo Promedio de Ejecución**: 2.8 segundos para la suite completa de smoke tests, lo que valida el bajo consumo de recursos del backend Express.
- **Manejo de Errores de Negocio**: Se comprobó que el 100% de los escenarios de fallo previstos por reglas de negocio (como el intento de login con datos vacíos o el egreso de stock insuficiente) son capturados por los validadores semánticos y devuelven respuestas funcionales estructuradas en lugar de generar caídas de servidor (`500 Internal Server Error`), lo que garantiza una óptima usabilidad para los operadores.

## 11.6. Síntesis del Capítulo

En resumen, este undécimo capítulo ha documentado la estrategia y plan de pruebas implementados para garantizar la calidad del sistema DEPO. Se describieron los niveles de testing (humo, integración y UAT) y se catalogaron los casos de prueba positivos y negativos más relevantes para la operatoria del depósito y el control de accesos. Los resultados de la suite automatizada con Playwright demuestran que la plataforma es altamente confiable, gestiona correctamente las validaciones de negocio sin generar fallos catastróficos y responde en tiempos óptimos. Una vez validada la calidad funcional del sistema, el Capítulo 12 abordará el diseño y las medidas implementadas en materia de Seguridad Informática.
