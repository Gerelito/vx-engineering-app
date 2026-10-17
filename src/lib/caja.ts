/**
 * Módulo 5: Caja y pagos.
 *
 * - Los pagos viven en la colección raíz /pagos (consultas simples por orden o por día,
 *   sin índices especiales y sin leer subcolecciones de cada orden).
 * - Cada pago o anulación actualiza en la MISMA transacción el resumen de pagos de la orden,
 *   así la lista de cuentas por cobrar se calcula con las órdenes ya cargadas (ahorra lecturas).
 * - Los pagos nunca se editan ni se borran: una anulación es un movimiento negativo
 *   que referencia al pago original.
 * - Cada documento escrito lleva su propio registro de auditoría (lo exigen las reglas).
 */
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  Transaction,
  WriteBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { limpiarUndefined } from './storage';
import {
  CierreCaja,
  ContactoCliente,
  DuenoUsuario,
  FinanzasOrden,
  MedioContacto,
  MontoPorMedio,
  MotivoContacto,
  OrdenServicio,
  PagoOrden,
  ResumenPagosOrden,
  TallerConfig,
  TipoPago,
} from '../types';

export const MEDIOS_PAGO_POR_DEFECTO = ['QR', 'Efectivo'];

export function mediosPagoConfigurados(config?: Pick<TallerConfig, 'mediosPago'> | null): string[] {
  const lista = (config?.mediosPago || []).map((m) => m.trim()).filter(Boolean);
  return lista.length > 0 ? lista : MEDIOS_PAGO_POR_DEFECTO;
}

