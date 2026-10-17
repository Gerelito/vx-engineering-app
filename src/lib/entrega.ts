/**
 * Módulo 6: Entrega y cancelación.
 * Control de calidad, aviso al cliente, almacenaje, acta de entrega / devolución y cancelación.
 * Cada documento escrito lleva su propio registro de auditoría (lo exigen las reglas).
 */
import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { limpiarUndefined, obtenerCotizacionesOrdenFirestore } from './storage';
import { calcularFinanzasOrden, diaLaPaz, escribirAuditoria, redondearBs } from './caja';
import {
  ActaEntrega,
  AvisoCliente,
  CancelacionOrden,
  ControlCalidad,
  DuenoUsuario,
  FotoOrden,
  HistorialEstado,
  MotivoCancelacion,
  OrdenServicio,
  TallerConfig,
  TipoFotoRecepcion,
} from '../types';

export const CHECKLIST_CONTROL_CALIDAD: { id: string; texto: string }[] = [
  { id: 'torque_ruedas', texto: 'Torque de ruedas verificado' },
  { id: 'niveles', texto: 'Niveles de fluidos correctos' },
  { id: 'sin_fugas', texto: 'Sin fugas' },
  { id: 'luces_tablero', texto: 'Luces del tablero apagadas' },
  { id: 'codigos_falla', texto: 'Códigos de falla borrados o justificados' },
  { id: 'sin_herramientas', texto: 'Sin herramientas olvidadas en el vehículo' },
  { id: 'limpio', texto: 'Vehículo limpio' },
  { id: 'objetos_cliente', texto: 'Objetos del cliente en su lugar' },
];

export const MOTIVOS_CANCELACION: MotivoCancelacion[] = [
  'El cliente rechazó la cotización',
  'El cliente no contestó',
  'Se llevó el auto a otro taller',
  'El repuesto no existe o es muy caro',
  'El taller no puede hacer el trabajo',
  'Otro',
];

export const OBJETOS_ACCESORIOS: { id: string; texto: string }[] = [
  { id: 'llantaRepuesto', texto: 'Llanta de repuesto' },
  { id: 'gato', texto: 'Gato' },
  { id: 'triangulos', texto: 'Triángulos' },
  { id: 'extintor', texto: 'Extintor' },
  { id: 'radio', texto: 'Radio / pantalla' },
  { id: 'tapetes', texto: 'Tapetes' },
  { id: 'documentos', texto: 'Documentos del vehículo' },
  { id: 'objetosValor', texto: 'Objetos de valor' },
];

const DIA_MS = 86_400_000;

function nombre(d: DuenoUsuario) {
  return d.displayName || d.email;
}

function entradaHistorial(estado: OrdenServicio['estado'], dueno: DuenoUsuario, notas: string): HistorialEstado {
  return {
    estado,
    fecha: new Date().toISOString(),
    fechaTimestamp: Date.now(),
    usuarioUid: dueno.uid,
    usuarioNombre: nombre(dueno),
    notas,
    fechaEstimadaLlegadaRepuestos: null,
  };
}

