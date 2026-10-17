/**
 * Módulo 8: historial del vehículo y del cliente, búsqueda global, alertas y componentes.
 * La búsqueda filtra en el navegador sobre lo ya cargado (sin lecturas extra del plan gratuito).
 */
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { aMilisegundos, limpiarUndefined, obtenerCotizacionesOrdenFirestore } from './storage';
import { calcularFinanzasOrden, escribirAuditoria } from './caja';
import {
  CategoriaComponente,
  Cliente,
  ContactoCliente,
  CorreccionOrden,
  CotizacionOrden,
  DuenoUsuario,
  FotoOrden,
  ItemCotizacion,
  OrdenServicio,
  PagoOrden,
  Vehiculo,
} from '../types';

// ---------------------------------------------------------------------------
// Búsqueda global
// ---------------------------------------------------------------------------
export function normalizar(s: any): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Distancia de Levenshtein con corte temprano (devuelve max+1 si se pasa). */
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minFila = Math.min(minFila, cur[j]);
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export type TipoResultado = 'vehiculo' | 'cliente' | 'orden';
export interface ResultadoBusqueda {
  tipo: TipoResultado;
  id: string;
  titulo: string;
  detalle: string;
  puntaje: number; // menor = mejor
}

/** Coincidencia: exacta/contiene (0), empieza por (0), con un error de tipeo en códigos (1). */
function puntuar(q: string, campos: { valor: string; tolerante?: boolean }[]): number | null {
  let mejor: number | null = null;
  for (const c of campos) {
    const v = normalizar(c.valor);
    if (!v) continue;
    let p: number | null = null;
    if (v === q) p = 0;
    else if (v.includes(q)) p = 0.5;
    else if (c.tolerante && q.length >= 4) {
      // placa, teléfono, folio, VIN: un error de tipeo (o el mismo prefijo con un error)
      const d = Math.min(levenshtein(v, q, 1), q.length < v.length ? levenshtein(v.slice(0, q.length), q, 1) : 9);
      if (d <= 1) p = 1 + d;
    }
    if (p !== null && (mejor === null || p < mejor)) mejor = p;
  }
  return mejor;
}

