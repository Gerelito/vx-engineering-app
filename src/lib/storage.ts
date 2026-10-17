import {
  Cliente,
  Vehiculo,
  AuditoriaEvento,
  TallerConfig,
  DuenoUsuario,
  ArchivoCliente,
  AccesoConfig,
  OrdenServicio,
  FotoOrden,
  HistorialEstado,
  TareaOrden,
  DiagnosticoTecnico,
  AprobacionCliente,
  HallazgoAdicional,
  CotizacionOrden,
  ItemCotizacion,
  PlantillaCotizacion,
  RegistroAprobacionCliente,
} from '../types';
import { db } from './firebase';
import { sincronizarVerificacion } from './verificacion';
import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';

export const DEFAULT_CONFIG: TallerConfig = {
  nombre: 'VX Engineering',
  direccion: '',
  ciudad: '',
  pais: 'Bolivia',
  telefonoWhatsapp: '',
  horario: '',
  moneda: 'Bs',
  formatoFecha: 'dd/mm/aaaa',
  almacenajeDiasGratis: 3,
  almacenajeCostoDiarioBs: 35,
  tarifaHoraEstandarBs: 90,
  margenMinimoPorcentaje: 25,
  vigenciaCotizacionDias: 7,
  alertaPresupuestoPorcentaje: 15,
  dominioVerificacionQr: 'https://gerelito.github.io/vx-engineering-app',
  mediosPago: ['QR', 'Efectivo'],

  // Módulo 3: Bahías, Mecánicos responsables, Tarifario estándar y Límites de alerta
  bahiasDisponibles: ['Bahía 1', 'Bahía 2', 'Bahía 3'],
  // Los responsables reales los cargan los dueños en Configuración
  mecanicosResponsables: [],
  trabajosTarifario: [
    { id: 'tar_1', trabajo: 'Cambio de aceite y filtro motor', horasEstandar: 0.75 },
    { id: 'tar_2', trabajo: 'Cambio de pastillas y discos delanteros', horasEstandar: 1.5 },
    { id: 'tar_3', trabajo: 'Escaneo OBD-II e informe diagnóstico', horasEstandar: 1.0 },
    { id: 'tar_4', trabajo: 'Afinamiento de motor e inyectores', horasEstandar: 2.5 },
    { id: 'tar_5', trabajo: 'Revisión general de suspensión y rótulas', horasEstandar: 1.25 },
    { id: 'tar_6', trabajo: 'Purgado y cambio de líquido de frenos', horasEstandar: 1.0 },
    { id: 'tar_7', trabajo: 'Cambio de kit de embrague', horasEstandar: 4.5 },
    { id: 'tar_8', trabajo: 'Control de calidad final y prueba de ruta', horasEstandar: 0.5 },
  ],
  limiteDiagnosticoHoras: 4,
  factorTiempoEstimadoReparacion: 1.5,
  limiteControlCalidadHoras: 4,
};

export function getFechaHoraActual(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// -------------------------------------------------------------
// LIMPIEZA DE CAMPOS UNDEFINED PARA FIRESTORE (Evita error WriteBatch.set)
// -------------------------------------------------------------

export function limpiarUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => limpiarUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    // Si es un FieldValue de Firestore o Date, no alterar
    if ('_methodName' in (obj as any) || obj instanceof Date) {
      return obj;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = typeof value === 'object' && value !== null ? limpiarUndefined(value) : value;
      }
    }
    return clean as T;
  }
  return obj;
}

// -------------------------------------------------------------
// NORMALIZACIÓN Y CONTROL DE TELÉFONOS (Bolivia +591)
// -------------------------------------------------------------

export function normalizarTelefono(tel: string): string {
  if (!tel) return '';
  let digits = tel.replace(/\D/g, '');
  if (digits.startsWith('591') && digits.length > 8) {
    digits = digits.substring(3);
  }
  if (digits.startsWith('0') && digits.length > 8) {
    digits = digits.substring(1);
  }
  return digits;
}

export function obtenerTelefonoE164(tel: string): string {
  const digits = normalizarTelefono(tel);
  return digits ? `+591${digits}` : '';
}

export function formatearTelefonoBolivia(tel: string): string {
  const digits = normalizarTelefono(tel);
  if (!digits) return '';
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Función única universal para formatear cualquier fecha y hora en la app y documentos:
 * - Zona horaria de Bolivia: America/La_Paz (UTC-4)
 * - Formato: dd/mm/aaaa hh:mm (o solo dd/mm/aaaa si incluirHora = false)
 */
/**
 * Convierte cualquier representación de fecha guardada (ISO, número, Date,
 * Timestamp de Firestore u objeto {seconds}) a milisegundos. Devuelve null si no es válida
 * (por ejemplo, un serverTimestamp todavía pendiente).
 */
// -------------------------------------------------------------
// MÓDULO 9: datos comunes de cada registro de auditoría
// -------------------------------------------------------------
/** Navegador y sistema resumidos, p. ej. "Chrome 130 · Android 14 · móvil". */
export function resumenDispositivo(): string {
  if (typeof navigator === 'undefined') return 'desconocido';
  const ua = navigator.userAgent || '';
  const nav =
    (/Edg\/(\d+)/.exec(ua) && `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`) ||
    (/OPR\/(\d+)/.exec(ua) && `Opera ${/OPR\/(\d+)/.exec(ua)![1]}`) ||
    (/SamsungBrowser\/(\d+)/.exec(ua) && `Samsung Internet ${/SamsungBrowser\/(\d+)/.exec(ua)![1]}`) ||
    (/(?:Chrome|CriOS)\/(\d+)/.exec(ua) && `Chrome ${/(?:Chrome|CriOS)\/(\d+)/.exec(ua)![1]}`) ||
    (/(?:Firefox|FxiOS)\/(\d+)/.exec(ua) && `Firefox ${/(?:Firefox|FxiOS)\/(\d+)/.exec(ua)![1]}`) ||
    (/Version\/(\d+).*Safari/.exec(ua) && `Safari ${/Version\/(\d+).*Safari/.exec(ua)![1]}`) ||
    'Navegador';
  const so =
    (/Android ([\d.]+)/.exec(ua) && `Android ${/Android ([\d.]+)/.exec(ua)![1].split('.')[0]}`) ||
    (/(?:iPhone|iPad).*OS (\d+)/.exec(ua) && `iOS ${/(?:iPhone|iPad).*OS (\d+)/.exec(ua)![1]}`) ||
    (/Windows NT/.test(ua) && 'Windows') ||
    (/Mac OS X/.test(ua) && 'macOS') ||
    (/CrOS/.test(ua) && 'ChromeOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    'Sistema';
  const movil = /Mobi|Android|iPhone|iPad/.test(ua);
  return `${nav} · ${so}${movil ? ' · móvil' : ''}`;
}

/** Completa un registro de auditoría con "sensible" (por defecto false) y "dispositivo". */
export function datosAuditoria<T extends Record<string, any>>(d: T, sensible?: boolean): T & { sensible: boolean; dispositivo: string } {
  return { ...d, sensible: d.sensible ?? sensible ?? false, dispositivo: resumenDispositivo() };
}

export function aMilisegundos(fecha: any): number | null {
  if (fecha === null || fecha === undefined || fecha === '') return null;
  let ms: number;
  if (typeof fecha?.toMillis === 'function') ms = fecha.toMillis();
  else if (typeof fecha?.toDate === 'function') ms = fecha.toDate().getTime();
  else if (fecha instanceof Date) ms = fecha.getTime();
  else if (typeof fecha === 'number') ms = fecha;
  else if (typeof fecha === 'string') ms = Date.parse(fecha.includes('T') || fecha.endsWith('Z') ? fecha : fecha.replace(' ', 'T'));
  else if (typeof fecha?.seconds === 'number') ms = fecha.seconds * 1000;
  else return null;
  return isNaN(ms) ? null : ms;
}

export function formatearFecha(fecha: any, incluirHora: boolean = true): string {
  if (!fecha) return '—';
  let d: Date;
  if (typeof fecha?.toDate === 'function') {
    d = fecha.toDate();
  } else if (fecha instanceof Date) {
    d = fecha;
  } else if (typeof fecha === 'number') {
    d = new Date(fecha);
  } else if (typeof fecha === 'string') {
    if (fecha.includes('T') || fecha.endsWith('Z')) {
      d = new Date(fecha);
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(fecha)) {
      d = new Date(fecha.replace(' ', 'T'));
    } else {
      d = new Date(fecha);
    }
  } else if (fecha?.seconds) {
    d = new Date(fecha.seconds * 1000);
  } else {
    return '—';
  }

  if (isNaN(d.getTime())) return '—';

  try {
    const formatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(incluirHora
        ? {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }
        : {}),
    });

    const parts = formatter.formatToParts(d);
    const p: Record<string, string> = {};
    for (const part of parts) {
      p[part.type] = part.value;
    }

    if (incluirHora) {
      return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
    }
    return `${p.day}/${p.month}/${p.year}`;
  } catch (e) {
    return '—';
  }
}

/**
 * Formatea montos en Bolivianos con formato 1.500,00 Bs:
 * Si es null o indefinido (ej. "Precio por definir"), devuelve "Pendiente de negociación"
 */
export function formatearMonedaBs(monto: number | null | undefined): string {
  if (monto === null || monto === undefined || isNaN(monto)) {
    return 'Pendiente de negociación';
  }
  return (
    monto.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' Bs'
  );
}

export function buscarDuplicadoPorTelefono(
  telefono: string,
  clientesExistentes: Cliente[],
  clienteIdExcluir?: string
): Cliente | null {
  const telNorm = normalizarTelefono(telefono);
  if (!telNorm || telNorm.length < 6) return null;

  for (const c of clientesExistentes) {
    if (!c.activo) continue; // Solo comparar contra clientes activos
    if (clienteIdExcluir && c.id === clienteIdExcluir) continue;
    const cTelNorm = normalizarTelefono(c.telefonoE164 || c.telefono);
    if (cTelNorm === telNorm) {
      return c;
    }
  }
  return null;
}

