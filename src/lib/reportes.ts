/**
 * Reportes del mes: todo se calcula en el dispositivo con las órdenes y clientes que ya están cargados.
 * Lo único que se lee aparte son los pagos del mes (una consulta por rango de fecha, sin índices extra).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { aMilisegundos } from './storage';
import { calcularFinanzasOrden, redondearBs } from './caja';
import { Cliente, OrdenServicio, PagoOrden } from '../types';

const BO = 4 * 3_600_000; // Bolivia = UTC-4, sin horario de verano

/** 'aaaa-mm' de una fecha (en hora de Bolivia). */
export function mesDe(fecha: any): string | null {
  const ms = aMilisegundos(fecha);
  return ms === null ? null : new Date(ms - BO).toISOString().slice(0, 7);
}

export function mesActual(): string {
  return new Date(Date.now() - BO).toISOString().slice(0, 7);
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function mesSiguiente(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

export function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('es-BO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function diasDelMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export async function cargarPagosDelMes(mes: string): Promise<PagoOrden[]> {
  const snap = await getDocs(
    query(collection(db, 'pagos'), where('fechaDia', '>=', `${mes}-01`), where('fechaDia', '<=', `${mes}-31`))
  );
  return snap.docs.map((d) => ({ ...(d.data() as PagoOrden), id: d.id }));
}

/** "2026-10-18 18:00" (hora de Bolivia) -> ms */
function prometidaMs(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) return Date.parse(`${m[1]}T${m[2]}:00-04:00`);
  const d = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}))?/);
  if (d) return Date.parse(`${d[3]}-${d[2]}-${d[1]}T${d[4] || '18:00'}:00-04:00`);
  return null;
}

