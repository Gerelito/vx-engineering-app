/**
 * Módulo 7: documentos PDF para el cliente (generados en el navegador con jsPDF).
 * Diseño de la Orden de servicio según el Anexo A (figuras A1 y A2).
 * Nunca se imprimen costos internos, márgenes ni notas internas.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { aMilisegundos, obtenerCotizacionesOrdenFirestore } from './storage';
import { calcularFinanzasOrden } from './caja';
import { OBJETOS_ACCESORIOS } from './entrega';
import { PASOS_CLIENTE, estadoParaCliente } from './verificacion';
import { CotizacionOrden, EstadoOrden, ItemCotizacion, OrdenServicio, PagoOrden, TallerConfig } from '../types';

export type TipoDocumento = 'orden' | 'cotizacion' | 'acta_entrega' | 'acta_devolucion';

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  orden: 'Orden de servicio',
  cotizacion: 'Cotización',
  acta_entrega: 'Acta de entrega',
  acta_devolucion: 'Acta de devolución',
};

export const COLOR_MARCA_POR_DEFECTO = '#C2410C';

export { PASOS_CLIENTE, estadoParaCliente, nombrePublico } from './verificacion';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aaaa · hh:mm en hora de Bolivia. */
export function fechaHoraBo(fecha: any, conHora = true): string {
  const ms = aMilisegundos(fecha);
  if (ms === null) return typeof fecha === 'string' && fecha ? fecha : '—';
  const d = new Date(ms - 4 * 3_600_000); // La Paz: UTC-4 todo el año
  const f = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return conHora ? `${f} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : f;
}

/** 1.500,00 */
export function bs(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const neg = n < 0;
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  return `${neg ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

function rgb(hex: string): [number, number, number] {
  const h = (hex || COLOR_MARCA_POR_DEFECTO).replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(v, 16);
  if (isNaN(n)) return rgb(COLOR_MARCA_POR_DEFECTO);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla un color con blanco (para fondos suaves). */
function suave(c: [number, number, number], t = 0.9): [number, number, number] {
  return c.map((x) => Math.round(x + (255 - x) * t)) as [number, number, number];
}

/** jsPDF con Helvetica solo admite Latin-1: cambia los caracteres que no entran. */
function limpio(s: any): string {
  return String(s ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '');
}

export function codigoCorto(orden: OrdenServicio): string {
  const c = (orden.codigoVerificacion || '').toUpperCase();
  return `${orden.folio} · ${c.slice(-8, -4)}-${c.slice(-4)}`;
}

export { urlBaseVerificacion, urlVerificacion } from './verificacion';
import { urlVerificacion } from './verificacion';

const TIPO_ITEM: Record<string, string> = { mano_obra: 'Mano de obra', repuesto: 'Repuesto', terceros: 'Servicio externo' };

// ---------------------------------------------------------------------------
// Datos de la orden para los documentos
// ---------------------------------------------------------------------------
export interface DatosTrabajos {
  titulo: 'Trabajos aprobados' | 'Trabajos cotizados';
  items: ItemCotizacion[];
  recomendaciones: string[];
  descuentoBs: number;
  hayPorDefinir: boolean;
}

export function trabajosDesdeCotizaciones(cots: CotizacionOrden[]): DatosTrabajos {
  const principales = cots.filter((c) => !c.esComplementariaTrabajoAdicional).sort((a, b) => (b.versionNumero || 0) - (a.versionNumero || 0));
  const aprobada = principales.find((c) => c.estado === 'Aprobada_Total' || c.estado === 'Aprobada_Parcial');
  const complementarias = cots.filter(
    (c) => c.esComplementariaTrabajoAdicional && (c.estado === 'Aprobada_Total' || c.estado === 'Aprobada_Parcial')
  );
  if (aprobada) {
    const usadas = [aprobada, ...complementarias];
    const items = usadas.flatMap((c) => c.items.filter((i) => i.aprobado));
    const recomendaciones = usadas.flatMap((c) => c.items.filter((i) => i.aprobado === false).map((i) => i.descripcion));
    const descuentoBs = usadas.reduce((a, c) => a + (c.descuentoTotalMontoBs || 0), 0);
    return { titulo: 'Trabajos aprobados', items, recomendaciones, descuentoBs, hayPorDefinir: items.some((i) => i.precioPorDefinir) };
  }
  const vigente = principales.find((c) => c.estado !== 'Rechazada');
  if (vigente) {
    return {
      titulo: 'Trabajos cotizados',
      items: vigente.items,
      recomendaciones: [],
      descuentoBs: vigente.descuentoTotalMontoBs || 0,
      hayPorDefinir: vigente.items.some((i) => i.precioPorDefinir),
    };
  }
  return { titulo: 'Trabajos cotizados', items: [], recomendaciones: [], descuentoBs: 0, hayPorDefinir: false };
}

/** Pagos vigentes de la orden (sin los anulados ni sus anulaciones). */
export async function pagosVigentesOrden(ordenId: string): Promise<PagoOrden[]> {
  const snap = await getDocs(query(collection(db, 'pagos'), where('ordenId', '==', ordenId)));
  const todos = snap.docs.map((d) => ({ ...(d.data() as PagoOrden), id: d.id }));
  const anulados = new Set(todos.filter((p) => p.anulaPagoId).map((p) => p.anulaPagoId as string));
  return todos
    .filter((p) => !p.anulaPagoId && !anulados.has(p.id))
    .sort((a, b) => String(a.fechaLocal).localeCompare(String(b.fechaLocal)));
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------
const PAGINA = { ancho: 215.9, alto: 279.4, izq: 13, der: 13, arriba: 12, abajo: 14 };
const ANCHO_UTIL = PAGINA.ancho - PAGINA.izq - PAGINA.der;
const TINTA: [number, number, number] = [31, 35, 40];
const GRIS: [number, number, number] = [95, 102, 114];
const LINEA: [number, number, number] = [227, 229, 232];
const VERDE: [number, number, number] = [21, 128, 61];
const PT = 0.3528; // mm por punto

class Lienzo {
  doc: jsPDF;
  y = PAGINA.arriba;
  marca: [number, number, number];

  constructor(public config: TallerConfig, public folio: string) {
    this.doc = new jsPDF({ unit: 'mm', format: 'letter' });
    this.marca = rgb((config as any).colorMarca || COLOR_MARCA_POR_DEFECTO);
    this.doc.setLineHeightFactor(1.25);
  }

  fuente(tam: number, estilo: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal', color: [number, number, number] = TINTA) {
    this.doc.setFont('helvetica', estilo);
    this.doc.setFontSize(tam);
    this.doc.setTextColor(...color);
  }

  alto(tam: number, lineas = 1) {
    return tam * PT * 1.25 * lineas;
  }

  texto(s: string, x: number, y: number, opts?: any) {
    this.doc.text(limpio(s), x, y, opts);
  }

  partir(s: string, ancho: number): string[] {
    return this.doc.splitTextToSize(limpio(s), ancho) as string[];
  }

  /** Si no entra el bloque, pasa a una página nueva. */
  espacio(h: number) {
    if (this.y + h > PAGINA.alto - PAGINA.abajo - 8) {
      this.doc.addPage();
      this.y = PAGINA.arriba;
    }
  }

  titulo(s: string, x = PAGINA.izq, y = this.y) {
    this.fuente(7.6, 'bold', GRIS);
    this.doc.setCharSpace(0.25);
    this.texto(s.toUpperCase(), x, y);
    this.doc.setCharSpace(0);
  }

  rect(x: number, y: number, w: number, h: number, borde?: [number, number, number] | null, relleno?: [number, number, number] | null, r = 2) {
    if (borde) this.doc.setDrawColor(...borde);
    if (relleno) this.doc.setFillColor(...relleno);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(x, y, w, h, r, r, borde && relleno ? 'FD' : relleno ? 'F' : 'S');
  }

  async encabezado(tituloDoc: string, lineasDerecha: string[]) {
    const c = this.config;
    const x0 = PAGINA.izq;
    const top = this.y;
    let logoOk = false;
    if (c.logoUrl) {
      try {
        const data = c.logoUrl.startsWith('data:') ? c.logoUrl : await urlADataUrl(c.logoUrl);
        const formato = data.includes('image/png') ? 'PNG' : 'JPEG';
        this.doc.addImage(data, formato, x0, top, 20, 20, undefined, 'FAST');
        logoOk = true;
      } catch {
        logoOk = false;
      }
    }
    if (!logoOk) {
      this.doc.setLineDashPattern([1, 0.8], 0);
      this.rect(x0, top, 20, 20, [185, 190, 198], null, 3);
      this.doc.setLineDashPattern([], 0);
      this.fuente(7, 'normal', GRIS);
      this.texto('TU', x0 + 10, top + 9, { align: 'center' });
      this.texto('LOGO', x0 + 10, top + 12.5, { align: 'center' });
    }
    const xt = x0 + 24;
    this.fuente(14.5, 'bold');
    this.texto(c.nombre || 'VX Engineering', xt, top + 6);
    this.fuente(8.3, 'normal', GRIS);
    const dir = [c.direccion, c.ciudad || 'La Paz', c.pais || 'Bolivia'].filter((v) => v && String(v).trim()).join(', ');
    this.texto(dir || 'La Paz, Bolivia', xt, top + 11);
    const contacto = [c.telefonoWhatsapp ? `Tel. / WhatsApp: ${c.telefonoWhatsapp}` : '', c.horario ? `Horario: ${c.horario}` : '']
      .filter(Boolean)
      .join(' · ');
    if (contacto) this.texto(contacto, xt, top + 15.2);

    const xr = PAGINA.ancho - PAGINA.der;
    this.fuente(7.8, 'bold', GRIS);
    this.doc.setCharSpace(0.3);
    this.texto(tituloDoc.toUpperCase(), xr, top + 3.5, { align: 'right' });
    this.doc.setCharSpace(0);
    this.fuente(16, 'bold', this.marca);
    this.texto(this.folio, xr, top + 10.5, { align: 'right' });
    this.fuente(8.3, 'normal', GRIS);
    lineasDerecha.forEach((l, i) => this.texto(l, xr, top + 15 + i * 3.8, { align: 'right' }));

    this.y = top + Math.max(22, 15 + lineasDerecha.length * 3.8) + 1;
    this.doc.setDrawColor(...this.marca);
    this.doc.setLineWidth(1);
    this.doc.line(x0, this.y, xr, this.y);
    this.y += 6;
  }

  /** "Estado de su vehículo" con barra de 6 pasos. */
  barraEstado(estado: EstadoOrden, textoEta: string | null) {
    const e = estadoParaCliente(estado);
    const x0 = PAGINA.izq;
    const xr = PAGINA.ancho - PAGINA.der;
    this.titulo('Estado de su vehículo', x0, this.y + 2);
    this.fuente(8.5, 'bold', [255, 255, 255]);
    const w = this.doc.getTextWidth(limpio(e.pastilla)) + 7;
    this.rect(xr - w, this.y - 1.5, w, 5.6, null, e.cancelada ? [185, 28, 28] : this.marca, 2.8);
    this.texto(e.pastilla, xr - w / 2, this.y + 2.4, { align: 'center' });
    this.y += 7;

    if (e.cancelada) {
      this.rect(x0, this.y, ANCHO_UTIL, 8, null, [254, 226, 226], 2);
      this.fuente(9, 'bold', [153, 27, 27]);
      this.texto('Orden cancelada', x0 + ANCHO_UTIL / 2, this.y + 5.3, { align: 'center' });
      this.y += 11;
      return;
    }
    const gap = 1.4;
    const wp = (ANCHO_UTIL - gap * 5) / 6;
    PASOS_CLIENTE.forEach((nombrePaso, i) => {
      const xp = x0 + i * (wp + gap);
      const hecho = i < e.paso;
      const ahora = i === e.paso;
      this.rect(xp, this.y, wp, 2, null, hecho ? VERDE : ahora ? this.marca : LINEA, 1);
      this.fuente(7.4, ahora ? 'bold' : 'normal', ahora ? this.marca : hecho ? TINTA : GRIS);
      const etiqueta = i === 2 && e.etiquetaPaso2 ? e.etiquetaPaso2 : nombrePaso;
      this.texto(etiqueta, xp + wp / 2, this.y + 5.6, { align: 'center' });
    });
    this.y += 9;
    if (textoEta) {
      this.rect(x0, this.y, ANCHO_UTIL, 7, null, suave(this.marca, 0.92), 2);
      this.fuente(8.6, 'normal');
      const pre = 'Entrega estimada: ';
      this.texto(pre, x0 + 3, this.y + 4.6);
      let x = x0 + 3 + this.doc.getTextWidth(pre);
      this.fuente(8.6, 'bold', this.marca);
      this.texto(textoEta, x, this.y + 4.6);
      x += this.doc.getTextWidth(limpio(textoEta));
      this.fuente(8.6, 'normal');
      this.texto(' · Le avisaremos por teléfono o WhatsApp cuando esté listo.', x, this.y + 4.6);
      this.y += 9.5;
    }
  }

  /** Dos tarjetas lado a lado con pares etiqueta / valor. */
  tarjetas(izq: { titulo: string; filas: [string, string][] }, der: { titulo: string; filas: [string, string][] }) {
    const x0 = PAGINA.izq;
    const w = (ANCHO_UTIL - 4) / 2;
    const filasMax = Math.max(izq.filas.length, der.filas.length);
    const h = 8 + filasMax * 4.4 + 2;
    this.espacio(h + 2);
    [izq, der].forEach((t, i) => {
      const x = x0 + i * (w + 4);
      this.rect(x, this.y, w, h, LINEA, null, 2);
      this.titulo(t.titulo, x + 3.5, this.y + 5);
      t.filas.forEach(([k, v], j) => {
        const yy = this.y + 10 + j * 4.4;
        this.fuente(8.6, 'normal', GRIS);
        this.texto(k, x + 3.5, yy);
        this.fuente(8.6, 'bold');
        const lineas = this.partir(v || '—', w - 38);
        this.texto(lineas[0], x + 34, yy);
      });
    });
    this.y += h + 5;
  }

  cita(tituloTxt: string, s: string) {
    this.fuente(9, 'italic');
    const lineas = this.partir(`"${s}"`, ANCHO_UTIL - 6);
    this.espacio(6 + this.alto(9, lineas.length));
    this.titulo(tituloTxt);
    this.y += 2.5;
    this.doc.setDrawColor(...LINEA);
    this.doc.setLineWidth(0.8);
    this.doc.line(PAGINA.izq + 0.4, this.y, PAGINA.izq + 0.4, this.y + this.alto(9, lineas.length) + 0.5);
    this.fuente(9, 'italic');
    this.texto(lineas.join('\n'), PAGINA.izq + 4, this.y + 3.3);
    this.y += this.alto(9, lineas.length) + 5;
  }

  /** Tabla simple. columnas: ancho en mm (la primera toma el resto) y alineación. */
  tabla(
    columnas: { titulo: string; ancho?: number; derecha?: boolean; etiqueta?: boolean }[],
    filas: string[][],
    opciones: { x?: number; ancho?: number; tam?: number } = {}
  ) {
    const x0 = opciones.x ?? PAGINA.izq;
    const anchoTotal = opciones.ancho ?? ANCHO_UTIL;
    const tam = opciones.tam ?? 8.8;
    const fijos = columnas.reduce((a, c) => a + (c.ancho || 0), 0);
    const anchos = columnas.map((c) => c.ancho || anchoTotal - fijos);
    const xs = anchos.map((_, i) => x0 + anchos.slice(0, i).reduce((a, b) => a + b, 0));
    const cabecera = () => {
      this.fuente(7.2, 'bold', GRIS);
      columnas.forEach((c, i) => {
        const xx = c.derecha ? xs[i] + anchos[i] - 1.5 : xs[i] + 1.5;
        this.texto(c.titulo.toUpperCase(), xx, this.y, c.derecha ? { align: 'right' } : undefined);
      });
      this.doc.setDrawColor(...TINTA);
      this.doc.setLineWidth(0.3);
      this.doc.line(x0, this.y + 1.6, x0 + anchoTotal, this.y + 1.6);
      this.y += 5.5;
    };
    this.espacio(12);
    cabecera();
    filas.forEach((fila) => {
      this.fuente(tam, 'normal');
      const lineasDesc = this.partir(fila[0], anchos[0] - 3);
      const h = Math.max(5, this.alto(tam, lineasDesc.length) + 1.8);
      if (this.y + h > PAGINA.alto - PAGINA.abajo - 8) {
        this.doc.addPage();
        this.y = PAGINA.arriba;
        cabecera();
      }
      fila.forEach((celda, i) => {
        const c = columnas[i];
        if (i === 0) {
          this.fuente(tam, 'normal');
          this.texto(lineasDesc.join('\n'), xs[i] + 1.5, this.y);
        } else if (c.etiqueta) {
          this.fuente(7, 'normal', GRIS);
          const w = this.doc.getTextWidth(limpio(celda)) + 3.5;
          this.rect(xs[i] + 1.5, this.y - 2.8, w, 3.9, null, [241, 242, 244], 1);
          this.texto(celda, xs[i] + 3.25, this.y);
        } else {
          const porDefinir = celda === 'Por definir';
          this.fuente(tam, porDefinir ? 'bolditalic' : 'normal', porDefinir ? [180, 83, 9] : TINTA);
          const xx = c.derecha ? xs[i] + anchos[i] - 1.5 : xs[i] + 1.5;
          this.texto(celda, xx, this.y, c.derecha ? { align: 'right' } : undefined);
        }
      });
      this.doc.setDrawColor(...LINEA);
      this.doc.setLineWidth(0.25);
      this.doc.line(x0, this.y + h - 3.2, x0 + anchoTotal, this.y + h - 3.2);
      this.y += h;
    });
    this.y += 1;
  }

  nota(s: string, fondo: [number, number, number] = [254, 243, 199], borde: [number, number, number] = [252, 211, 77], color: [number, number, number] = [120, 53, 15]) {
    this.fuente(8.6, 'normal', color);
    const lineas = this.partir(s, ANCHO_UTIL - 6);
    const h = this.alto(8.6, lineas.length) + 4;
    this.espacio(h + 3);
    this.rect(PAGINA.izq, this.y, ANCHO_UTIL, h, borde, fondo, 2);
    this.fuente(8.6, 'normal', color);
    this.texto(lineas.join('\n'), PAGINA.izq + 3, this.y + 4.3);
    this.y += h + 4;
  }

  /** Recuadro punteado de recomendaciones pendientes. */
  recomendaciones(lista: string[]) {
    if (!lista.length) return;
    this.fuente(8.8, 'normal');
    const lineas = lista.flatMap((r) => this.partir(`·  ${r}`, ANCHO_UTIL - 10));
    const h = 8 + this.alto(8.8, lineas.length) + 2;
    this.espacio(h + 3);
    this.doc.setLineDashPattern([1.2, 0.9], 0);
    this.rect(PAGINA.izq, this.y, ANCHO_UTIL, h, [201, 205, 211], [250, 250, 251], 2);
    this.doc.setLineDashPattern([], 0);
    this.fuente(8.8, 'bold');
    const t = 'Recomendaciones que quedaron pendientes';
    this.texto(t, PAGINA.izq + 3.5, this.y + 5);
    const anchoT = this.doc.getTextWidth(t);
    this.fuente(8.8, 'normal');
    this.texto(' (no aprobadas; se las recordaremos más adelante):', PAGINA.izq + 3.5 + anchoT, this.y + 5);
    this.texto(lineas.join('\n'), PAGINA.izq + 5, this.y + 9.6);
    this.y += h + 4;
  }

  async verificacion(url: string, codigo: string) {
    const h = 30;
    this.espacio(h + 2);
    this.rect(PAGINA.izq, this.y, ANCHO_UTIL, h, LINEA, null, 3);
    try {
      const qr = await QRCode.toDataURL(url, { margin: 0, width: 360, errorCorrectionLevel: 'M' });
      this.doc.addImage(qr, 'PNG', PAGINA.izq + 4, this.y + 3, 24, 24);
    } catch {
      /* sin QR: queda el código escrito */
    }
    const xt = PAGINA.izq + 33;
    this.fuente(10, 'bold');
    this.texto('Verifique este documento y vea el estado actualizado', xt, this.y + 8);
    this.fuente(8.5, 'normal', GRIS);
    const exp = this.partir(
      'Escanee el código con la cámara de su celular. Verá si el documento es auténtico y en qué estado está su vehículo en este momento.',
      ANCHO_UTIL - 38
    );
    this.texto(exp.join('\n'), xt, this.y + 13);
    const yc = this.y + 13 + this.alto(8.5, exp.length) + 1.5;
    const etiqueta = 'Código de verificación: ';
    this.texto(etiqueta, xt, yc);
    const anchoEtiqueta = this.doc.getTextWidth(limpio(etiqueta));
    this.doc.setFont('courier', 'bold');
    this.doc.setTextColor(...TINTA);
    this.texto(codigo, xt + anchoEtiqueta, yc);
    this.y += h + 4;
  }

  firmas(izq: string, der: string) {
    this.espacio(24);
    this.y += 16;
    const w = (ANCHO_UTIL - 20) / 2;
    this.doc.setDrawColor(...GRIS);
    this.doc.setLineWidth(0.3);
    this.doc.line(PAGINA.izq, this.y, PAGINA.izq + w, this.y);
    this.doc.line(PAGINA.izq + w + 20, this.y, PAGINA.izq + 2 * w + 20, this.y);
    this.fuente(8, 'normal', GRIS);
    this.texto(izq, PAGINA.izq + w / 2, this.y + 4, { align: 'center' });
    this.texto(der, PAGINA.izq + w * 1.5 + 20, this.y + 4, { align: 'center' });
    this.y += 8;
  }

  /** Pie en todas las páginas. */
  pies() {
    const total = this.doc.getNumberOfPages();
    const generado = `Generado el ${fechaHoraBo(new Date())} · Este documento no es una factura.`;
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      const y = PAGINA.alto - PAGINA.abajo + 2;
      this.doc.setDrawColor(...LINEA);
      this.doc.setLineWidth(0.25);
      this.doc.line(PAGINA.izq, y - 4, PAGINA.ancho - PAGINA.der, y - 4);
      this.fuente(7.6, 'normal', GRIS);
      this.texto(generado, PAGINA.izq, y);
      this.texto(`Folio ${this.folio} · Página ${p} de ${total}`, PAGINA.ancho - PAGINA.der, y, { align: 'right' });
    }
  }
}

async function urlADataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  const b = await r.blob();
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });
}