export function normalizarPlaca(placa: string): string {
  if (!placa) return '';
  return placa.replace(/[\s\-_/.]/g, '').toUpperCase();
}

export function buscarDuplicadoPorPlaca(
  placa: string,
  vehiculosExistentes: Vehiculo[],
  vehiculoIdExcluir?: string
): Vehiculo | null {
  const placaNorm = normalizarPlaca(placa);
  if (!placaNorm || placaNorm.length < 3) return null;

  for (const v of vehiculosExistentes) {
    if (!v.activo) continue;
    if (vehiculoIdExcluir && v.id === vehiculoIdExcluir) continue;
    if (normalizarPlaca(v.placa) === placaNorm) {
      return v;
    }
  }
  return null;
}

export function validarFormatoVin(vin: string): { valido: boolean; mensaje?: string } {
  const trimmed = vin.trim().toUpperCase();
  if (!trimmed) return { valido: true };
  if (trimmed.length !== 17) {
    return { valido: false, mensaje: 'Un número VIN estándar debe tener exactamente 17 caracteres alfanuméricos.' };
  }
  if (/[IOQ]/.test(trimmed)) {
    return { valido: false, mensaje: 'Los números VIN oficiales no contienen las letras I, O ni Q para evitar confusiones con 1 y 0.' };
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(trimmed)) {
    return { valido: false, mensaje: 'El formato de VIN contiene caracteres inválidos.' };
  }
  return { valido: true };
}

// -------------------------------------------------------------
// CONTROL DE ACCESO /config/acceso
// -------------------------------------------------------------

export async function inicializarOComprobarAcceso(dueno: DuenoUsuario): Promise<{
  esDueno: boolean;
  duenos: string[];
  primerArranqueRealizado: boolean;
}> {
  const ref = doc(db, 'config', 'acceso');
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e: any) {
    // Justo después de entrar con Google, Firestore a veces recibe la consulta antes que el token: reintentar.
    if (e?.code !== 'permission-denied') throw e;
    await new Promise((r) => setTimeout(r, 1500));
    snap = await getDoc(ref);
  }

  const miEmail = dueno.email.toLowerCase().trim();

  if (!snap.exists()) {
    const inicial: AccesoConfig = {
      duenos: [miEmail],
    };
    await setDoc(ref, inicial);
    return {
      esDueno: true,
      duenos: [miEmail],
      primerArranqueRealizado: true,
    };
  }

  const data = snap.data() as AccesoConfig;
  const listaDuenos = (data.duenos || []).map((e) => e.toLowerCase().trim());
  const autorizado = listaDuenos.includes(miEmail);

  return {
    esDueno: autorizado,
    duenos: listaDuenos,
    primerArranqueRealizado: false,
  };
}