export function buscarGlobal(
  texto: string,
  datos: { clientes: Cliente[]; vehiculos: Vehiculo[]; ordenes: OrdenServicio[] },
  limite = 20
): ResultadoBusqueda[] {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const res: ResultadoBusqueda[] = [];
  for (const v of datos.vehiculos) {
    const p = puntuar(q, [
      { valor: v.placa, tolerante: true },
      { valor: v.vin || '', tolerante: true },
      { valor: `${v.marca} ${v.modelo}` },
    ]);
    if (p !== null)
      res.push({ tipo: 'vehiculo', id: v.id, titulo: `${v.placa} · ${v.marca} ${v.modelo}`, detalle: `${v.anio || ''} ${v.color || ''}`.trim(), puntaje: p });
  }
  for (const c of datos.clientes) {
    const p = puntuar(q, [
      { valor: c.nombre },
      { valor: c.telefono, tolerante: true },
      { valor: c.telefonoE164 || '', tolerante: true },
      { valor: c.documentoIdentidad || '', tolerante: true },
    ]);
    if (p !== null) res.push({ tipo: 'cliente', id: c.id, titulo: c.nombre, detalle: `${c.telefono}${c.documentoIdentidad ? ` · CI ${c.documentoIdentidad}` : ''}`, puntaje: p });
  }
  for (const o of datos.ordenes) {
    const p = puntuar(q, [{ valor: o.folio, tolerante: true }]);
    if (p !== null)
      res.push({ tipo: 'orden', id: o.id, titulo: `${o.folio} · ${o.vehiculoPlaca}`, detalle: `${o.clienteNombre} · ${o.estado}`, puntaje: p });
  }
  const orden: Record<TipoResultado, number> = { vehiculo: 0, cliente: 1, orden: 2 };
  return res.sort((a, b) => a.puntaje - b.puntaje || orden[a.tipo] - orden[b.tipo]).slice(0, limite);
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------
export const COMPONENTES: { id: CategoriaComponente; texto: string; prueba: (d: string) => boolean }[] = [
  { id: 'aceite', texto: 'Aceite de motor', prueba: (d) => /\baceite\b|lubricante/.test(d.replace(/filtros? de aceite/g, '')) },
  { id: 'filtro_aceite', texto: 'Filtro de aceite', prueba: (d) => /filtros? de aceite/.test(d) },
  { id: 'filtro_aire', texto: 'Filtro de aire', prueba: (d) => /filtros? de aire(?! acond)/.test(d) },
  { id: 'filtro_combustible', texto: 'Filtro de combustible', prueba: (d) => /filtros? de (combustible|gasolina|diesel|diésel)/.test(d) },
  { id: 'filtro_cabina', texto: 'Filtro de cabina / A/C', prueba: (d) => /filtros? de (cabina|polen|habitaculo|habitáculo|a\/c|aire acond)/.test(d) },
  { id: 'frenos_delanteros', texto: 'Frenos delanteros', prueba: (d) => /(pastilla|disco|freno)/.test(d) && /delanter/.test(d) },
  { id: 'frenos_traseros', texto: 'Frenos traseros', prueba: (d) => /(pastilla|zapata|tambor|disco|freno)/.test(d) && /traser/.test(d) },
  { id: 'bateria', texto: 'Batería', prueba: (d) => /bater[ií]a|acumulador/.test(d) },
  { id: 'correa_distribucion', texto: 'Correa / cadena de distribución', prueba: (d) => /distribuci[oó]n/.test(d) },
  { id: 'neumaticos', texto: 'Neumáticos', prueba: (d) => /neum[aá]tico|cubierta|llanta(?! de repuesto)/.test(d) },
];

/** Componentes que cubre un ítem (el elegido a mano manda; si no, se deduce de la descripción). */
export function componentesDeItem(it: ItemCotizacion): CategoriaComponente[] {
  if (it.componente) return it.componente === 'otro' ? [] : [it.componente];
  const d = (it.descripcion || '').toLowerCase();
  return COMPONENTES.filter((c) => c.prueba(d)).map((c) => c.id);
}

export function componenteDeItem(it: ItemCotizacion): CategoriaComponente | null {
  return componentesDeItem(it)[0] || null;
}

// ---------------------------------------------------------------------------
// Carga del historial
// ---------------------------------------------------------------------------
export interface Visita {
  orden: OrdenServicio;
  ingresoMs: number;
  entregaMs: number | null;
  cotizaciones: CotizacionOrden[];
  trabajos: ItemCotizacion[]; // ítems aprobados de la cotización principal vigente y complementarias
  recomendaciones: string[]; // ítems no aprobados
  pagos: PagoOrden[];
  totalBs: number | null;
  pagadoBs: number;
  saldoBs: number | null;
}

function porLotes<T>(arr: T[], n = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function leerPorOrdenes<T>(coleccion: string, ordenIds: string[]): Promise<T[]> {
  const lotes = await Promise.all(
    porLotes(ordenIds).map((ids) => getDocs(query(collection(db, coleccion), where('ordenId', 'in', ids))))
  );
  return lotes.flatMap((s) => s.docs.map((d) => ({ ...(d.data() as T), id: d.id })));
}

export function trabajosDeCotizaciones(cots: CotizacionOrden[]) {
  const aprobadas = cots.filter((c) => c.estado === 'Aprobada_Total' || c.estado === 'Aprobada_Parcial');
  const principal = aprobadas
    .filter((c) => !c.esComplementariaTrabajoAdicional)
    .sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0))[0];
  const usadas = [principal, ...aprobadas.filter((c) => c.esComplementariaTrabajoAdicional)].filter(Boolean) as CotizacionOrden[];
  return {
    trabajos: usadas.flatMap((c) => c.items.filter((i) => i.aprobado)),
    recomendaciones: usadas.flatMap((c) => c.items.filter((i) => i.aprobado === false).map((i) => i.descripcion)),
  };
}

