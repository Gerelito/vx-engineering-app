/** Módulo 10: plantillas de WhatsApp y textos legales (con valores por defecto). */
import { ClavePlantillaWhatsapp, ClaveTextoLegal, OrdenServicio, TallerConfig } from '../types';

export const PLANTILLAS_WHATSAPP: Record<ClavePlantillaWhatsapp, { titulo: string; texto: string }> = {
  listo: {
    titulo: 'Su auto está listo',
    texto:
      'Hola {cliente}, le saluda {taller}. Su vehículo {vehiculo} (placa {placa}) ya está listo para recoger (orden {folio}). Puede ver el detalle aquí: {enlace}',
  },
  cotizacion: {
    titulo: 'Le enviamos su cotización',
    texto:
      'Hola {cliente}, le saluda {taller}. Le enviamos la cotización de su {vehiculo} (placa {placa}), orden {folio}. Puede verificarla aquí: {enlace}. Indíquenos qué trabajos autoriza.',
  },
  orden: {
    titulo: 'Orden de servicio',
    texto:
      'Hola {cliente}, le saluda {taller}. Le enviamos el documento de su {vehiculo} (placa {placa}), orden {folio}. Puede verificarlo y ver el estado de su vehículo aquí: {enlace}',
  },
  saldo: {
    titulo: 'Recordatorio de saldo',
    texto:
      'Hola {cliente}, le saluda {taller}. Le recordamos que la orden {folio} de su {vehiculo} (placa {placa}) tiene un saldo pendiente de {saldo} Bs. Puede pagar por QR o en efectivo. ¡Gracias!',
  },
};

export const TEXTOS_LEGALES: Record<ClaveTextoLegal, { titulo: string; texto: string }> = {
  consentimiento: {
    titulo: 'Consentimiento de datos',
    texto:
      'Autorizo al taller a registrar mis datos personales y los de mi vehículo para prestar el servicio, contactarme por teléfono o WhatsApp sobre mi vehículo y guardar el historial de trabajos. Puedo pedir que se corrijan mis datos.',
  },
  condicionesOrden: {
    titulo: 'Condiciones de la orden',
    texto:
      'El taller no se responsabiliza por objetos de valor no declarados. Todo trabajo adicional se realiza solo con autorización del cliente. Los repuestos reemplazados se entregan si el cliente lo solicita.',
  },
  condicionesAlmacenaje: {
    titulo: 'Condiciones de almacenaje',
    texto:
      'Una vez avisado que el vehículo está listo o cotizado, el cliente tiene {dias} días gratis para retirarlo o aprobar. Desde el día siguiente se cobra {costo} Bs por día de almacenaje.',
  },
  exclusionesGarantia: {
    titulo: 'Exclusiones de garantía',
    texto:
      'La garantía no cubre daños por mal uso, accidentes, repuestos provistos por el cliente ni trabajos realizados por terceros sobre el mismo sistema.',
  },
};

export function plantillaWhatsapp(config: TallerConfig, clave: ClavePlantillaWhatsapp): string {
  return config.plantillasWhatsapp?.[clave]?.trim() || PLANTILLAS_WHATSAPP[clave].texto;
}

export function textoLegal(config: TallerConfig, clave: ClaveTextoLegal): string {
  const t = config.textosLegales?.[clave]?.trim() || TEXTOS_LEGALES[clave].texto;
  return t.replace('{dias}', String(config.almacenajeDiasGratis ?? 3)).replace('{costo}', String(config.almacenajeCostoDiarioBs ?? 0));
}

/** Reemplaza {cliente}, {vehiculo}, {placa}, {folio}, {enlace}, {taller} y {saldo}. */
export function llenarPlantilla(
  plantilla: string,
  orden: Pick<OrdenServicio, 'clienteNombre' | 'vehiculoMarca' | 'vehiculoModelo' | 'vehiculoPlaca' | 'folio'>,
  config: TallerConfig,
  extra: { enlace?: string; saldo?: number | null } = {}
): string {
  const primerNombre = (orden.clienteNombre || '').trim().split(/\s+/)[0] || '';
  return plantilla
    .replace(/\{cliente\}/g, primerNombre)
    .replace(/\{vehiculo\}/g, `${orden.vehiculoMarca} ${orden.vehiculoModelo}`.trim())
    .replace(/\{placa\}/g, orden.vehiculoPlaca || '')
    .replace(/\{folio\}/g, orden.folio || '')
    .replace(/\{enlace\}/g, extra.enlace || '')
    .replace(/\{taller\}/g, config.nombre || 'VX Engineering')
    .replace(/\{saldo\}/g, extra.saldo != null ? extra.saldo.toFixed(2) : '');
}
