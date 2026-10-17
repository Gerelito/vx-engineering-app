/** Fecha guardada en Firestore: texto ISO (registros antiguos), Timestamp del servidor o FieldValue al escribir. */
export type FechaFS = string | number | { toDate: () => Date } | { seconds: number } | import('firebase/firestore').FieldValue | null;

export interface DuenoUsuario {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface AccesoConfig {
  duenos: string[]; // Lista de hasta 3 correos en minúsculas
  auditoriaId?: string;
}

export type TipoCliente = 'Particular' | 'Empresa';
export type CanalContacto = 'WhatsApp' | 'Llamada';
export type OrigenCliente = 'Referido' | 'Redes sociales' | 'Carteles en la calle' | 'Cliente habitual' | 'Otro';

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string; // Formato visual para el usuario: ej. 7000-0001
  telefonoE164?: string; // Formato internacional: ej. +59170000001 (para WhatsApp, llamadas y duplicados)
  documentoIdentidad?: string | null; // CI con extensión o NIT
  correo?: string | null;
  direccion?: string | null;
  canalPreferido: CanalContacto;
  tipo: TipoCliente;
  origen: OrigenCliente;
  consentimientoFirmado: boolean;
  consentimientoArchivoId?: string | null; // ID en subcolección /clientes/{id}/archivos/{archivoId}
  consentimientoFecha?: string | null;
  consentimientoUsuarioEmail?: string | null;
  activo: boolean; // Desactivación lógica (prohibido borrar según reglas)
  notas?: string | null;
  auditoriaId?: string; // ID de auditoría atómica vinculada
  createdAt: FechaFS;
  updatedAt: FechaFS;
}

export type TipoCombustible = 'Gasolina' | 'Diésel' | 'GNV' | 'Híbrido' | 'Eléctrico';
export type TipoTransmision = 'Manual' | 'Automática' | 'Secuencial';
export type TipoTraccion = '4x2' | '4x4' | 'AWD';

export interface HistorialPropietario {
  clienteId: string;
  clienteNombre: string;
  telefono: string;
  fechaInicio: string; // dd/mm/aaaa
  fechaFin?: string | null; // dd/mm/aaaa o 'Actual'
  motivoCambio?: string | null;
}

export interface Vehiculo {
  id: string;
  placa: string; // Texto libre normalizado
  vin?: string | null; // Opcional, 17 caracteres
  marca: string;
  modelo: string;
  version?: string | null;
  anio: string;
  color: string;
  cilindrada?: string | null;
  combustible: TipoCombustible;
  transmision: TipoTransmision;
  traccion: TipoTraccion;
  vencimientoSoat?: string | null; // dd/mm/aaaa
  vencimientoItv?: string | null; // Inspección Técnica Vehicular dd/mm/aaaa
  propietarioActualId: string;
  historialPropietarios: HistorialPropietario[];
  ultimoKilometraje?: number | null;
  notasTecnicas?: string | null;
  activo: boolean; // Desactivación lógica (prohibido borrar según reglas)
  auditoriaId?: string; // ID de auditoría atómica vinculada
  createdAt: FechaFS;
  updatedAt: FechaFS;
}

export interface ArchivoCliente {
  id: string;
  clienteId: string;
  tipo: 'consentimiento' | 'recepcion' | 'otro';
  nombreArchivo: string;
  formato: 'jpeg' | 'png' | 'pdf';
  tamanioBytes: number;
  base64Data: string; // Almacenado en documento propio de Firestore (límite < 1 MB)
  subidoPorEmail: string;
  subidoPorNombre: string;
  fecha: string;
  reemplazado?: boolean; // Se marca true si es reemplazado por un nuevo consentimiento
  auditoriaId?: string; // ID de auditoría atómica vinculada
}

// -------------------------------------------------------------
// MÓDULO 2 & 3: ESTADOS, RECEPCIÓN Y TALLER
// -------------------------------------------------------------

export type EstadoOrden =
  | 'Recibido'
  | 'En diagnóstico'
  | 'Esperando aprobación'
  | 'Esperando repuestos'
  | 'En reparación'
  | 'Control de calidad'
  | 'Listo para entrega'
  | 'Entregado'
  | 'Cancelada';