/** Fecha aaaa-mm-dd en hora de Bolivia. */
export function diaLaPaz(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/** Muestra un día aaaa-mm-dd como dd/mm/aaaa. */
export function formatearDia(dia: string): string {
  const [a, m, d] = dia.split('-');
  return a && m && d ? `${d}/${m}/${a}` : dia;
}

export function redondearBs(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Total aprobado de la orden.
 * - Cotización principal: último monto aprobado (una nueva versión reemplaza a la anterior).
 * - Cotizaciones complementarias (trabajos adicionales): se suman.
 * - Cargos adicionales (almacenaje, Módulo 6): se suman.
 * Si todavía no hay aprobación y la cotización tiene precios por definir → pendiente de negociación.
 */
export function calcularFinanzasOrden(orden: OrdenServicio): FinanzasOrden {
  const principal =
    typeof orden.montoAprobadoPrincipalBs === 'number'
      ? orden.montoAprobadoPrincipalBs
      : orden.aprobaciones?.aprobadoPorCliente && typeof orden.aprobaciones.montoAprobadoBs === 'number'
      ? orden.aprobaciones.montoAprobadoBs
      : null;

  const adicionales = orden.montoAprobadoAdicionalesBs || 0;
  const cargos = orden.cargosAdicionalesBs || 0;

  let estadoTotal: FinanzasOrden['estadoTotal'];
  let totalAprobadoBs: number | null;
  if (principal !== null) {
    estadoTotal = 'aprobado';
    totalAprobadoBs = redondearBs(principal + adicionales + cargos);
  } else if (orden.cotizacionConPrecioPorDefinir) {
    estadoTotal = 'pendiente_negociacion';
    totalAprobadoBs = null;
  } else {
    estadoTotal = 'sin_aprobacion';
    totalAprobadoBs = null;
  }

  const porMedio = { ...(orden.pagos?.porMedio || {}) };
  const pagadoQRBs = redondearBs(porMedio['QR'] || 0);
  const pagadoEfectivoBs = redondearBs(porMedio['Efectivo'] || 0);
  const totalPagadoBs = redondearBs(orden.pagos?.totalPagadoBs || 0);
  const pagadoOtrosBs = redondearBs(totalPagadoBs - pagadoQRBs - pagadoEfectivoBs);

  const saldoBs = totalAprobadoBs === null ? null : redondearBs(totalAprobadoBs - totalPagadoBs);

  return {
    estadoTotal,
    totalAprobadoBs,
    porMedio,
    pagadoQRBs,
    pagadoEfectivoBs,
    pagadoOtrosBs,
    totalPagadoBs,
    saldoBs,
    pagosACuenta: totalAprobadoBs === null && totalPagadoBs > 0,
  };
}

/** Antigüedad del saldo en días (desde saldoDesde o, si falta, desde la aprobación). */
export function diasDeSaldo(orden: OrdenServicio, ahora: Date = new Date()): number | null {
  const ref = orden.saldoDesde || orden.aprobaciones?.fechaAprobacion || null;
  if (!ref) return null;
  const t = Date.parse(ref.includes('T') ? ref : ref.replace(' ', 'T'));
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((ahora.getTime() - t) / 86_400_000));
}

export function rangoAntiguedad(dias: number | null): '0-30' | '31-60' | '60+' | 'sin_fecha' {
  if (dias === null) return 'sin_fecha';
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  return '60+';
}

function datosUsuario(dueno: DuenoUsuario) {
  return {
    usuarioUid: dueno.uid,
    usuarioEmail: dueno.email.toLowerCase(),
    usuarioNombre: dueno.displayName || dueno.email,
  };
}

function escribirAuditoria(
  w: Transaction | WriteBatch,
  dueno: DuenoUsuario,
  datos: {
    modulo: string;
    accion: string;
    entidad: string;
    entidadId: string;
    antes: Record<string, any> | null;
    despues: Record<string, any> | null;
    sensible?: boolean;
  }
): string {
  const ref = doc(collection(db, 'auditoria'));
  (w as any).set(
    ref,
    limpiarUndefined({
      ...datos,
      sensible: datos.sensible || false,
      ...datosUsuario(dueno),
      fecha: serverTimestamp(),
    })
  );
  return ref.id;
}

function sumarAlResumen(resumen: ResumenPagosOrden | null | undefined, montos: MontoPorMedio[]): ResumenPagosOrden {
  const porMedio: Record<string, number> = { ...(resumen?.porMedio || {}) };
  let total = resumen?.totalPagadoBs || 0;
  for (const m of montos) {
    porMedio[m.medio] = redondearBs((porMedio[m.medio] || 0) + m.montoBs);
    total += m.montoBs;
  }
  return {
    porMedio,
    totalPagadoBs: redondearBs(total),
    cantidadPagos: (resumen?.cantidadPagos || 0) + 1,
    ultimoPagoFecha: resumen?.ultimoPagoFecha || null,
    ultimoPagoMontoBs: resumen?.ultimoPagoMontoBs ?? null,
  };
}

async function verificarCajaAbierta(tx: Transaction, dia: string) {
  const cajaSnap = await tx.get(doc(db, 'cajas', dia));
  if (cajaSnap.exists() && (cajaSnap.data() as CierreCaja).cerrado) {
    throw new Error(
      `La caja del ${formatearDia(dia)} ya está cerrada. Para registrar o anular pagos de ese día, un dueño debe reabrirla con un motivo.`
    );
  }
}

export interface NuevoPagoInput {
  tipo: Exclude<TipoPago, 'Anulación'>;
  montos: MontoPorMedio[];
  concepto: string;
  comprobanteBase64?: string | null;
}

/** Registra un pago (puede combinar varios medios) y actualiza el resumen de la orden. */
export async function registrarPagoFirestore(
  orden: OrdenServicio,
  input: NuevoPagoInput,
  dueno: DuenoUsuario
): Promise<PagoOrden> {
  if (!navigator.onLine) {
    throw new Error('Registrar pagos requiere conexión a internet.');
  }
  const montos = input.montos
    .map((m) => ({ medio: m.medio, montoBs: redondearBs(Number(m.montoBs) || 0) }))
    .filter((m) => m.montoBs !== 0);
  if (montos.some((m) => m.montoBs < 0)) throw new Error('Los montos no pueden ser negativos.');
  const totalBs = redondearBs(montos.reduce((s, m) => s + m.montoBs, 0));
  if (totalBs <= 0) throw new Error('Ingresa al menos un monto mayor a cero.');
  if (!input.concepto.trim()) throw new Error('El concepto es obligatorio.');

  const dia = diaLaPaz();
  const ahoraIso = new Date().toISOString();
  const pagoRef = doc(collection(db, 'pagos'));
  const ordenRef = doc(db, 'ordenes', orden.id);

  return runTransaction(db, async (tx) => {
    const ordenSnap = await tx.get(ordenRef);
    if (!ordenSnap.exists()) throw new Error('La orden ya no existe.');
    await verificarCajaAbierta(tx, dia);
    const ordenActual = { ...(ordenSnap.data() as OrdenServicio), id: orden.id };
    const finanzasAntes = calcularFinanzasOrden(ordenActual);

    const auditPagoId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Pago registrado',
      entidad: 'pagos',
      entidadId: pagoRef.id,
      antes: null,
      despues: { folio: orden.folio, tipo: input.tipo, montos, totalBs, concepto: input.concepto.trim() },
    });

    const pago: PagoOrden = {
      id: pagoRef.id,
      ordenId: orden.id,
      folio: ordenActual.folio,
      clienteId: ordenActual.clienteId,
      clienteNombre: ordenActual.clienteNombre,
      vehiculoPlaca: ordenActual.vehiculoPlaca,
      tipo: input.tipo,
      montos,
      totalBs,
      concepto: input.concepto.trim(),
      comprobanteBase64: input.comprobanteBase64 || null,
      aCuenta: finanzasAntes.estadoTotal !== 'aprobado',
      anulaPagoId: null,
      motivoAnulacion: null,
      fechaDia: dia,
      fechaLocal: ahoraIso,
      fecha: serverTimestamp() as any,
      registradoPorUid: dueno.uid,
      registradoPorEmail: dueno.email.toLowerCase(),
      registradoPorNombre: dueno.displayName || dueno.email,
      auditoriaId: auditPagoId,
    };
    tx.set(pagoRef, limpiarUndefined(pago));

    const resumen = sumarAlResumen(ordenActual.pagos, montos);
    resumen.ultimoPagoFecha = ahoraIso;
    resumen.ultimoPagoMontoBs = totalBs;

    const auditOrdenId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Resumen de pagos actualizado',
      entidad: 'ordenes',
      entidadId: orden.id,
      antes: { pagos: ordenActual.pagos || null },
      despues: { pagos: resumen, pagoId: pagoRef.id },
    });

    tx.update(
      ordenRef,
      limpiarUndefined({
        pagos: resumen,
        auditoriaId: auditOrdenId,
        updatedAt: serverTimestamp(),
      })
    );

    return pago;
  });
}

