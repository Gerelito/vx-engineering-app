/**
 * Módulo 7: verificación pública por QR.
 * /verificaciones/{codigoVerificacion} guarda SOLO datos públicos (sin montos, teléfonos ni notas internas).
 * Se escribe en el mismo batch/transacción que cambia la orden, reutilizando la auditoría de la orden
 * (las reglas comprueban que esa auditoría corresponde a la orden con este código).
 */
import { doc, Transaction, WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import { EstadoOrden, OrdenServicio, TallerConfig } from '../types';

export const PASOS_CLIENTE = ['Recibido', 'Diagnóstico', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'];

/** Traducción de estados internos a lo que ve el cliente (Anexo A.3). */
export function estadoParaCliente(estado: EstadoOrden): { paso: number; pastilla: string; cancelada: boolean; etiquetaPaso2?: string } {
  switch (estado) {
    case 'Recibido':
      return { paso: 0, pastilla: 'Recibido', cancelada: false };
    case 'En diagnóstico':
      return { paso: 1, pastilla: 'En diagnóstico', cancelada: false };
    case 'Esperando aprobación':
      return { paso: 2, pastilla: 'Esperando aprobación', cancelada: false, etiquetaPaso2: 'Aprobación' };
    case 'Esperando repuestos':
    case 'En reparación':
    case 'Control de calidad':
      return { paso: 3, pastilla: 'En reparación', cancelada: false };
    case 'Listo para entrega':
      return { paso: 4, pastilla: 'Listo para entrega', cancelada: false };
    case 'Entregado':
      return { paso: 6, pastilla: 'Entregado', cancelada: false };
    case 'Cancelada':
      return { paso: -1, pastilla: 'Orden cancelada', cancelada: true };
    default:
      return { paso: 0, pastilla: String(estado), cancelada: false };
  }
}

/** Nombre del cliente para la página pública: primer nombre e inicial del apellido. */
export function nombrePublico(nombre: string): string {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.`;
}

/** Placa parcialmente oculta: 1234ABC -> 12**ABC */
export function placaPublica(placa: string): string {
  const p = (placa || '').toUpperCase().replace(/\s+/g, '');
  if (p.length <= 4) return p;
  return p.slice(0, 2) + '*'.repeat(Math.max(1, p.length - 5)) + p.slice(-3);
}

export type TipoDocumentoPublico = 'orden' | 'cotizacion' | 'acta_entrega' | 'acta_devolucion';

/** Lo único que se guarda en /verificaciones (las reglas aceptan solo estas claves). */
export interface VerificacionPublica {
  folio: string;
  clienteNombre: string;
  vehiculo: { marca: string; modelo: string; placa: string };
  estadoCliente: string;
  pasoCliente: number;
  cancelada: boolean;
  activo?: boolean;
  version?: number | null; // versión vigente de la cotización principal
  reemplazadoPor?: string | null;
  documentos?: Partial<Record<TipoDocumentoPublico, { fechaEmision: string; version?: number | null }>>;
  tallerNombre?: string;
  tallerTelefono?: string;
  actualizado: string;
  auditoriaId: string;
}

type OrdenMinima = Pick<OrdenServicio, 'folio' | 'clienteNombre' | 'vehiculoMarca' | 'vehiculoModelo' | 'vehiculoPlaca' | 'codigoVerificacion'>;

export function camposPublicosOrden(orden: OrdenMinima, estado: EstadoOrden, auditoriaId: string): VerificacionPublica {
  const e = estadoParaCliente(estado);
  return {
    folio: orden.folio,
    clienteNombre: nombrePublico(orden.clienteNombre),
    vehiculo: { marca: orden.vehiculoMarca || '', modelo: orden.vehiculoModelo || '', placa: placaPublica(orden.vehiculoPlaca) },
    estadoCliente: e.pastilla,
    pasoCliente: e.paso,
    cancelada: e.cancelada,
    actualizado: new Date().toISOString(),
    auditoriaId,
  };
}

/**
 * Agrega al batch/transacción la actualización de la verificación pública.
 * `auditoriaId` debe ser una auditoría NUEVA de este mismo batch con entidad 'ordenes' y entidadId = id de la orden
 * (o entidad 'verificaciones' y entidadId = código).
 */
export function sincronizarVerificacion(
  w: WriteBatch | Transaction,
  orden: OrdenMinima,
  estado: EstadoOrden,
  auditoriaId: string,
  extra: Partial<VerificacionPublica> = {}
) {
  if (!orden.codigoVerificacion || orden.codigoVerificacion.length < 16) return;
  const ref = doc(db, 'verificaciones', orden.codigoVerificacion);
  const data = { ...camposPublicosOrden(orden, estado, auditoriaId), ...extra };
  (w as WriteBatch).set(ref, data, { merge: true });
}

/** URL base pública de la app (desde Configuración; si falta, la dirección actual). */
export function urlBaseVerificacion(config: TallerConfig): string {
  const conf = (config.dominioVerificacionQr || '').trim().replace(/\/+$/, '');
  if (conf && /^https?:\/\//.test(conf) && !/ai\.studio|aistudio/.test(conf)) return conf;
  return `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
}

export function urlVerificacion(config: TallerConfig, orden: Pick<OrdenServicio, 'codigoVerificacion'>, tipo?: TipoDocumentoPublico, version?: number): string {
  const extra = tipo === 'cotizacion' && version ? `?d=cotizacion&n=${version}` : tipo ? `?d=${tipo}` : '';
  return `${urlBaseVerificacion(config)}/#/v/${orden.codigoVerificacion}${extra}`;
}