export async function actualizarListaDuenos(
  nuevaLista: string[],
  duenoActual: DuenoUsuario
): Promise<void> {
  const listaLimpia = Array.from(
    new Set(nuevaLista.map((e) => e.toLowerCase().trim()).filter(Boolean))
  );

  if (listaLimpia.length < 1) {
    throw new Error('No puedes eliminar al último dueño; el taller debe tener al menos 1 dueño registrado.');
  }

  if (listaLimpia.length > 3) {
    throw new Error('El sistema solo permite un máximo de 3 cuentas de dueños.');
  }

  const accesoRef = doc(db, 'config', 'acceso');
  const auditRef = doc(collection(db, 'auditoria'));

  const snapAnterior = await getDoc(accesoRef);
  const dataAnterior = snapAnterior.exists() ? snapAnterior.data() : null;

  const batch = writeBatch(db);

  batch.update(
    accesoRef,
    limpiarUndefined({
      duenos: listaLimpia,
      auditoriaId: auditRef.id,
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Seguridad',
    accion: 'Acceso',
    entidad: 'acceso',
    entidadId: 'acceso',
    antes: dataAnterior ? limpiarUndefined(dataAnterior) : null,
    despues: limpiarUndefined({ duenos: listaLimpia }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData, true)));

  await batch.commit();
}

// -------------------------------------------------------------
// OPERACIONES DE CLIENTES (Firestore + Batch Audit Atómica)
// -------------------------------------------------------------

export async function guardarClienteFirestore(
  clienteData: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'activo'>,
  duenoActual: DuenoUsuario,
  clienteExistente?: Cliente
): Promise<Cliente> {
  const now = new Date();
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'auditoria'));

  const telFormateado = formatearTelefonoBolivia(clienteData.telefono);
  const telE164 = obtenerTelefonoE164(clienteData.telefono);

  let clienteFinalRaw: Cliente;
  let accionAuditoria: AuditoriaEvento['accion'] = 'Creación';
  let antes: any = null;

  if (clienteExistente) {
    accionAuditoria = 'Modificación';
    antes = {
      nombre: clienteExistente.nombre,
      telefono: clienteExistente.telefono,
      tipo: clienteExistente.tipo,
      direccion: clienteExistente.direccion || null,
      documentoIdentidad: clienteExistente.documentoIdentidad || null,
    };

    clienteFinalRaw = {
      ...clienteExistente,
      ...clienteData,
      telefono: telFormateado,
      telefonoE164: telE164,
      documentoIdentidad: clienteData.documentoIdentidad?.trim() || null,
      correo: clienteData.correo?.trim() || null,
      direccion: clienteData.direccion?.trim() || null,
      notas: clienteData.notas?.trim() || null,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    };
  } else {
    const nuevoId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    clienteFinalRaw = {
      id: nuevoId,
      ...clienteData,
      telefono: telFormateado,
      telefonoE164: telE164,
      documentoIdentidad: clienteData.documentoIdentidad?.trim() || null,
      correo: clienteData.correo?.trim() || null,
      direccion: clienteData.direccion?.trim() || null,
      notas: clienteData.notas?.trim() || null,
      consentimientoFirmado: false,
      activo: true,
      auditoriaId: auditRef.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  const clienteFinal = limpiarUndefined(clienteFinalRaw);
  const clienteRef = doc(db, 'clientes', clienteFinal.id);

  batch.set(clienteRef, clienteFinal);

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Clientes',
    accion: accionAuditoria,
    entidad: 'clientes',
    entidadId: clienteFinal.id,
    antes: antes ? limpiarUndefined(antes) : null,
    despues: limpiarUndefined({
      nombre: clienteFinal.nombre,
      telefono: clienteFinal.telefono,
      telefonoE164: clienteFinal.telefonoE164,
      tipo: clienteFinal.tipo,
      documentoIdentidad: clienteFinal.documentoIdentidad || null,
    }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
  return clienteFinal;
}

export async function desactivarClienteFirestore(
  cliente: Cliente,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const clienteRef = doc(db, 'clientes', cliente.id);
  const auditRef = doc(collection(db, 'auditoria'));

  batch.update(
    clienteRef,
    limpiarUndefined({
      activo: false,
      auditoriaId: auditRef.id,
      updatedAt: new Date().toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Clientes',
    accion: 'Desactivación',
    entidad: 'clientes',
    entidadId: cliente.id,
    antes: limpiarUndefined({ activo: true, nombre: cliente.nombre }),
    despues: limpiarUndefined({ activo: false, nombre: cliente.nombre }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

// -------------------------------------------------------------
// ADJUNTOS Y CONSENTIMIENTO (Subcolección /clientes/{id}/archivos)
// -------------------------------------------------------------

export async function guardarConsentimientoConArchivo(
  cliente: Cliente,
  archivoData: {
    nombreArchivo: string;
    formato: 'jpeg' | 'png' | 'pdf';
    tamanioBytes: number;
    base64Data: string;
  },
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);

  const archivoRef = doc(collection(db, 'clientes', cliente.id, 'archivos'));
  const clienteRef = doc(db, 'clientes', cliente.id);
  const auditArchivoRef = doc(collection(db, 'auditoria'));
  const auditClienteRef = doc(collection(db, 'auditoria'));

  const ahoraStr = getFechaHoraActual();

  if (cliente.consentimientoArchivoId) {
    const viejoRef = doc(db, 'clientes', cliente.id, 'archivos', cliente.consentimientoArchivoId);
    batch.update(
      viejoRef,
      limpiarUndefined({
        reemplazado: true,
        auditoriaId: auditArchivoRef.id,
      })
    );
  }

  const archivoDoc: ArchivoCliente = limpiarUndefined({
    id: archivoRef.id,
    clienteId: cliente.id,
    tipo: 'consentimiento',
    nombreArchivo: archivoData.nombreArchivo,
    formato: archivoData.formato,
    tamanioBytes: archivoData.tamanioBytes,
    base64Data: archivoData.base64Data,
    subidoPorEmail: duenoActual.email.toLowerCase(),
    subidoPorNombre: duenoActual.displayName || duenoActual.email,
    fecha: ahoraStr,
    reemplazado: false,
    auditoriaId: auditArchivoRef.id,
  });

  batch.set(archivoRef, archivoDoc);

  batch.update(
    clienteRef,
    limpiarUndefined({
      consentimientoFirmado: true,
      consentimientoArchivoId: archivoRef.id,
      consentimientoFecha: ahoraStr,
      consentimientoUsuarioEmail: duenoActual.email.toLowerCase(),
      auditoriaId: auditClienteRef.id,
      updatedAt: new Date().toISOString(),
    })
  );

  const auditArchivoData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Clientes',
    accion: 'Consentimiento',
    entidad: 'archivos',
    entidadId: archivoRef.id,
    antes: {
      consentimientoFirmado: cliente.consentimientoFirmado,
      archivoAnteriorId: cliente.consentimientoArchivoId || null,
    },
    despues: {
      consentimientoFirmado: true,
      archivoId: archivoRef.id,
      formato: archivoData.formato,
      tamanioBytes: archivoData.tamanioBytes,
      reemplazado: false,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditArchivoRef, limpiarUndefined(datosAuditoria(auditArchivoData)));

  const auditClienteData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Clientes',
    accion: 'Modificación',
    entidad: 'clientes',
    entidadId: cliente.id,
    antes: {
      consentimientoFirmado: cliente.consentimientoFirmado,
      archivoAnteriorId: cliente.consentimientoArchivoId || null,
    },
    despues: {
      consentimientoFirmado: true,
      consentimientoArchivoId: archivoRef.id,
      consentimientoFecha: ahoraStr,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditClienteRef, limpiarUndefined(datosAuditoria(auditClienteData)));

  await batch.commit();
}

export async function obtenerArchivoCliente(
  clienteId: string,
  archivoId: string
): Promise<ArchivoCliente | null> {
  const ref = doc(db, 'clientes', clienteId, 'archivos', archivoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as ArchivoCliente;
}

// -------------------------------------------------------------
// OPERACIONES DE VEHÍCULOS (Firestore + Batch Audit Atómica)
// -------------------------------------------------------------

export async function guardarVehiculoFirestore(
  vehiculoData: Omit<Vehiculo, 'id' | 'createdAt' | 'updatedAt' | 'historialPropietarios' | 'activo'>,
  propietario: Cliente,
  duenoActual: DuenoUsuario,
  vehiculoExistente?: Vehiculo
): Promise<Vehiculo> {
  const now = new Date();
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'auditoria'));

  let vehiculoFinalRaw: Vehiculo;
  let accionAuditoria: AuditoriaEvento['accion'] = 'Creación';
  let antes: any = null;

  if (vehiculoExistente) {
    accionAuditoria = 'Modificación';
    antes = {
      placa: vehiculoExistente.placa,
      marca: vehiculoExistente.marca,
      modelo: vehiculoExistente.modelo,
      propietarioActualId: vehiculoExistente.propietarioActualId,
    };

    vehiculoFinalRaw = {
      ...vehiculoExistente,
      ...vehiculoData,
      vin: vehiculoData.vin?.trim() || null,
      version: vehiculoData.version?.trim() || null,
      cilindrada: vehiculoData.cilindrada?.trim() || null,
      vencimientoSoat: vehiculoData.vencimientoSoat?.trim() || null,
      vencimientoItv: vehiculoData.vencimientoItv?.trim() || null,
      notasTecnicas: vehiculoData.notasTecnicas?.trim() || null,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    };
  } else {
    const nuevoId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fechaHoy = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    vehiculoFinalRaw = {
      id: nuevoId,
      ...vehiculoData,
      vin: vehiculoData.vin?.trim() || null,
      version: vehiculoData.version?.trim() || null,
      cilindrada: vehiculoData.cilindrada?.trim() || null,
      vencimientoSoat: vehiculoData.vencimientoSoat?.trim() || null,
      vencimientoItv: vehiculoData.vencimientoItv?.trim() || null,
      notasTecnicas: vehiculoData.notasTecnicas?.trim() || null,
      propietarioActualId: propietario.id,
      historialPropietarios: [
        {
          clienteId: propietario.id,
          clienteNombre: propietario.nombre,
          telefono: propietario.telefono,
          fechaInicio: fechaHoy,
          fechaFin: 'Actual',
        },
      ],
      activo: true,
      auditoriaId: auditRef.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  const vehiculoFinal = limpiarUndefined(vehiculoFinalRaw);
  const vehiculoRef = doc(db, 'vehiculos', vehiculoFinal.id);
  batch.set(vehiculoRef, vehiculoFinal);

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Vehículos',
    accion: accionAuditoria,
    entidad: 'vehiculos',
    entidadId: vehiculoFinal.id,
    antes: antes ? limpiarUndefined(antes) : null,
    despues: limpiarUndefined({
      placa: vehiculoFinal.placa,
      marca: vehiculoFinal.marca,
      modelo: vehiculoFinal.modelo,
      propietario: propietario.nombre,
    }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
  return vehiculoFinal;
}

export async function cambiarPropietarioFirestore(
  vehiculo: Vehiculo,
  nuevoPropietario: Cliente,
  motivo: string,
  duenoActual: DuenoUsuario
): Promise<Vehiculo> {
  const now = new Date();
  const fechaHoy = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const anteriorPropietarioId = vehiculo.propietarioActualId;

  const historialActualizado = vehiculo.historialPropietarios.map((p) => {
    if (p.fechaFin === 'Actual' || !p.fechaFin) {
      return {
        ...p,
        fechaFin: fechaHoy,
        motivoCambio: motivo.trim() || 'Transferencia de propiedad',
      };
    }
    return p;
  });

  historialActualizado.unshift({
    clienteId: nuevoPropietario.id,
    clienteNombre: nuevoPropietario.nombre,
    telefono: nuevoPropietario.telefono,
    fechaInicio: fechaHoy,
    fechaFin: 'Actual',
  });

  const auditRef = doc(collection(db, 'auditoria'));

  const vehiculoActualizadoRaw: Vehiculo = {
    ...vehiculo,
    propietarioActualId: nuevoPropietario.id,
    historialPropietarios: historialActualizado,
    auditoriaId: auditRef.id,
    updatedAt: now.toISOString(),
  };

  const vehiculoActualizado = limpiarUndefined(vehiculoActualizadoRaw);

  const batch = writeBatch(db);
  const vehiculoRef = doc(db, 'vehiculos', vehiculo.id);

  batch.set(vehiculoRef, vehiculoActualizado);

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Vehículos',
    accion: 'Cambio de Propietario',
    entidad: 'vehiculos',
    entidadId: vehiculo.id,
    antes: limpiarUndefined({ propietarioActualId: anteriorPropietarioId }),
    despues: limpiarUndefined({
      nuevoPropietarioId: nuevoPropietario.id,
      nuevoPropietarioNombre: nuevoPropietario.nombre,
      motivo,
    }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
  return vehiculoActualizado;
}

export async function desactivarVehiculoFirestore(
  vehiculo: Vehiculo,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const vehiculoRef = doc(db, 'vehiculos', vehiculo.id);
  const auditRef = doc(collection(db, 'auditoria'));

  batch.update(
    vehiculoRef,
    limpiarUndefined({
      activo: false,
      auditoriaId: auditRef.id,
      updatedAt: new Date().toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Vehículos',
    accion: 'Desactivación',
    entidad: 'vehiculos',
    entidadId: vehiculo.id,
    antes: limpiarUndefined({ activo: true, placa: vehiculo.placa }),
    despues: limpiarUndefined({ activo: false, placa: vehiculo.placa }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

// -------------------------------------------------------------
// CONFIGURACIÓN DEL TALLER (/config/taller)
// -------------------------------------------------------------

export async function guardarConfiguracionTaller(
  nuevaConfig: TallerConfig,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const configRef = doc(db, 'config', 'taller');
  const auditRef = doc(collection(db, 'auditoria'));

  const configConAuditoria: TallerConfig = limpiarUndefined({
    ...nuevaConfig,
    logoUrl: nuevaConfig.logoUrl?.trim() || null,
    auditoriaId: auditRef.id,
  });

  batch.set(configRef, configConAuditoria);

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Configuración',
    accion: 'Modificación',
    entidad: 'configuracion',
    entidadId: 'taller',
    antes: null,
    despues: limpiarUndefined({ nombre: nuevaConfig.nombre, moneda: nuevaConfig.moneda }),
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };

  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

// -------------------------------------------------------------
// MÓDULO 2: FOLIOS CORRELATIVOS SIN SERVIDOR (/contadores/ordenes)
// -------------------------------------------------------------

/**
 * Genera código de verificación aleatorio seguro de 16+ caracteres (criptográfico).
 */
export function generarCodigoVerificacionQr(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Asigna el siguiente folio correlativo oficial (OS-000001, OS-000002...)
 * mediante transacción sobre /contadores/ordenes.
 * Si no hay conexión, lanza error para activar folio provisional 'PEND-xxxx'.
 */
export async function asignarFolioCorrelativoOficial(dueno: DuenoUsuario): Promise<{
  folio: string;
  numero: number;
}> {
  const contadorRef = doc(db, 'contadores', 'ordenes');

  const nuevoNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    const anterior = snap.exists() ? snap.data().ultimo || 0 : 0;
    const siguiente = anterior + 1;
    // Módulo 9: el contador de folios también deja su registro de auditoría
    const auditRef = doc(collection(db, 'auditoria'));
    transaction.set(
      auditRef,
      limpiarUndefined(
        datosAuditoria({
          modulo: 'Recepción',
          accion: 'Folio asignado',
          entidad: 'contadores',
          entidadId: 'ordenes',
          antes: { ultimo: anterior },
          despues: { ultimo: siguiente, folio: `OS-${String(siguiente).padStart(6, '0')}` },
          usuarioUid: dueno.uid,
          usuarioEmail: dueno.email.toLowerCase(),
          usuarioNombre: dueno.displayName || dueno.email,
          fecha: serverTimestamp(),
        })
      )
    );
    if (snap.exists()) transaction.update(contadorRef, { ultimo: siguiente, auditoriaId: auditRef.id });
    else transaction.set(contadorRef, { ultimo: 1, auditoriaId: auditRef.id });
    return siguiente;
  });

  const folioFormateado = `OS-${String(nuevoNumero).padStart(6, '0')}`;
  return {
    folio: folioFormateado,
    numero: nuevoNumero,
  };
}

// -------------------------------------------------------------
// MÓDULO 2: RECEPCIÓN Y ÓRDENES DE SERVICIO (/ordenes)
// -------------------------------------------------------------

export interface NuevaOrdenInput {
  cliente: Cliente;
  vehiculo: Vehiculo;
  kilometraje: number;
  kilometrajeAnterior?: number | null;
  justificacionKilometraje?: string | null;
  nivelCombustible: OrdenServicio['nivelCombustible'];
  prioridad: OrdenServicio['prioridad'];
  fechaPrometidaEntrega: string;
  motivoCliente: string;
  motivoTecnico?: string | null;
  tipoServicio: OrdenServicio['tipoServicio'];
  sistemasAfectados: string[];
  preguntasGuiadas: OrdenServicio['preguntasGuiadas'];
  lucesAdvertenciaTablero: string[];
  daniosCarroceria: OrdenServicio['daniosCarroceria'];
  accesorios: OrdenServicio['accesorios'];
  autorizaciones: OrdenServicio['autorizaciones'];
  reclamoGarantia?: OrdenServicio['reclamoGarantia'];
  fotos: {
    tipo: FotoOrden['tipo'];
    titulo: string;
    base64Data: string;
    tamanioBytes?: number;
  }[];
}

/**
 * Guarda la recepción completa en Firestore:
 * - Colección /ordenes
 * - Subcolección /ordenes/{id}/fotos (máx 10)
 * - Actualización de odómetro en el vehículo
 * - Registro atómico en /auditoria
 */
export async function crearOrdenRecepcionFirestore(
  input: NuevaOrdenInput,
  duenoActual: DuenoUsuario
): Promise<{ orden: OrdenServicio; esProvisional: boolean }> {
  const now = new Date();
  const ordenId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let folio = `PEND-${Date.now().toString().slice(-4)}`;
  let numeroFolio: number | null = null;
  let sincronizacionFolio: 'confirmado' | 'pendiente' = 'pendiente';
  let esProvisional = true;

  // Intentar obtener folio oficial mediante transacción si estamos en línea
  if (navigator.onLine) {
    try {
      const res = await asignarFolioCorrelativoOficial(duenoActual);
      folio = res.folio;
      numeroFolio = res.numero;
      sincronizacionFolio = 'confirmado';
      esProvisional = false;
    } catch (e) {
      console.warn('No se pudo contactar el contador en línea; asignando folio provisional:', e);
      sincronizacionFolio = 'pendiente';
      esProvisional = true;
    }
  }

  const codigoVerificacion = generarCodigoVerificacionQr();
  const auditOrdenRef = doc(collection(db, 'auditoria'));

  const ordenDocRaw: OrdenServicio = {
    id: ordenId,
    folio,
    numeroFolio,
    sincronizacionFolio,
    codigoVerificacion,
    estado: 'Recibido',
    prioridad: input.prioridad,

    clienteId: input.cliente.id,
    clienteNombre: input.cliente.nombre,
    clienteTelefono: input.cliente.telefono,
    clienteTelefonoE164: input.cliente.telefonoE164 || obtenerTelefonoE164(input.cliente.telefono),
    clienteDocumento: input.cliente.documentoIdentidad || null,

    vehiculoId: input.vehiculo.id,
    vehiculoPlaca: input.vehiculo.placa,
    vehiculoMarca: input.vehiculo.marca,
    vehiculoModelo: input.vehiculo.modelo,
    vehiculoAnio: input.vehiculo.anio || null,
    vehiculoColor: input.vehiculo.color || null,

    kilometraje: input.kilometraje,
    kilometrajeAnterior: input.kilometrajeAnterior || null,
    justificacionKilometraje: input.justificacionKilometraje || null,
    nivelCombustible: input.nivelCombustible,
    fechaPrometidaEntrega: input.fechaPrometidaEntrega,

    motivoCliente: input.motivoCliente,
    motivoTecnico: input.motivoTecnico || null,
    tipoServicio: input.tipoServicio,
    sistemasAfectados: input.sistemasAfectados,
    preguntasGuiadas: input.preguntasGuiadas,
    lucesAdvertenciaTablero: input.lucesAdvertenciaTablero,

    daniosCarroceria: input.daniosCarroceria,
    accesorios: input.accesorios,
    autorizaciones: input.autorizaciones,
    reclamoGarantia: input.reclamoGarantia || null,

    firmaSubida: false,
    firmaFotoId: null,
    firmaFecha: null,

    totalFotos: input.fotos.length,

    // Historial inicial de estado de taller (empieza obligatoriamente con Recibido)
    historialEstados: [
      {
        estado: 'Recibido',
        fecha: new Date().toISOString(),
        fechaTimestamp: Date.now(),
        usuarioUid: duenoActual.uid,
        usuarioNombre: duenoActual.displayName || duenoActual.email,
        notas: 'Recepción inicial registrada en taller',
      },
    ],
    fechaIngresoEstadoActual: serverTimestamp(),
    fechaIngresoEstadoActualServidor: serverTimestamp(),

    creadoPorUid: duenoActual.uid,
    creadoPorEmail: duenoActual.email.toLowerCase(),
    creadoPorNombre: duenoActual.displayName || duenoActual.email,
    auditoriaId: auditOrdenRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ordenDoc = limpiarUndefined(ordenDocRaw);

  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', ordenId);
  batch.set(ordenRef, ordenDoc);

  // Subcolección de fotos iniciales
  for (const f of input.fotos) {
    const fotoRef = doc(collection(db, 'ordenes', ordenId, 'fotos'));
    const auditFotoRef = doc(collection(db, 'auditoria'));

    const fotoDoc: FotoOrden = limpiarUndefined({
      id: fotoRef.id,
      ordenId,
      tipo: f.tipo,
      titulo: f.titulo,
      base64Data: f.base64Data,
      tamanioBytes: f.tamanioBytes || 0,
      fechaStr: getFechaHoraActual(),
      usuarioUid: duenoActual.uid,
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      auditoriaId: auditFotoRef.id,
      reemplazada: false,
    });

    batch.set(fotoRef, fotoDoc);

    const auditFotoData: Omit<AuditoriaEvento, 'id'> = {
      modulo: 'Recepción',
      accion: 'Foto Orden',
      entidad: 'fotos',
      entidadId: fotoRef.id,
      antes: null,
      despues: {
        ordenId,
        tipo: f.tipo,
        titulo: f.titulo,
      },
      usuarioUid: duenoActual.uid,
      usuarioEmail: duenoActual.email.toLowerCase(),
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      fecha: serverTimestamp(),
    };
    batch.set(auditFotoRef, limpiarUndefined(datosAuditoria(auditFotoData)));
  }

  // Actualizar último kilometraje en el vehículo si el nuevo es mayor
  const vehiculoRef = doc(db, 'vehiculos', input.vehiculo.id);
  const ultimoKm = input.vehiculo.ultimoKilometraje || 0;
  if (input.kilometraje > ultimoKm) {
    const auditVehRef = doc(collection(db, 'auditoria'));
    batch.update(
      vehiculoRef,
      limpiarUndefined({
        ultimoKilometraje: input.kilometraje,
        auditoriaId: auditVehRef.id,
        updatedAt: now.toISOString(),
      })
    );

    const auditVehData: Omit<AuditoriaEvento, 'id'> = {
      modulo: 'Vehículos',
      accion: 'Modificación',
      entidad: 'vehiculos',
      entidadId: input.vehiculo.id,
      antes: { ultimoKilometraje: ultimoKm },
      despues: { ultimoKilometraje: input.kilometraje, motivo: `Recepción ${folio}` },
      usuarioUid: duenoActual.uid,
      usuarioEmail: duenoActual.email.toLowerCase(),
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      fecha: serverTimestamp(),
    };
    batch.set(auditVehRef, limpiarUndefined(datosAuditoria(auditVehData)));
  }

  // Auditoría principal para la creación de la orden
  const auditOrdenData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Recepción',
    accion: 'Recepción',
    entidad: 'ordenes',
    entidadId: ordenId,
    antes: null,
    despues: {
      folio,
      placa: input.vehiculo.placa,
      cliente: input.cliente.nombre,
      kilometraje: input.kilometraje,
      prioridad: input.prioridad,
      sincronizacionFolio,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdenRef, limpiarUndefined(datosAuditoria(auditOrdenData)));
  sincronizarVerificacion(batch, ordenDocRaw, 'Recibido', auditOrdenRef.id);

  await batch.commit();

  return { orden: ordenDoc, esProvisional };
}

/**
 * Sincroniza órdenes que tenían folio provisional ('PEND-xxxx')
 * asignándoles el folio correlativo definitivo mediante transacción.
 */
export async function sincronizarOrdenesPendientes(
  ordenesPendientes: OrdenServicio[],
  duenoActual: DuenoUsuario
): Promise<number> {
  let sincronizadas = 0;

  for (const ord of ordenesPendientes) {
    if (ord.sincronizacionFolio !== 'pendiente') continue;

    try {
      const res = await asignarFolioCorrelativoOficial(duenoActual);
      const auditRef = doc(collection(db, 'auditoria'));
      const batch = writeBatch(db);
      const ordRef = doc(db, 'ordenes', ord.id);

      batch.update(
        ordRef,
        limpiarUndefined({
          folio: res.folio,
          numeroFolio: res.numero,
          sincronizacionFolio: 'confirmado',
          auditoriaId: auditRef.id,
          updatedAt: new Date().toISOString(),
        })
      );

      const auditData: Omit<AuditoriaEvento, 'id'> = {
        modulo: 'Recepción',
        accion: 'Modificación',
        entidad: 'ordenes',
        entidadId: ord.id,
        antes: { folio: ord.folio, sincronizacionFolio: 'pendiente' },
        despues: { folio: res.folio, numeroFolio: res.numero, sincronizacionFolio: 'confirmado' },
        usuarioUid: duenoActual.uid,
        usuarioEmail: duenoActual.email.toLowerCase(),
        usuarioNombre: duenoActual.displayName || duenoActual.email,
        fecha: serverTimestamp(),
      };
      batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));
      sincronizarVerificacion(batch, { ...ord, folio: res.folio }, ord.estado, auditRef.id);

      await batch.commit();
      sincronizadas++;
    } catch (e) {
      console.warn(`No se pudo sincronizar folio para orden ${ord.id}:`, e);
      break;
    }
  }

  return sincronizadas;
}

/**
 * Registra la foto de la orden firmada físicamente por el cliente.
 */
export async function subirFirmaOrdenFirestore(
  orden: OrdenServicio,
  fotoData: {
    nombreArchivo: string;
    base64Data: string;
    tamanioBytes?: number;
  },
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const ahoraStr = getFechaHoraActual();
  const ordenRef = doc(db, 'ordenes', orden.id);
  const fotoRef = doc(collection(db, 'ordenes', orden.id, 'fotos'));
  const auditFotoRef = doc(collection(db, 'auditoria'));
  const auditOrdenRef = doc(collection(db, 'auditoria'));

  // Documento de foto firmada
  const fotoDoc: FotoOrden = limpiarUndefined({
    id: fotoRef.id,
    ordenId: orden.id,
    tipo: 'orden_firmada',
    titulo: 'Orden de Servicio Firmada por Cliente',
    base64Data: fotoData.base64Data,
    tamanioBytes: fotoData.tamanioBytes || 0,
    fechaStr: ahoraStr,
    usuarioUid: duenoActual.uid,
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    auditoriaId: auditFotoRef.id,
    reemplazada: false,
  });

  batch.set(fotoRef, fotoDoc);

  // Actualizar orden
  batch.update(
    ordenRef,
    limpiarUndefined({
      firmaSubida: true,
      firmaFotoId: fotoRef.id,
      firmaFecha: ahoraStr,
      totalFotos: (orden.totalFotos || 0) + 1,
      auditoriaId: auditOrdenRef.id,
      updatedAt: new Date().toISOString(),
    })
  );

  // Auditoría foto
  const auditFotoData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Recepción',
    accion: 'Firma Orden',
    entidad: 'fotos',
    entidadId: fotoRef.id,
    antes: null,
    despues: { ordenId: orden.id, tipo: 'orden_firmada' },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditFotoRef, limpiarUndefined(datosAuditoria(auditFotoData)));

  // Auditoría orden
  const auditOrdenData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Recepción',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { firmaSubida: false },
    despues: { firmaSubida: true, firmaFotoId: fotoRef.id },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdenRef, limpiarUndefined(datosAuditoria(auditOrdenData)));

  await batch.commit();
}

/**
 * MÓDULO 3: TALLER
 * Actualiza el estado de una orden guardando historialEstados y auditoría atómica
 */
export async function actualizarEstadoOrdenFirestore(
  orden: OrdenServicio,
  nuevoEstado: OrdenServicio['estado'],
  duenoActual: DuenoUsuario,
  opciones?: {
    notas?: string;
    fechaEstimadaRepuestos?: string;
  }
): Promise<void> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();

  const nuevoHistorialItem: HistorialEstado = {
    estado: nuevoEstado,
    fecha: new Date().toISOString(),
    fechaTimestamp: Date.now(),
    usuarioUid: duenoActual.uid,
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    notas: opciones?.notas || null,
    fechaEstimadaLlegadaRepuestos: opciones?.fechaEstimadaRepuestos || null,
  };

  const historialActualizado = [...(orden.historialEstados || []), nuevoHistorialItem];

  const updatePayload: Record<string, any> = {
    estado: nuevoEstado,
    fechaIngresoEstadoActual: serverTimestamp(),
    fechaIngresoEstadoActualServidor: serverTimestamp(),
    historialEstados: historialActualizado,
    auditoriaId: auditRef.id,
    updatedAt: serverTimestamp(),
  };

  if (nuevoEstado === 'Esperando repuestos' && opciones?.fechaEstimadaRepuestos) {
    updatePayload.fechaEstimadaLlegadaRepuestos = opciones.fechaEstimadaRepuestos;
  }

  batch.update(ordenRef, limpiarUndefined(updatePayload));

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Estado Taller',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { estado: orden.estado },
    despues: {
      estado: nuevoEstado,
      notas: opciones?.notas || null,
      fechaEstimadaRepuestos: opciones?.fechaEstimadaRepuestos || null,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));
  sincronizarVerificacion(batch, orden, nuevoEstado, auditRef.id);

  await batch.commit();
}

/**
 * Asigna o reasigna bahía y mecánico responsable de la orden
 */
export async function asignarBahiaYResponsableFirestore(
  orden: OrdenServicio,
  bahia: string | null,
  mecanico: string | null,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();

  batch.update(
    ordenRef,
    limpiarUndefined({
      bahiaAsignada: bahia,
      mecanicoResponsable: mecanico,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { bahiaAsignada: orden.bahiaAsignada || null, mecanicoResponsable: orden.mecanicoResponsable || null },
    despues: { bahiaAsignada: bahia, mecanicoResponsable: mecanico },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

/**
 * Registra la aprobación del cliente para habilitar "En reparación"
 */
export async function registrarAprobacionClienteFirestore(
  orden: OrdenServicio,
  aprobacion: AprobacionCliente,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();

  const aprobacionFinal: AprobacionCliente = {
    ...aprobacion,
    fechaAprobacion: aprobacion.fechaAprobacion || now.toISOString(),
    registradoPorNombre: duenoActual.displayName || duenoActual.email,
  };

  batch.update(
    ordenRef,
    limpiarUndefined({
      aprobaciones: aprobacionFinal,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { aprobaciones: orden.aprobaciones || null },
    despues: { aprobaciones: aprobacionFinal },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

/**
 * Guarda o actualiza una tarea dentro de la orden
 */
export async function guardarTareaOrdenFirestore(
  orden: OrdenServicio,
  tareaData: Omit<TareaOrden, 'id' | 'ordenId' | 'fechaCreacion'> & { id?: string },
  duenoActual: DuenoUsuario
): Promise<TareaOrden> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();

  const tareasActuales = [...(orden.tareas || [])];
  let tareaResult: TareaOrden;

  if (tareaData.id) {
    const idx = tareasActuales.findIndex((t) => t.id === tareaData.id);
    if (idx >= 0) {
      tareaResult = {
        ...tareasActuales[idx],
        ...tareaData,
        id: tareaData.id,
        ordenId: orden.id,
      };
      tareasActuales[idx] = tareaResult;
    } else {
      tareaResult = {
        id: tareaData.id,
        ordenId: orden.id,
        fechaCreacion: now.toISOString(),
        ...tareaData,
      };
      tareasActuales.push(tareaResult);
    }
  } else {
    tareaResult = {
      id: `tar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ordenId: orden.id,
      fechaCreacion: now.toISOString(),
      ...tareaData,
    };
    tareasActuales.push(tareaResult);
  }

  batch.update(
    ordenRef,
    limpiarUndefined({
      tareas: tareasActuales,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Tarea',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: null,
    despues: { tareaId: tareaResult.id, descripcion: tareaResult.descripcion, estado: tareaResult.estado },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
  return tareaResult;
}

/**
 * Control del cronómetro de una tarea: iniciar, pausar o finalizar
 * Guarda intervalos con ISO/serverTimestamp para precisión si la app se cierra
 */
export async function cronometroTareaFirestore(
  orden: OrdenServicio,
  tareaId: string,
  accion: 'iniciar' | 'pausar' | 'finalizar',
  duenoActual: DuenoUsuario,
  motivoPausa?: TareaOrden['intervalos'][0]['pausaMotivo'],
  notasPausa?: string
): Promise<void> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();
  const nowIso = now.toISOString();

  const tareas = (orden.tareas || []).map((t) => {
    if (t.id !== tareaId) return t;

    const intervalos = [...(t.intervalos || [])];
    let nuevoEstado: TareaOrden['estado'] = t.estado;
    let fechaInicio = t.fechaInicio;
    let fechaFin = t.fechaFin;

    if (accion === 'iniciar') {
      nuevoEstado = 'En curso';
      if (!fechaInicio) fechaInicio = nowIso;
      intervalos.push({
        id: `int_${Date.now()}`,
        inicio: nowIso,
        fin: null,
      });
    } else if (accion === 'pausar') {
      nuevoEstado = 'Pausada';
      // Cerrar el último intervalo abierto
      if (intervalos.length > 0 && !intervalos[intervalos.length - 1].fin) {
        const ultimo = intervalos[intervalos.length - 1];
        const durSeg = Math.round((now.getTime() - new Date(ultimo.inicio).getTime()) / 1000);
        ultimo.fin = nowIso;
        ultimo.duracionSegundos = Math.max(0, durSeg);
        ultimo.pausaMotivo = motivoPausa || 'Otra tarea';
        ultimo.notas = notasPausa || null;
      }
    } else if (accion === 'finalizar') {
      nuevoEstado = 'Finalizada';
      fechaFin = nowIso;
      // Cerrar el último intervalo abierto si existía
      if (intervalos.length > 0 && !intervalos[intervalos.length - 1].fin) {
        const ultimo = intervalos[intervalos.length - 1];
        const durSeg = Math.round((now.getTime() - new Date(ultimo.inicio).getTime()) / 1000);
        ultimo.fin = nowIso;
        ultimo.duracionSegundos = Math.max(0, durSeg);
      }
    }

    // Recalcular minutos reales sumando todos los intervalos cerrados
    const totalSegundos = intervalos.reduce((acc, i) => acc + (i.duracionSegundos || 0), 0);
    const tiempoRealMinutos = Math.round(totalSegundos / 60);

    return {
      ...t,
      estado: nuevoEstado,
      intervalos,
      tiempoRealMinutos,
      fechaInicio,
      fechaFin,
    };
  });

  batch.update(
    ordenRef,
    limpiarUndefined({
      tareas,
      auditoriaId: auditRef.id,
      updatedAt: nowIso,
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Tarea',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { tareaId, accionPrevia: 'N/A' },
    despues: { tareaId, accion, motivoPausa: motivoPausa || null },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

/**
 * Guarda el diagnóstico técnico completo en la orden
 * (Inspección multipunto, mediciones, códigos OBD-II, recomendaciones)
 */
export async function guardarDiagnosticoTecnicoFirestore(
  orden: OrdenServicio,
  diagnostico: DiagnosticoTecnico,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditRef = doc(collection(db, 'auditoria'));
  const now = new Date();

  const diagnosticoFinal: DiagnosticoTecnico = {
    ...diagnostico,
    actualizadoPor: duenoActual.displayName || duenoActual.email,
    fechaActualizacion: now.toISOString(),
  };

  batch.update(
    ordenRef,
    limpiarUndefined({
      diagnosticoTecnico: diagnosticoFinal,
      auditoriaId: auditRef.id,
      updatedAt: now.toISOString(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Diagnóstico',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { diagnosticoPrevio: orden.diagnosticoTecnico ? true : false },
    despues: {
      completado: diagnosticoFinal.completado,
      totalCodigosObd: diagnosticoFinal.codigosObd2?.length || 0,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

/**
 * Registra foto de diagnóstico en subcolección /ordenes/{id}/fotos
 */
export async function subirFotoDiagnosticoFirestore(
  orden: OrdenServicio,
  fotoData: {
    titulo: string;
    base64Data: string;
    tamanioBytes?: number;
  },
  duenoActual: DuenoUsuario
): Promise<FotoOrden> {
  const batch = writeBatch(db);
  const ahoraStr = getFechaHoraActual();
  const ordenRef = doc(db, 'ordenes', orden.id);
  const fotoRef = doc(collection(db, 'ordenes', orden.id, 'fotos'));
  const auditFotoRef = doc(collection(db, 'auditoria'));
  const auditOrdenRef = doc(collection(db, 'auditoria'));

  const fotoDoc: FotoOrden = limpiarUndefined({
    id: fotoRef.id,
    ordenId: orden.id,
    tipo: 'diagnostico',
    titulo: fotoData.titulo || 'Foto de Evidencia de Diagnóstico',
    base64Data: fotoData.base64Data,
    tamanioBytes: fotoData.tamanioBytes || 0,
    fechaStr: ahoraStr,
    usuarioUid: duenoActual.uid,
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    auditoriaId: auditFotoRef.id,
    reemplazada: false,
  });

  batch.set(fotoRef, fotoDoc);

  batch.update(
    ordenRef,
    limpiarUndefined({
      totalFotos: (orden.totalFotos || 0) + 1,
      auditoriaId: auditOrdenRef.id,
      updatedAt: new Date().toISOString(),
    })
  );

  const auditFotoData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Foto Orden',
    entidad: 'fotos',
    entidadId: fotoRef.id,
    antes: null,
    despues: { ordenId: orden.id, tipo: 'diagnostico', titulo: fotoData.titulo },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditFotoRef, limpiarUndefined(datosAuditoria(auditFotoData)));

  const auditOrdenData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { totalFotos: orden.totalFotos || 0 },
    despues: { totalFotos: (orden.totalFotos || 0) + 1 },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdenRef, limpiarUndefined(datosAuditoria(auditOrdenData)));

  await batch.commit();
  return fotoDoc;
}

/**
 * Registra un trabajo / hallazgo adicional detectado en el taller (Módulo 3)
 * Si no está autorizado por el cliente, permite transicionar a 'Esperando aprobación'
 */
export async function registrarTrabajoAdicionalFirestore(
  orden: OrdenServicio,
  hallazgoInput: {
    descripcion: string;
    piezasServiciosRequeridos?: string | null;
    costoEstimadoBs: number;
    autorizadoPorCliente: boolean;
    fotoBase64?: string | null;
  },
  duenoActual: DuenoUsuario
): Promise<HallazgoAdicional> {
  const batch = writeBatch(db);
  const now = new Date();
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditOrdenRef = doc(collection(db, 'auditoria'));

  let fotoId: string | null = null;

  // Si incluye foto de evidencia del hallazgo
  if (hallazgoInput.fotoBase64) {
    const fotoRef = doc(collection(db, 'ordenes', orden.id, 'fotos'));
    const auditFotoRef = doc(collection(db, 'auditoria'));
    fotoId = fotoRef.id;

    const fotoDoc: FotoOrden = limpiarUndefined({
      id: fotoRef.id,
      ordenId: orden.id,
      tipo: 'diagnostico',
      titulo: `Trabajo Adicional: ${hallazgoInput.descripcion.slice(0, 40)}`,
      base64Data: hallazgoInput.fotoBase64,
      tamanioBytes: Math.round((hallazgoInput.fotoBase64.length * 3) / 4),
      fechaStr: getFechaHoraActual(),
      usuarioUid: duenoActual.uid,
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      auditoriaId: auditFotoRef.id,
      reemplazada: false,
    });

    batch.set(fotoRef, fotoDoc);

    const auditFotoData: Omit<AuditoriaEvento, 'id'> = {
      modulo: 'Taller',
      accion: 'Foto Orden',
      entidad: 'fotos',
      entidadId: fotoRef.id,
      antes: null,
      despues: { ordenId: orden.id, tipo: 'diagnostico' },
      usuarioUid: duenoActual.uid,
      usuarioEmail: duenoActual.email.toLowerCase(),
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      fecha: serverTimestamp(),
    };
    batch.set(auditFotoRef, limpiarUndefined(datosAuditoria(auditFotoData)));
  }

  const nuevoHallazgo: HallazgoAdicional = {
    id: `hallazgo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fecha: now.toISOString(),
    descripcion: hallazgoInput.descripcion,
    piezasServiciosRequeridos: hallazgoInput.piezasServiciosRequeridos || null,
    costoEstimadoBs: Number(hallazgoInput.costoEstimadoBs) || 0,
    fotoId,
    autorizadoPorCliente: hallazgoInput.autorizadoPorCliente,
    fechaAutorizacion: hallazgoInput.autorizadoPorCliente ? now.toISOString() : null,
    registradoPor: duenoActual.displayName || duenoActual.email,
  };

  const hallazgosActualizados = [...(orden.hallazgosAdicionales || []), nuevoHallazgo];

  const updatePayload: Record<string, any> = {
    hallazgosAdicionales: hallazgosActualizados,
    auditoriaId: auditOrdenRef.id,
    updatedAt: now.toISOString(),
  };

  // Si el hallazgo no está autorizado y el vehículo está en reparación, puede cambiar a Esperando aprobación
  if (!hallazgoInput.autorizadoPorCliente && orden.estado === 'En reparación') {
    updatePayload.estado = 'Esperando aprobación';
    updatePayload.fechaIngresoEstadoActual = now.toISOString();
    updatePayload.historialEstados = [
      ...(orden.historialEstados || []),
      {
        estado: 'Esperando aprobación',
        fecha: now.toISOString(),
        fechaTimestamp: now.getTime(),
        usuarioUid: duenoActual.uid,
        usuarioNombre: duenoActual.displayName || duenoActual.email,
        notas: `Trabajo adicional detectado: ${hallazgoInput.descripcion} (+${hallazgoInput.costoEstimadoBs} Bs)`,
      },
    ];
  }

  if (fotoId) {
    updatePayload.totalFotos = (orden.totalFotos || 0) + 1;
  }

  batch.update(ordenRef, limpiarUndefined(updatePayload));

  const auditOrdenData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Hallazgo Adicional',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: null,
    despues: {
      hallazgoId: nuevoHallazgo.id,
      descripcion: nuevoHallazgo.descripcion,
      costoEstimadoBs: nuevoHallazgo.costoEstimadoBs,
      autorizado: nuevoHallazgo.autorizadoPorCliente,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdenRef, limpiarUndefined(datosAuditoria(auditOrdenData)));
  if (updatePayload.estado && updatePayload.estado !== orden.estado) {
    sincronizarVerificacion(batch, orden, updatePayload.estado, auditOrdenRef.id);
  }

  await batch.commit();
  return nuevoHallazgo;
}

// -------------------------------------------------------------
// MÓDULO 4: COTIZACIONES Y APROBACIONES (/ordenes/{id}/cotizaciones/{version})
// -------------------------------------------------------------

/**
 * Guarda o actualiza una versión de cotización en Firestore:
 * - Subcolección /ordenes/{id}/cotizaciones/{version}
 * - Cada edición crea una nueva versión secuencial (v1, v2, v3...)
 * - Preserva historial de versiones con autor y motivo
 * - Maneja cálculo automático y soporte para "precioPorDefinir" ("Pendiente de negociación")
 * - Validación y auditoría atómica con hasValidAudit('cotizaciones', versionId)
 */
export async function guardarCotizacionFirestore(
  orden: OrdenServicio,
  cotizacionInput: {
    items: ItemCotizacion[];
    descuentoTotalMontoBs?: number;
    descuentoTotalMotivo?: string | null;
    diasVigencia?: number;
    esComplementariaTrabajoAdicional?: boolean;
    trabajoAdicionalId?: string | null;
    versionForzada?: number;
  },
  duenoActual: DuenoUsuario,
  motivoCambio?: string
): Promise<CotizacionOrden> {
  const cotizacionesRef = collection(db, 'ordenes', orden.id, 'cotizaciones');
  const snapExistentes = await getDocs(cotizacionesRef);
  const totalVersiones = snapExistentes.size;
  const siguienteVersionNumero = cotizacionInput.versionForzada || (totalVersiones + 1);
  const versionId = `v${siguienteVersionNumero}`;

  const cotizacionRef = doc(db, 'ordenes', orden.id, 'cotizaciones', versionId);
  const auditRef = doc(collection(db, 'auditoria'));
  const ordenRef = doc(db, 'ordenes', orden.id);

  const diasVigencia = cotizacionInput.diasVigencia || 7;
  const ahora = new Date();
  const fechaVencimiento = new Date(ahora.getTime() + diasVigencia * 24 * 60 * 60 * 1000);

  // Comprobar si algún ítem tiene "precioPorDefinir"
  const tienePrecioPorDefinir = cotizacionInput.items.some((item) => item.precioPorDefinir);

  let subtotalCalculado: number | null = null;
  let totalCalculado: number | null = null;
  let costoTotalInterno = 0;
  let hayAlertaMargen = false;

  // Si NINGÚN ítem tiene precioPorDefinir, calcular totales
  if (!tienePrecioPorDefinir) {
    let subtotal = 0;
    for (const item of cotizacionInput.items) {
      subtotal += item.precioTotalBs || 0;
      if (item.costoUnitarioBs) {
        costoTotalInterno += (item.costoUnitarioBs || 0) * (item.cantidad || item.horasManoObra || 1);
      }
      if (item.alertaMargenBajo) {
        hayAlertaMargen = true;
      }
    }
    const desc = Math.max(0, cotizacionInput.descuentoTotalMontoBs || 0);
    subtotalCalculado = subtotal;
    totalCalculado = Math.max(0, subtotal - desc);
  } else {
    // Si hay precio por definir, calcular costos internos conocidos
    for (const item of cotizacionInput.items) {
      if (item.alertaMargenBajo) {
        hayAlertaMargen = true;
      }
      if (item.costoUnitarioBs) {
        costoTotalInterno += (item.costoUnitarioBs || 0) * (item.cantidad || item.horasManoObra || 1);
      }
    }
  }

  // Historial de versiones existentes
  const historialVersionesAnterior = snapExistentes.docs
    .map((d) => d.data() as CotizacionOrden)
    .sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0));

  const historialVersiones = [
    {
      version: siguienteVersionNumero,
      fecha: ahora.toISOString(),
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      motivoCambio:
        motivoCambio ||
        (siguienteVersionNumero === 1
          ? 'Creación inicial de cotización'
          : `Actualización de cotización a v${siguienteVersionNumero}`),
    },
    ...(historialVersionesAnterior[0]?.historialVersiones || []),
  ];

  const cotizacionDoc: CotizacionOrden = {
    id: versionId,
    versionNumero: siguienteVersionNumero,
    ordenId: orden.id,
    folioOrden: orden.folio,
    clienteId: orden.clienteId,
    clienteNombre: orden.clienteNombre,
    vehiculoPlaca: orden.vehiculoPlaca,
    estado: 'Borrador',
    items: cotizacionInput.items,
    tienePrecioPorDefinir,
    subtotalBs: subtotalCalculado,
    descuentoTotalMontoBs: cotizacionInput.descuentoTotalMontoBs || 0,
    descuentoTotalMotivo: cotizacionInput.descuentoTotalMotivo || null,
    totalBs: totalCalculado,
    totalAprobadoBs: null,
    costoTotalInternoBs: costoTotalInterno,
    hayAlertaMargenBajo: hayAlertaMargen,
    esComplementariaTrabajoAdicional: cotizacionInput.esComplementariaTrabajoAdicional || false,
    trabajoAdicionalId: cotizacionInput.trabajoAdicionalId || null,
    diasVigencia,
    fechaEmision: ahora.toISOString(),
    fechaVencimiento: fechaVencimiento.toISOString(),
    esVencida: false,
    aprobacion: null,
    historialVersiones,
    creadoPorUid: duenoActual.uid,
    creadoPorEmail: duenoActual.email.toLowerCase(),
    creadoPorNombre: duenoActual.displayName || duenoActual.email,
    auditoriaId: auditRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(cotizacionRef, limpiarUndefined(cotizacionDoc));

  // Actualizar orden con presupuesto estimado
  const ordenUpdate: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };
  if (!cotizacionInput.esComplementariaTrabajoAdicional) {
    ordenUpdate.cotizacionConPrecioPorDefinir = tienePrecioPorDefinir;
  }
  if (totalCalculado !== null) {
    ordenUpdate.costoTotalEstimadoBs = totalCalculado;
    if (!orden.presupuestoOriginalBs) {
      ordenUpdate.presupuestoOriginalBs = totalCalculado;
    }
  }
  // La orden necesita su propio registro de auditoría (las reglas exigen uno por documento)
  const auditOrdenRef = doc(collection(db, 'auditoria'));
  ordenUpdate.auditoriaId = auditOrdenRef.id;
  batch.update(ordenRef, limpiarUndefined(ordenUpdate));
  batch.set(
    auditOrdenRef,
    limpiarUndefined(datosAuditoria({
      modulo: 'Cotizaciones',
      accion: 'Presupuesto de orden actualizado',
      entidad: 'ordenes',
      entidadId: orden.id,
      antes: {
        costoTotalEstimadoBs: orden.costoTotalEstimadoBs ?? null,
        presupuestoOriginalBs: orden.presupuestoOriginalBs ?? null,
      },
      despues: {
        cotizacion: versionId,
        costoTotalEstimadoBs: ordenUpdate.costoTotalEstimadoBs ?? orden.costoTotalEstimadoBs ?? null,
        presupuestoOriginalBs: ordenUpdate.presupuestoOriginalBs ?? orden.presupuestoOriginalBs ?? null,
      },
      usuarioUid: duenoActual.uid,
      usuarioEmail: duenoActual.email.toLowerCase(),
      usuarioNombre: duenoActual.displayName || duenoActual.email,
      fecha: serverTimestamp(),
    }))
  );

  // Auditoría atómica (acción sensible si incluye descuento)
  const huboDescuento =
    (cotizacionInput.descuentoTotalMontoBs || 0) > 0 ||
    cotizacionInput.items.some((i) => (i.descuentoMontoBs || 0) > 0);
  // Módulo 9: cambio de precio respecto de la versión anterior = acción sensible
  const versionAnterior = snapExistentes.docs
    .map((d) => d.data() as CotizacionOrden)
    .filter((c) => !!c.esComplementariaTrabajoAdicional === !!cotizacionInput.esComplementariaTrabajoAdicional)
    .sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0))[0];
  const cambioPrecio = !!versionAnterior && (versionAnterior.totalBs ?? null) !== (totalCalculado ?? null);
  const accionAudit = huboDescuento
    ? 'Descuento Cotización'
    : siguienteVersionNumero > 1
    ? 'Versión Cotización'
    : 'Cotización';

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Cotizaciones',
    accion: accionAudit,
    entidad: 'cotizaciones',
    entidadId: versionId,
    antes: null,
    despues: {
      ordenId: orden.id,
      folio: orden.folio,
      version: versionId,
      tienePrecioPorDefinir,
      totalBs: totalCalculado,
      huboDescuento,
      descuentoTotal: cotizacionInput.descuentoTotalMontoBs || 0,
      descuentoMotivo: cotizacionInput.descuentoTotalMotivo || null,
      motivoCambio,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData, huboDescuento || cambioPrecio)));
  if (!cotizacionInput.esComplementariaTrabajoAdicional) {
    sincronizarVerificacion(batch, orden, orden.estado, auditOrdenRef.id, { version: siguienteVersionNumero });
  }

  await batch.commit();
  return cotizacionDoc;
}

/**
 * Obtiene todas las versiones de cotizaciones de una orden, marcando expiración si procede
 */
export async function obtenerCotizacionesOrdenFirestore(ordenId: string): Promise<CotizacionOrden[]> {
  const cotizacionesRef = collection(db, 'ordenes', ordenId, 'cotizaciones');
  const snap = await getDocs(cotizacionesRef);
  const lista: CotizacionOrden[] = snap.docs.map((d) => d.data() as CotizacionOrden);

  const ahora = Date.now();
  return lista
    .map((cot) => {
      const fVenc = cot.fechaVencimiento ? new Date(cot.fechaVencimiento).getTime() : 0;
      const esVencida =
        fVenc > 0 &&
        ahora > fVenc &&
        cot.estado !== 'Aprobada_Total' &&
        cot.estado !== 'Aprobada_Parcial' &&
        cot.estado !== 'Rechazada';
      return {
        ...cot,
        esVencida,
        estado: esVencida ? ('Vencida' as const) : cot.estado,
      };
    })
    .sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0));
}

/**
 * Registra aprobación (total o parcial) de la cotización por parte del cliente:
 * - Actualiza la cotización con el registro de aprobación (medio, fecha, nombre, nota obligatoria, evidencia)
 * - Actualiza la orden pasando a 'En reparación' o 'Esperando repuestos'
 * - Registra doble auditoría atómica
 */
export async function registrarAprobacionCotizacionFirestore(
  orden: OrdenServicio,
  cotizacion: CotizacionOrden,
  aprobacionData: {
    medio: 'En persona' | 'Llamada telefónica' | 'WhatsApp';
    fechaHora: string;
    nombreAprobador: string;
    nota: string;
    evidenciaFotoBase64?: string | null;
    evidenciaFotoNombre?: string | null;
    itemsAprobadosIds: string[];
    nuevoEstadoOrden: 'En reparación' | 'Esperando repuestos';
    dentroDePreAutorizacion?: boolean;
    fechaEstimadaRepuestos?: string;
  },
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const cotizacionRef = doc(db, 'ordenes', orden.id, 'cotizaciones', cotizacion.id);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditCotRef = doc(collection(db, 'auditoria'));
  const auditOrdRef = doc(collection(db, 'auditoria'));

  // Determinar aprobación parcial vs total
  const esParcial = aprobacionData.itemsAprobadosIds.length < cotizacion.items.length;
  let montoAprobado = 0;

  const itemsActualizados = cotizacion.items.map((item) => {
    const estaAprobado = aprobacionData.itemsAprobadosIds.includes(item.id);
    if (estaAprobado) {
      montoAprobado += item.precioTotalBs || 0;
    }
    return {
      ...item,
      aprobado: estaAprobado,
    };
  });

  const registroAprobacion: RegistroAprobacionCliente = {
    medio: aprobacionData.medio,
    fechaHora: aprobacionData.fechaHora,
    nombreAprobador: aprobacionData.nombreAprobador,
    nota: aprobacionData.nota,
    evidenciaFotoBase64: aprobacionData.evidenciaFotoBase64 || null,
    evidenciaFotoNombre: aprobacionData.evidenciaFotoNombre || null,
    esAprobacionParcial: esParcial,
    montoAprobadoBs: montoAprobado,
    dentroDePreAutorizacion: aprobacionData.dentroDePreAutorizacion || false,
    registradoPorUid: duenoActual.uid,
    registradoPorEmail: duenoActual.email.toLowerCase(),
    registradoPorNombre: duenoActual.displayName || duenoActual.email,
  };

  // 1. Actualizar cotización
  batch.update(
    cotizacionRef,
    limpiarUndefined({
      estado: esParcial ? 'Aprobada_Parcial' : 'Aprobada_Total',
      items: itemsActualizados,
      aprobacion: registroAprobacion,
      totalAprobadoBs: montoAprobado,
      auditoriaId: auditCotRef.id,
      updatedAt: serverTimestamp(),
    })
  );

  // 2. Actualizar orden
  const nuevoHistorialItem: HistorialEstado = {
    estado: aprobacionData.nuevoEstadoOrden,
    fecha: new Date().toISOString(),
    fechaTimestamp: Date.now(),
    usuarioUid: duenoActual.uid,
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    notas: `Aprobación ${esParcial ? 'parcial' : 'total'} (${aprobacionData.medio}): ${
      aprobacionData.nota
    }. Total aprobado: ${formatearMonedaBs(montoAprobado)}`,
    fechaEstimadaLlegadaRepuestos: aprobacionData.fechaEstimadaRepuestos || null,
  };

  const historialActualizado = [...(orden.historialEstados || []), nuevoHistorialItem];

  const updateOrden: Record<string, any> = {
    estado: aprobacionData.nuevoEstadoOrden,
    fechaIngresoEstadoActual: serverTimestamp(),
    fechaIngresoEstadoActualServidor: serverTimestamp(),
    historialEstados: historialActualizado,
    costoTotalEstimadoBs: montoAprobado,
    // Módulo 5: la cotización principal reemplaza el monto principal; las complementarias se suman
    ...(cotizacion.esComplementariaTrabajoAdicional
      ? { montoAprobadoAdicionalesBs: (orden.montoAprobadoAdicionalesBs || 0) + montoAprobado }
      : { montoAprobadoPrincipalBs: montoAprobado, cotizacionConPrecioPorDefinir: false }),
    saldoDesde: orden.saldoDesde || new Date().toISOString(),
    aprobaciones: {
      aprobadoPorCliente: true,
      fechaAprobacion: aprobacionData.fechaHora,
      medioAprobacion: aprobacionData.medio,
      montoAprobadoBs: montoAprobado,
      notasAprobacion: aprobacionData.nota,
      registradoPorNombre: aprobacionData.nombreAprobador,
    },
    auditoriaId: auditOrdRef.id,
    updatedAt: serverTimestamp(),
  };

  if (aprobacionData.nuevoEstadoOrden === 'Esperando repuestos' && aprobacionData.fechaEstimadaRepuestos) {
    updateOrden.fechaEstimadaLlegadaRepuestos = aprobacionData.fechaEstimadaRepuestos;
  }

  batch.update(ordenRef, limpiarUndefined(updateOrden));

  // 3. Auditoría para cotización
  const auditCotData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Cotizaciones',
    accion: 'Aprobación Cotización',
    entidad: 'cotizaciones',
    entidadId: cotizacion.id,
    antes: { estado: cotizacion.estado },
    despues: {
      estado: esParcial ? 'Aprobada_Parcial' : 'Aprobada_Total',
      montoAprobadoBs: montoAprobado,
      medio: aprobacionData.medio,
      aprobador: aprobacionData.nombreAprobador,
      dentroDePreAutorizacion: aprobacionData.dentroDePreAutorizacion || false,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditCotRef, limpiarUndefined(datosAuditoria(auditCotData)));

  // 4. Auditoría para orden
  const auditOrdData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Estado Taller',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { estado: orden.estado },
    despues: {
      estado: aprobacionData.nuevoEstadoOrden,
      montoAprobadoBs: montoAprobado,
      origenCotizacion: cotizacion.id,
    },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdRef, limpiarUndefined(datosAuditoria(auditOrdData)));
  sincronizarVerificacion(batch, orden, aprobacionData.nuevoEstadoOrden, auditOrdRef.id);

  await batch.commit();
}

/**
 * Rechaza la cotización por parte del cliente y pasa la orden a 'Cancelada'
 */
export async function rechazarCotizacionFirestore(
  orden: OrdenServicio,
  cotizacion: CotizacionOrden,
  motivoRechazo: string,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const cotizacionRef = doc(db, 'ordenes', orden.id, 'cotizaciones', cotizacion.id);
  const ordenRef = doc(db, 'ordenes', orden.id);
  const auditCotRef = doc(collection(db, 'auditoria'));
  const auditOrdRef = doc(collection(db, 'auditoria'));

  // 1. Marcar cotización como rechazada
  batch.update(
    cotizacionRef,
    limpiarUndefined({
      estado: 'Rechazada',
      motivoRechazo,
      fechaRechazo: new Date().toISOString(),
      auditoriaId: auditCotRef.id,
      updatedAt: serverTimestamp(),
    })
  );

  // 2. Pasar orden a Cancelada
  const nuevoHistorialItem: HistorialEstado = {
    estado: 'Cancelada',
    fecha: new Date().toISOString(),
    fechaTimestamp: Date.now(),
    usuarioUid: duenoActual.uid,
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    notas: `Cotización ${cotizacion.id} rechazada por cliente: ${motivoRechazo}`,
  };

  const historialActualizado = [...(orden.historialEstados || []), nuevoHistorialItem];

  // Queda como cancelación abierta (Módulo 6) hasta devolver el vehículo; se cobra el diagnóstico si fue autorizado.
  const montoDiagnosticoBs = orden.autorizaciones?.autorizaDiagnostico
    ? Math.max(0, orden.autorizaciones.costoDiagnosticoBs || 0)
    : 0;
  const cancelacion = orden.cancelacion || {
    estado: 'abierta' as const,
    motivo: 'El cliente rechazó la cotización' as const,
    nota: motivoRechazo || null,
    fecha: new Date().toISOString(),
    registradoPorNombre: duenoActual.displayName || duenoActual.email,
    registradoPorEmail: duenoActual.email.toLowerCase(),
    vehiculoDesarmado: false,
    rearmado: null,
    cobrarDiagnostico: montoDiagnosticoBs > 0,
    montoDiagnosticoBs,
    repuestosLiberados: true,
    seguimientoFecha: null,
    seguimientoRealizado: false,
  };

  batch.update(
    ordenRef,
    limpiarUndefined({
      estado: 'Cancelada',
      cancelacion,
      montoAprobadoPrincipalBs: orden.cancelacion ? orden.montoAprobadoPrincipalBs ?? 0 : montoDiagnosticoBs,
      montoAprobadoAdicionalesBs: orden.cancelacion ? orden.montoAprobadoAdicionalesBs ?? 0 : 0,
      cotizacionConPrecioPorDefinir: false,
      fechaIngresoEstadoActual: serverTimestamp(),
      fechaIngresoEstadoActualServidor: serverTimestamp(),
      historialEstados: historialActualizado,
      auditoriaId: auditOrdRef.id,
      updatedAt: serverTimestamp(),
    })
  );

  // 3. Auditoría cotización
  const auditCotData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Cotizaciones',
    accion: 'Rechazo Cotización',
    entidad: 'cotizaciones',
    entidadId: cotizacion.id,
    antes: { estado: cotizacion.estado },
    despues: { estado: 'Rechazada', motivoRechazo },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditCotRef, limpiarUndefined(datosAuditoria(auditCotData)));

  // 4. Auditoría orden
  const auditOrdData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Taller',
    accion: 'Estado Taller',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { estado: orden.estado },
    despues: { estado: 'Cancelada', motivo: motivoRechazo },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditOrdRef, limpiarUndefined(datosAuditoria(auditOrdData, true)));
  sincronizarVerificacion(batch, orden, 'Cancelada', auditOrdRef.id);

  await batch.commit();
}

/**
 * Guarda o actualiza una plantilla de servicio frecuente
 */
export async function guardarPlantillaCotizacionFirestore(
  plantilla: PlantillaCotizacion,
  duenoActual: DuenoUsuario
): Promise<void> {
  const batch = writeBatch(db);
  const plantillaRef = doc(db, 'plantillas', plantilla.id);
  const auditRef = doc(collection(db, 'auditoria'));

  batch.set(
    plantillaRef,
    limpiarUndefined({
      ...plantilla,
      auditoriaId: auditRef.id,
      updatedAt: serverTimestamp(),
    })
  );

  const auditData: Omit<AuditoriaEvento, 'id'> = {
    modulo: 'Configuración',
    accion: 'Plantilla',
    entidad: 'plantillas',
    entidadId: plantilla.id,
    antes: null,
    despues: { nombre: plantilla.nombre, items: plantilla.items.length },
    usuarioUid: duenoActual.uid,
    usuarioEmail: duenoActual.email.toLowerCase(),
    usuarioNombre: duenoActual.displayName || duenoActual.email,
    fecha: serverTimestamp(),
  };
  batch.set(auditRef, limpiarUndefined(datosAuditoria(auditData)));

  await batch.commit();
}

