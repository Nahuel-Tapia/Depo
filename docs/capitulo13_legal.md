# Capítulo 13: Apartado legal y normativo

Este capítulo analiza el marco regulatorio y legal aplicable al sistema DEPO en la República Argentina y en la Provincia de San Juan. Se examinan las implicaciones de la Ley N.º 25.326 de Protección de Datos Personales, la normativa provincial sobre contrataciones y administración de bienes del Estado, el régimen de Propiedad Intelectual según la Ley N.º 11.723, la Ley N.º 26.653 de Accesibilidad Web, y las responsabilidades civiles y profesionales asociadas al desarrollo. Finalmente, se presenta un modelo de Política de Privacidad y Términos de Uso redactado a medida para la plataforma.

## 13.1. Introducción

El desarrollo e implementación de sistemas informáticos en el sector público no ocurre en un vacío legal. Las soluciones tecnológicas deben ajustarse estrictamente a las leyes nacionales y provinciales vigentes que regulan la seguridad de la información, los derechos de los ciudadanos sobre sus datos, el uso de software libre y de terceros, y los mecanismos de fiscalización de los recursos estatales.

En el caso del sistema DEPO, implementado para el Ministerio de Educación de la Provincia de San Juan, el cumplimiento normativo adquiere una relevancia crítica. La plataforma almacena datos identificatorios de funcionarios públicos y directivos escolares, maneja información presupuestaria de licitaciones públicas de insumos y administra existencias patrimoniales del Estado. Por lo tanto, el sistema se ha diseñado considerando el cumplimiento activo de los marcos legales aplicables, garantizando la licitud y la transparencia de la operatoria informática.

---

## 13.2. Protección de Datos Personales

El tratamiento de la información de los usuarios del sistema DEPO se encuadra dentro de la **Ley Nacional N.º 25.326 de Protección de Datos Personales (de la República Argentina)** y su **Decreto Reglamentario N.º 1558/2001**.

### 13.2.1. El Rol de la Agencia de Acceso a la Información Pública (AAIP)
La AAIP es el órgano de control de la Ley N.º 25.326, encargado de garantizar el respeto de los derechos de los titulares de datos, fiscalizar el funcionamiento de las bases de datos públicas y privadas, y sancionar los incumplimientos a las medidas de seguridad exigidas por la ley. En el contexto de DEPO, el Ministerio de Educación de San Juan, como responsable institucional del sistema, debe empadronar la base de datos de usuarios de la plataforma ante la AAIP.

### 13.2.2. Categorización de los Datos Administrados
El sistema DEPO recopila y almacena datos de carácter personal necesarios para la operatividad del flujo logístico:
- **Datos de Identificación**: Nombre, apellido, Documento Nacional de Identidad (DNI) y firma digital o rúbrica de directivos, supervisores y operadores.
- **Datos de Contacto**: Correo electrónico y número de teléfono institucional o particular.
- **Datos de Localización**: Coordenadas geográficas, calle, altura y departamento del edificio de las instituciones educativas.
- **Datos de Menores**: El sistema registra de manera cuantitativa el número de matriculados (alumnos) por establecimiento escolar para el cálculo automático de los kits de insumos. Es fundamental destacar que **DEPO no recopila datos de identidad (nombre, DNI, etc.) de los menores de edad**, cumpliendo de esta forma con el principio de minimización de datos y protegiendo el interés superior del niño según la Ley Nacional N.º 26.061.
- **Inexistencia de Datos Sensibles**: Conforme al Artículo 2 de la Ley N.º 25.326, el sistema no almacena datos de carácter sensible (religión, afiliación política, orientación sexual, origen étnico o datos de salud), limitándose únicamente a los datos funcionales requeridos por la lógica del negocio.

### 13.2.3. Aplicación de Principios de la Ley N.º 25.326
El diseño del software y la base de datos de DEPO respetan activamente los principios fundamentales del derecho de protección de datos:
- **Principio de Finalidad (Art. 6)**: Los datos personales recopilados (correo, DNI, teléfono) se utilizan exclusivamente para la autenticación de usuarios, la asignación de permisos según el rol jerárquico y la emisión de comprobantes de remitos. No pueden ser desviados para fines comerciales ni cedidos a terceros sin consentimiento expreso.
- **Principio de Calidad del Dato (Art. 4)**: Los datos de las instituciones y usuarios deben ser exactos y estar actualizados. El sistema proporciona paneles ABM para corregir de forma oportuna inconsistencias en el padrón de escuelas o matrículas.
- **Principio de Seguridad y Confidencialidad (Arts. 9 y 10)**: El sistema implementa cifrado de contraseñas mediante Bcrypt, autenticación mediante tokens JWT y validaciones de rol en la API. Toda persona que intervenga en el tratamiento de los datos (administradores, operadores) está sujeta al deber de confidencialidad profesional.

---

## 13.3. Normativa de Contrataciones y Uso de Sistemas en el Sector Público

