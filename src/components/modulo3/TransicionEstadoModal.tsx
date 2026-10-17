import React, { useState } from 'react';
import { OrdenServicio, EstadoOrden, TallerConfig, AprobacionCliente } from '../../types';
import {
  TRANSICIONES_PERMITIDAS,
  ESTILOS_ESTADO,
  validarTransicionTaller,
  obtenerSiguientesEstadosPermitidos,
} from '../../lib/estadosTaller';
import {
  X,
  ArrowRight,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  FileCheck,
  PackageCheck,
  ShieldAlert,
} from 'lucide-react';

interface TransicionEstadoModalProps {
  orden: OrdenServicio | null;
  nuevoEstadoObjetivo?: EstadoOrden | null;
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  onConfirmarTransicion: (
    orden: OrdenServicio,
    nuevoEstado: EstadoOrden,
    opciones?: {
      notas?: string;
      fechaEstimadaRepuestos?: string;
      aprobacionRegistrada?: AprobacionCliente;
    }
  ) => Promise<void>;
}

export const TransicionEstadoModal: React.FC<TransicionEstadoModalProps> = ({
  orden,
  nuevoEstadoObjetivo,
  isOpen,
  onClose,
  config,
  onConfirmarTransicion,
}) => {
  if (!isOpen || !orden) return null;

  const estadosPermitidos = obtenerSiguientesEstadosPermitidos(orden.estado);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoOrden>(
    nuevoEstadoObjetivo && estadosPermitidos.includes(nuevoEstadoObjetivo)
      ? nuevoEstadoObjetivo
      : estadosPermitidos[0] || orden.estado
  );

  const [notasTransicion, setNotasTransicion] = useState('');
  const [fechaEstimadaRepuestos, setFechaEstimadaRepuestos] = useState(() => {
    const en3dias = new Date();
    en3dias.setDate(en3dias.getDate() + 3);
    return `${en3dias.getFullYear()}-${String(en3dias.getMonth() + 1).padStart(2, '0')}-${String(
      en3dias.getDate()
    ).padStart(2, '0')}`;
  });

  // Estado para aprobación rápida si se va a "En reparación" y no tiene aprobación previa
  const tieneAprobacion =
    orden.aprobaciones?.aprobadoPorCliente === true ||
    (orden.autorizaciones?.montoPreAutorizadoBs || 0) > 0;

  const [aprobacionMedio, setAprobacionMedio] = useState<
    'WhatsApp' | 'Presencial' | 'Llamada' | 'Pre-autorizado'
  >('WhatsApp');
  const [aprobacionMontoBs, setAprobacionMontoBs] = useState<string>(
    orden.autorizaciones?.montoPreAutorizadoBs
      ? String(orden.autorizaciones.montoPreAutorizadoBs)
      : ''
  );
  const [aprobacionNotas, setAprobacionNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const estaOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const validacion = validarTransicionTaller(orden, estadoSeleccionado, estaOnline);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    if (!estaOnline) {
      setErrorLocal(
        'Sin internet: los cambios de estado necesitan conexión.'
      );
      return;
    }

    if (!validacion.valido && !validacion.requiereAprobacionCliente) {
      setErrorLocal(validacion.mensajeError || 'Transición no permitida.');
      return;
    }

    setGuardando(true);
    try {
      let aprobacionPayload: AprobacionCliente | undefined = undefined;

      // Si pasa a "En reparación" y se llenó la aprobación en este modal
      if (estadoSeleccionado === 'En reparación' && !orden.aprobaciones?.aprobadoPorCliente) {
        aprobacionPayload = {
          aprobadoPorCliente: true,
          fechaAprobacion: new Date().toISOString(),
          medioAprobacion: aprobacionMedio,
          montoAprobadoBs: aprobacionMontoBs ? parseFloat(aprobacionMontoBs) : null,
          notasAprobacion: aprobacionNotas.trim() || 'Aprobado antes de iniciar reparación',
        };
      }

      await onConfirmarTransicion(orden, estadoSeleccionado, {
        notas: notasTransicion.trim() || undefined,
        fechaEstimadaRepuestos:
          estadoSeleccionado === 'Esperando repuestos' ? fechaEstimadaRepuestos : undefined,
        aprobacionRegistrada: aprobacionPayload,
      });

      onClose();
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al actualizar el estado de la orden');
    } finally {
      setGuardando(false);
    }
  };

  const estiloActual = ESTILOS_ESTADO[orden.estado] || ESTILOS_ESTADO['Recibido'];
  const estiloNuevo = ESTILOS_ESTADO[estadoSeleccionado] || ESTILOS_ESTADO['Recibido'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 flex flex-col">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cambiar Estado en Taller</h2>
              <p className="text-xs text-slate-400">
                Folio: <span className="font-mono text-amber-400 font-bold">{orden.folio}</span> ·{' '}
                {orden.vehiculoPlaca}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta si está offline */}
        {!estaOnline && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Sin conexión:</strong> Los cambios de estado necesitan internet para quedar registrados.
            </span>
          </div>
        )}

        {/* Error local */}
        {errorLocal && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 flex items-center justify-between text-xs text-rose-900">
            <span>{errorLocal}</span>
            <button onClick={() => setErrorLocal(null)} className="text-rose-500 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Visualización de la transición */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Estado Actual
              </span>
              <span
                className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${estiloActual.badge}`}
              >
                {orden.estado}
              </span>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />

            <div className="text-center flex-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Nuevo Estado
              </span>
              <span
                className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border ${estiloNuevo.badge}`}
              >
                {estadoSeleccionado}
              </span>
            </div>
          </div>

          {/* Selector de estados permitidos según la tabla de especificación */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Seleccionar Siguiente Estado Permitido:
            </label>
            {estadosPermitidos.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border">
                Esta orden está en estado final ({orden.estado}) y no admite más transiciones.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {estadosPermitidos.map((est) => {
                  const estInfo = ESTILOS_ESTADO[est];
                  const isSelected = estadoSeleccionado === est;
                  return (
                    <button
                      key={est}
                      type="button"
                      onClick={() => setEstadoSeleccionado(est)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? `${estInfo.bg} ${estInfo.border} ring-2 ring-slate-900 shadow-xs`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${estInfo.text}`}>{est}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {estInfo.descripcion}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Campo especial: Esperando repuestos pide fecha estimada de llegada */}
          {estadoSeleccionado === 'Esperando repuestos' && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-700" />
                Fecha Estimada de Llegada de Repuestos <span className="text-red-500">*</span>:
              </label>
              <input
                type="date"
                required
                value={fechaEstimadaRepuestos}
                onChange={(e) => setFechaEstimadaRepuestos(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
              <p className="text-[11px] text-purple-700">
                Esta fecha se mostrará en el tablero Kanban y en el seguimiento del cliente.
              </p>
            </div>
          )}

          {/* Validación obligatoria para "En reparación": aprobación del cliente */}
          {estadoSeleccionado === 'En reparación' && !tieneAprobacion && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Aprobación de Reparación Requerida
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Regla de taller: No se puede iniciar reparación sin confirmación del cliente.
                    Registra la aprobación para proceder:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Canal de Aprobación:
                  </label>
                  <select
                    value={aprobacionMedio}
                    onChange={(e: any) => setAprobacionMedio(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-amber-300"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Presencial">Presencial (en taller)</option>
                    <option value="Llamada">Llamada telefónica</option>
                    <option value="Pre-autorizado">Pre-autorizado en recepción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Monto Aprobado (Bs):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={aprobacionMontoBs}
                    onChange={(e) => setAprobacionMontoBs(e.target.value)}
                    placeholder="Monto estimado en Bs"
                    className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-amber-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Nota / Detalle de la autorización:
                </label>
                <input
                  type="text"
                  value={aprobacionNotas}
                  onChange={(e) => setAprobacionNotas(e.target.value)}
                  placeholder="Ej. Aprobó cambio de pastillas y rectificado por mensaje"
                  className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-amber-300"
                />
              </div>
            </div>
          )}

          {/* Nota opcional para el cambio de estado */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nota / Observación para el Historial (Opcional):
            </label>
            <input
              type="text"
              value={notasTransicion}
              onChange={(e) => setNotasTransicion(e.target.value)}
              placeholder="Ej. Se concluyó la inspección de frenos, pasando a espera de repuestos"
              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !estaOnline || estadosPermitidos.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {guardando ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 text-amber-400" />
                  <span>Confirmar a "{estadoSeleccionado}"</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