/** Sube una foto a /ordenes/{id}/fotos con su auditoría y suma el contador de la orden. */
export async function subirFotoOrdenFirestore(
  orden: OrdenServicio,
  tipo: TipoFotoRecepcion,
  titulo: string,
  base64Data: string,
  tamanioBytes: number,
  dueno: DuenoUsuario
): Promise<string> {
  const batch = writeBatch(db);
  const fotoRef = doc(collection(db, 'ordenes', orden.id, 'fotos'));
  const auditFotoId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Foto Orden',
    entidad: 'fotos',
    entidadId: fotoRef.id,
    antes: null,
    despues: { ordenId: orden.id, tipo, titulo },
  });
  const foto: FotoOrden = {
    id: fotoRef.id,
    ordenId: orden.id,
    tipo,
    titulo,
    base64Data,
    tamanioBytes,
    fecha: serverTimestamp(),
    fechaStr: new Date().toISOString(),
    usuarioUid: dueno.uid,
    usuarioNombre: nombre(dueno),
    auditoriaId: auditFotoId,
    reemplazada: false,
  };
  batch.set(fotoRef, limpiarUndefined(foto));
  const auditOrdenId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: null,
    despues: { fotoAgregada: fotoRef.id, tipo },
  });
  batch.update(doc(db, 'ordenes', orden.id), {
    totalFotos: increment(1),
    auditoriaId: auditOrdenId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return fotoRef.id;
}

/** Almacenaje: corre desde el aviso al cliente; días gratis y cargo diario desde Configuración. */
export function calcularAlmacenaje(orden: OrdenServicio, config: TallerConfig, ahora: Date = new Date()) {
  const desde = orden.avisoCliente?.fecha || null;
  const diasGratis = Math.max(0, config.almacenajeDiasGratis ?? 3);
  const costoDiario = Math.max(0, config.almacenajeCostoDiarioBs ?? 0);
  if (!desde) return { desde: null, diasTranscurridos: 0, diasCobrables: 0, montoBs: 0, diasGratis, costoDiario };
  const t = Date.parse(desde);
  const diasTranscurridos = isNaN(t) ? 0 : Math.max(0, Math.floor((ahora.getTime() - t) / DIA_MS));
  const diasCobrables = Math.max(0, diasTranscurridos - diasGratis);
  return {
    desde,
    diasTranscurridos,
    diasCobrables,
    montoBs: redondearBs(diasCobrables * costoDiario),
    diasGratis,
    costoDiario,
  };
}

/** Horas desde el aviso (para la lista "Sin retirar": amarillo a las 24 h, rojo a las 72 h). */
export function horasDesdeAviso(orden: OrdenServicio, ahora: Date = new Date()): number | null {
  if (!orden.avisoCliente?.fecha) return null;
  const t = Date.parse(orden.avisoCliente.fecha);
  return isNaN(t) ? null : Math.max(0, Math.floor((ahora.getTime() - t) / 3_600_000));
}

/** Trabajos aprobados y recomendaciones no aprobadas a partir de las cotizaciones de la orden. */
export async function resumenTrabajosOrden(orden: OrdenServicio) {
  const cots = await obtenerCotizacionesOrdenFirestore(orden.id);
  const aprobadas = cots.filter((c) => c.estado === 'Aprobada_Total' || c.estado === 'Aprobada_Parcial');
  const principal = aprobadas
    .filter((c) => !c.esComplementariaTrabajoAdicional)
    .sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0))[0];
  const complementarias = aprobadas.filter((c) => c.esComplementariaTrabajoAdicional);
  const usadas = [principal, ...complementarias].filter(Boolean) as typeof cots;
  const trabajos: string[] = [];
  const noAprobadas: string[] = [];
  for (const c of usadas) {
    for (const it of c.items) {
      if (it.aprobado) trabajos.push(it.descripcion);
      else if (it.aprobado === false) noAprobadas.push(it.descripcion);
    }
  }
  return { trabajos, noAprobadas, hayCotizacionAprobada: usadas.length > 0 };
}

