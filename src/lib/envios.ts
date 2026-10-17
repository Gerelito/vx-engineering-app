/**
 * Módulo 7: registro de documentos emitidos en la verificación pública, activar/desactivar el enlace
 * y envío por WhatsApp (sin API: compartir del celular o wa.me + descarga).
 */
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { escribirAuditoria } from './caja';
import { limpiarUndefined } from './storage';
import { camposPublicosOrden, TipoDocumentoPublico } from './verificacion';
import { llenarPlantilla, plantillaWhatsapp } from './plantillas';
import { DuenoUsuario, OrdenServicio, TallerConfig } from '../types';

export const NOMBRE_DOC: Record<TipoDocumentoPublico, string> = {
  orden: 'Orden de servicio',
  cotizacion: 'Cotización',
  acta_entrega: 'Acta de entrega',
  acta_devolucion: 'Acta de devolución',
};

function nombre(d: DuenoUsuario) {
  return d.displayName || d.email;
}

/** Al generar un PDF: deja constancia (pública) del documento emitido. No guarda montos ni teléfonos del cliente. */
export async function registrarDocumentoEmitidoFirestore(
  orden: OrdenServicio,
  tipo: TipoDocumentoPublico,
  version: number | null,
  config: TallerConfig,
  dueno: DuenoUsuario
): Promise<void> {
  if (!orden.codigoVerificacion) return;
  const batch = writeBatch(db);
  const fecha = new Date().toISOString();
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Documentos',
    accion: `Documento emitido: ${NOMBRE_DOC[tipo]}${version ? ` v${version}` : ''}`,
    entidad: 'verificaciones',
    entidadId: orden.codigoVerificacion,
    antes: null,
    despues: { folio: orden.folio, tipo, version },
  });
  const datos: Record<string, any> = {
    ...camposPublicosOrden(orden, orden.estado, auditId),
    documentos: { [tipo]: { fechaEmision: fecha, version: version ?? null } },
    tallerNombre: config.nombre || 'VX Engineering',
    tallerTelefono: config.telefonoWhatsapp || '',
  };
  batch.set(doc(db, 'verificaciones', orden.codigoVerificacion), limpiarUndefined(datos), { merge: true });
  await batch.commit();
}

/** Activa o desactiva el enlace público (acción sensible en auditoría). */
export async function cambiarActivoVerificacionFirestore(
  orden: OrdenServicio,
  activo: boolean,
  motivo: string,
  dueno: DuenoUsuario
): Promise<void> {
  if (!activo && !motivo.trim()) throw new Error('Indica el motivo para desactivar el enlace.');
  const batch = writeBatch(db);
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Documentos',
    accion: activo ? 'Enlace de verificación reactivado' : 'Enlace de verificación desactivado',
    entidad: 'verificaciones',
    entidadId: orden.codigoVerificacion,
    antes: { activo: !activo },
    despues: { activo, motivo: motivo.trim() || null, folio: orden.folio },
    sensible: true,
  });
  batch.set(
    doc(db, 'verificaciones', orden.codigoVerificacion),
    { ...camposPublicosOrden(orden, orden.estado, auditId), activo },
    { merge: true }
  );
  await batch.commit();
}

/** Mensaje desde las plantillas de Configuración (Módulo 10). */
export function mensajeWhatsApp(orden: OrdenServicio, tipo: TipoDocumentoPublico, url: string, config: TallerConfig, version?: number | null) {
  void version;
  return llenarPlantilla(plantillaWhatsapp(config, tipo === 'cotizacion' ? 'cotizacion' : 'orden'), orden, config, { enlace: url });
}

function telefonoWa(orden: OrdenServicio): string {
  const e164 = (orden.clienteTelefonoE164 || '').replace(/\D/g, '');
  if (e164) return e164;
  const local = (orden.clienteTelefono || '').replace(/\D/g, '');
  return local.length === 8 ? `591${local}` : local;
}

export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const a = document.createElement('a');
  const u = URL.createObjectURL(blob);
  a.href = u;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30_000);
}

export function puedeCompartirArchivos(blob: Blob, nombreArchivo: string): boolean {
  try {
    const f = new File([blob], nombreArchivo, { type: 'application/pdf' });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch {
    return false;
  }
}

/**
 * Debe llamarse directamente desde el clic (sin esperas antes) para que el navegador permita compartir / abrir WhatsApp.
 * Devuelve 'compartido', 'whatsapp_web' o 'cancelado'.
 */
export async function enviarPorWhatsApp(
  pdf: { blob: Blob; nombre: string },
  mensaje: string,
  orden: OrdenServicio
): Promise<'compartido' | 'whatsapp_web' | 'cancelado'> {
  if (puedeCompartirArchivos(pdf.blob, pdf.nombre)) {
    const file = new File([pdf.blob], pdf.nombre, { type: 'application/pdf' });
    navigator.clipboard?.writeText(mensaje).catch(() => undefined);
    try {
      await navigator.share({ files: [file], text: mensaje, title: pdf.nombre });
      return 'compartido';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelado';
      throw e;
    }
  }
  const tel = telefonoWa(orden);
  const ventana = window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  descargarBlob(pdf.blob, pdf.nombre);
  navigator.clipboard?.writeText(mensaje).catch(() => undefined);
  if (!ventana) {
    // Ventana bloqueada: igual queda el PDF descargado y el mensaje copiado.
  }
  return 'whatsapp_web';
}

/** Deja el envío en la bitácora de contactos del cliente. */
export async function registrarEnvioDocumentoFirestore(
  orden: OrdenServicio,
  tipo: TipoDocumentoPublico,
  via: 'compartido' | 'whatsapp_web',
  version: number | null,
  dueno: DuenoUsuario
): Promise<void> {
  const ref = doc(collection(db, 'contactos'));
  const batch = writeBatch(db);
  const docTxt = `${NOMBRE_DOC[tipo]}${version ? ` v${version}` : ''}`;
  const auditId = escribirAuditoria(batch, dueno, {
    modulo: 'Bitácora de contactos',
    accion: 'Contacto: Envío de documento',
    entidad: 'contactos',
    entidadId: ref.id,
    antes: null,
    despues: { ordenId: orden.id, folio: orden.folio, documento: docTxt, via },
  });
  batch.set(
    ref,
    limpiarUndefined({
      id: ref.id,
      clienteId: orden.clienteId,
      clienteNombre: orden.clienteNombre,
      ordenId: orden.id,
      folio: orden.folio,
      medio: 'WhatsApp',
      motivo: 'Envío de documento',
      resumen: `${docTxt} enviado por WhatsApp (${via === 'compartido' ? 'compartir del celular' : 'WhatsApp Web + PDF descargado'})`,
      resultado: 'Enviado',
      fechaLocal: new Date().toISOString(),
      fecha: serverTimestamp(),
      registradoPorUid: dueno.uid,
      registradoPorEmail: dueno.email.toLowerCase(),
      registradoPorNombre: nombre(dueno),
      auditoriaId: auditId,
    })
  );
  await batch.commit();
}