export type PrioridadOrden = 'Normal' | 'Urgente';
export type TipoServicio = 'Programado' | 'Preventivo' | 'Correctivo';

export type NivelCombustible =
  | '0/8'
  | '1/8'
  | '2/8'
  | '3/8'
  | '4/8'
  | '5/8'
  | '6/8'
  | '7/8'
  | '8/8';

export interface DanioCarroceria {
  id: string;
  zona: 'frente' | 'trasera' | 'lateral_izq' | 'lateral_der' | 'techo';
  tipo: 'Rayón' | 'Abolladura' | 'Golpe' | 'Pintura desgastada' | 'Vidrio astillado';
  severidad: 'Leve' | 'Media' | 'Grave';
  xPercent: number; // Coordenada X porcentual en el diagrama SVG (0 - 100)
  yPercent: number; // Coordenada Y porcentual en el diagrama SVG (0 - 100)
  descripcion?: string | null;
}

export type TipoFotoRecepcion =
  | 'frente'
  | 'trasera'
  | 'lateral_izq'
  | 'lateral_der'
  | 'tablero_kilometraje'
  | 'neumaticos'
  | 'vin_chasis'
  | 'orden_firmada'
  | 'diagnostico'
  | 'adicional'
  | 'final'
  | 'piezas_retiradas'
  | 'salida_frente'
  | 'salida_trasera'
  | 'salida_lateral_izq'
  | 'salida_lateral_der'
  | 'salida_tablero'
  | 'rearmado'
  | 'acta_firmada';

export interface FotoOrden {
  id: string;
  ordenId: string;
  tipo: TipoFotoRecepcion;
  titulo: string;
  base64Data: string;
  tamanioBytes?: number;
  fecha?: any; // Firestore serverTimestamp
  fechaStr?: string;
  usuarioUid: string;
  usuarioNombre: string;
  auditoriaId: string;
  reemplazada?: boolean;
}

export interface AccesoriosChecklist {
  llantaRepuesto: boolean;
  gato: boolean;
  triangulos: boolean;
  extintor: boolean;
  radio: boolean;
  tapetes: boolean;
  documentos: boolean;
  objetosValor: boolean;
  objetosValorDetalle?: string | null;
  cantidadLlaves: number;
  obsNeumaticos?: string | null;
  obsLuces?: string | null;
  obsRetrovisores?: string | null;
}

export interface DiagnosticoGuiado {
  temperaturaMotor?: 'Frío' | 'Caliente' | 'Indistinto' | null;
  velocidad?: 'Baja (< 40 km/h)' | 'Alta (> 60 km/h)' | 'Ralentí' | 'Indistinto' | null;
  alAccionar?: 'Al frenar' | 'Al girar' | 'Al acelerar' | 'En baches' | 'Constante' | null;
  desdeCuando?: 'Hoy' | 'Hace unos días' | 'Más de una semana' | 'Intermitente' | null;
  frecuencia?: 'Siempre' | 'A veces' | 'Rara vez' | null;
}

export interface AutorizacionesCliente {
  autorizaDiagnostico: boolean;
  costoDiagnosticoBs: number;
  montoPreAutorizadoBs?: number | null;
  devolucionPiezas: boolean;
  aceptaContactoWhatsapp: boolean;
  aceptaCondicionesAlmacenaje: boolean;
  textoAlmacenaje?: string | null;
  nombreQuienEntrega?: string | null;
}

// -------------------------------------------------------------
// MÓDULO 3: MODELOS ESPECÍFICOS DE TALLER
// -------------------------------------------------------------

export interface HistorialEstado {
  estado: EstadoOrden;
  fecha: string; // ISO string
  fechaTimestamp?: number; // ms para cálculo preciso de tiempo
  usuarioUid: string;
  usuarioNombre: string;
  notas?: string | null;
  fechaEstimadaLlegadaRepuestos?: string | null;
}

export interface AprobacionCliente {
  aprobadoPorCliente: boolean;
  fechaAprobacion?: string | null;
  medioAprobacion?: 'WhatsApp' | 'Presencial' | 'Llamada' | 'Pre-autorizado' | null;
  montoAprobadoBs?: number | null;
  notasAprobacion?: string | null;
  registradoPorNombre?: string | null;
}