/** Lee cotizaciones y pagos de las órdenes indicadas (las órdenes ya están cargadas en la app). */
export async function cargarVisitas(ordenes: OrdenServicio[]): Promise<Visita[]> {
  const ids = ordenes.map((o) => o.id);
  const [cotsPorOrden, pagos] = await Promise.all([
    Promise.all(ordenes.map((o) => obtenerCotizacionesOrdenFirestore(o.id).catch(() => [] as CotizacionOrden[]))),
    ids.length ? leerPorOrdenes<PagoOrden>('pagos', ids) : Promise.resolve([] as PagoOrden[]),
  ]);
  return ordenes
    .map((orden, i) => {
      const cotizaciones = cotsPorOrden[i];
      const { trabajos, recomendaciones } = trabajosDeCotizaciones(cotizaciones);
      const fin = calcularFinanzasOrden(orden);
      const anulados = new Set(pagos.filter((p) => p.anulaPagoId).map((p) => p.anulaPagoId));
      return {
        orden,
        ingresoMs: aMilisegundos(orden.createdAt) ?? aMilisegundos(orden.historialEstados?.[0]?.fecha) ?? 0,
        entregaMs: orden.fechaEntrega ? Date.parse(orden.fechaEntrega) : null,
        cotizaciones,
        trabajos,
        recomendaciones,
        pagos: pagos
          .filter((p) => p.ordenId === orden.id && !p.anulaPagoId && !anulados.has(p.id))
          .sort((a, b) => String(a.fechaLocal).localeCompare(String(b.fechaLocal))),
        totalBs: fin.totalAprobadoBs,
        pagadoBs: fin.totalPagadoBs,
        saldoBs: fin.saldoBs,
      } as Visita;
    })
    .sort((a, b) => (b.ingresoMs || 0) - (a.ingresoMs || 0));
}

