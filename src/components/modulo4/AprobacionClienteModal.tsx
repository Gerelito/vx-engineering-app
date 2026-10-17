import React, { useState, useEffect } from 'react';
import {
  OrdenServicio,
  CotizacionOrden,
  TallerConfig,
  DuenoUsuario,
} from '../../types';
import {
  formatearFecha,
  formatearMonedaBs,
  registrarAprobacionCotizacionFirestore,
  rechazarCotizacionFirestore,
} from '../../lib/storage';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Camera,
  FileText,
  DollarSign,
  Phone,
  MessageCircle,
  UserCheck,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AprobacionClienteModalProps {
  orden: OrdenServicio | null;
  cotizacion: CotizacionOrden | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
  usuarioActual: DuenoUsuario;
  onAprobacionRegistrada?: () => void;
  onRechazoRegistrado?: () => void;
}

export const AprobacionClienteModal: React.FC<AprobacionClienteModalProps> = ({
  orden,
  cotizacion,
  config,
  isOpen,
  onClose,
  usuarioActual,
  onAprobacionRegistrada,
  onRechazoRegistrado,
}) => {
  const [modo, setModo] = useState<'aprobar' | 'rechazar'>('aprobar');

  // Campos de aprobación
  const [medio, setMedio] = useState<'En persona' | 'Llamada telefónica' | 'WhatsApp'>('WhatsApp');
  const [nombreAprobador, setNombreAprobador] = useState('');
  const [nota, setNota] = useState('');
  const [itemsAprobados, setItemsAprobados] = useState<Record<string, boolean>>({});
  const [nuevoEstado, setNuevoEstado] = useState<'En reparación' | 'Esperando repuestos'>('En reparación');
  const [fechaEstimadaRepuestos, setFechaEstimadaRepuestos] = useState('');

  // Evidencia de aprobación (captura WhatsApp o nota)
  const [evidenciaBase64, setEvidenciaBase64] = useState<string | null>(null);
  const [evidenciaNombre, setEvidenciaNombre] = useState<string | null>(null);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);

  // Campos de rechazo
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !orden || !cotizacion) return;

    setModo('aprobar');
    setMedio('WhatsApp');
    setNombreAprobador(orden.clienteNombre || '');
    setNota('');
    setEvidenciaBase64(null);
    setEvidenciaNombre(null);
    setMotivoRechazo('');
    setErrorLocal(null);

    // Por defecto todos los ítems marcados como aprobados
    const mapaInicial: Record<string, boolean> = {};
    for (const it of cotizacion.items) {
      mapaInicial[it.id] = true;
    }
    setItemsAprobados(mapaInicial);

    // Sugerir estado inicial según si hay repuestos
    const requiereRepuestos = cotizacion.items.some((i) => i.tipo === 'repuesto');
    setNuevoEstado(requiereRepuestos ? 'Esperando repuestos' : 'En reparación');
  }, [isOpen, orden, cotizacion]);

  if (!isOpen || !orden || !cotizacion) return null;

  // Cálculo de totales aprobados (Aprobación Parcial vs Total)
  const itemsLista = cotizacion.items || [];
  const itemsAprobadosIds = Object.entries(itemsAprobados)
    .filter(([_, aprobado]) => aprobado)
    .map(([id]) => id);

  const montoAprobadoTotal = itemsLista.reduce((acc, it) => {
    return itemsAprobados[it.id] ? acc + (it.precioTotalBs || 0) : acc;
  }, 0);

  const esParcial = itemsAprobadosIds.length > 0 && itemsAprobadosIds.length < itemsLista.length;
  const esTotal = itemsAprobadosIds.length === itemsLista.length;
  const ningunItem = itemsAprobadosIds.length === 0;

  // Control de pre-autorización (Trabajos adicionales / Orden)
  const montoPreAutorizado = orden.autorizaciones?.montoPreAutorizadoBs || 0;
  const entraEnPreAutorizacion = montoPreAutorizado > 0 && montoAprobadoTotal <= montoPreAutorizado;

  // Presupuesto acumulado vs original
  const presupuestoOriginal = orden.presupuestoOriginalBs || cotizacion.totalBs || 0;
  const sobrecosto = presupuestoOriginal > 0 ? montoAprobadoTotal - presupuestoOriginal : 0;
  const sobrecostoPorcentaje =
    presupuestoOriginal > 0 ? Math.round((sobrecosto / presupuestoOriginal) * 100) : 0;
  const superaAlerta = sobrecostoPorcentaje > (config.alertaPresupuestoPorcentaje || 15);

  // Subir captura de evidencia comprimida
  const handleArchivoEvidencia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoArchivo(true);
    setErrorLocal(null);
    try {
      const res = await procesarArchivoAdjunto(file);
      setEvidenciaBase64(res.base64Data);
      setEvidenciaNombre(file.name);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al procesar la evidencia de aprobación.');
    } finally {
      setProcesandoArchivo(false);
    }
  };

  // Confirmar Aprobación
  const handleConfirmarAprobacion = async () => {
    if (ningunItem) {
      setErrorLocal('Debes aprobar al menos un ítem. Si el cliente no desea realizar ningún trabajo, usa "Rechazo Total".');
      return;
    }

    if (!nombreAprobador.trim()) {
      setErrorLocal('El nombre de quien aprobó es obligatorio.');
      return;
    }

    if (!nota.trim()) {
      setErrorLocal('La nota explicativa de la aprobación es obligatoria (ej. "Autorizó por WhatsApp a las 10:30").');
      return;
    }

    setGuardando(true);
    setErrorLocal(null);

    try {
      await registrarAprobacionCotizacionFirestore(
        orden,
        cotizacion,
        {
          medio,
          fechaHora: new Date().toISOString(),
          nombreAprobador: nombreAprobador.trim(),
          nota: nota.trim(),
          evidenciaFotoBase64: evidenciaBase64 || null,
          evidenciaFotoNombre: evidenciaNombre || null,
          itemsAprobadosIds,
          nuevoEstadoOrden: nuevoEstado,
          dentroDePreAutorizacion: entraEnPreAutorizacion,
          fechaEstimadaRepuestos: nuevoEstado === 'Esperando repuestos' ? fechaEstimadaRepuestos : undefined,
        },
        usuarioActual
      );

      if (onAprobacionRegistrada) onAprobacionRegistrada();
      onClose();
    } catch (err: any) {
      console.error('Error registrando aprobación:', err);
      setErrorLocal(err?.message || 'Error al registrar la aprobación en Firestore.');
    } finally {
      setGuardando(false);
    }
  };

  // Confirmar Rechazo Total
  const handleConfirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      setErrorLocal('El motivo del rechazo es obligatorio para registrar en la hoja de vida de la orden.');
      return;
    }

    setGuardando(true);
    setErrorLocal(null);

    try {
      await rechazarCotizacionFirestore(orden, cotizacion, motivoRechazo.trim(), usuarioActual);
      if (onRechazoRegistrado) onRechazoRegistrado();
      onClose();
    } catch (err: any) {
      console.error('Error registrando rechazo:', err);
      setErrorLocal(err?.message || 'Error al registrar el rechazo de la orden.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Encabezado */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              modo === 'aprobar' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {modo === 'aprobar' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {modo === 'aprobar' ? 'Registrar Aprobación de Cotización' : 'Registrar Rechazo de Cotización'}
              </h3>
              <p className="text-xs text-slate-300">
                Orden: <span className="font-mono font-bold text-white">{orden.folio}</span> · Cotización v{cotizacion.versionNumero} · Placa: {orden.vehiculoPlaca}
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

        {/* Pestañas de Modo (Aprobar vs Rechazar) */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setModo('aprobar')}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              modo === 'aprobar'
                ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Aprobación (Total o Parcial)</span>
          </button>
          <button
            type="button"
            onClick={() => setModo('rechazar')}
            className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              modo === 'rechazar'
                ? 'bg-white text-rose-800 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Rechazo Total de la Orden</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorLocal && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
              <span>{errorLocal}</span>
              <button onClick={() => setErrorLocal(null)}>
                <X className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          )}

          {modo === 'aprobar' ? (
            <>
              {/* Pre-autorización aviso */}
              {entraEnPreAutorizacion && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">Aprobado internamente: dentro de monto pre-autorizado</strong>
                    <span className="text-[11px] text-emerald-900">
                      El monto ({formatearMonedaBs(montoAprobadoTotal)}) no supera los {formatearMonedaBs(montoPreAutorizado)} pre-autorizados por el cliente al ingresar.
                    </span>
                  </div>
                </div>
              )}

              {/* Alerta de presupuesto si supera límite */}
              {superaAlerta && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">Alerta: Supera el límite de presupuesto (+{sobrecostoPorcentaje}%)</strong>
                    <span className="text-[11px] text-amber-900">
                      El monto supera el {config.alertaPresupuestoPorcentaje || 15}% respecto al presupuesto original ({formatearMonedaBs(presupuestoOriginal)}).
                    </span>
                  </div>
                </div>
              )}

              {/* Canal de Aprobación */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase text-[11px]">
                  Medio de Aprobación *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'WhatsApp' as const, label: 'WhatsApp', icon: MessageCircle },
                    { val: 'Llamada telefónica' as const, label: 'Llamada', icon: Phone },
                    { val: 'En persona' as const, label: 'En Persona', icon: UserCheck },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setMedio(m.val)}
                      className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        medio === m.val
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <m.icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Datos de quien aprueba */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre de quien Aprobó *:
                  </label>
                  <input
                    type="text"
                    required
                    value={nombreAprobador}
                    onChange={(e) => setNombreAprobador(e.target.value)}
                    placeholder="Titular o persona autorizada"
                    className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Próximo Estado de la Orden *:
                  </label>
                  <select
                    value={nuevoEstado}
                    onChange={(e) => setNuevoEstado(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 font-bold text-slate-900"
                  >
                    <option value="En reparación">En reparación (Iniciar de inmediato)</option>
                    <option value="Esperando repuestos">Esperando repuestos (Solicitar piezas)</option>
                  </select>
                </div>
              </div>

              {nuevoEstado === 'Esperando repuestos' && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <label className="block font-semibold text-amber-900 text-[11px]">
                    Fecha estimada de llegada de repuestos (Opcional):
                  </label>
                  <input
                    type="date"
                    value={fechaEstimadaRepuestos}
                    onChange={(e) => setFechaEstimadaRepuestos(e.target.value)}
                    className="px-3 py-1.5 bg-white rounded border border-amber-300 text-slate-900 font-bold"
                  />
                </div>
              )}

              {/* Aprobación Ítem por Ítem (Aprobación Parcial) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-[11px] uppercase">
                    Ítems a Aprobar ({itemsAprobadosIds.length}/{itemsLista.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const todos: Record<string, boolean> = {};
                        itemsLista.forEach((it) => (todos[it.id] = true));
                        setItemsAprobados(todos);
                      }}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                    >
                      Aprobar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setItemsAprobados({})}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {itemsLista.map((it) => {
                    const estaAprobado = !!itemsAprobados[it.id];
                    return (
                      <div
                        key={it.id}
                        onClick={() =>
                          setItemsAprobados((prev) => ({
                            ...prev,
                            [it.id]: !prev[it.id],
                          }))
                        }
                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          estaAprobado ? 'bg-emerald-50/40' : 'bg-white opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <input
                            type="checkbox"
                            checked={estaAprobado}
                            onChange={() => {}} // Manejado por div
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {it.descripcion}
                            </span>
                            <span className="text-[10px] text-slate-500 capitalize">
                              {it.tipo.replace('_', ' ')} · {it.clasificacion}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-slate-900">
                          {it.precioPorDefinir ? 'Por definir' : formatearMonedaBs(it.precioTotalBs)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-400 block">Tipo de Aprobación:</span>
                    <strong className="text-white font-bold">
                      {esTotal ? 'Aprobación Total' : esParcial ? 'Aprobación Parcial' : 'Ningún ítem marcado'}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-amber-400 block font-semibold">Total Autorizado:</span>
                    <span className="font-mono text-lg font-black text-amber-400">
                      {formatearMonedaBs(montoAprobadoTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nota Obligatoria */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nota u Observación Obligatoria *:
                </label>
                <textarea
                  required
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. El cliente aprobó por mensaje de WhatsApp a las 11:15 am, solicita guardar las piezas cambiadas."
                  className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              {/* Evidencia Opcional (Captura comprimida) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-[11px] block">
                  Evidencia Opcional (Captura de WhatsApp o Nota Firmada):
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{procesandoArchivo ? 'Comprimiendo...' : 'Subir Imagen'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleArchivoEvidencia}
                      className="hidden"
                    />
                  </label>
                  {evidenciaNombre && (
                    <span className="text-[11px] text-emerald-700 font-semibold truncate max-w-xs">
                      ✓ {evidenciaNombre}
                    </span>
                  )}
                </div>
                {evidenciaBase64 && (
                  <div className="w-24 h-16 rounded overflow-hidden border border-slate-300">
                    <img src={evidenciaBase64} alt="Evidencia" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Modo Rechazar Cotización */
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <strong className="font-bold text-xs uppercase">Cancelación por Rechazo del Cliente</strong>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  Al registrar el rechazo total, la orden pasará al estado <strong>"Cancelada"</strong>.
                  El motivo ingresado quedará registrado de forma inmutable en el historial técnico y de auditoría.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Motivo del Rechazo del Cliente *:
                </label>
                <textarea
                  required
                  rows={4}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Ej. El cliente indica que el presupuesto excede su disponibilidad actual y decide retirar el vehículo sin reparar."
                  className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900 font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancelar
          </button>

          {modo === 'aprobar' ? (
            <button
              type="button"
              onClick={handleConfirmarAprobacion}
              disabled={guardando || ningunItem}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{guardando ? 'Registrando...' : 'Confirmar Aprobación y Pasar a Taller'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmarRechazo}
              disabled={guardando || !motivoRechazo.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{guardando ? 'Cancelando orden...' : 'Registrar Rechazo y Cancelar Orden'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