export interface IntervaloTiempo {
  id: string;
  inicio: string; // ISO
  fin?: string | null; // ISO
  duracionSegundos?: number;
  pausaMotivo?: 'Espera de repuesto' | 'Consulta técnica' | 'Almuerzo / Descanso' | 'Otra tarea' | null;
  notas?: string | null;
}

export interface TareaOrden {
  id: string;
  ordenId: string;
  descripcion: string;
  responsable: string;
  tiempoEstimadoMinutos: number;
  estado: 'Pendiente' | 'En curso' | 'Pausada' | 'Finalizada';
  intervalos: IntervaloTiempo[];
  tiempoRealMinutos: number;
  fechaCreacion: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface TrabajoTarifario {
  id: string;
  trabajo: string;
  horasEstandar: number;
}

export type EstadoSemaforo = 'Bueno' | 'Observación' | 'Urgente';

export interface ItemInspeccion {
  sistema: string;
  estado: EstadoSemaforo;
  observacion?: string | null;
}

export interface MedicionesTecnicas {
  espesorPastillasDelanterasIzqMm?: number | null;
  espesorPastillasDelanterasDerMm?: number | null;
  espesorPastillasTraserasIzqMm?: number | null;
  espesorPastillasTraserasDerMm?: number | null;
  espesorDiscosDelanterosMm?: number | null;
  espesorDiscosTraserosMm?: number | null;
  dibujoNeumaticoDelanteroIzqMm?: number | null;
  dibujoNeumaticoDelanteroDerMm?: number | null;
  dibujoNeumaticoTraseroIzqMm?: number | null;
  dibujoNeumaticoTraseroDerMm?: number | null;
  voltajeBateriaReposoV?: number | null;
  voltajeBateriaCargaV?: number | null;
  presionAceitePsi?: number | null;
  compresionCilindro1Psi?: number | null;
  compresionCilindro2Psi?: number | null;
  compresionCilindro3Psi?: number | null;
  compresionCilindro4Psi?: number | null;
  compresionCilindro5Psi?: number | null;
  compresionCilindro6Psi?: number | null;
}

export interface CodigoObd2 {
  id: string;
  codigo: string; // ej. P0300
  descripcion: string;
  estado: 'Activo' | 'Pendiente' | 'Histórico';
  freezeFrame?: string | null;
  borrado: boolean;
}

export interface HallazgoClasificado {
  id: string;
  descripcion: string;
  clasificacion: 'Seguridad (Urgente)' | 'Recomendado' | 'Puede esperar';
  sistema: string;
  costoEstimadoBs?: number | null;
}

export interface DiagnosticoTecnico {
  inspeccionMultipunto: ItemInspeccion[];
  mediciones: MedicionesTecnicas;
  codigosObd2: CodigoObd2[];
  hallazgos: HallazgoClasificado[];
  notaInternaTaller?: string | null;
  notaExplicativaCliente?: string | null;
  completado: boolean;
  actualizadoPor?: string | null;
  fechaActualizacion?: string | null;
}

export interface HallazgoAdicional {
  id: string;
  fecha: string;
  descripcion: string;
  piezasServiciosRequeridos?: string | null;
  costoEstimadoBs: number;
  fotoId?: string | null;
  fotoBase64?: string | null;
  autorizadoPorCliente: boolean;
  fechaAutorizacion?: string | null;
  registradoPor: string;
}

// -------------------------------------------------------------
// ORDEN DE SERVICIO INTEGRAL (MÓDULOS 2 Y 3)
// -------------------------------------------------------------

export interface OrdenServicio {
  id: string; // ID en Firestore
  folio: string; // 'OS-000001' o provisional 'PEND-xxxx'
  numeroFolio?: number | null; // Correlativo entero
  sincronizacionFolio: 'confirmado' | 'pendiente';
  codigoVerificacion: string; // 16+ caracteres aleatorios para QR
  estado: EstadoOrden;
  prioridad: PrioridadOrden;

  // Cliente
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteTelefonoE164?: string;
  clienteDocumento?: string | null;

  // Vehículo
  vehiculoId: string;
  vehiculoPlaca: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoAnio?: string | null;
  vehiculoColor?: string | null;

  // Datos de ingreso
  kilometraje: number;
  kilometrajeAnterior?: number | null;
  justificacionKilometraje?: string | null;
  nivelCombustible: NivelCombustible;
  fechaPrometidaEntrega: string; // dd/mm/aaaa hh:mm