/** Anula un pago con un movimiento negativo (solo dueños, motivo obligatorio). */
export async function anularPagoFirestore(
  orden: OrdenServicio,
  pagoOriginal: PagoOrden,
  motivo: string,
  dueno: DuenoUsuario
): Promise<void> {
  if (!navigator.onLine) throw new Error('Anular pagos requiere conexión a internet.');
  if (!motivo.trim()) throw new Error('El motivo de la anulación es obligatorio.');
  if (pagoOriginal.tipo === 'Anulación') throw new Error('No se puede anular una anulación.');

  const yaAnulado = await getDocs(query(collection(db, 'pagos'), where('anulaPagoId', '==', pagoOriginal.id)));
  if (!yaAnulado.empty) throw new Error('Este pago ya fue anulado.');

  const dia = diaLaPaz();
  const ahoraIso = new Date().toISOString();
  const anulacionRef = doc(collection(db, 'pagos'));
  const ordenRef = doc(db, 'ordenes', orden.id);
  const montosNegativos = pagoOriginal.montos.map((m) => ({ medio: m.medio, montoBs: -Math.abs(m.montoBs) }));
  const totalBs = redondearBs(montosNegativos.reduce((s, m) => s + m.montoBs, 0));

  await runTransaction(db, async (tx) => {
    const ordenSnap = await tx.get(ordenRef);
    if (!ordenSnap.exists()) throw new Error('La orden ya no existe.');
    await verificarCajaAbierta(tx, dia);
    const ordenActual = ordenSnap.data() as OrdenServicio;

    const auditPagoId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Anulación de pago',
      entidad: 'pagos',
      entidadId: anulacionRef.id,
      antes: { pagoId: pagoOriginal.id, montos: pagoOriginal.montos, totalBs: pagoOriginal.totalBs },
      despues: { montos: montosNegativos, totalBs, motivo: motivo.trim() },
      sensible: true,
    });

    const anulacion: PagoOrden = {
      id: anulacionRef.id,
      ordenId: orden.id,
      folio: ordenActual.folio,
      clienteId: ordenActual.clienteId,
      clienteNombre: ordenActual.clienteNombre,
      vehiculoPlaca: ordenActual.vehiculoPlaca,
      tipo: 'Anulación',
      montos: montosNegativos,
      totalBs,
      concepto: `Anulación del pago del ${formatearDia(pagoOriginal.fechaDia)}`,
      comprobanteBase64: null,
      aCuenta: false,
      anulaPagoId: pagoOriginal.id,
      motivoAnulacion: motivo.trim(),
      fechaDia: dia,
      fechaLocal: ahoraIso,
      fecha: serverTimestamp() as any,
      registradoPorUid: dueno.uid,
      registradoPorEmail: dueno.email.toLowerCase(),
      registradoPorNombre: dueno.displayName || dueno.email,
      auditoriaId: auditPagoId,
    };
    tx.set(anulacionRef, limpiarUndefined(anulacion));

    const resumen = sumarAlResumen(ordenActual.pagos, montosNegativos);
    const auditOrdenId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Resumen de pagos actualizado (anulación)',
      entidad: 'ordenes',
      entidadId: orden.id,
      antes: { pagos: ordenActual.pagos || null },
      despues: { pagos: resumen, anulacionId: anulacionRef.id },
      sensible: true,
    });
    tx.update(
      ordenRef,
      limpiarUndefined({ pagos: resumen, auditoriaId: auditOrdenId, updatedAt: serverTimestamp() })
    );
  });
}