/** Caja de totales a la derecha y pagos registrados a la izquierda (Anexo A). */
function bloqueDinero(L: Lienzo, orden: OrdenServicio, pagos: PagoOrden[], variantePorDefinir: boolean, mediosConfig: string[]) {
  const fin = calcularFinanzasOrden(orden);
  const wTot = 78;
  const xTot = PAGINA.ancho - PAGINA.der - wTot;
  const wPag = ANCHO_UTIL - wTot - 5;

  const otrosMedios = Object.entries(fin.porMedio || {}).filter(([m, v]) => m !== 'QR' && m !== 'Efectivo' && Math.abs(v) > 0.004);
  const filasTot: { k: string; v: string; tipo?: 'pagado' | 'saldo' | 'pend' }[] = [];
  if (variantePorDefinir || fin.estadoTotal !== 'aprobado') {
    filasTot.push({ k: 'Total', v: 'Pendiente de negociación', tipo: 'pend' });
  } else {
    filasTot.push({ k: 'Total aprobado', v: `Bs ${bs(fin.totalAprobadoBs)}` });
  }
  filasTot.push({ k: 'Pagado (QR)', v: `- Bs ${bs(fin.pagadoQRBs)}`, tipo: 'pagado' });
  filasTot.push({ k: 'Pagado (efectivo)', v: `- Bs ${bs(fin.pagadoEfectivoBs)}`, tipo: 'pagado' });
  otrosMedios.forEach(([m, v]) => filasTot.push({ k: `Pagado (${m})`, v: `- Bs ${bs(v)}`, tipo: 'pagado' }));
  const saldo = variantePorDefinir || fin.saldoBs === null ? 'Por calcular' : `Bs ${bs(fin.saldoBs)}`;
  filasTot.push({ k: fin.saldoBs !== null && fin.saldoBs < 0 ? 'Saldo a su favor' : 'Saldo pendiente', v: saldo, tipo: 'saldo' });

  const hFila = 6.6;
  const hTot = filasTot.length * hFila;
  const hPag = 6 + Math.max(1, pagos.length) * 4.6 + 6;
  L.espacio(Math.max(hTot, hPag) + 4);
  const y0 = L.y;

  // Totales
  L.rect(xTot, y0, wTot, hTot, LINEA, null, 2);
  filasTot.forEach((f, i) => {
    const yy = y0 + i * hFila;
    if (f.tipo === 'saldo') {
      L.doc.setFillColor(...(variantePorDefinir ? GRIS : L.marca));
      const ultima = i === filasTot.length - 1;
      L.doc.roundedRect(xTot, yy, wTot, hFila, ultima ? 2 : 0, ultima ? 2 : 0, 'F');
      L.doc.rect(xTot, yy, wTot, hFila / 2, 'F');
      L.fuente(10.5, 'bold', [255, 255, 255]);
    } else if (f.tipo === 'pagado') {
      L.fuente(9, 'normal', VERDE);
    } else {
      L.fuente(9, 'normal');
    }
    L.texto(f.k, xTot + 3.5, yy + 4.4);
    if (f.tipo === 'pend') L.fuente(9, 'bolditalic', [180, 83, 9]);
    L.texto(f.v, xTot + wTot - 3.5, yy + 4.4, { align: 'right' });
    if (i < filasTot.length - 1 && filasTot[i + 1].tipo !== 'saldo') {
      L.doc.setDrawColor(...LINEA);
      L.doc.setLineWidth(0.25);
      L.doc.line(xTot, yy + hFila, xTot + wTot, yy + hFila);
    }
  });

  // Pagos registrados
  L.titulo('Pagos registrados', PAGINA.izq, y0 + 2);
  L.y = y0 + 7;
  if (pagos.length === 0) {
    L.fuente(8.5, 'italic', GRIS);
    L.texto('Todavía no hay pagos registrados.', PAGINA.izq + 1.5, L.y + 1);
    L.y += 5;
  } else {
    L.tabla(
      [{ titulo: 'Concepto' }, { titulo: 'Fecha', ancho: 20 }, { titulo: 'Medio', ancho: 22 }, { titulo: 'Monto (Bs)', ancho: 22, derecha: true }],
      pagos.map((p) => [
        p.tipo === 'Devolución' ? 'Devolución' : p.tipo,
        fechaHoraBo(p.fechaLocal, false),
        p.montos.filter((m) => Math.abs(m.montoBs) > 0.004).map((m) => m.medio).join(' + ') || '—',
        bs(p.totalBs),
      ]),
      { ancho: wPag, tam: 8.4 }
    );
  }
  void mediosConfig;
  L.y = Math.max(L.y, y0 + hTot) + 5;
}