export async function contactosDe(filtro: { clienteId?: string; ordenIds?: string[] }): Promise<ContactoCliente[]> {
  let lista: ContactoCliente[] = [];
  if (filtro.clienteId) {
    const s = await getDocs(query(collection(db, 'contactos'), where('clienteId', '==', filtro.clienteId)));
    lista = s.docs.map((d) => ({ ...(d.data() as ContactoCliente), id: d.id }));
  } else if (filtro.ordenIds?.length) {
    lista = await leerPorOrdenes<ContactoCliente>('contactos', filtro.ordenIds);
  }
  return lista.sort((a, b) => String(b.fechaLocal).localeCompare(String(a.fechaLocal)));
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------
export interface AlertaHistorial {
  nivel: 'rojo' | 'ambar' | 'info';
  texto: string;
}

/** dd/mm/aaaa -> ms (mediodía) */
function fechaDdMm(s?: string | null): number | null {
  const m = (s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) {
    const t = Date.parse(s || '');
    return isNaN(t) ? null : t;
  }
  return Date.UTC(+m[3], +m[2] - 1, +m[1], 16);
}

const DIA = 86_400_000;

export function alertasVehiculo(vehiculo: Vehiculo, visitas: Visita[], ahora = Date.now()): AlertaHistorial[] {
  const a: AlertaHistorial[] = [];
  // Documentos
  ([
    ['SOAT', vehiculo.vencimientoSoat],
    ['ITV', vehiculo.vencimientoItv],
  ] as [string, string | null | undefined][]).forEach(([n, f]) => {
    const t = fechaDdMm(f);
    if (t === null) return;
    const dias = Math.floor((t - ahora) / DIA);
    if (dias < 0) a.push({ nivel: 'rojo', texto: `${n} vencido desde el ${f}` });
    else if (dias <= 30) a.push({ nivel: 'ambar', texto: `${n} vence en ${dias} día(s) (${f})` });
  });
  // Saldo
  const saldo = visitas.reduce((s, v) => s + (v.saldoBs && v.saldoBs > 0 && v.orden.estado !== 'Cancelada' ? v.saldoBs : 0), 0);
  const saldoCancel = visitas.reduce((s, v) => s + (v.saldoBs && v.saldoBs > 0 && v.orden.estado === 'Cancelada' ? v.saldoBs : 0), 0);
  if (saldo + saldoCancel > 0.004) a.push({ nivel: 'rojo', texto: `Saldo pendiente: ${(saldo + saldoCancel).toFixed(2)} Bs` });
  // Recomendaciones pendientes: no aprobadas y no hechas en una visita posterior
  const pendientes: { texto: string; folio: string }[] = [];
  visitas.forEach((v, i) => {
    const posteriores = visitas.slice(0, i).flatMap((x) => x.trabajos.map((t) => normalizar(t.descripcion)));
    v.recomendaciones.forEach((r) => {
      if (!posteriores.includes(normalizar(r)) && !pendientes.some((p) => normalizar(p.texto) === normalizar(r)))
        pendientes.push({ texto: r, folio: v.orden.folio });
    });
  });
  if (pendientes.length)
    a.push({
      nivel: 'ambar',
      texto: `Recomendaciones pendientes: ${pendientes
        .slice(0, 4)
        .map((p) => `${p.texto} (${p.folio})`)
        .join('; ')}${pendientes.length > 4 ? ` y ${pendientes.length - 4} más` : ''}`,
    });
  // Falla repetida (< 90 días): mismo sistema afectado o mismo código OBD
  const ord = [...visitas].sort((x, y) => x.ingresoMs - y.ingresoMs);
  const repetidas = new Set<string>();
  for (let i = 1; i < ord.length; i++) {
    for (let j = 0; j < i; j++) {
      if (ord[i].ingresoMs - ord[j].ingresoMs > 90 * DIA) continue;
      const s1 = ord[i].orden.sistemasAfectados || [];
      const s2 = ord[j].orden.sistemasAfectados || [];
      s1.filter((s) => s2.includes(s)).forEach((s) => repetidas.add(`sistema ${s}`));
      const c1 = (ord[i].orden.diagnosticoTecnico?.codigosObd2 || []).map((c) => c.codigo);
      const c2 = (ord[j].orden.diagnosticoTecnico?.codigosObd2 || []).map((c) => c.codigo);
      c1.filter((c) => c2.includes(c)).forEach((c) => repetidas.add(`código ${c}`));
    }
  }
  if (repetidas.size) a.push({ nivel: 'rojo', texto: `Falla repetida en menos de 90 días: ${[...repetidas].join(', ')}` });
  return a;
}

// ---------------------------------------------------------------------------
// Componentes y kilometraje
// ---------------------------------------------------------------------------
export interface UltimoComponente {
  id: CategoriaComponente;
  texto: string;
  fechaMs: number | null;
  km: number | null;
  detalle: string | null;
  folio: string | null;
}

export function ultimosComponentes(visitas: Visita[]): UltimoComponente[] {
  return COMPONENTES.map((c) => {
    for (const v of visitas) {
      // visitas vienen de la más reciente a la más antigua; solo trabajos de órdenes entregadas cuentan como hechos
      if (v.orden.estado !== 'Entregado') continue;
      // se prefiere el repuesto (trae marca y serial) antes que la mano de obra
      const it = [...v.trabajos]
        .sort((a, b) => (a.tipo === 'repuesto' ? 0 : 1) - (b.tipo === 'repuesto' ? 0 : 1))
        .find((t) => componentesDeItem(t).includes(c.id));
      if (it) {
        const marca = it.marcaRepuesto ? ` · ${it.marcaRepuesto}` : '';
        const serial = it.serialRepuesto ? ` · S/N ${it.serialRepuesto}` : '';
        return {
          id: c.id,
          texto: c.texto,
          fechaMs: v.entregaMs || v.ingresoMs,
          km: v.orden.actaEntrega?.kmSalida || v.orden.kilometraje || null,
          detalle: `${it.descripcion}${marca}${serial}`,
          folio: v.orden.folio,
        };
      }
    }
    return { id: c.id, texto: c.texto, fechaMs: null, km: null, detalle: null, folio: null };
  });
}

export function puntosKilometraje(visitas: Visita[]): { ms: number; km: number; folio: string }[] {
  const p: { ms: number; km: number; folio: string }[] = [];
  visitas.forEach((v) => {
    if (v.orden.kilometraje && v.ingresoMs) p.push({ ms: v.ingresoMs, km: v.orden.kilometraje, folio: v.orden.folio });
    if (v.orden.actaEntrega?.kmSalida && v.entregaMs) p.push({ ms: v.entregaMs, km: v.orden.actaEntrega.kmSalida, folio: v.orden.folio });
  });
  return p.sort((a, b) => a.ms - b.ms);
}

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------
export type TipoEvento = 'ingreso' | 'estado' | 'cotizacion' | 'aprobacion' | 'pago' | 'contacto' | 'entrega' | 'cancelacion' | 'correccion';
export interface EventoLinea {
  ms: number;
  tipo: TipoEvento;
  folio: string;
  texto: string;
  quien?: string;
}

export function lineaDeTiempo(visitas: Visita[], contactos: ContactoCliente[]): EventoLinea[] {
  const ev: EventoLinea[] = [];
  const ms = (x: any) => aMilisegundos(x) ?? (typeof x === 'string' ? Date.parse(x) : NaN);
  visitas.forEach((v) => {
    const o = v.orden;
    ev.push({ ms: v.ingresoMs, tipo: 'ingreso', folio: o.folio, texto: `Ingreso con ${o.kilometraje} km: "${o.motivoCliente}"`, quien: o.creadoPorNombre });
    (o.historialEstados || []).slice(1).forEach((h) => {
      const t = ms(h.fecha);
      if (!isNaN(t)) ev.push({ ms: t, tipo: h.estado === 'Cancelada' ? 'cancelacion' : 'estado', folio: o.folio, texto: `${h.estado}${h.notas ? ` · ${h.notas}` : ''}`, quien: h.usuarioNombre });
    });
    v.cotizaciones.forEach((c) => {
      const t = ms(c.fechaEmision);
      if (!isNaN(t))
        ev.push({
          ms: t,
          tipo: 'cotizacion',
          folio: o.folio,
          texto: `Cotización v${c.versionNumero}${c.esComplementariaTrabajoAdicional ? ' (adicional)' : ''}: ${c.totalBs === null ? 'por definir' : `${c.totalBs} Bs`} · ${c.estado.replace('_', ' ')}`,
        });
    });
    v.pagos.forEach((p) => {
      const t = ms(p.fechaLocal);
      if (!isNaN(t)) ev.push({ ms: t, tipo: 'pago', folio: o.folio, texto: `${p.tipo}: ${p.totalBs.toFixed(2)} Bs (${p.montos.filter((m) => m.montoBs).map((m) => m.medio).join(' + ')})`, quien: p.registradoPorNombre });
    });
    if (o.actaEntrega) {
      const t = ms(o.actaEntrega.fecha);
      if (!isNaN(t))
        ev.push({
          ms: t,
          tipo: 'entrega',
          folio: o.folio,
          texto: `${o.actaEntrega.tipo === 'entrega' ? 'Entregado' : 'Devuelto sin reparar'} a ${o.actaEntrega.quienRetira.nombre} con ${o.actaEntrega.kmSalida} km`,
          quien: o.actaEntrega.registradoPorNombre,
        });
    }
    (o.correcciones || []).forEach((c) => {
      const t = ms(c.fecha);
      if (!isNaN(t)) ev.push({ ms: t, tipo: 'correccion', folio: o.folio, texto: `Corrección de ${c.campo}: ${c.motivo}`, quien: c.registradoPorNombre });
    });
  });
  const folios = new Map(visitas.map((v) => [v.orden.id, v.orden.folio]));
  contactos.forEach((c) => {
    const t = ms(c.fechaLocal);
    if (!isNaN(t)) ev.push({ ms: t, tipo: 'contacto', folio: c.folio || folios.get(c.ordenId || '') || '', texto: `${c.medio} · ${c.motivo}: ${c.resumen}${c.resultado ? ` → ${c.resultado}` : ''}`, quien: c.registradoPorNombre });
  });
  return ev.filter((e) => e.ms && !isNaN(e.ms)).sort((a, b) => b.ms - a.ms);
}

// ---------------------------------------------------------------------------
// Correcciones (con motivo; el valor anterior se conserva; sensible si la orden está cerrada)
// ---------------------------------------------------------------------------
export const CAMPOS_CORREGIBLES: { id: string; texto: string; tipo: 'numero' | 'texto' }[] = [
  { id: 'kilometraje', texto: 'Kilometraje de ingreso', tipo: 'numero' },
  { id: 'actaEntrega.kmSalida', texto: 'Kilometraje de salida', tipo: 'numero' },
  { id: 'motivoCliente', texto: 'Motivo del cliente', tipo: 'texto' },
  { id: 'motivoTecnico', texto: 'Apreciación técnica', tipo: 'texto' },
  { id: 'mecanicoResponsable', texto: 'Responsable', tipo: 'texto' },
];

export function valorCampo(orden: OrdenServicio, campo: string): any {
  return campo.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), orden as any);
}