/** Un dueño autoriza entregar el vehículo con saldo pendiente (acción sensible). */
export async function autorizarEntregaConSaldoFirestore(
  orden: OrdenServicio,
  motivo: string,
  fechaCompromisoPago: string | null,
  dueno: DuenoUsuario
): Promise<void> {
  if (!motivo.trim()) throw new Error('El motivo es obligatorio para entregar con saldo.');
  const fin = calcularFinanzasOrden(orden);
  if (fin.saldoBs === null || fin.saldoBs <= 0) throw new Error('Esta orden no tiene saldo pendiente.');

  const batch = writeBatch(db);
  const autorizacion = {
    autorizada: true,
    motivo: motivo.trim(),
    fechaCompromisoPago: fechaCompromisoPago || null,
    saldoAlAutorizarBs: fin.saldoBs,
    autorizadoPorNombre: dueno.displayName || dueno.email,
    autorizadoPorEmail: dueno.email.toLowerCase(),
    fecha: new Date().toISOString(),
  };
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Caja y Pagos',
    accion: 'Entrega con saldo autorizada',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { entregaConSaldo: orden.entregaConSaldo || null },
    despues: { entregaConSaldo: autorizacion },
    sensible: true,
  });
  batch.update(
    doc(db, 'ordenes', orden.id),
    limpiarUndefined({
      entregaConSaldo: autorizacion,
      saldoDesde: orden.saldoDesde || new Date().toISOString(),
      auditoriaId: auditId,
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

/** Registra un contacto con el cliente (cobranza, aviso, seguimiento, etc.). */
export async function registrarContactoFirestore(
  datos: {
    clienteId: string;
    clienteNombre: string;
    ordenId?: string | null;
    folio?: string | null;
    medio: MedioContacto;
    motivo: MotivoContacto;
    resumen: string;
    resultado: string;
  },
  dueno: DuenoUsuario
): Promise<void> {
  if (!datos.resumen.trim()) throw new Error('Escribe un resumen del contacto.');
  const ref = doc(collection(db, 'contactos'));
  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Bitácora de contactos',
    accion: `Contacto: ${datos.motivo}`,
    entidad: 'contactos',
    entidadId: ref.id,
    antes: null,
    despues: { ...datos },
  });
  const contacto: ContactoCliente = {
    id: ref.id,
    clienteId: datos.clienteId,
    clienteNombre: datos.clienteNombre,
    ordenId: datos.ordenId || null,
    folio: datos.folio || null,
    medio: datos.medio,
    motivo: datos.motivo,
    resumen: datos.resumen.trim(),
    resultado: datos.resultado.trim(),
    fechaLocal: new Date().toISOString(),
    fecha: serverTimestamp() as any,
    registradoPorUid: dueno.uid,
    registradoPorEmail: dueno.email.toLowerCase(),
    registradoPorNombre: dueno.displayName || dueno.email,
    auditoriaId: auditId,
  };
  batch.set(ref, limpiarUndefined(contacto));
  await batch.commit();
}

/** Calcula los totales de un día a partir de sus movimientos. */
export function resumirMovimientosDelDia(pagos: PagoOrden[]) {
  const totalPorMedio: Record<string, number> = {};
  let total = 0;
  for (const p of pagos) {
    for (const m of p.montos) {
      totalPorMedio[m.medio] = redondearBs((totalPorMedio[m.medio] || 0) + m.montoBs);
      total += m.montoBs;
    }
  }
  return { totalPorMedio, totalRecibidoBs: redondearBs(total), efectivoEsperadoBs: totalPorMedio['Efectivo'] || 0 };
}

export async function obtenerPagosDelDia(dia: string): Promise<PagoOrden[]> {
  const snap = await getDocs(query(collection(db, 'pagos'), where('fechaDia', '==', dia)));
  return snap.docs.map((d) => d.data() as PagoOrden);
}

/** Cierra la caja de un día. Vuelve a leer los movimientos dentro de la operación para no cerrar con datos viejos. */
export async function cerrarCajaFirestore(
  dia: string,
  efectivoContadoBs: number,
  nota: string,
  dueno: DuenoUsuario
): Promise<CierreCaja> {
  if (!navigator.onLine) throw new Error('El cierre de caja requiere conexión a internet.');
  if (isNaN(efectivoContadoBs) || efectivoContadoBs < 0) throw new Error('Ingresa el efectivo contado.');
  const pagos = await obtenerPagosDelDia(dia);
  const resumen = resumirMovimientosDelDia(pagos);
  const cajaRef = doc(db, 'cajas', dia);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(cajaRef);
    const anterior = snap.exists() ? (snap.data() as CierreCaja) : null;
    if (anterior?.cerrado) throw new Error('La caja de ese día ya está cerrada.');

    const diferenciaBs = redondearBs(efectivoContadoBs - resumen.efectivoEsperadoBs);
    const auditId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Cierre de caja',
      entidad: 'cajas',
      entidadId: dia,
      antes: anterior ? { cerrado: anterior.cerrado, efectivoContadoBs: anterior.efectivoContadoBs } : null,
      despues: { ...resumen, efectivoContadoBs, diferenciaBs, nota: nota.trim() || null },
      sensible: diferenciaBs !== 0,
    });
    const cierre: CierreCaja = {
      id: dia,
      fechaDia: dia,
      totalPorMedio: resumen.totalPorMedio,
      totalRecibidoBs: resumen.totalRecibidoBs,
      efectivoEsperadoBs: resumen.efectivoEsperadoBs,
      efectivoContadoBs: redondearBs(efectivoContadoBs),
      diferenciaBs,
      cantidadMovimientos: pagos.length,
      nota: nota.trim() || null,
      cerrado: true,
      cerradoPorNombre: dueno.displayName || dueno.email,
      cerradoPorEmail: dueno.email.toLowerCase(),
      fechaCierreLocal: new Date().toISOString(),
      reaperturas: anterior?.reaperturas || [],
      auditoriaId: auditId,
    };
    tx.set(cajaRef, limpiarUndefined(cierre));
    return cierre;
  });
}