Al ser un sistema diseñado para el Ministerio de Educación de la Provincia de San Juan, DEPO debe cumplir con las regulaciones locales que rigen la administración de bienes del Estado provincial.

### 13.3.1. Marco Normativo de San Juan
La operatoria de compras, licitaciones e inventario que informatiza DEPO debe adecuarse a:
- **Ley N.º 55-A de Administración Financiera de la Provincia de San Juan**: Regula los sistemas de presupuesto, tesorería y contrataciones de la provincia.
- **Ley N.º 151-A (Ley de Contabilidad de la Provincia de San Juan)**: Establece el régimen de control y auditoría de la hacienda pública.
- **Ley N.º 2000-A (Régimen de Contrataciones de la Provincia de San Juan)**: Regula las compras, licitaciones públicas y adjudicaciones del Estado provincial.

### 13.3.2. Requisitos de Auditoría y Trazabilidad de Recursos Públicos
De acuerdo a las directivas del **Tribunal de Cuentas de la Provincia de San Juan** (organismo externo encargado de fiscalizar las cuentas públicas provinciales), todo sistema informático que gestione activos del Estado debe garantizar la inalterabilidad de los registros de egreso y posesión. El sistema DEPO cumple con esta exigencia mediante:
- El registro atómico y no eliminable de los movimientos de inventario en la tabla `movimiento_stock`.
- El registro de firmas de directores de área, supervisores y directivos en `aprobacion_seguimiento`.
- La emisión obligatoria del comprobante de entrega **por triplicado** (con copia física para la escuela solicitante, el depósito emisor y el Tribunal de Cuentas para rendición final).

---

## 13.4. Propiedad Intelectual y Licenciamiento

El software desarrollado se enmarca dentro de las regulaciones nacionales sobre derechos de autor y protección de programas de computación.

### 13.4.1. Régimen Jurídico del Software en Argentina
La **Ley N.º 11.723 de Propiedad Intelectual** asimila los programas de computación (software) a las obras literarias, protegiendo tanto el código fuente como el código objeto de la duplicación no autorizada. 
- **Titularidad**: El software ha sido desarrollado en el marco académico de la Tecnicatura Universitaria en Desarrollo de Software de la UCCuyo. Su titularidad intelectual originaria corresponde al autor (estudiante desarrollador). No obstante, en caso de implementación real en el Ministerio de Educación de San Juan, se prevé la firma de un convenio de cesión de derechos de uso de carácter no exclusivo y gratuito al organismo provincial, manteniendo el autor el derecho a su reconocimiento técnico y propiedad intelectual.

### 13.4.2. Licencias de Terceros y Compatibilidad
El sistema DEPO utiliza frameworks y librerías de código abierto (*Open Source*). A continuación, se presenta la tabla detallada de dependencias y sus licencias asociadas:

| Componente | Capa | Licencia de Tercero | Compatibilidad |
| :--- | :--- | :--- | :--- |
| **Node.js** | Backend | MIT / BSD | Totalmente compatible para entornos públicos. |
| **Express** | Backend | MIT | Permisiva, permite uso comercial y gubernamental libre. |
| **PostgreSQL Client (pg)**| Backend | MIT | Permisiva, sin restricciones. |
| **Bcryptjs / JWT** | Backend | MIT | Permisivas, uso libre para seguridad. |
| **React / React DOM** | Frontend | MIT | Permisiva, desarrollada por Meta. |
| **Leaflet / React Leaflet**| Frontend | BSD-2-Clause | Permisiva, permite integración libre de mapas. |
| **Recharts** | Frontend | MIT | Permisiva, permite generación libre de reportes. |
| **Playwright Test** | Testing | Apache 2.0 | Permisiva, permite automatización sin costes. |

Dado que la totalidad de las dependencias utilizadas poseen licencias permisivas (MIT, BSD, Apache 2.0), **no existe incompatibilidad legal** que restrinja el desarrollo, empaquetado o distribución comercial o estatal de la plataforma como software propietario cerrado para el Ministerio.

---

## 13.5. Accesibilidad y Derechos del Usuario

El sistema DEPO posee una interfaz web unificada, por lo que debe ajustarse a las regulaciones nacionales sobre acceso equitativo a la información digital.

La **Ley Nacional N.º 26.653 de Accesibilidad de la Información en Páginas Web** establece la obligatoriedad de que los portales del Estado nacional, provincial y municipal, además de empresas concesionarias de servicios públicos, respeten las pautas de accesibilidad web para garantizar el acceso a personas con discapacidad.
- **Pautas WCAG 2.1 AA**: El frontend de DEPO incorpora las pautas internacionales de accesibilidad web, tales como el contraste correcto de textos y fondos, la disponibilidad de textos alternativos para elementos no textuales y la compatibilidad con navegación mediante teclado para usuarios con discapacidad motriz u ocular que utilicen lectores de pantalla.

---

## 13.6. Responsabilidad Civil y Profesional

En el plano de la práctica profesional de la informática, es indispensable deslindar las responsabilidades civiles y profesionales asociadas al funcionamiento del sistema:

- **Prototipo Académico vs. Producción**: El software desarrollado en esta etapa se entrega bajo la modalidad de **Trabajo Final de Tecnicatura (TFT)**. En consecuencia, el desarrollador no asume responsabilidades por fallos del sistema o pérdidas de información si el Ministerio decide ponerlo en producción sin una auditoría técnica externa previa, pruebas de estrés formales y una firma de recepción de control técnico y conformidad.
- **Garantías y Limitaciones de Responsabilidad**: En los términos y condiciones se incluye una cláusula de exclusión que limita la responsabilidad del desarrollador a fines estrictamente de validación académica del prototipo de software.

---

## 13.7. Términos y Condiciones / Política de privacidad (Modelo Propuesto)

A continuación, se redacta el modelo de Política de Privacidad y Términos de Uso adaptado específicamente para los usuarios finales de la plataforma DEPO en el Ministerio de Educación de San Juan.

***

### POLÍTICA DE PRIVACIDAD Y TÉRMINOS DE USO: SISTEMA DEPO

**1. ACEPTACIÓN DE LOS TÉRMINOS**
El acceso y uso de la plataforma web DEPO (en adelante, "el Sistema") propiedad del Ministerio de Educación de la Provincia de San Juan (en adelante, "el Ministerio") atribuye la condición de Usuario Autorizado al agente público (Directivo, Supervisor, Funcionario u Operador) e implica la aceptación total de los presentes Términos de Uso y Políticas de Privacidad.

**2. PROPÓSITO DEL SISTEMA**
El Sistema tiene como única finalidad la gestión de existencias de stock, procesamiento de pedidos anuales y extraordinarios de insumos, adjudicación de licitaciones de compras y control logístico de distribución para los establecimientos educativos dependientes del Ministerio en la Provincia de San Juan.

**3. PROTECCIÓN DE DATOS PERSONALES (LEY N.º 25.326)**
En cumplimiento de la Ley N.º 25.326 de Protección de Datos Personales, el Ministerio informa al Usuario que los datos de carácter personal recolectados (DNI, Correo Electrónico, Nombre y Teléfono) serán tratados con la exclusiva finalidad de autenticar las credenciales del usuario, trazar las firmas electrónicas en el circuito de aprobaciones y emitir los comprobantes y remitos de mercadería.

**4. DERECHOS DE LOS TITULARES DE LOS DATOS (ARCO)**
El Usuario tiene derecho a ejercer los derechos de Acceso, Rectificación, Actualización y Supresión de sus datos personales. Para ello, deberá canalizar la solicitud formal ante el departamento de administración de usuarios de la Dirección de Informática del Ministerio.

**5. MEDIDAS DE SEGURIDAD**
El Ministerio y el Desarrollador declaran haber implementado medidas de seguridad de índole técnica, organizativa y tecnológica para garantizar la confidencialidad, integridad y seguridad de la información almacenada en el Sistema, incluyendo cifrado de contraseñas mediante Bcrypt y control de sesiones a través de tokens JWT firmados.

**6. CONDICIONES DE USO Y RESPONSABILIDAD DEL USUARIO**
El Usuario se compromete a realizar un uso lícito y diligente del Sistema, custodiando bajo su exclusiva responsabilidad la confidencialidad de su contraseña de acceso. Queda prohibida la cesión de credenciales a terceros. Toda acción realizada con una cuenta de usuario será atribuida de forma unívoca a su titular registrado en la base de datos de auditoría.

**7. PROPIEDAD INTELECTUAL**
El código fuente, bases de datos y diseño del Sistema están protegidos por la Ley N.º 11.723 de Propiedad Intelectual. Queda prohibida la reproducción, modificación o distribución no autorizada del Sistema por fuera de los convenios establecidos con el Ministerio de Educación de San Juan.

**8. LEY APLICABLE Y JURISDICCIÓN**
Para todas las cuestiones litigiosas que se susciten en relación con la interpretación, ejecución o incumplimiento de los presentes términos, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la Primera Circunscripción Judicial de la Provincia de San Juan, renunciando a cualquier otro fuero que pudiera corresponder.

***

## 13.8. Síntesis del Capítulo

Este décimo tercer capítulo ha analizado de manera exhaustiva el marco normativo nacional y provincial aplicable a la plataforma DEPO. Se determinó la compatibilidad y cumplimiento de la Ley N.º 25.326 de Protección de Datos Personales, garantizando la confidencialidad del padrón de usuarios y delimitando que no se administran datos sensibles de menores de edad. Asimismo, se alineó la trazabilidad del software con la Ley N.º 151-A de Contabilidad de San Juan y las directivas del Tribunal de Cuentas, y se demostró la compatibilidad de las licencias open source con la Ley N.º 11.723 de Propiedad Intelectual. Una vez establecido el marco legal, el Capítulo 14 detallará el Plan de Implementación, Despliegue y Capacitación a usuarios del sistema.
