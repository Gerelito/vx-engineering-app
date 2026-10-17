# Sistema Integral de Gestión para Taller Mecánico Automotriz — Plan Definitivo (Firebase + Módulos 1 al 10)

Aplicación web cliente-servidor integral, responsiva e instalable (PWA) diseñada para la operación de punta a punta de un taller mecánico automotriz en Bolivia, operada en tiempo real por sus 3 dueños mediante **Google Firebase en la nube**, sincronización offline reactiva, generación de archivos PDF versionados según Anexo A, verificación QR pública en colección aislada y auditoría inmutable escrita exclusivamente por el servidor.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Arquitectura y definiciones acordadas con el usuario para la construcción por fases:

- **Infraestructura Firebase en la Nube**:
  - **Hosting**: Firebase Hosting con CDN global, SSL automático y soporte de dominio personalizado.
  - **Base de Datos**: Cloud Firestore con soporte multi-dispositivo en tiempo real (`onSnapshot`) y persistencia offline integrada.
  - **Autenticación**: Firebase Authentication con registro público desactivado (whitelist restringida exclusivamente a los 3 dueños del taller).
  - **2FA & Códigos de Recuperación**: Verificación en dos pasos TOTP en servidor; los 10 códigos de recuperación se validan en backend. Si un dueño extravía su acceso, otro dueño puede autorizar el restablecimiento (auditado críticamente).
  - **Almacenamiento de Archivos**: Firebase Storage en región estándar de cuota gratuita (ej. `us-central1`), con compresión de fotos en el dispositivo cliente (< 250 KB) para mantener el consumo muy por debajo de los límites gratuitos.
  - **Alerta de Presupuesto**: Configurada en Google Cloud Console en **US$ 2.00** para garantizar costo cero sorpresas.
- **Auditoría Inmutable de Servidor (Cloud Functions)**:
  - La app cliente **NO** escribe en `/auditoria`.
  - Las reglas de seguridad de Firestore bloquean cualquier escritura directa desde el cliente:
    `match /auditoria/{id} { allow read: if isSignedIn(); allow write: if false; }`
  - La auditoría es generada y escrita **exclusivamente por Cloud Functions de servidor con triggers** (`onCreate`, `onUpdate`, `onDelete`) en las colecciones del sistema (`clientes`, `vehiculos`, `ordenes`, `pagos`, `cotizaciones`, etc.), capturando usuario autenticado, timestamp de servidor, valores anteriores y nuevos. Nadie puede omitirla ni manipularla.
- **QR Público Aislado (`/verificaciones/{token}`)**:
  - Las órdenes de servicio (`/ordenes`) **nunca** son de lectura pública.
  - Se utiliza una colección pública independiente: `/verificaciones/{token}` que contiene **únicamente los datos indispensables para el cliente** (folio, fecha, nombre cliente, vehículo, estado traducido según Anexo A.3, autenticidad y fecha estimada).
  - Es sincronizada y alimentada exclusivamente por Cloud Functions de servidor al cambiar el estado o los precios de la orden.
- **Caché Offline, Clientes Provisionales y Cola de Fotos**:
  - Sin conexión: los datos se guardan en IndexedDB localmente.
  - Un cliente nuevo creado offline se etiqueta como `esProvisional: true`. Al volver la red, el sistema valida duplicados por teléfono antes de consolidar.
  - El folio oficial correlativo (`OS-000001`) lo asigna el servidor de forma transaccional. Sin red, la orden recibe un folio provisional (`TEMP-xxxxxx`) que se sustituye automáticamente al sincronizar.
  - Cola propia en IndexedDB para subir fotos pendientes de inspección en segundo plano aunque se cierre el navegador.
- **Respaldos Diarios y Restauración Segura**:
  - Respaldo programado cada 24 horas tanto de Firestore como de los archivos de Firebase Storage (fotos y PDFs) hacia un bucket independiente.
  - La restauración exige **confirmación doble**, queda registrada en la auditoría inmutable y ejecuta primero una prueba en una base de datos/copia temporal antes de aplicar los datos.
- **Construcción Modular**: Se inicia con el **Módulo 1 (Clientes y Vehículos)** completo y funcional.

---

### 1. Overview & Core Concept

- **Qué hace la aplicación**: Plataforma operativa para taller mecánico en Bolivia que resuelve de punta a punta:
  - Ficha única de clientes y vehículos con control estricto de duplicados por teléfono.
  - Recepción de vehículos con fotos obligatorias y marcado táctil de daños previos en diagrama de 4 vistas (< 5 min).
  - Operación en taller vía tablero Kanban, asignación de bahías, cronómetro de tareas y diagnóstico multipunto con códigos OBD-II.
  - Cotizaciones con items definidos o «Por definir» (alerta de 15% y pre-autorización).
  - Caja con pagos en QR y efectivo, arqueo diario y cuentas por cobrar con antigüedad por color.
  - Control de calidad (QC) con checklist y prueba de ruta; entrega formal o cancelación con rearmado y acta.
  - Emisión de documentos PDF oficiales según el Anexo A y verificación QR en tiempo real.

---

### 2. User Experience & Visual Design

#### Arquitectura de Navegación y UI
- Cumple con la constitución de diseño: navegación superior de 3 zonas con marca única («Taller Mecánico Automotriz»), enlaces directos en una línea, y avatar con estado de sesión del dueño activo.
- Panel de trabajo adaptativo para celulares y tabletas en fosa/bahía (botones táctiles $\ge 44\text{px}$, tipografía tabular para montos y kilometrajes, colores sobrios: `#0F172A`, `#1E40AF`, acento ámbar `#D97706` y esmeralda `#16A34A`).
- Cero píldoras decorativas vacías. Metadatos legibles separados por `·`.