function nombre(d: DuenoUsuario) {
  return d.displayName || d.email;
}

export async function corregirOrdenFirestore(
  orden: OrdenServicio,
  campo: string,
  valorNuevo: string | number,
  motivo: string,
  dueno: DuenoUsuario
): Promise<void> {
  const def = CAMPOS_CORREGIBLES.find((c) => c.id === campo);
  if (!def) throw new Error('Campo no corregible.');
  if (!motivo.trim()) throw new Error('La corrección exige un motivo.');
  if (campo === 'actaEntrega.kmSalida' && !orden.actaEntrega) throw new Error('La orden no tiene acta.');
  const nuevo = def.tipo === 'numero' ? Number(valorNuevo) : String(valorNuevo).trim();
  if (def.tipo === 'numero' && !(Number(nuevo) > 0)) throw new Error('Escribe un número válido.');
  const antes = valorCampo(orden, campo) ?? null;
  if (antes === nuevo) throw new Error('El valor no cambió.');
  const cerrada = orden.estado === 'Entregado' || orden.estado === 'Cancelada';
  const correccion: CorreccionOrden = {
    id: `cor_${Date.now()}`,
    fecha: new Date().toISOString(),
    campo: def.texto,
    antes,
    despues: nuevo,
    motivo: motivo.trim(),
    registradoPorNombre: nombre(dueno),
    registradoPorEmail: dueno.email.toLowerCase(),
  };
  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Historial',
    accion: cerrada ? 'Corrección de orden cerrada' : 'Corrección de orden',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: { [campo]: antes },
    despues: { [campo]: nuevo, motivo: motivo.trim() },
    sensible: cerrada,
  });
  batch.update(
    doc(db, 'ordenes', orden.id),
    limpiarUndefined({
      [campo]: nuevo,
      correcciones: [...(orden.correcciones || []), correccion],
      auditoriaId: auditId,
      updatedAt: serverTimestamp(),
    })
  );
  await batch.commit();
}

