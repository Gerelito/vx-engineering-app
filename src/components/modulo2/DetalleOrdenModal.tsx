import React, { useState, useEffect } from 'react';
import { DuenoUsuario, OrdenServicio, FotoOrden, TallerConfig } from '../../types';
import { PanelCorreccionesOrden, ReemplazarFoto } from '../modulo8/PanelCorreccionesOrden';
import { DiagramaCarroceria } from './DiagramaCarroceria';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  X,
  Printer,
  MessageCircle,
  FileCheck,
  Camera,
  AlertTriangle,
  Clock,
  Gauge,
  Fuel,
  ShieldCheck,
  CheckCircle2,
  Car,
  User,
  QrCode,
  Tag,
  Stethoscope,
  Timer,
  ArrowRight,
  Plus,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { estaVigente, textoGarantia } from '../../lib/garantia';
import { ESTILOS_ESTADO, obtenerSiguientesEstadosPermitidos } from '../../lib/estadosTaller';
import { formatearFecha, formatearMonedaBs, formatearTelefonoBolivia } from '../../lib/storage';

interface DetalleOrdenModalProps {
  orden: OrdenServicio | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
  onAbrirImprimir: (orden: OrdenServicio) => void;
  onAbrirDocumento?: (orden: OrdenServicio) => void;
  onAbrirSubirFirma: (orden: OrdenServicio) => void;
  onCambiarEstado?: (orden: OrdenServicio, nuevoEstado: OrdenServicio['estado']) => void;
  onAbrirTransicion?: (orden: OrdenServicio) => void;
  onAbrirDiagnostico?: (orden: OrdenServicio) => void;
  onAbrirTareas?: (orden: OrdenServicio) => void;
  onAbrirTrabajoAdicional?: (orden: OrdenServicio) => void;
  onAbrirCotizacion?: (orden: OrdenServicio) => void;
  onAbrirPagos?: (orden: OrdenServicio) => void;
  onAbrirAprobacion?: (orden: OrdenServicio) => void;
  onAbrirImprimirCotizacion?: (orden: OrdenServicio) => void;
  usuarioActual?: DuenoUsuario | null;
}