/** Registra el control de calidad. Aprobado → Listo para entrega; Rechazado → En reparación (retrabajo). */
export async function registrarControlCalidadFirestore(
  orden: OrdenServicio,
  datos: Omit<ControlCalidad, 'id' | 'fecha' | 'registradoPorNombre'>,
  dueno: DuenoUsuario
): Promise<void> {
  if (orden.estado !== 'Control de calidad') throw new Error('La orden no está en Control de calidad.');
  if (!navigator.onLine) throw new Error('Cambiar el estado requiere conexión a internet.');
  if (!datos.revisor.trim()) throw new Error('Indica quién hizo la revisión.');
  if (datos.resultado === 'Rechazado' && !datos.motivoRechazo?.trim()) throw new Error('Indica el motivo del rechazo.');

  const control: ControlCalidad = {
    ...datos,
    id: `cc_${Date.now()}`,
    fecha: new Date().toISOString(),
    registradoPorNombre: nombre(dueno),
  };
  const aprobado = datos.resultado === 'Aprobado';
  const nuevoEstado: OrdenServicio['estado'] = aprobado ? 'Listo para entrega' : 'En reparación';

  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: aprobado ? 'Control de calidad aprobado' : 'Control de calidad rechazado (retrabajo)',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { estado: orden.estado },
    despues: { estado: nuevoEstado, revisor: datos.revisor, revisionPropia: datos.revisionPropia, motivoRechazo: datos.motivoRechazo || null },
    sensible: datos.revisionPropia,
  });
  batch.update(
    doc(db, 'ordenes', orden.id),
    limpiarUndefined({
      estado: nuevoEstado,
      controlesCalidad: [...(orden.controlesCalidad || []), control],
      retrabajos: aprobado ? orden.retrabajos || 0 : (orden.retrabajos || 0) + 1,
      listoDesde: aprobado ? new Date().toISOString() : orden.listoDesde || null,
      historialEstados: [
        ...(orden.historialEstados || []),
        entradaHistorial(
          nuevoEstado,
          dueno,
          aprobado ? `Control de calidad aprobado por ${datos.revisor}` : `Retrabajo: ${datos.motivoRechazo}`
        ),
      ],
      fechaIngresoEstadoActual: serverTimestamp(),
      fechaIngresoEstadoActualServidor: serverTimestamp(),
      auditoriaId: auditId,
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

/** Marca "Cliente avisado" y lo deja también en la bitácora de contactos. */
export async function registrarAvisoClienteFirestore(
  orden: OrdenServicio,
  datos: Omit<AvisoCliente, 'fecha' | 'registradoPorNombre'>,
  dueno: DuenoUsuario
): Promise<void> {
  const aviso: AvisoCliente = { ...datos, fecha: new Date().toISOString(), registradoPorNombre: nombre(dueno) };
  const batch = writeBatch(db);
  const auditOrdenId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Cliente avisado',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { avisoCliente: orden.avisoCliente || null },
    despues: { avisoCliente: aviso },
  });
  batch.update(doc(db, 'ordenes', orden.id), {
    avisoCliente: aviso,
    auditoriaId: auditOrdenId,
    updatedAt: serverTimestamp(),
  });
  const contactoRef = doc(collection(db, 'contactos'));
  const auditContactoId = escribirAuditoria(batch, dueno, {
    modulo: 'Bitácora de contactos',
    accion: 'Contacto: Aviso de vehículo listo',
    entidad: 'contactos',
    entidadId: contactoRef.id,
    antes: null,
    despues: { ordenId: orden.id, medio: datos.medio, resultado: datos.resultado },
  });
  batch.set(
    contactoRef,
    limpiarUndefined({
      id: contactoRef.id,
      clienteId: orden.clienteId,
      clienteNombre: orden.clienteNombre,
      ordenId: orden.id,
      folio: orden.folio,
      medio: datos.medio === 'En persona' ? 'Visita' : datos.medio,
      motivo: 'Aviso de vehículo listo',
      resumen: `Aviso: vehículo listo para entrega (${orden.folio})`,
      resultado: datos.resultado,
      fechaLocal: aviso.fecha,
      fecha: serverTimestamp(),
      registradoPorUid: dueno.uid,
      registradoPorEmail: dueno.email.toLowerCase(),
      registradoPorNombre: nombre(dueno),
      auditoriaId: auditContactoId,
    })
  );
  await batch.commit();
}

export interface DatosActaInput {
  kmSalida: number;
  quienRetira: { nombre: string; documento: string; relacion: string };
  llavesDevueltas: number;
  objetosDevueltos: Record<string, boolean>;
  piezasRetiradasEntregadas?: boolean | null;
  trabajosRealizados: string[];
  recomendacionesNoAprobadas: string[];
  observaciones?: string | null;
  fotosSalidaIds?: string[];
}

/**
 * Entrega del vehículo (acta de entrega) o devolución sin reparar (acta de devolución).
 * Suma el almacenaje a la orden y valida el saldo dentro de una transacción con datos frescos.
 */
export async function entregarVehiculoFirestore(
  ordenId: string,
  tipo: 'entrega' | 'devolucion',
  datos: DatosActaInput,
  config: TallerConfig,
  dueno: DuenoUsuario
): Promise<ActaEntrega> {
  if (!navigator.onLine) throw new Error('Registrar la entrega requiere conexión a internet.');
  if (!datos.quienRetira.nombre.trim() || !datos.quienRetira.documento.trim()) {
    throw new Error('Indica el nombre y el documento de quien retira el vehículo.');
  }
  if (!(datos.kmSalida > 0)) throw new Error('Indica el kilometraje de salida.');
  const ordenRef = doc(db, 'ordenes', ordenId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ordenRef);
    if (!snap.exists()) throw new Error('La orden ya no existe.');
    const orden = { ...(snap.data() as OrdenServicio), id: ordenId };

    if (tipo === 'entrega' && orden.estado !== 'Listo para entrega') {
      throw new Error('Solo se puede entregar una orden en estado "Listo para entrega".');
    }
    if (tipo === 'devolucion') {
      if (orden.estado !== 'Cancelada' || orden.cancelacion?.estado !== 'abierta') {
        throw new Error('La devolución solo aplica a una cancelación abierta.');
      }
      if (orden.cancelacion.vehiculoDesarmado && !orden.cancelacion.rearmado?.completado) {
        throw new Error('Primero registra el rearmado del vehículo (con fotos).');
      }
    }
    if (datos.kmSalida < (orden.kilometraje || 0)) {
      throw new Error(`El kilometraje de salida no puede ser menor al de ingreso (${orden.kilometraje} km).`);
    }

    const alm = calcularAlmacenaje(orden, config);
    const cargos = redondearBs((orden.cargosAdicionalesBs || 0) + alm.montoBs);
    const fin = calcularFinanzasOrden({ ...orden, cargosAdicionalesBs: cargos });
    const saldo = fin.saldoBs;

    if (tipo === 'entrega') {
      if (fin.estadoTotal !== 'aprobado') {
        throw new Error('La orden no tiene un total aprobado. Registra la aprobación de la cotización antes de entregar.');
      }
      if (saldo !== null && saldo > 0 && !orden.entregaConSaldo?.autorizada) {
        throw new Error(
          `Hay un saldo pendiente de ${saldo.toFixed(2)} Bs. Registra el pago o pide a un dueño que autorice la entrega con saldo (en "Pagos").`
        );
      }
    } else if (saldo !== null && saldo > 0 && !orden.entregaConSaldo?.autorizada) {
      throw new Error(
        `El cliente debe ${saldo.toFixed(2)} Bs (diagnóstico/almacenaje). Registra el cobro o autoriza la devolución con saldo en "Pagos".`
      );
    }

    const ahora = new Date();
    const acta: ActaEntrega = {
      tipo,
      fecha: ahora.toISOString(),
      kmSalida: datos.kmSalida,
      quienRetira: {
        nombre: datos.quienRetira.nombre.trim(),
        documento: datos.quienRetira.documento.trim(),
        relacion: datos.quienRetira.relacion.trim() || 'Titular',
      },
      llavesDevueltas: datos.llavesDevueltas,
      objetosDevueltos: datos.objetosDevueltos,
      piezasRetiradasEntregadas: datos.piezasRetiradasEntregadas ?? null,
      trabajosRealizados: tipo === 'entrega' ? datos.trabajosRealizados : [],
      recomendacionesNoAprobadas: datos.recomendacionesNoAprobadas,
      almacenajeDias: alm.diasCobrables,
      almacenajeBs: alm.montoBs,
      totalBs: fin.totalAprobadoBs,
      pagadoBs: fin.totalPagadoBs,
      saldoAlEntregarBs: saldo,
      observaciones: datos.observaciones?.trim() || null,
      fotosSalidaIds: datos.fotosSalidaIds || [],
      firmaSubida: false,
      firmaFotoId: null,
      registradoPorNombre: nombre(dueno),
    };

    const update: Record<string, any> = {
      actaEntrega: acta,
      fechaEntrega: acta.fecha,
      cargosAdicionalesBs: cargos,
      updatedAt: serverTimestamp(),
    };
    if (saldo !== null && saldo > 0 && !orden.saldoDesde) update.saldoDesde = acta.fecha;

    if (tipo === 'entrega') {
      update.estado = 'Entregado';
      update.fechaIngresoEstadoActual = serverTimestamp();
      update.historialEstados = [
        ...(orden.historialEstados || []),
        entradaHistorial('Entregado', dueno, `Entregado a ${acta.quienRetira.nombre} (${acta.quienRetira.relacion})`),
      ];
    } else {
      const seguimiento = new Date(ahora.getTime() + 30 * DIA_MS);
      update.cancelacion = {
        ...orden.cancelacion,
        estado: 'cerrada',
        fechaCierre: acta.fecha,
        seguimientoFecha: diaLaPaz(seguimiento),
        seguimientoRealizado: false,
      };
      update.historialEstados = [
        ...(orden.historialEstados || []),
        entradaHistorial('Cancelada', dueno, `Vehículo devuelto sin reparar a ${acta.quienRetira.nombre}. Cancelación cerrada.`),
      ];
    }

    const auditId = escribirAuditoria(tx, dueno, {
      modulo: 'Entrega',
      accion: tipo === 'entrega' ? 'Entrega de vehículo' : 'Devolución sin reparar (cancelación cerrada)',
      entidad: 'ordenes',
      entidadId: ordenId,
      antes: { estado: orden.estado, cargosAdicionalesBs: orden.cargosAdicionalesBs || 0 },
      despues: { estado: update.estado || orden.estado, almacenajeBs: alm.montoBs, saldo, quienRetira: acta.quienRetira },
      sensible: saldo !== null && saldo > 0,
    });
    update.auditoriaId = auditId;
    tx.update(ordenRef, limpiarUndefined(update));
    return acta;
  });
}