function contar(textos: string[], max = 8): { texto: string; cantidad: number }[] {
  const mapa = new Map<string, { texto: string; cantidad: number }>();
  for (const t of textos) {
    const limpio = (t || '').trim().replace(/\s+/g, ' ');
    if (!limpio) continue;
    const clave = limpio.toLowerCase();
    const e = mapa.get(clave);
    if (e) e.cantidad++;
    else mapa.set(clave, { texto: limpio.charAt(0).toUpperCase() + limpio.slice(1), cantidad: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad || a.texto.localeCompare(b.texto)).slice(0, max);
}

export interface FilaMecanico {
  nombre: string;
  entregadas: number;
  facturadoBs: number;
  tareas: number;
  horasReales: number;
  horasEstimadas: number;
}

export interface FilaEntregada {
  folio: string;
  placa: string;
  cliente: string;
  fechaEntrega: string;
  dias: number | null;
  totalBs: number;
  pagadoBs: number;
  saldoBs: number;
  mecanico: string;
  aTiempo: boolean | null;
}

export interface ReporteMes {
  mes: string;
  recibidas: number;
  entregadas: number;
  canceladas: number;
  enTallerAhora: number;
  facturadoBs: number;
  cobradoBs: number;
  cobradoPorMedio: { medio: string; bs: number }[];
  ticketPromedioBs: number | null;
  diasPromedioTaller: number | null;
  cumplimientoPct: number | null;
  clientesNuevos: number;
  saldoPorCobrarBs: number;
  ordenesConSaldo: number;
  reclamosGarantia: number;
  retrabajos: number;
  topTrabajos: { texto: string; cantidad: number }[];
  topSistemas: { texto: string; cantidad: number }[];
  motivosCancelacion: { texto: string; cantidad: number }[];
  mecanicos: FilaMecanico[];
  cobrosPorDia: { dia: number; bs: number }[];
  detalleEntregadas: FilaEntregada[];
}

export function calcularReporte(mes: string, datos: { ordenes: OrdenServicio[]; clientes: Cliente[]; pagos: PagoOrden[] }): ReporteMes {
  const { ordenes, clientes, pagos } = datos;
  const recibidas = ordenes.filter((o) => mesDe(o.createdAt || o.fechaCreacion) === mes);
  const entregadas = ordenes.filter((o) => o.estado === 'Entregado' && o.actaEntrega?.tipo === 'entrega' && mesDe(o.fechaEntrega) === mes);
  const canceladas = ordenes.filter((o) => o.cancelacion && mesDe(o.cancelacion.fecha) === mes);

  const detalle: FilaEntregada[] = entregadas
    .map((o) => {
      const f = calcularFinanzasOrden(o);
      const ini = aMilisegundos(o.createdAt || o.fechaCreacion);
      const fin = aMilisegundos(o.fechaEntrega);
      const listo = aMilisegundos(o.listoDesde) ?? fin;
      const prom = prometidaMs(o.fechaPrometidaEntrega);
      return {
        folio: o.folio,
        placa: o.vehiculoPlaca,
        cliente: o.clienteNombre,
        fechaEntrega: o.fechaEntrega || '',
        dias: ini && fin ? Math.max(0, (fin - ini) / 86_400_000) : null,
        totalBs: f.totalAprobadoBs ?? 0,
        pagadoBs: f.totalPagadoBs,
        saldoBs: Math.max(0, f.saldoBs ?? 0),
        mecanico: o.mecanicoResponsable || 'Sin asignar',
        aTiempo: prom && listo ? listo <= prom : null,
      };
    })
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  const facturadoBs = redondearBs(detalle.reduce((s, d) => s + d.totalBs, 0));
  const conDias = detalle.filter((d) => d.dias !== null);
  const conFecha = detalle.filter((d) => d.aTiempo !== null);

  // Cobros (incluye anulaciones, que restan)
  const porMedio = new Map<string, number>();
  const porDia = new Map<number, number>();
  for (const p of pagos) {
    if (!p.fechaDia?.startsWith(mes)) continue;
    for (const m of p.montos || []) porMedio.set(m.medio, (porMedio.get(m.medio) || 0) + m.montoBs);
    const dia = Number(p.fechaDia.slice(8, 10));
    porDia.set(dia, (porDia.get(dia) || 0) + p.totalBs);
  }
  const cobradoBs = redondearBs([...porDia.values()].reduce((s, v) => s + v, 0));

  // Saldo por cobrar hoy: mismo criterio que Caja > Cuentas por cobrar
  let saldoPorCobrarBs = 0;
  let ordenesConSaldo = 0;
  for (const o of ordenes) {
    if (o.estado === 'Cancelada') continue;
    const s = calcularFinanzasOrden(o).saldoBs;
    if (s !== null && s > 0) {
      saldoPorCobrarBs += s;
      ordenesConSaldo++;
    }
  }

  // Mecánicos: órdenes entregadas y tareas terminadas en el mes
  const mec = new Map<string, FilaMecanico>();
  const fila = (n: string) => {
    const k = n || 'Sin asignar';
    if (!mec.has(k)) mec.set(k, { nombre: k, entregadas: 0, facturadoBs: 0, tareas: 0, horasReales: 0, horasEstimadas: 0 });
    return mec.get(k)!;
  };
  for (const d of detalle) {
    const f = fila(d.mecanico);
    f.entregadas++;
    f.facturadoBs = redondearBs(f.facturadoBs + d.totalBs);
  }
  for (const o of ordenes) {
    for (const t of o.tareas || []) {
      if (t.estado !== 'Finalizada' || mesDe(t.fechaFin) !== mes) continue;
      const f = fila(t.responsable || o.mecanicoResponsable || '');
      f.tareas++;
      f.horasReales += (t.tiempoRealMinutos || 0) / 60;
      f.horasEstimadas += (t.tiempoEstimadoMinutos || 0) / 60;
    }
  }

  const prevAnt = (n: number) => Math.round(n * 10) / 10;

  return {
    mes,
    recibidas: recibidas.length,
    entregadas: entregadas.length,
    canceladas: canceladas.length,
    enTallerAhora: ordenes.filter((o) => !['Entregado', 'Cancelada'].includes(o.estado)).length,
    facturadoBs,
    cobradoBs,
    cobradoPorMedio: [...porMedio.entries()].map(([medio, bs]) => ({ medio, bs: redondearBs(bs) })).sort((a, b) => b.bs - a.bs),
    ticketPromedioBs: detalle.length ? redondearBs(facturadoBs / detalle.length) : null,
    diasPromedioTaller: conDias.length ? prevAnt(conDias.reduce((s, d) => s + (d.dias || 0), 0) / conDias.length) : null,
    cumplimientoPct: conFecha.length ? Math.round((conFecha.filter((d) => d.aTiempo).length / conFecha.length) * 100) : null,
    clientesNuevos: clientes.filter((c) => mesDe(c.createdAt) === mes).length,
    saldoPorCobrarBs: redondearBs(saldoPorCobrarBs),
    ordenesConSaldo,
    reclamosGarantia: recibidas.filter((o) => o.reclamoGarantia).length,
    retrabajos: entregadas.reduce((s, o) => s + (o.retrabajos || 0), 0),
    topTrabajos: contar(entregadas.flatMap((o) => o.actaEntrega?.trabajosRealizados || [])),
    topSistemas: contar(recibidas.flatMap((o) => o.sistemasAfectados || [])),
    motivosCancelacion: contar(canceladas.map((o) => o.cancelacion!.motivo)),
    mecanicos: [...mec.values()]
      .map((m) => ({ ...m, horasReales: prevAnt(m.horasReales), horasEstimadas: prevAnt(m.horasEstimadas) }))
      .sort((a, b) => b.facturadoBs - a.facturadoBs || b.tareas - a.tareas),
    cobrosPorDia: Array.from({ length: diasDelMes(mes) }, (_, i) => ({ dia: i + 1, bs: redondearBs(porDia.get(i + 1) || 0) })),
    detalleEntregadas: detalle,
  };
}