  // Motivo y diagnóstico inicial
  motivoCliente: string; // Dictado por voz o escrito textual
  motivoTecnico?: string | null;
  tipoServicio: TipoServicio;
  sistemasAfectados: string[];
  preguntasGuiadas: DiagnosticoGuiado;
  lucesAdvertenciaTablero: string[];

  // Daños de carrocería en diagrama SVG
  daniosCarroceria: DanioCarroceria[];

  // Inventario y accesorios
  accesorios: AccesoriosChecklist;

  // Autorizaciones de ingreso
  autorizaciones: AutorizacionesCliente;

  // Firma física del cliente
  firmaSubida: boolean;
  firmaFotoId?: string | null;
  firmaFecha?: string | null;

  // Cantidad total de fotos registradas
  totalFotos: number;

  // Módulo 3: Asignación y Operación en Taller
  bahiaAsignada?: string | null;
  mecanicoResponsable?: string | null;
  historialEstados?: HistorialEstado[];
  fechaIngresoEstadoActual?: FechaFS;
  fechaIngresoEstadoActualServidor?: FechaFS;
  fechaEstimadaLlegadaRepuestos?: string | null;
  aprobaciones?: AprobacionCliente | null;
  tareas?: TareaOrden[];
  diagnosticoTecnico?: DiagnosticoTecnico | null;
  hallazgosAdicionales?: HallazgoAdicional[];
  presupuestoOriginalBs?: number | null;
  costoTotalEstimadoBs?: number | null;

  // Módulo 4/5: montos aprobados (principal = cotización principal, adicionales = complementarias)
  montoAprobadoPrincipalBs?: number | null;
  montoAprobadoAdicionalesBs?: number | null;
  cotizacionConPrecioPorDefinir?: boolean;
  cargosAdicionalesBs?: number | null; // almacenaje u otros cargos (Módulo 6)

  // Módulo 5: resumen de pagos (se actualiza en la misma transacción que cada pago)
  pagos?: ResumenPagosOrden | null;
  saldoDesde?: string | null;
  entregaConSaldo?: AutorizacionEntregaConSaldo | null;
  fechaEntrega?: string | null;

  // Módulo 6: control de calidad, aviso, entrega y cancelación
  controlesCalidad?: ControlCalidad[];
  retrabajos?: number;
  listoDesde?: string | null;
  avisoCliente?: AvisoCliente | null;
  actaEntrega?: ActaEntrega | null;
  cancelacion?: CancelacionOrden | null;

  // Metadatos
  creadoPorUid: string;
  creadoPorEmail: string;
  creadoPorNombre: string;
  auditoriaId: string;
  createdAt: FechaFS;
  updatedAt: FechaFS;
  fechaCreacion?: any; // Firestore serverTimestamp
}

export interface ContadorFolios {
  ultimo: number;
}

export interface AuditoriaEvento {
  id: string;
  modulo: string;
  accion:
    | 'Creación'
    | 'Modificación'
    | 'Desactivación'
    | 'Cambio de Propietario'
    | 'Consentimiento'
    | 'Acceso'
    | 'Recepción'
    | 'Firma Orden'
    | 'Foto Orden'
    | 'Estado Taller'
    | 'Diagnóstico'
    | 'Tarea'
    | 'Hallazgo Adicional'
    | 'Cotización'
    | 'Versión Cotización'
    | 'Aprobación Cotización'
    | 'Rechazo Cotización'
    | 'Descuento Cotización'
    | 'Plantilla'
    | string;
  entidad:
    | 'clientes'
    | 'vehiculos'
    | 'configuracion'
    | 'archivos'
    | 'acceso'
    | 'ordenes'
    | 'fotos'
    | 'contadores'
    | 'cotizaciones'
    | 'plantillas'
    | 'pagos'
    | 'contactos'
    | 'cajas';
  entidadId: string;
  antes: Record<string, any> | null;
  despues: Record<string, any> | null;
  usuarioUid: string;
  usuarioEmail: string;
  usuarioNombre: string;
  fecha?: any; // Firestore serverTimestamp
  fechaLocalStr?: string; // Formato legible para visualización en UI
}

export interface TallerConfig {
  nombre: string;
  logoUrl?: string | null;
  direccion: string;
  ciudad: string;
  pais: string;
  telefonoWhatsapp: string;
  horario: string;
  moneda: string; // 'Bs'
  formatoFecha: string; // 'dd/mm/aaaa'
  almacenajeDiasGratis: number;
  almacenajeCostoDiarioBs: number;
  tarifaHoraEstandarBs: number;
  margenMinimoPorcentaje: number;
  vigenciaCotizacionDias: number;
  alertaPresupuestoPorcentaje: number;
  dominioVerificacionQr: string;