function filasCliente(orden: OrdenServicio): [string, string][] {
  const f: [string, string][] = [
    ['Nombre', orden.clienteNombre],
    ['Teléfono', orden.clienteTelefono],
  ];
  const entrego = (orden as any).personaEntrega || (orden as any).quienEntrega;
  if (entrego) f.push(['Entregó el auto', String(entrego)]);
  return f;
}

function filasVehiculo(orden: OrdenServicio, kmSalida?: number | null): [string, string][] {
  const f: [string, string][] = [
    ['Vehículo', `${orden.vehiculoMarca} ${orden.vehiculoModelo}${orden.vehiculoAnio ? ` · ${orden.vehiculoAnio}` : ''}`],
    ['Placa', orden.vehiculoPlaca],
  ];
  if (orden.vehiculoColor) f.push(['Color', orden.vehiculoColor]);
  f.push(['Km de ingreso', `${bs(orden.kilometraje).replace(/,00$/, '')} km`]);
  if (kmSalida) f.push(['Km de salida', `${bs(kmSalida).replace(/,00$/, '')} km`]);
  return f;
}

function filasItems(items: ItemCotizacion[], conClasificacion = false): string[][] {
  return items.map((i) => {
    const cant = i.tipo !== 'mano_obra' && (i.cantidad || 1) > 1 ? ` (x${i.cantidad})` : '';
    const marca = i.tipo === 'repuesto' && i.marcaRepuesto ? ` · ${i.marcaRepuesto}` : '';
    const fila = [
      `${i.descripcion}${cant}${marca}`,
      TIPO_ITEM[i.tipo] || i.tipo,
      i.precioPorDefinir ? 'Por definir' : bs((i.precioTotalBs || 0) - (i.descuentoMontoBs || 0)),
    ];
    if (conClasificacion) fila.splice(1, 0, i.clasificacion === 'General' ? '' : i.clasificacion);
    return fila;
  });
}

