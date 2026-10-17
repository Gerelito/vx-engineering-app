import React from 'react';
import { CotizacionOrden, TallerConfig, OrdenServicio } from '../../types';
import { formatearFecha, formatearMonedaBs, formatearTelefonoBolivia } from '../../lib/storage';
import { MessageCircle, Printer, X, Wrench, AlertCircle, FileText, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface CotizacionImprimibleModalProps {
  cotizacion: CotizacionOrden | null;
  orden?: OrdenServicio | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
  onEnviar?: (cotizacion: CotizacionOrden) => void;
}

export const CotizacionImprimibleModal: React.FC<CotizacionImprimibleModalProps> = ({
  cotizacion,
  orden,
  config,
  isOpen,
  onClose,
  onEnviar,
}) => {
  if (!isOpen || !cotizacion) return null;

  const handleImprimir = () => {
    window.print();
  };

  const faltanDatosTaller = !config.direccion?.trim() || !config.telefonoWhatsapp?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="zona-impresion w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Barra superior de control (no se imprime) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">
              Vista Imprimible de Cotización · {cotizacion.folioOrden} (v{cotizacion.versionNumero})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onEnviar && orden && (
              <button
                onClick={() => onEnviar(cotizacion)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>PDF / WhatsApp</span>
              </button>
            )}
            <button
              onClick={handleImprimir}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cotización</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aviso si faltan datos del taller */}
        {faltanDatosTaller && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2.5 print:hidden">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Completa los datos del taller en Configuración (dirección y WhatsApp).</span>
          </div>
        )}

        {/* CONTENIDO IMPRIMIBLE (Formato A4 Estándar) */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white" id="cotizacion-imprimible">
          {/* Encabezado del Taller */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wrench className="w-6 h-6 text-slate-900" />
                <h1 className="text-xl font-extrabold tracking-tight">
                  {config.nombre || 'VX Engineering'}
                </h1>
              </div>
              {config.direccion?.trim() ? (
                <p className="text-xs text-slate-600">
                  {config.direccion} {config.ciudad ? `· ${config.ciudad}` : ''} {config.pais ? `, ${config.pais}` : ''}
                </p>
              ) : null}
              {config.telefonoWhatsapp?.trim() || config.horario?.trim() ? (
                <p className="text-xs text-slate-600 font-medium">
                  {config.telefonoWhatsapp ? `WhatsApp: ${config.telefonoWhatsapp}` : ''}
                  {config.telefonoWhatsapp && config.horario ? ' · ' : ''}
                  {config.horario ? `Horario: ${config.horario}` : ''}
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Presupuesto / Cotización
              </span>
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono text-xl font-black text-slate-950">
                  {cotizacion.folioOrden}
                </span>
                <span className="font-mono text-xs font-extrabold bg-slate-900 text-white px-2 py-0.5 rounded">
                  v{cotizacion.versionNumero}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 block mt-0.5">
                Emisión: <strong>{formatearFecha(cotizacion.fechaEmision)}</strong>
              </span>
              <span className="text-[11px] text-slate-600 block">
                Vigencia: <strong>{cotizacion.diasVigencia || 7} días</strong> (Hasta: {formatearFecha(cotizacion.fechaVencimiento, false)})
              </span>
            </div>
          </div>

          {/* Bloque Cliente y Vehículo */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-200 pb-0.5">
                Datos del Cliente
              </span>
              <div>
                <strong>Titular:</strong> {cotizacion.clienteNombre}
              </div>
              {orden && (
                <>
                  <div>
                    <strong>Teléfono:</strong> {formatearTelefonoBolivia(orden.clienteTelefono)}
                  </div>
                  {orden.clienteDocumento && (
                    <div>
                      <strong>Documento / CI:</strong> {orden.clienteDocumento}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-200 pb-0.5">
                Datos del Vehículo
              </span>
              <div>
                <strong>Placa:</strong> <span className="font-mono font-bold text-sm">{cotizacion.vehiculoPlaca}</span>
              </div>
              {orden && (
                <>
                  <div>
                    <strong>Vehículo:</strong> {orden.vehiculoMarca} {orden.vehiculoModelo} ({orden.vehiculoAnio || 'N/D'})
                  </div>
                  <div>
                    <strong>Kilometraje:</strong> {orden.kilometraje?.toLocaleString() || 0} km
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabla de Ítems Cotizados */}
          <div className="space-y-2">
            <span className="font-extrabold text-slate-900 uppercase block text-xs border-b border-slate-300 pb-1">
              Detalle de Trabajos y Repuestos
            </span>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 text-slate-700 text-[11px] uppercase tracking-wider">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Descripción del Ítem</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2 text-center">Cant / Horas</th>
                  <th className="py-2 px-2 text-right">P. Unitario</th>
                  <th className="py-2 pl-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cotizacion.items.map((it, idx) => (
                  <tr key={it.id || idx} className="align-top">
                    <td className="py-2 pr-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <strong className="text-slate-950 block">{it.descripcion}</strong>
                      {it.tipo === 'repuesto' && it.marcaRepuesto && (
                        <span className="text-[11px] text-slate-500 block">
                          Marca: {it.marcaRepuesto} ({it.calidadRepuesto || 'original'})
                        </span>
                      )}
                      {it.clasificacion && it.clasificacion !== 'General' && (
                        <span className="text-[10px] text-amber-800 font-semibold block">
                          Prioridad: {it.clasificacion}
                        </span>
                      )}
                      {/* Opciones comparables si hay */}
                      {it.opcionesComparables && it.opcionesComparables.length > 0 && (
                        <div className="mt-1 text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200">
                          <strong>Alternativas disponibles:</strong>
                          {it.opcionesComparables.map((op) => (
                            <span key={op.id} className="block">
                              • {op.titulo} ({op.marca}): {formatearMonedaBs(op.precioBs)} [Garantía: {op.garantia}]
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-slate-600 capitalize whitespace-nowrap">
                      {it.tipo === 'mano_obra' ? 'Mano de obra' : it.tipo === 'repuesto' ? 'Repuesto' : 'Terceros'}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">
                      {it.tipo === 'mano_obra' ? `${it.horasManoObra || 1} h` : it.cantidad || 1}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                      {it.precioPorDefinir ? 'Por definir' : formatearMonedaBs(it.precioUnitarioCalculadoBs)}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                      {it.precioPorDefinir ? (
                        <span className="text-amber-700 italic">Por definir</span>
                      ) : (
                        formatearMonedaBs(it.precioTotalBs)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bloque de Totales */}
          <div className="flex justify-end pt-2">
            <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">
                  {cotizacion.tienePrecioPorDefinir
                    ? 'Pendiente'
                    : formatearMonedaBs(cotizacion.subtotalBs)}
                </span>
              </div>

              {cotizacion.descuentoTotalMontoBs ? (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Descuento aplicado:</span>
                  <span className="font-mono">-{formatearMonedaBs(cotizacion.descuentoTotalMontoBs)}</span>
                </div>
              ) : null}

              <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center text-sm font-extrabold text-slate-950">
                <span>Total Estimado:</span>
                <span className="font-mono text-base font-black text-slate-950">
                  {cotizacion.tienePrecioPorDefinir ? (
                    <span className="text-amber-700 font-bold text-xs uppercase">
                      Pendiente de negociación
                    </span>
                  ) : (
                    formatearMonedaBs(cotizacion.totalBs)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Términos y Condiciones Comerciales */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1.5 leading-relaxed">
            <strong className="block font-bold text-slate-900 text-xs">
              Condiciones de la Cotización:
            </strong>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                Presupuesto válido por <strong>{cotizacion.diasVigencia || 7} días calendario</strong> a partir de su emisión.
              </li>
              <li>
                Los precios de repuestos pueden variar según disponibilidad de proveedores al momento de la confirmación formal.
              </li>
              <li>
                Cualquier trabajo adicional descubierto tras el desarmado mecánico será notificado para previa autorización del cliente.
              </li>
              <li>
                Garantía estándar del taller: mano de obra garantizada y piezas según especificaciones de fábrica.
              </li>
            </ul>
          </div>

          {/* Sección de Aprobación / Firma */}
          <div className="grid grid-cols-2 gap-8 pt-6">
            <div className="text-center space-y-2">
              <div className="border-b-2 border-slate-900 h-16" />
              <span className="font-bold text-xs block text-slate-900">
                Firma de Aprobación del Cliente
              </span>
              <span className="text-[11px] text-slate-500 block">
                {cotizacion.clienteNombre}
              </span>
            </div>

            <div className="text-center space-y-2">
              <div className="border-b-2 border-slate-900 h-16" />
              <span className="font-bold text-xs block text-slate-900">
                Por {config.nombre || 'VX Engineering'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Asesor de Servicio / Jefe de Taller
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