/** Sube la foto del acta firmada en papel. */
export async function subirActaFirmadaFirestore(
  orden: OrdenServicio,
  base64Data: string,
  tamanioBytes: number,
  dueno: DuenoUsuario
): Promise<void> {
  if (!orden.actaEntrega) throw new Error('La orden no tiene acta registrada.');
  const fotoId = await subirFotoOrdenFirestore(
    orden,
    'acta_firmada',
    orden.actaEntrega.tipo === 'entrega' ? 'Acta de entrega firmada' : 'Acta de devolución firmada',
    base64Data,
    tamanioBytes,
    dueno
  );
  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Acta firmada subida',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { firmaSubida: orden.actaEntrega.firmaSubida },
    despues: { firmaSubida: true, firmaFotoId: fotoId },
  });
  batch.update(doc(db, 'ordenes', orden.id), {
    'actaEntrega.firmaSubida': true,
    'actaEntrega.firmaFotoId': fotoId,
    auditoriaId: auditId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Inicia la cancelación: motivo obligatorio, define cobro de diagnóstico y deja la cancelación abierta. */
export async function iniciarCancelacionFirestore(
  orden: OrdenServicio,
  datos: { motivo: MotivoCancelacion; nota: string; vehiculoDesarmado: boolean; cobrarDiagnostico: boolean },
  dueno: DuenoUsuario
): Promise<void> {
  if (orden.estado === 'Entregado') throw new Error('No se puede cancelar una orden entregada.');
  if (orden.cancelacion) throw new Error('Esta orden ya tiene una cancelación registrada.');
  if (datos.motivo === 'Otro' && !datos.nota.trim()) throw new Error('Describe el motivo en la nota.');
  if (!navigator.onLine) throw new Error('Cancelar requiere conexión a internet.');

  const montoDiagnosticoBs =
    datos.cobrarDiagnostico && orden.autorizaciones?.autorizaDiagnostico
      ? Math.max(0, orden.autorizaciones.costoDiagnosticoBs || 0)
      : 0;
  const cancelacion: CancelacionOrden = {
    estado: 'abierta',
    motivo: datos.motivo,
    nota: datos.nota.trim() || null,
    fecha: new Date().toISOString(),
    registradoPorNombre: nombre(dueno),
    registradoPorEmail: dueno.email.toLowerCase(),
    vehiculoDesarmado: datos.vehiculoDesarmado,
    rearmado: datos.vehiculoDesarmado ? { completado: false } : null,
    cobrarDiagnostico: montoDiagnosticoBs > 0,
    montoDiagnosticoBs,
    repuestosLiberados: true,
    seguimientoFecha: null,
    seguimientoRealizado: false,
  };

  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Cancelación de orden',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { estado: orden.estado },
    despues: { estado: 'Cancelada', motivo: datos.motivo, nota: cancelacion.nota, cobroDiagnosticoBs: montoDiagnosticoBs },
    sensible: true,
  });
  batch.update(
    doc(db, 'ordenes', orden.id),
    limpiarUndefined({
      estado: 'Cancelada',
      cancelacion,
      // En una cancelación solo se cobra el diagnóstico pactado (y almacenaje si corresponde).
      montoAprobadoPrincipalBs: montoDiagnosticoBs,
      montoAprobadoAdicionalesBs: 0,
      cotizacionConPrecioPorDefinir: false,
      historialEstados:
        orden.estado === 'Cancelada'
          ? orden.historialEstados || []
          : [...(orden.historialEstados || []), entradaHistorial('Cancelada', dueno, `Cancelación: ${datos.motivo}`)],
      fechaIngresoEstadoActual: serverTimestamp(),
      auditoriaId: auditId,
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

/** Registra el rearmado obligatorio (con fotos) antes de devolver un vehículo desarmado. */
export async function registrarRearmadoFirestore(
  orden: OrdenServicio,
  notas: string,
  fotosIds: string[],
  dueno: DuenoUsuario
): Promise<void> {
  if (!orden.cancelacion?.vehiculoDesarmado) throw new Error('Esta cancelación no requiere rearmado.');
  if (fotosIds.length === 0) throw new Error('Agrega al menos una foto del vehículo rearmado.');
  const batch = writeBatch(db);
  const rearmado = { completado: true, fecha: new Date().toISOString(), notas: notas.trim() || null, fotosIds };
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Rearmado registrado',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { rearmado: orden.cancelacion.rearmado || null },
    despues: { rearmado },
  });
  batch.update(doc(db, 'ordenes', orden.id), {
    'cancelacion.rearmado': rearmado,
    auditoriaId: auditId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Marca como hecha la llamada de seguimiento a 30 días de una cancelación. */
export async function registrarSeguimientoCancelacionFirestore(
  orden: OrdenServicio,
  nota: string,
  dueno: DuenoUsuario
): Promise<void> {
  if (!nota.trim()) throw new Error('Escribe el resultado de la llamada.');
  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Entrega',
    accion: 'Seguimiento de cancelación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { seguimientoRealizado: false },
    despues: { seguimientoRealizado: true, nota: nota.trim() },
  });
  batch.update(doc(db, 'ordenes', orden.id), {
    'cancelacion.seguimientoRealizado': true,
    'cancelacion.seguimientoNota': nota.trim(),
    auditoriaId: auditId,
    updatedAt: serverTimestamp(),
  });
  const contactoRef = doc(collection(db, 'contactos'));
  const auditContactoId = escribirAuditoria(batch, dueno, {
    modulo: 'Bitácora de contactos',
    accion: 'Contacto: Seguimiento',
    entidad: 'contactos',
    entidadId: contactoRef.id,
    antes: null,
    despues: { ordenId: orden.id, nota: nota.trim() },
  });
  batch.set(
    contactoRef,
    limpiarUndefined({
      id: contactoRef.id,
      clienteId: orden.clienteId,
      clienteNombre: orden.clienteNombre,
      ordenId: orden.id,
      folio: orden.folio,
      medio: 'Llamada',
      motivo: 'Seguimiento',
      resumen: 'Seguimiento a 30 días de la cancelación',
      resultado: nota.trim(),
      fechaLocal: new Date().toISOString(),
      fecha: serverTimestamp(),
      registradoPorUid: dueno.uid,
      registradoPorEmail: dueno.email.toLowerCase(),
      registradoPorNombre: nombre(dueno),
      auditoriaId: auditContactoId,
    })
  );
  await batch.commit();
}