/** Reemplaza una foto: la nueva se agrega, la anterior queda guardada y marcada como reemplazada. */
export async function reemplazarFotoOrdenFirestore(
  orden: OrdenServicio,
  anterior: FotoOrden,
  base64Data: string,
  tamanioBytes: number,
  motivo: string,
  dueno: DuenoUsuario
): Promise<void> {
  if (!motivo.trim()) throw new Error('Reemplazar una foto exige un motivo.');
  const cerrada = orden.estado === 'Entregado' || orden.estado === 'Cancelada';
  const batch = writeBatch(db);
  const nuevaRef = doc(collection(db, 'ordenes', orden.id, 'fotos'));
  const auditNueva = escribirAuditoria(batch, dueno, {
    modulo: 'Historial',
    accion: 'Foto de reemplazo',
    entidad: 'fotos',
    entidadId: nuevaRef.id,
    antes: null,
    despues: { ordenId: orden.id, reemplazaFotoId: anterior.id, tipo: anterior.tipo, motivo: motivo.trim() },
  });
  batch.set(
    nuevaRef,
    limpiarUndefined({
      id: nuevaRef.id,
      ordenId: orden.id,
      tipo: anterior.tipo,
      titulo: anterior.titulo,
      base64Data,
      tamanioBytes,
      fecha: serverTimestamp(),
      fechaStr: new Date().toISOString(),
      usuarioUid: dueno.uid,
      usuarioNombre: nombre(dueno),
      auditoriaId: auditNueva,
      reemplazada: false,
      reemplazaFotoId: anterior.id,
      motivoReemplazo: motivo.trim(),
    })
  );
  const auditAnterior = escribirAuditoria(batch, dueno, {
    modulo: 'Historial',
    accion: cerrada ? 'Corrección de foto en orden cerrada' : 'Corrección de foto',
    entidad: 'fotos',
    entidadId: anterior.id,
    antes: { reemplazada: false },
    despues: { reemplazada: true, reemplazadaPorId: nuevaRef.id, motivo: motivo.trim() },
    sensible: true,
  });
  batch.update(doc(db, 'ordenes', orden.id, 'fotos', anterior.id), {
    reemplazada: true,
    reemplazadaPorId: nuevaRef.id,
    motivoReemplazo: motivo.trim(),
    auditoriaId: auditAnterior,
  });
  const auditOrden = escribirAuditoria(batch, dueno, {
    modulo: 'Historial',
    accion: 'Modificación',
    entidad: 'ordenes',
    entidadId: orden.id,
    antes: null,
    despues: { fotoReemplazada: anterior.id, nueva: nuevaRef.id },
  });
  batch.update(doc(db, 'ordenes', orden.id), { totalFotos: (orden.totalFotos || 0) + 1, auditoriaId: auditOrden, updatedAt: serverTimestamp() });
  await batch.commit();
}