/** Reabre una caja cerrada (solo dueños, motivo obligatorio). */
export async function reabrirCajaFirestore(dia: string, motivo: string, dueno: DuenoUsuario): Promise<void> {
  if (!motivo.trim()) throw new Error('El motivo para reabrir la caja es obligatorio.');
  const cajaRef = doc(db, 'cajas', dia);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(cajaRef);
    if (!snap.exists()) throw new Error('No hay cierre registrado para ese día.');
    const caja = snap.data() as CierreCaja;
    if (!caja.cerrado) throw new Error('La caja ya está abierta.');
    const reapertura = {
      fecha: new Date().toISOString(),
      motivo: motivo.trim(),
      usuarioNombre: dueno.displayName || dueno.email,
      usuarioEmail: dueno.email.toLowerCase(),
    };
    const auditId = escribirAuditoria(tx, dueno, {
      modulo: 'Caja y Pagos',
      accion: 'Reapertura de caja',
      entidad: 'cajas',
      entidadId: dia,
      antes: { cerrado: true },
      despues: { cerrado: false, motivo: reapertura.motivo },
      sensible: true,
    });
    tx.update(cajaRef, {
      cerrado: false,
      reaperturas: [...(caja.reaperturas || []), reapertura],
      auditoriaId: auditId,
    });
  });
}