  // Módulo 3: Configuración de Bahías, Mecánicos y Alertas
  bahiasDisponibles: string[];
  mecanicosResponsables: string[];
  trabajosTarifario: TrabajoTarifario[];
  limiteDiagnosticoHoras: number;
  factorTiempoEstimadoReparacion: number;
  limiteControlCalidadHoras: number;

  // Módulo 4: Plantillas de servicios frecuentes
  plantillasCotizacion?: PlantillaCotizacion[];

  // Módulo 5: medios de pago disponibles (ej. QR, Efectivo)
  mediosPago?: string[];

  auditoriaId?: string; // ID de auditoría atómica vinculada
}

// -------------------------------------------------------------
// MÓDULO 4: COTIZACIONES Y APROBACIONES
// -------------------------------------------------------------

export type TipoItemCotizacion = 'mano_obra' | 'repuesto' | 'terceros';
export type CalidadRepuesto = 'original' | 'alterno' | 'usado';
export type ClasificacionHallazgoCotizacion =
  | 'Seguridad (Urgente)'
  | 'Recomendado'
  | 'Puede esperar'
  | 'General';

export interface OpcionComparable {
  id: string;
  titulo: string; // ej. 'Repuesto Original Bosch' vs 'Alterno OEM'
  calidad: CalidadRepuesto;
  marca: string;
  costoBs: number;
  margenPorcentaje: number;
  precioBs: number;
  garantia: string; // ej. '12 meses o 20.000 km'
  diferenciaPrecioBs?: number;
}

export interface ItemCotizacion {
  id: string;
  tipo: TipoItemCotizacion;
  descripcion: string;
  clasificacion: ClasificacionHallazgoCotizacion;
  origenHallazgoId?: string | null;

  // Mano de obra
  codigoManoObra?: string | null;
  horasManoObra?: number | null;
  tarifaHoraBs?: number | null;

  // Repuesto
  marcaRepuesto?: string | null;
  calidadRepuesto?: CalidadRepuesto | null;
  cantidad?: number;
  costoUnitarioBs?: number; // Costo interno
  margenPorcentaje?: number; // Margen interno

  // Terceros
  proveedorTerceros?: string | null;

  // Precio final calculado o Por definir
  precioPorDefinir: boolean;
  precioUnitarioCalculadoBs: number; // Precio de venta sugerido unitario
  precioTotalBs: number; // Cantidad * precio unitario (0 si por definir)

  // Alternativas comparables (ej. Original vs Alterno)
  opcionesComparables?: OpcionComparable[];
  opcionSeleccionadaId?: string | null;

  // Descuento por ítem (solo dueños)
  descuentoPorcentaje?: number;
  descuentoMontoBs?: number;
  descuentoMotivo?: string | null;

  // Estado de aprobación (para aprobación parcial)
  aprobado?: boolean | null; // true = aprobado, false = rechazado, null = pendiente

  // Alerta interna de margen bajo
  alertaMargenBajo?: boolean;
}

export type EstadoCotizacion =
  | 'Borrador'
  | 'Enviada'
  | 'Aprobada_Total'
  | 'Aprobada_Parcial'
  | 'Rechazada'
  | 'Vencida';

export interface RegistroAprobacionCliente {
  medio: 'En persona' | 'Llamada telefónica' | 'WhatsApp';
  fechaHora: string;
  nombreAprobador: string;
  nota: string; // Obligatoria
  evidenciaFotoBase64?: string | null;
  evidenciaFotoNombre?: string | null;
  esAprobacionParcial: boolean;
  montoAprobadoBs: number;
  dentroDePreAutorizacion?: boolean;
  registradoPorUid: string;
  registradoPorEmail: string;
  registradoPorNombre: string;
}

export interface CotizacionOrden {
  id: string; // 'v1', 'v2', etc. o cot_...
  versionNumero: number;
  ordenId: string;
  folioOrden: string;
  clienteId: string;
  clienteNombre: string;
  vehiculoPlaca: string;
  estado: EstadoCotizacion;
  items: ItemCotizacion[];