export const DetalleOrdenModal: React.FC<DetalleOrdenModalProps> = ({
  orden,
  config,
  isOpen,
  onClose,
  onAbrirImprimir,
  onAbrirDocumento,
  onAbrirSubirFirma,
  onCambiarEstado,
  onAbrirTransicion,
  onAbrirDiagnostico,
  onAbrirTareas,
  onAbrirTrabajoAdicional,
  onAbrirCotizacion,
  onAbrirPagos,
  onAbrirAprobacion,
  onAbrirImprimirCotizacion,
  usuarioActual,
}) => {
  const [verReemplazadas, setVerReemplazadas] = useState(false);
  const [fotos, setFotos] = useState<FotoOrden[]>([]);
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoOrden | null>(null);

  useEffect(() => {
    if (!orden || !isOpen) {
      setFotos([]);
      return;
    }

    const unsubFotos = onSnapshot(
      collection(db, 'ordenes', orden.id, 'fotos'),
      (snapshot) => {
        const lista: FotoOrden[] = snapshot.docs.map((d) => ({ ...(d.data() as FotoOrden), id: d.id }));
        setFotos(lista);
      },
      (err) => {
        console.warn('Error leyendo fotos de orden:', err);
      }
    );

    return () => unsubFotos();
  }, [orden, isOpen]);

  if (!isOpen || !orden) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Encabezado */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex shrink-0 w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 font-mono font-bold text-sm items-center justify-center">
              {orden.folio.startsWith('OS-') ? orden.folio.slice(3) : 'PEND'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold whitespace-nowrap">
                  <span className="hidden sm:inline">Orden de Servicio </span>{orden.folio}
                </h3>
                {orden.reclamoGarantia && (
                  <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    Garantía de {orden.reclamoGarantia.folioOrigen}
                  </span>
                )}
                {orden.sincronizacionFolio === 'pendiente' && (
                  <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                    Folio provisional (Sin internet al crear)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 truncate sm:whitespace-normal">
                Placa: {orden.vehiculoPlaca} · Cliente: {orden.clienteNombre} · Ingreso: {formatearFecha(orden.createdAt || orden.fechaCreacion)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onAbrirDocumento && (
              <button
                onClick={() => onAbrirDocumento(orden)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="sm:hidden">Enviar</span>
                <span className="hidden sm:inline">PDF / WhatsApp</span>
              </button>
            )}
            <button
              onClick={() => onAbrirImprimir(orden)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Imprimir Hoja</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de estado y acciones rápidas */}
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Estado:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                ESTILOS_ESTADO[orden.estado]?.badge || 'bg-slate-200 text-slate-800'
              }`}
            >
              {orden.estado}
            </span>

            {onAbrirTransicion && obtenerSiguientesEstadosPermitidos(orden.estado).length > 0 && (
              <button
                type="button"
                onClick={() => onAbrirTransicion(orden)}
                className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>Avanzar Estado</span>
                <ArrowRight className="w-3 h-3 text-amber-400" />
              </button>
            )}

            {onAbrirDiagnostico && (
              <button
                type="button"
                onClick={() => onAbrirDiagnostico(orden)}
                className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Stethoscope className="w-3.5 h-3.5 text-blue-700" />
                <span>Diagnóstico</span>
              </button>
            )}

            {onAbrirTareas && (
              <button
                type="button"
                onClick={() => onAbrirTareas(orden)}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Timer className="w-3.5 h-3.5 text-amber-700" />
                <span>Tareas ({orden.tareas?.length || 0})</span>
              </button>
            )}

            {onAbrirTrabajoAdicional && (
              <button
                type="button"
                onClick={() => onAbrirTrabajoAdicional(orden)}
                className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Registrar hallazgo adicional o trabajo complementario en taller"
              >
                <Plus className="w-3.5 h-3.5 text-purple-700" />
                <span>Hallazgo ({orden.hallazgosAdicionales?.length || 0})</span>
              </button>
            )}

            {onAbrirCotizacion && (
              <button
                type="button"
                onClick={() => onAbrirCotizacion(orden)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Ver o editar cotizaciones"
              >
                <span>Cotización</span>
              </button>
            )}

            {onAbrirPagos && (
              <button
                type="button"
                onClick={() => onAbrirPagos(orden)}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Registrar o ver pagos de esta orden"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pagos</span>
              </button>
            )}

            {onAbrirAprobacion && orden.estado === 'Esperando aprobación' && (
              <button
                type="button"
                onClick={() => onAbrirAprobacion(orden)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Registrar aprobación del cliente"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aprobar</span>
              </button>
            )}

            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                orden.prioridad === 'Urgente'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {orden.prioridad}
            </span>
          </div>

          <div>
            {!orden.firmaSubida ? (
              <button
                type="button"
                onClick={() => onAbrirSubirFirma(orden)}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Firma Pendiente (Subir foto)</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Firma de cliente archivada</span>
              </span>
            )}
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Tarjeta de Datos Clave */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 block">Kilometraje:</span>
              <span className="font-bold text-slate-900 text-sm">
                {orden.kilometraje.toLocaleString()} km
              </span>
              {orden.justificacionKilometraje && (
                <span className="text-[10px] text-amber-700 block mt-0.5 font-medium">
                  Discrepancia: {orden.justificacionKilometraje}
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 block">Combustible:</span>
              <span className="font-bold text-amber-600 text-sm">
                {orden.nivelCombustible}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 block">Fecha prometida:</span>
              <span className="font-bold text-slate-900 text-xs">
                {orden.fechaPrometidaEntrega}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 block">Código Verificación:</span>
              <span className="font-mono font-bold text-slate-900 text-[11px] break-all">
                {orden.codigoVerificacion.slice(0, 12)}...
              </span>
            </div>
          </div>

          {orden.estado === 'Entregado' && (
            <div className={`p-3 rounded-xl border text-xs ${orden.garantia && estaVigente(orden.garantia) ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              <b>Garantía:</b> {textoGarantia(orden.garantia)}
              {orden.garantia && !estaVigente(orden.garantia) ? ' (vencida por fecha)' : ''}
            </div>
          )}

          {/* Motivo de ingreso */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-900 block">
              Motivo Expresado por el Cliente:
            </span>
            <p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
              "{orden.motivoCliente}"
            </p>

            {orden.motivoTecnico && (
              <div className="text-xs text-slate-600 pt-1">
                <strong>Apreciación Técnica:</strong> {orden.motivoTecnico}
              </div>
            )}

            {orden.sistemasAfectados?.length > 0 && (
              <div className="flex items-center gap-1.5 pt-2 flex-wrap text-xs">
                <span className="font-semibold text-slate-500">Sistemas:</span>
                {orden.sistemasAfectados.map((sis) => (
                  <span
                    key={sis}
                    className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-semibold text-[11px]"
                  >
                    {sis}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* MÓDULO 4: GESTIÓN DE COTIZACIÓN Y APROBACIONES */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">
                  Cotizaciones y aprobaciones del cliente
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onAbrirCotizacion && (
                  <button
                    type="button"
                    onClick={() => onAbrirCotizacion(orden)}
                    className="text-[11px] font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gestionar Cotización</span>
                  </button>
                )}
                {onAbrirAprobacion && (
                  <button
                    type="button"
                    onClick={() => onAbrirAprobacion(orden)}
                    className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Registrar Aprobación</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Presupuesto Original:</span>
                <span className="text-sm font-bold text-slate-800">
                  {orden.presupuestoOriginalBs ? formatearMonedaBs(orden.presupuestoOriginalBs) : 'Pendiente'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Total Estimado / Aprobado:</span>
                <span className="text-sm font-bold text-emerald-700">
                  {orden.costoTotalEstimadoBs ? formatearMonedaBs(orden.costoTotalEstimadoBs) : 'Por definir'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Estado de Aprobación:</span>
                <span className="text-sm font-bold text-slate-900">
                  {orden.aprobaciones?.aprobadoPorCliente
                    ? `Aprobado (${orden.aprobaciones.medioAprobacion || 'Cliente'})`
                    : orden.estado === 'Esperando aprobación'
                    ? 'Esperando respuesta cliente'
                    : 'Sin registrar'}
                </span>
              </div>
            </div>
          </div>

          {/* CONTROL DE PRESUPUESTO Y TRABAJOS ADICIONALES (Requisito F) */}
          {(() => {
            const montoPreAutorizado = orden.autorizaciones?.montoPreAutorizadoBs || 0;
            const hallazgos = orden.hallazgosAdicionales || [];
            const totalAdicionalBs = hallazgos.reduce((acc, h) => acc + (Number(h.costoEstimadoBs) || 0), 0);
            const limiteAlertaPct = config.alertaPresupuestoPorcentaje || 15;
            const sobrecostoPct = montoPreAutorizado > 0
              ? Math.round((totalAdicionalBs / montoPreAutorizado) * 100)
              : 0;
            const tieneAlerta = montoPreAutorizado > 0 && sobrecostoPct > limiteAlertaPct;

            return (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Presupuesto y Trabajos Adicionales de Taller
                    </span>
                  </div>
                  {onAbrirTrabajoAdicional && (
                    <button
                      type="button"
                      onClick={() => onAbrirTrabajoAdicional(orden)}
                      className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar Hallazgo Adicional</span>
                    </button>
                  )}
                </div>

                {/* Resumen Financiero */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Monto Pre-Autorizado:</span>
                    <span className="text-sm font-bold text-slate-800">
                      {montoPreAutorizado > 0 ? `${montoPreAutorizado.toFixed(2)} ${config.moneda}` : 'Sin pre-autorización'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">Total Hallazgos Adicionales:</span>
                    <span className="text-sm font-bold text-purple-700">
                      {totalAdicionalBs.toFixed(2)} {config.moneda} ({hallazgos.length} reg.)
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${tieneAlerta ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 block font-medium">Sobrecosto vs Original:</span>
                    <span className={`text-sm font-bold ${tieneAlerta ? 'text-rose-700' : 'text-slate-800'}`}>
                      +{sobrecostoPct}% {montoPreAutorizado > 0 ? `(Límite: ${limiteAlertaPct}%)` : ''}
                    </span>
                  </div>
                </div>

                {/* Alerta en rojo si supera el % configurable */}
                {tieneAlerta && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span>Alerta de Presupuesto: los hallazgos adicionales (+{sobrecostoPct}%) superan el margen permitido de tolerancia ({limiteAlertaPct}%) sobre el monto pre-autorizado.</span>
                      <p className="text-[11px] font-normal text-rose-800 mt-0.5">
                        Requiere cotización complementaria y aprobación explícita del cliente antes de iniciar reparación.
                      </p>
                    </div>
                  </div>
                )}

                {/* Lista de hallazgos adicionales */}
                {hallazgos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 block">Detalle de Hallazgos:</span>
                    <div className="space-y-1.5">
                      {hallazgos.map((h) => (
                        <div key={h.id} className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900 block">{h.descripcion}</span>
                            {h.piezasServiciosRequeridos && (
                              <span className="text-[11px] text-slate-500 block">Piezas: {h.piezasServiciosRequeridos}</span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 block">{Number(h.costoEstimadoBs).toFixed(2)} {config.moneda}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${h.autorizadoPorCliente ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {h.autorizadoPorCliente ? 'Autorizado' : 'Pend. Aprobación'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 italic pt-1">
                  Agrégalo a una cotización complementaria para que el cliente lo apruebe.
                </div>
              </div>
            );
          })()}

          {/* Galería de Fotos de Recepción */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-slate-700" />
                Fotografías de Recepción y Evidencia ({fotos.filter((f) => !f.reemplazada).length}):
              </h4>
              {fotos.some((f) => f.reemplazada) && (
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input type="checkbox" checked={verReemplazadas} onChange={(e) => setVerReemplazadas(e.target.checked)} />
                  Ver reemplazadas
                </label>
              )}
            </div>

            {fotos.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Cargando o sin fotos adjuntas registradas.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fotos.filter((f) => verReemplazadas || !f.reemplazada).map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setFotoAmpliada(f)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                  >
                    <img
                      src={f.base64Data}
                      alt={f.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2 text-white">
                      <span className="text-[10px] font-bold block truncate">
                        {f.reemplazada ? '[Reemplazada] ' : f.reemplazaFotoId ? '[Corregida] ' : ''}
                        {f.titulo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Diagrama de Carrocería Solo Lectura */}
          <div>
            <DiagramaCarroceria
              danios={orden.daniosCarroceria || []}
              onChangeDanios={() => {}}
              soloLectura={true}
            />
          </div>

          {/* Inventario de accesorios */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-900 block">
              Inventario de Objetos y Llaves:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>Llanta repuesto: <strong>{orden.accesorios.llantaRepuesto ? 'Sí' : 'No'}</strong></div>
              <div>Gato mecánico: <strong>{orden.accesorios.gato ? 'Sí' : 'No'}</strong></div>
              <div>Triángulos: <strong>{orden.accesorios.triangulos ? 'Sí' : 'No'}</strong></div>
              <div>Extintor: <strong>{orden.accesorios.extintor ? 'Sí' : 'No'}</strong></div>
              <div>Radio/Pantalla: <strong>{orden.accesorios.radio ? 'Sí' : 'No'}</strong></div>
              <div>Tapetes: <strong>{orden.accesorios.tapetes ? 'Sí' : 'No'}</strong></div>
              <div>Documentos: <strong>{orden.accesorios.documentos ? 'Sí' : 'No'}</strong></div>
              <div>Llaves: <strong>{orden.accesorios.cantidadLlaves}</strong></div>
            </div>
          </div>

          {usuarioActual && <PanelCorreccionesOrden orden={orden} usuarioActual={usuarioActual} />}
        </div>

        {/* Modal de foto ampliada */}
        {fotoAmpliada && (
          <div
            onClick={() => setFotoAmpliada(null)}
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          >
            <div className="max-w-3xl max-h-[90vh] bg-white rounded-xl overflow-hidden p-2">
              <div className="flex items-center justify-between pb-2 px-2 text-xs font-bold text-slate-800">
                <span>{fotoAmpliada.titulo}</span>
                <button
                  onClick={() => setFotoAmpliada(null)}
                  className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={fotoAmpliada.base64Data}
                alt={fotoAmpliada.titulo}
                className="max-h-[70vh] w-auto mx-auto object-contain rounded"
              />
              {usuarioActual && (
                <ReemplazarFoto orden={orden} foto={fotoAmpliada} usuarioActual={usuarioActual} onListo={() => setFotoAmpliada(null)} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
