/**
 * Garantía de los trabajos: se fija al entregar (meses y/o km, lo que ocurra primero),
 * se muestra en el acta y en la hoja de vida, y se avisa al recibir el vehículo de nuevo.
 */
import { GarantiaOrden, OrdenServicio, TallerConfig } from '../types';

export const GARANTIA_MESES_DEFECTO = 3;
export const GARANTIA_KM_DEFECTO = 5000;

export function garantiaPorDefecto(config: TallerConfig): { meses: number; km: number } {
  return {
    meses: config.garantiaMesesDefecto ?? GARANTIA_MESES_DEFECTO,
    km: config.garantiaKmDefecto ?? GARANTIA_KM_DEFECTO,
  };
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha.getTime());
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // 31/01 + 1 mes -> último día de febrero (no 03/03)
  if (d.getDate() < dia) d.setDate(0);
  return d;
}

/** Devuelve null si no hay garantía (0 meses y 0 km). */
export function calcularGarantia(meses: number, km: number, desdeISO: string, kmDesde: number): GarantiaOrden | null {
  const m = Math.max(0, Math.round(Number(meses) || 0));
  const k = Math.max(0, Math.round(Number(km) || 0));
  if (!m && !k) return null;
  return {
    meses: m,
    km: k,
    desde: desdeISO,
    kmDesde: Math.round(kmDesde || 0),
    hastaFecha: m ? sumarMeses(new Date(desdeISO), m).toISOString() : null,
    hastaKm: k ? Math.round(kmDesde || 0) + k : null,
  };
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "3 meses o 5.000 km (lo que ocurra primero): hasta el 17/01/2027 o los 6.200 km" */
export function textoGarantia(g: GarantiaOrden | null | undefined): string {
  if (!g) return 'Sin garantía';
  const partes: string[] = [];
  const limites: string[] = [];
  if (g.meses) {
    partes.push(`${g.meses} ${g.meses === 1 ? 'mes' : 'meses'}`);
    limites.push(`el ${fechaCorta(g.hastaFecha)}`);
  }
  if (g.km) {
    partes.push(`${g.km.toLocaleString('es-BO')} km`);
    limites.push(`los ${(g.hastaKm || 0).toLocaleString('es-BO')} km`);
  }
  const primero = partes.length > 1 ? ' (lo que ocurra primero)' : '';
  return `${partes.join(' o ')}${primero}: hasta ${limites.join(' o ')}`;
}

export interface GarantiaVigente {
  orden: OrdenServicio;
  garantia: GarantiaOrden;
  diasRestantes: number | null;
  kmRestantes: number | null;
}

/** Vigente si no pasó la fecha ni el km (si se conoce el km actual). */
export function estaVigente(g: GarantiaOrden, kmActual?: number | null, ahora = Date.now()): boolean {
  if (g.hastaFecha && Date.parse(g.hastaFecha) < ahora) return false;
  if (g.hastaKm && kmActual && kmActual > g.hastaKm) return false;
  return true;
}

/** Garantías vigentes de un vehículo (de la más reciente a la más antigua). */
export function garantiasVigentes(ordenes: OrdenServicio[], vehiculoId: string, kmActual?: number | null): GarantiaVigente[] {
  const ahora = Date.now();
  return ordenes
    .filter((o) => o.vehiculoId === vehiculoId && o.estado === 'Entregado' && o.garantia)
    .filter((o) => estaVigente(o.garantia!, kmActual, ahora))
    .sort((a, b) => Date.parse(b.garantia!.desde) - Date.parse(a.garantia!.desde))
    .map((o) => {
      const g = o.garantia!;
      return {
        orden: o,
        garantia: g,
        diasRestantes: g.hastaFecha ? Math.max(0, Math.ceil((Date.parse(g.hastaFecha) - ahora) / 86_400_000)) : null,
        kmRestantes: g.hastaKm && kmActual ? Math.max(0, g.hastaKm - kmActual) : null,
      };
    });
}

/** Resumen corto de lo que cubre: trabajos del acta (o el motivo). */
export function trabajosCubiertos(o: OrdenServicio): string {
  const t = o.actaEntrega?.trabajosRealizados || [];
  if (t.length) return t.slice(0, 3).join(', ') + (t.length > 3 ? ` y ${t.length - 3} más` : '');
  return o.motivoCliente || '';
}