  // Cálculos de totales
  tienePrecioPorDefinir: boolean;
  subtotalBs: number | null; // Si tienePrecioPorDefinir = true, esto es null
  descuentoTotalMontoBs?: number;
  descuentoTotalMotivo?: string | null;
  totalBs: number | null; // Si tienePrecioPorDefinir = true, esto es null ("Pendiente de negociación")
  totalAprobadoBs?: number | null;

  // Métricas financieras internas (NUNCA mostradas al cliente)
  costoTotalInternoBs?: number;
  margenPromedioPorcentaje?: number;
  hayAlertaMargenBajo: boolean;

  // Complementaria de trabajos adicionales
  esComplementariaTrabajoAdicional?: boolean;
  trabajoAdicionalId?: string | null;

  // Vigencia
  diasVigencia: number;
  fechaEmision: string; // ISO
  fechaVencimiento: string; // ISO
  esVencida?: boolean;

  // Aprobación o Rechazo
  aprobacion?: RegistroAprobacionCliente | null;
  motivoRechazo?: string | null;
  fechaRechazo?: string | null;

  // Historial de versiones
  historialVersiones?: {
    version: number;
    fecha: string;
    usuarioNombre: string;
    motivoCambio: string;
  }[];

  // Metadatos
  creadoPorUid: string;
  creadoPorEmail: string;
  creadoPorNombre: string;
  auditoriaId: string;
  createdAt: any;
  updatedAt: any;
}

export interface PlantillaCotizacion {
  id: string;
  nombre: string;
  descripcion?: string | null;
  items: Omit<ItemCotizacion, 'id' | 'aprobado'>[];
  activo: boolean;
}

// -------------------------------------------------------------
// MÓDULO 5: CAJA Y PAGOS
// -------------------------------------------------------------

export type TipoPago = 'Anticipo' | 'Abono' | 'Pago final' | 'Anulación' | 'Devolución';

export interface MontoPorMedio {
  medio: string; // 'QR', 'Efectivo' u otro configurado
  montoBs: number; // negativo en anulaciones
}

export interface PagoOrden {
  id: string;
  ordenId: string;
  folio: string;
  clienteId: string;
  clienteNombre: string;
  vehiculoPlaca: string;
  tipo: TipoPago;
  montos: MontoPorMedio[];
  totalBs: number;
  concepto: string;
  comprobanteBase64?: string | null;
  aCuenta: boolean; // registrado mientras el precio estaba pendiente de negociación
  anulaPagoId?: string | null;
  motivoAnulacion?: string | null;
  fechaDia: string; // aaaa-mm-dd en hora de Bolivia
  fechaLocal: string; // ISO del dispositivo (referencia)
  fecha?: FechaFS; // hora del servidor
  registradoPorUid: string;
  registradoPorEmail: string;
  registradoPorNombre: string;
  auditoriaId: string;
}

export interface ResumenPagosOrden {
  porMedio: Record<string, number>;
  totalPagadoBs: number;
  cantidadPagos: number;
  ultimoPagoFecha?: string | null;
  ultimoPagoMontoBs?: number | null;
}

export interface AutorizacionEntregaConSaldo {
  autorizada: boolean;
  motivo: string;
  fechaCompromisoPago?: string | null;
  saldoAlAutorizarBs: number;
  autorizadoPorNombre: string;
  autorizadoPorEmail: string;
  fecha: string;
}

export type EstadoTotalOrden = 'aprobado' | 'pendiente_negociacion' | 'sin_aprobacion';

export interface FinanzasOrden {
  estadoTotal: EstadoTotalOrden;
  totalAprobadoBs: number | null;
  porMedio: Record<string, number>;
  pagadoQRBs: number;
  pagadoEfectivoBs: number;
  pagadoOtrosBs: number;
  totalPagadoBs: number;
  saldoBs: number | null;
  pagosACuenta: boolean;
}

export type MedioContacto = 'Llamada' | 'WhatsApp' | 'Mensaje' | 'Visita';
export type MotivoContacto = 'Cobranza' | 'Aviso de vehículo listo' | 'Cotización' | 'Seguimiento' | 'Envío de documento' | 'Otro';

export interface ContactoCliente {
  id: string;
  clienteId: string;
  clienteNombre: string;
  ordenId?: string | null;
  folio?: string | null;
  medio: MedioContacto;
  motivo: MotivoContacto;
  resumen: string;
  resultado: string;
  fechaLocal: string;
  fecha?: FechaFS;
  registradoPorUid: string;
  registradoPorEmail: string;
  registradoPorNombre: string;
  auditoriaId: string;
}

export interface CierreCaja {
  id: string; // aaaa-mm-dd
  fechaDia: string;
  totalPorMedio: Record<string, number>;
  totalRecibidoBs: number;
  efectivoEsperadoBs: number;
  efectivoContadoBs: number;
  diferenciaBs: number;
  cantidadMovimientos: number;
  nota?: string | null;
  cerrado: boolean;
  cerradoPorNombre?: string | null;
  cerradoPorEmail?: string | null;
  fechaCierreLocal?: string | null;
  reaperturas?: { fecha: string; motivo: string; usuarioNombre: string; usuarioEmail: string }[];
  auditoriaId: string;
}

// -------------------------------------------------------------
// MÓDULO 6: ENTREGA Y CANCELACIÓN
// -------------------------------------------------------------

export interface PruebaRuta {
  realizada: boolean;
  kmInicial?: number | null;
  kmFinal?: number | null;
  recorrido?: string | null;
  observaciones?: string | null;
  resultado?: 'Satisfactoria' | 'Con observaciones' | 'No satisfactoria' | null;
}

export interface ControlCalidad {
  id: string;
  fecha: string;
  revisor: string;
  revisionPropia: boolean;
  trabajosConfirmados: { descripcion: string; ok: boolean }[];
  checklist: Record<string, boolean>;
  pruebaRuta: PruebaRuta;
  resultado: 'Aprobado' | 'Rechazado';
  motivoRechazo?: string | null;
  fotosIds?: string[];
  registradoPorNombre: string;
}

export interface AvisoCliente {
  fecha: string;
  medio: 'WhatsApp' | 'Llamada' | 'Mensaje' | 'En persona';
  resultado: string;
  registradoPorNombre: string;
}

export interface ActaEntrega {
  tipo: 'entrega' | 'devolucion';
  fecha: string;
  kmSalida: number;
  quienRetira: { nombre: string; documento: string; relacion: string };
  llavesDevueltas: number;
  objetosDevueltos: Record<string, boolean>;
  piezasRetiradasEntregadas?: boolean | null;
  trabajosRealizados: string[];
  recomendacionesNoAprobadas: string[];
  almacenajeDias: number;
  almacenajeBs: number;
  totalBs: number | null;
  pagadoBs: number;
  saldoAlEntregarBs: number | null;
  observaciones?: string | null;
  fotosSalidaIds?: string[];
  firmaSubida: boolean;
  firmaFotoId?: string | null;
  registradoPorNombre: string;
}

export type MotivoCancelacion =
  | 'El cliente rechazó la cotización'
  | 'El cliente no contestó'
  | 'Se llevó el auto a otro taller'
  | 'El repuesto no existe o es muy caro'
  | 'El taller no puede hacer el trabajo'
  | 'Otro';

export interface CancelacionOrden {
  estado: 'abierta' | 'cerrada';
  motivo: MotivoCancelacion;
  nota?: string | null;
  fecha: string;
  registradoPorNombre: string;
  registradoPorEmail: string;
  vehiculoDesarmado: boolean;
  rearmado?: { completado: boolean; fecha?: string | null; notas?: string | null; fotosIds?: string[] } | null;
  cobrarDiagnostico: boolean;
  montoDiagnosticoBs: number;
  repuestosLiberados: boolean; // inventario es fase 2; queda registrado
  seguimientoFecha?: string | null; // aaaa-mm-dd (cancelación + 30 días)
  seguimientoRealizado?: boolean;
  seguimientoNota?: string | null;
  fechaCierre?: string | null;
}