function asesorDe(orden: OrdenServicio): string {
  return (orden as any).creadoPorNombre || orden.historialEstados?.[0]?.usuarioNombre || '';
}

function fechaIngreso(orden: OrdenServicio): any {
  return (orden as any).createdAt || orden.historialEstados?.[0]?.fecha;
}

function nombreArchivo(tipo: TipoDocumento, orden: OrdenServicio, version?: number) {
  const base = { orden: 'Orden', cotizacion: `Cotizacion-v${version || 1}`, acta_entrega: 'Acta-entrega', acta_devolucion: 'Acta-devolucion' }[tipo];
  return `${base}-${orden.folio}-${orden.vehiculoPlaca}.pdf`.replace(/[^\w.-]+/g, '_');
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------
export interface PdfGenerado {
  blob: Blob;
  nombre: string;
  url: string; // enlace de verificación
}

/** Orden de servicio (Anexo A, figuras A1 y A2). */
export async function generarPdfOrden(
  orden: OrdenServicio,
  config: TallerConfig,
  precargado?: { cotizaciones: CotizacionOrden[]; pagos: PagoOrden[] }
): Promise<PdfGenerado> {
  const [cots, pagos] = precargado
    ? [precargado.cotizaciones, precargado.pagos]
    : await Promise.all([obtenerCotizacionesOrdenFirestore(orden.id), pagosVigentesOrden(orden.id)]);
  const trabajos = trabajosDesdeCotizaciones(cots);
  const fin = calcularFinanzasOrden(orden);
  const variante = trabajos.hayPorDefinir || fin.estadoTotal === 'pendiente_negociacion' || !!orden.cotizacionConPrecioPorDefinir;

  const L = new Lienzo(config, orden.folio);
  const asesor = asesorDe(orden);
  await L.encabezado('Orden de servicio', [`Ingreso: ${fechaHoraBo(fechaIngreso(orden))}`, ...(asesor ? [`Asesor: ${asesor}`] : [])]);

  let eta: string | null = null;
  if (orden.estado === 'Entregado') eta = null;
  else if (orden.estado === 'Listo para entrega') eta = 'su vehículo ya está listo';
  else if (orden.estado !== 'Cancelada') {
    eta = orden.estado === 'Esperando aprobación' || orden.estado === 'Recibido' || orden.estado === 'En diagnóstico'
      ? orden.fechaPrometidaEntrega
        ? `${orden.fechaPrometidaEntrega} (por confirmar tras su aprobación)`
        : 'por confirmar tras su aprobación'
      : orden.fechaPrometidaEntrega || 'por confirmar';
  }
  L.barraEstado(orden.estado, eta);
  L.tarjetas({ titulo: 'Cliente', filas: filasCliente(orden) }, { titulo: 'Vehículo', filas: filasVehiculo(orden, orden.actaEntrega?.kmSalida) });
  if (orden.motivoCliente) L.cita('Motivo de ingreso (en sus palabras)', orden.motivoCliente);

  if (trabajos.items.length) {
    L.espacio(14);
    L.titulo(trabajos.titulo);
    L.y += 4.5;
    const filas = filasItems(trabajos.items);
    if (trabajos.descuentoBs > 0) filas.push(['Descuento', '', `-${bs(trabajos.descuentoBs)}`]);
    if ((orden.cargosAdicionalesBs || 0) > 0) filas.push(['Almacenaje y otros cargos', '', bs(orden.cargosAdicionalesBs)]);
    L.tabla([{ titulo: 'Descripción' }, { titulo: 'Tipo', ancho: 32, etiqueta: true }, { titulo: 'Monto (Bs)', ancho: 28, derecha: true }], filas);
  } else {
    L.titulo('Trabajos');
    L.y += 4.5;
    L.fuente(8.8, 'italic', GRIS);
    L.texto('El diagnóstico está en curso. Le enviaremos la cotización para su aprobación.', PAGINA.izq + 1.5, L.y);
    L.y += 6;
  }
  if (variante) {
    L.nota(
      'Montos en negociación: algunos precios todavía se están definiendo con usted. Cuando se acuerden, le enviaremos este documento actualizado con los totales.'
    );
  }
  bloqueDinero(L, orden, pagos, variante, config.mediosPago || []);
  if (!variante) L.recomendaciones(trabajos.recomendaciones);
  await L.verificacion(urlVerificacion(config, orden, 'orden'), codigoCorto(orden));
  L.pies();
  return { blob: L.doc.output('blob'), nombre: nombreArchivo('orden', orden), url: urlVerificacion(config, orden, 'orden') };
}

/** Cotización para el cliente (sin costos ni márgenes). */
export async function generarPdfCotizacion(orden: OrdenServicio, cot: CotizacionOrden, config: TallerConfig): Promise<PdfGenerado> {
  const L = new Lienzo(config, orden.folio);
  const vence = cot.fechaVencimiento ? fechaHoraBo(cot.fechaVencimiento, false) : null;
  await L.encabezado(cot.esComplementariaTrabajoAdicional ? 'Cotización adicional' : 'Cotización', [
    `Versión ${cot.versionNumero || 1} · ${fechaHoraBo(cot.fechaEmision, false)}`,
    ...(vence ? [`Válida hasta: ${vence}`] : []),
  ]);
  L.tarjetas({ titulo: 'Cliente', filas: filasCliente(orden) }, { titulo: 'Vehículo', filas: filasVehiculo(orden) });
  if (orden.motivoCliente) L.cita('Motivo de ingreso (en sus palabras)', orden.motivoCliente);

  L.espacio(14);
  L.titulo('Trabajos cotizados');
  L.y += 4.5;
  const filas = filasItems(cot.items, true);
  L.tabla(
    [{ titulo: 'Descripción' }, { titulo: 'Prioridad', ancho: 30 }, { titulo: 'Tipo', ancho: 30, etiqueta: true }, { titulo: 'Monto (Bs)', ancho: 26, derecha: true }],
    filas
  );
  // Opciones comparables
  const conOpciones = cot.items.filter((i) => (i.opcionesComparables || []).length > 0);
  if (conOpciones.length) {
    L.espacio(10);
    L.titulo('Alternativas para elegir');
    L.y += 4.5;
    L.tabla(
      [{ titulo: 'Opción' }, { titulo: 'Garantía', ancho: 36 }, { titulo: 'Precio (Bs)', ancho: 26, derecha: true }],
      conOpciones.flatMap((i) =>
        (i.opcionesComparables || []).map((o) => [`${i.descripcion}: ${o.titulo} (${o.marca}, ${o.calidad})`, o.garantia || '—', bs(o.precioBs)])
      ),
      { tam: 8.4 }
    );
  }

  // Totales
  const wTot = 78;
  const xTot = PAGINA.ancho - PAGINA.der - wTot;
  const filasTot: [string, string, boolean][] = [];
  if (cot.tienePrecioPorDefinir || cot.totalBs === null) {
    filasTot.push(['Total', 'Pendiente de negociación', true]);
  } else {
    if ((cot.descuentoTotalMontoBs || 0) > 0) {
      filasTot.push(['Subtotal', `Bs ${bs(cot.subtotalBs)}`, false]);
      filasTot.push(['Descuento', `- Bs ${bs(cot.descuentoTotalMontoBs)}`, false]);
    }
    filasTot.push(['Total', `Bs ${bs(cot.totalBs)}`, true]);
  }
  const h = filasTot.length * 6.6;
  L.espacio(h + 4);
  L.rect(xTot, L.y, wTot, h, LINEA, null, 2);
  filasTot.forEach(([k, v, fuerte], i) => {
    const yy = L.y + i * 6.6;
    if (fuerte) {
      L.doc.setFillColor(...(cot.tienePrecioPorDefinir ? GRIS : L.marca));
      L.doc.roundedRect(xTot, yy, wTot, 6.6, 2, 2, 'F');
      L.doc.rect(xTot, yy, wTot, 3.3, 'F');
      L.fuente(10.5, 'bold', [255, 255, 255]);
    } else L.fuente(9, 'normal');
    L.texto(k, xTot + 3.5, yy + 4.4);
    L.texto(v, xTot + wTot - 3.5, yy + 4.4, { align: 'right' });
  });
  L.y += h + 5;
  if (cot.tienePrecioPorDefinir) {
    L.nota('Algunos precios todavía se están definiendo (por ejemplo, repuestos que dependen del proveedor). Le enviaremos la cotización actualizada con el total.');
  }
  L.nota(
    'Para aprobar, responda por WhatsApp o llámenos indicando qué trabajos autoriza. Puede aprobar todo o solo una parte. Los precios están en bolivianos.',
    suave(L.marca, 0.93),
    suave(L.marca, 0.7),
    TINTA
  );
  await L.verificacion(urlVerificacion(config, orden, 'cotizacion', cot.versionNumero), codigoCorto(orden));
  L.pies();
  const url = urlVerificacion(config, orden, 'cotizacion', cot.versionNumero);
  return { blob: L.doc.output('blob'), nombre: nombreArchivo('cotizacion', orden, cot.versionNumero), url };
}

/** Acta de entrega o de devolución sin reparar. */
export async function generarPdfActa(orden: OrdenServicio, config: TallerConfig): Promise<PdfGenerado> {
  const acta = orden.actaEntrega;
  if (!acta) throw new Error('La orden todavía no tiene acta registrada.');
  const tipo: TipoDocumento = acta.tipo === 'entrega' ? 'acta_entrega' : 'acta_devolucion';
  const L = new Lienzo(config, orden.folio);
  await L.encabezado(acta.tipo === 'entrega' ? 'Acta de entrega' : 'Acta de devolución', [
    `Fecha: ${fechaHoraBo(acta.fecha)}`,
    `Atendió: ${acta.registradoPorNombre}`,
  ]);
  L.tarjetas(
    {
      titulo: 'Cliente y retiro',
      filas: [
        ['Cliente', orden.clienteNombre],
        ['Retira', acta.quienRetira.nombre],
        ['Documento', acta.quienRetira.documento],
        ['Relación', acta.quienRetira.relacion],
      ],
    },
    { titulo: 'Vehículo', filas: [...filasVehiculo(orden, acta.kmSalida), ['Llaves devueltas', String(acta.llavesDevueltas)]] }
  );
  if (acta.tipo === 'devolucion') {
    L.nota(
      `El vehículo se devuelve sin reparar. Motivo: ${orden.cancelacion?.motivo || '—'}${orden.cancelacion?.nota ? ` (${orden.cancelacion.nota})` : ''}.`,
      [254, 242, 242],
      [252, 165, 165],
      [127, 29, 29]
    );
  }
  if (acta.trabajosRealizados.length) {
    L.espacio(12);
    L.titulo('Trabajos realizados');
    L.y += 4.5;
    L.tabla([{ titulo: 'Descripción' }], acta.trabajosRealizados.map((t) => [t]));
  }
  const objetos = OBJETOS_ACCESORIOS.filter((o) => acta.objetosDevueltos[o.id]).map((o) => o.texto);
  const piezas =
    acta.piezasRetiradasEntregadas === true
      ? ' Se entregaron las piezas retiradas.'
      : acta.piezasRetiradasEntregadas === false
      ? ' El cliente no quiso las piezas retiradas.'
      : '';
  L.espacio(10);
  L.titulo('Objetos devueltos');
  L.y += 4.3;
  L.fuente(8.8, 'normal');
  const lo = L.partir(`${objetos.join(', ') || 'Ninguno registrado'}.${piezas}`, ANCHO_UTIL - 3);
  L.texto(lo.join('\n'), PAGINA.izq + 1.5, L.y);
  L.y += L.alto(8.8, lo.length) + 4;

  // Montos
  const filas: [string, string][] = [
    ['Total', acta.totalBs === null ? 'Pendiente de negociación' : `Bs ${bs(acta.totalBs)}`],
    ...(acta.almacenajeBs > 0 ? ([[`Incluye almacenaje (${acta.almacenajeDias} día/s)`, `Bs ${bs(acta.almacenajeBs)}`]] as [string, string][]) : []),
    ['Pagado', `Bs ${bs(acta.pagadoBs)}`],
    ['Saldo al entregar', acta.saldoAlEntregarBs === null ? 'Por calcular' : `Bs ${bs(acta.saldoAlEntregarBs)}`],
  ];
  const wTot = 90;
  const xTot = PAGINA.ancho - PAGINA.der - wTot;
  const h = filas.length * 6.4;
  L.espacio(h + 4);
  L.rect(xTot, L.y, wTot, h, LINEA, null, 2);
  filas.forEach(([k, v], i) => {
    const yy = L.y + i * 6.4;
    const ultimo = i === filas.length - 1;
    if (ultimo) {
      L.doc.setFillColor(...L.marca);
      L.doc.roundedRect(xTot, yy, wTot, 6.4, 2, 2, 'F');
      L.doc.rect(xTot, yy, wTot, 3.2, 'F');
      L.fuente(10, 'bold', [255, 255, 255]);
    } else L.fuente(9, 'normal');
    L.texto(k, xTot + 3.5, yy + 4.3);
    L.texto(v, xTot + wTot - 3.5, yy + 4.3, { align: 'right' });
  });
  if (orden.entregaConSaldo?.autorizada && (acta.saldoAlEntregarBs || 0) > 0) {
    L.fuente(8, 'normal', GRIS);
    const t = L.partir(
      `Entrega con saldo autorizada.${orden.entregaConSaldo.fechaCompromisoPago ? ` Compromiso de pago: ${fechaHoraBo(orden.entregaConSaldo.fechaCompromisoPago + 'T12:00:00', false)}.` : ''}`,
      ANCHO_UTIL - wTot - 6
    );
    L.texto(t.join('\n'), PAGINA.izq + 1.5, L.y + 4);
  }
  L.y += h + 5;
  L.recomendaciones(acta.recomendacionesNoAprobadas);
  if (acta.observaciones) L.cita('Observaciones', acta.observaciones);
  L.fuente(8.5, 'normal', GRIS);
  const decl = L.partir(
    acta.tipo === 'entrega'
      ? 'Declaro recibir el vehículo en las condiciones descritas, con los trabajos indicados realizados y los objetos marcados.'
      : 'Declaro recibir el vehículo sin reparar, en las condiciones descritas y con los objetos marcados.',
    ANCHO_UTIL
  );
  L.espacio(8);
  L.texto(decl.join('\n'), PAGINA.izq, L.y);
  L.y += L.alto(8.5, decl.length);
  L.firmas('Firma de quien retira', `Por el taller (${acta.registradoPorNombre})`);
  L.y += 3;
  await L.verificacion(urlVerificacion(config, orden, tipo), codigoCorto(orden));
  L.pies();
  return { blob: L.doc.output('blob'), nombre: nombreArchivo(tipo, orden), url: urlVerificacion(config, orden, tipo) };
}

/** Informe de historial del vehículo (Módulo 8). Sin costos internos ni notas internas. */
export async function generarPdfHistorialVehiculo(
  vehiculo: import('../types').Vehiculo,
  propietario: { nombre: string; telefono: string } | null,
  visitas: import('./historial').Visita[],
  config: TallerConfig
): Promise<{ blob: Blob; nombre: string }> {
  const { ultimosComponentes, alertasVehiculo } = await import('./historial');
  const L = new Lienzo(config, vehiculo.placa);
  await L.encabezado('Historial del vehículo', [`Emitido: ${fechaHoraBo(new Date())}`, `Visitas: ${visitas.length}`]);
  L.tarjetas(
    {
      titulo: 'Vehículo',
      filas: [
        ['Vehículo', `${vehiculo.marca} ${vehiculo.modelo}${vehiculo.anio ? ` · ${vehiculo.anio}` : ''}`],
        ['Placa', vehiculo.placa],
        ...(vehiculo.vin ? ([['VIN / chasis', vehiculo.vin]] as [string, string][]) : []),
        ['Último km', vehiculo.ultimoKilometraje ? `${bs(vehiculo.ultimoKilometraje).replace(/,00$/, '')} km` : '—'],
      ],
    },
    {
      titulo: 'Propietario y documentos',
      filas: [
        ['Propietario', propietario?.nombre || '—'],
        ['Teléfono', propietario?.telefono || '—'],
        ['SOAT vence', vehiculo.vencimientoSoat || '—'],
        ['ITV vence', vehiculo.vencimientoItv || '—'],
      ],
    }
  );

  const alertas = alertasVehiculo(vehiculo, visitas).filter((a) => !a.texto.startsWith('Saldo'));
  if (alertas.length) L.nota(alertas.map((a) => a.texto).join('\n'));

  L.espacio(14);
  L.titulo('Visitas al taller');
  L.y += 4.5;
  const filas = visitas.map((v) => {
    const trabajos = v.trabajos.map((t) => `${t.descripcion}${t.marcaRepuesto ? ` (${t.marcaRepuesto}${t.serialRepuesto ? `, S/N ${t.serialRepuesto}` : ''})` : ''}`);
    const desc = `${v.orden.folio} · ${v.orden.estado}\nMotivo: ${v.orden.motivoCliente}${trabajos.length ? `\nTrabajos: ${trabajos.join('; ')}` : ''}`;
    return [desc, fechaHoraBo(v.ingresoMs, false), `${bs(v.orden.kilometraje).replace(/,00$/, '')}`, v.totalBs === null ? 'Por definir' : bs(v.totalBs)];
  });
  if (filas.length) {
    L.tabla(
      [{ titulo: 'Visita' }, { titulo: 'Ingreso', ancho: 22 }, { titulo: 'Km', ancho: 20, derecha: true }, { titulo: 'Monto (Bs)', ancho: 24, derecha: true }],
      filas,
      { tam: 8.2 }
    );
  } else {
    L.fuente(8.8, 'italic', GRIS);
    L.texto('Todavía no hay visitas registradas.', PAGINA.izq + 1.5, L.y);
    L.y += 6;
  }

  const comps = ultimosComponentes(visitas).filter((c) => c.fechaMs);
  if (comps.length) {
    L.espacio(14);
    L.titulo('Último cambio de componentes');
    L.y += 4.5;
    L.tabla(
      [{ titulo: 'Componente' }, { titulo: 'Fecha', ancho: 22 }, { titulo: 'Km', ancho: 22, derecha: true }, { titulo: 'Orden', ancho: 24 }],
      comps.map((c) => [`${c.texto}${c.detalle ? ` · ${c.detalle}` : ''}`, fechaHoraBo(c.fechaMs, false), c.km ? bs(c.km).replace(/,00$/, '') : '—', c.folio || '—']),
      { tam: 8.2 }
    );
  }

  const pendientes: string[] = [];
  visitas.forEach((v, i) => {
    const hechas = visitas.slice(0, i).flatMap((x) => x.trabajos.map((t) => t.descripcion.toLowerCase()));
    v.recomendaciones.forEach((r) => {
      if (!hechas.includes(r.toLowerCase()) && !pendientes.includes(r)) pendientes.push(r);
    });
  });
  L.recomendaciones(pendientes);
  L.pies();
  const nombre = `Historial-${vehiculo.placa}.pdf`.replace(/[^\w.-]+/g, '_');
  return { blob: L.doc.output('blob'), nombre };
}