---

### 3. Modelo de Entidades en Firestore

- `/usuarios/{uid}`: `id`, `nombre`, `email`, `twoFactorEnabled`, `twoFactorRecoveryCodesHash`, `activo`, `ultimoAcceso`.
- `/clientes/{clienteId}`: `id`, `nombre`, `telefono` (clave de control de duplicados), `documentoIdentidad` (CI con extensión o NIT), `correo`, `direccion`, `canalPreferido` (Llamada/WhatsApp), `tipo` (Particular/Empresa), `origen`, `consentimientoFirmado` (boolean), `consentimientoDocUrl`, `consentimientoFecha`, `consentimientoUsuarioId`, `esProvisional` (boolean), `notas`.
- `/vehiculos/{vehiculoId}`: `id`, `placa` (texto libre), `vin` (validación opcional 17 car.), `marca`, `modelo`, `version`, `año`, `color`, `cilindrada`, `combustible`, `transmision`, `traccion`, `vencimientoSoat`, `vencimientoItv`, `propietarioActualId`, `historialPropietarios`: array de `{ clienteId, fechaInicio, fechaFin }`.
- `/bahias/{bahiaId}`: `id`, `nombre`, `descripcion`, `estado`, `ordenActualId`.
- `/tareas/{tareaId}`: `id`, `ordenId`, `descripcion`, `responsableId`, `tiempoEstimadoMin`, `tiempoRealMin`, `estado`, `fechaInicio`, `fechaFin`, `pausas`.
- `/ordenes/{ordenId}`: `folio` (`OS-000001` o provisional), `clienteId`, `vehiculoId`, `quienEntrego`, `kilometrajeIngreso`, `combustibleOctavos`, `prioridad`, `fechaIngreso`, `fechaEstimadaEntrega`, `usuarioReceptorId`, `responsableId`, `bahiaId`, `estadoActual` (8 estados), `danosDiagrama`, `fotosIngreso`, `objetosAccesorios`, `llavesRecibidas`, `autorizaciones`, `diagnostico`, `controlCalidad`, `entrega`, `cancelacion`.
- `/cotizaciones/{cotizacionId}`: `ordenId`, `numeroVersion`, `fechaCreacion`, `usuarioId`, `vigenciaHasta`, `items`, `estadoVersion`, `evidenciaAprobacion`.
- `/pagos/{pagoId}`: `ordenId`, `fechaHora`, `montoBs`, `medio`, `tipo`, `concepto`, `usuarioId`, `comprobanteUrl`, `anulado`.
- `/cierres_caja/{cierreId}`: `fechaHoraCierre`, `usuarioId`, `totalRecibidoQrBs`, `totalRecibidoEfectivoBs`, `arqueoEfectivoBs`, `diferenciaBs`, `observaciones`.
- `/documentos/{docId}`: `ordenId`, `tipoDocumento`, `numeroVersion`, `tokenUnico`, `archivoPdfUrl`, `estado` (activo/reemplazado/desactivado).
- `/verificaciones/{token}`: **Colección pública aislada**. Solo lectura para clientes. Campos: `folio`, `fechaEmision`, `clienteNombre`, `vehiculo`: `{ marca, modelo, placa }`, `estadoCliente` (según Anexo A.3), `entregaEstimada`, `documentoAutentico`: true, `activo`: true.
- `/bitacora_contactos/{id}`: `clienteId`, `ordenId`, `fechaHora`, `medio`, `usuarioId`, `resumen`, `resultado`.
- `/auditoria/{id}`: **Escritura restringida a Cloud Functions**. `timestamp`, `usuarioId`, `usuarioNombre`, `modulo`, `accion`, `registroId`, `valorAnterior`, `valorNuevo`, `fotoAnteriorUrl`, `esSensible`.

---

### 4. Plan de Ejecución Módulo por Módulo

- **Módulo 1: Clientes y Vehículos** (Turno actual):
  - Ficha de cliente con validación y detección inmediata de duplicados por teléfono.
  - Registro de vehículos con placa libre, validación de VIN (17 caracteres), SOAT/ITV e historial de propietarios.
  - Estado «Consentimiento pendiente» con subida de documento escaneado/fotografiado.
  - Selector de clientes particulares y empresas, canal de contacto (Llamada/WhatsApp) con acceso directo.
  - Soporte de clientes provisionales para modo offline.
- **Módulo 2**: Recepción e Inspección (diagrama de 4 vistas, fotos obligatorias con compresión, folio correlativo y orden de servicio).
- **Módulo 3**: Taller, Bahías, Kanban, Cronómetro de tareas y Diagnóstico multipunto.
- **Módulo 4**: Cotizaciones, items «Por definir», versiones y aprobaciones.
- **Módulo 5**: Caja, Pagos QR/efectivo, Cuentas por cobrar y Cierre de caja.
- **Módulo 6**: Control de calidad, Prueba de ruta, Entrega y Cancelación.
- **Módulo 7**: Documentos PDF oficiales Anexo A, QR público y WhatsApp.
- **Módulo 8**: Historial del vehículo, línea de tiempo, vista de componentes y alertas.
- **Módulo 9**: Auditoría inmutable de servidor y exportación.
- **Módulo 10**: Configuración del taller, usuarios, 2FA, tarifas y textos legales.
