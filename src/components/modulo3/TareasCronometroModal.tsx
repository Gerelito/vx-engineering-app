import React, { useState, useEffect } from 'react';
import { OrdenServicio, TallerConfig, TareaOrden, TrabajoTarifario } from '../../types';
import {
  X,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  User,
  Wrench,
  AlertCircle,
  Timer,
  ChevronRight,
  Coffee,
  HelpCircle,
  Package,
} from 'lucide-react';

interface TareasCronometroModalProps {
  orden: OrdenServicio | null;
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  onGuardarTarea: (
    orden: OrdenServicio,
    tarea: Omit<TareaOrden, 'id' | 'ordenId' | 'fechaCreacion'> & { id?: string }
  ) => Promise<void>;
  onControlCronometro: (
    orden: OrdenServicio,
    tareaId: string,
    accion: 'iniciar' | 'pausar' | 'finalizar',
    motivoPausa?: TareaOrden['intervalos'][0]['pausaMotivo'],
    notasPausa?: string
  ) => Promise<void>;
}

export const TareasCronometroModal: React.FC<TareasCronometroModalProps> = ({
  orden,
  isOpen,
  onClose,
  config,
  onGuardarTarea,
  onControlCronometro,
}) => {
  if (!isOpen || !orden) return null;

  const [mostrarNuevaTarea, setMostrarNuevaTarea] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState(
    orden.mecanicoResponsable || config.mecanicosResponsables[0] || 'Mecánico de Turno'
  );
  const [tiempoEstimadoMinutos, setTiempoEstimadoMinutos] = useState<number>(60);
  const [tarifarioSeleccionado, setTarifarioSeleccionado] = useState('');

  // Estado para el modal rápido de pausa
  const [tareaParaPausar, setTareaParaPausar] = useState<string | null>(null);
  const [motivoPausa, setMotivoPausa] = useState<TareaOrden['intervalos'][0]['pausaMotivo']>(
    'Espera de repuesto'
  );
  const [notasPausa, setNotasPausa] = useState('');

  const [procesando, setProcesando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Tick local cada 1 segundo para actualizar los cronómetros en pantalla
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const tareas = orden.tareas || [];

  // Calcular totales acumulados estimado vs real
  const totalEstimadoMin = tareas.reduce((acc, t) => acc + (t.tiempoEstimadoMinutos || 0), 0);

  // Calcular tiempo real acumulado en segundos considerando intervalos activos en vivo
  const calcularTiempoEnVivoSegundos = (t: TareaOrden): number => {
    let seg = (t.intervalos || []).reduce((acc, i) => acc + (i.duracionSegundos || 0), 0);
    // Si la tarea está "En curso", sumar los segundos transcurridos desde el inicio del último intervalo
    if (t.estado === 'En curso' && t.intervalos && t.intervalos.length > 0) {
      const ultimo = t.intervalos[t.intervalos.length - 1];
      if (!ultimo.fin) {
        const transcurrido = Math.round((Date.now() - new Date(ultimo.inicio).getTime()) / 1000);
        seg += Math.max(0, transcurrido);
      }
    }
    return seg;
  };

  const totalRealMin = Math.round(
    tareas.reduce((acc, t) => acc + calcularTiempoEnVivoSegundos(t), 0) / 60
  );

  const formatearSegundos = (segundosTotales: number): string => {
    const h = Math.floor(segundosTotales / 3600);
    const m = Math.floor((segundosTotales % 3600) / 60);
    const s = segundosTotales % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const handleSeleccionarTarifario = (trabajoId: string) => {
    setTarifarioSeleccionado(trabajoId);
    const tar = config.trabajosTarifario.find((t) => t.id === trabajoId);
    if (tar) {
      setDescripcion(tar.trabajo);
      setTiempoEstimadoMinutos(Math.round(tar.horasEstandar * 60));
    }
  };

  const handleCrearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) {
      setErrorLocal('Ingresa la descripción del trabajo técnico a realizar.');
      return;
    }

    setProcesando(true);
    setErrorLocal(null);
    try {
      await onGuardarTarea(orden, {
        descripcion: descripcion.trim(),
        responsable,
        tiempoEstimadoMinutos: Number(tiempoEstimadoMinutos) || 30,
        estado: 'Pendiente',
        intervalos: [],
        tiempoRealMinutos: 0,
      });

      setDescripcion('');
      setMostrarNuevaTarea(false);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al guardar tarea');
    } finally {
      setProcesando(false);
    }
  };

  const handleAccionCronometro = async (
    tarea: TareaOrden,
    accion: 'iniciar' | 'pausar' | 'finalizar'
  ) => {
    if (accion === 'pausar') {
      setTareaParaPausar(tarea.id);
      return;
    }

    setProcesando(true);
    setErrorLocal(null);
    try {
      await onControlCronometro(orden, tarea.id, accion);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al actualizar cronómetro');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarPausa = async () => {
    if (!tareaParaPausar) return;
    setProcesando(true);
    setErrorLocal(null);
    try {
      await onControlCronometro(orden, tareaParaPausar, 'pausar', motivoPausa, notasPausa);
      setTareaParaPausar(null);
      setNotasPausa('');
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al pausar');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tareas Técnicas & Cronómetro</h2>
              <p className="text-xs text-slate-400">
                Folio: <span className="font-mono text-amber-400 font-bold">{orden.folio}</span> ·{' '}
                {orden.vehiculoPlaca} ({orden.vehiculoMarca} {orden.vehiculoModelo})
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

        {/* Resumen Comparativo: Estimado vs Real */}
        <div className="bg-slate-100 border-b border-slate-200 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0 text-center">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Tiempo Estimado
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
              {Math.floor(totalEstimadoMin / 60)}h {totalEstimadoMin % 60}m
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Tiempo Real Acumulado
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-mono ${
                totalRealMin > totalEstimadoMin && totalEstimadoMin > 0
                  ? 'text-rose-600'
                  : 'text-emerald-700'
              }`}
            >
              {Math.floor(totalRealMin / 60)}h {totalRealMin % 60}m
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Desempeño Frente a Estándar
            </span>
            <span
              className={`text-xs font-bold px-2 py-1 rounded inline-block mt-0.5 ${
                totalRealMin === 0
                  ? 'bg-slate-100 text-slate-700'
                  : totalRealMin <= totalEstimadoMin
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {totalRealMin === 0
                ? 'Sin iniciar'
                : totalRealMin <= totalEstimadoMin
                ? 'Dentro del estimado'
                : `+${totalRealMin - totalEstimadoMin}m sobre estimado`}
            </span>
          </div>
        </div>

        {/* Error local */}
        {errorLocal && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl flex items-center justify-between text-xs shrink-0">
            <span>{errorLocal}</span>
            <button onClick={() => setErrorLocal(null)} className="text-rose-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cuerpo del modal (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Botón para añadir nueva tarea */}
          {!mostrarNuevaTarea && (
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lista de Trabajos Asignados ({tareas.length})
              </h3>
              <button
                type="button"
                onClick={() => setMostrarNuevaTarea(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar Trabajo</span>
              </button>
            </div>
          )}

          {/* Formulario para agregar tarea */}
          {mostrarNuevaTarea && (
            <form
              onSubmit={handleCrearTarea}
              className="p-4 bg-slate-50 border-2 border-slate-300 rounded-xl space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-700" />
                  Nuevo Trabajo Técnico
                </span>
                <button
                  type="button"
                  onClick={() => setMostrarNuevaTarea(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selector desde Tarifario Estándar de Configuración */}
              {config.trabajosTarifario && config.trabajosTarifario.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cargar desde Tarifario Estándar del Taller:
                  </label>
                  <select
                    value={tarifarioSeleccionado}
                    onChange={(e) => handleSeleccionarTarifario(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300"
                  >
                    <option value="">-- Seleccionar trabajo estándar (horas precargadas) --</option>
                    {config.trabajosTarifario.map((tar) => (
                      <option key={tar.id} value={tar.id}>
                        {tar.trabajo} · {tar.horasEstandar}h ({Math.round(tar.horasEstandar * 60)} min)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Descripción del Trabajo <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Cambio de pastillas delanteras y rectificado de discos"
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mecánico Responsable:
                  </label>
                  <select
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white rounded-lg border border-slate-300"
                  >
                    {config.mecanicosResponsables.map((mec) => (
                      <option key={mec} value={mec}>
                        {mec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tiempo Estimado (Minutos):
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={tiempoEstimadoMinutos}
                    onChange={(e) => setTiempoEstimadoMinutos(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Equivale a {(tiempoEstimadoMinutos / 60).toFixed(2)} horas estándar
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMostrarNuevaTarea(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
                >
                  Guardar Trabajo
                </button>
              </div>
            </form>
          )}

          {/* Lista de Tareas */}
          {tareas.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">
                No hay tareas asignadas para esta orden todavía.
              </p>
              <button
                type="button"
                onClick={() => setMostrarNuevaTarea(true)}
                className="text-xs font-bold text-slate-900 underline hover:text-amber-600"
              >
                + Crear el primer trabajo con cronómetro
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tareas.map((tarea) => {
                const segundosEnVivo = calcularTiempoEnVivoSegundos(tarea);
                const minutosEnVivo = Math.round(segundosEnVivo / 60);
                const excedeEstimado =
                  minutosEnVivo > tarea.tiempoEstimadoMinutos && tarea.tiempoEstimadoMinutos > 0;

                return (
                  <div
                    key={tarea.id}
                    className={`p-4 rounded-xl border transition-all ${
                      tarea.estado === 'En curso'
                        ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-500'
                        : tarea.estado === 'Pausada'
                        ? 'bg-amber-50/40 border-amber-300'
                        : tarea.estado === 'Finalizada'
                        ? 'bg-slate-50 border-slate-200 opacity-80'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* Información de la tarea */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              tarea.estado === 'En curso'
                                ? 'bg-blue-600 text-white animate-pulse'
                                : tarea.estado === 'Pausada'
                                ? 'bg-amber-500 text-white'
                                : tarea.estado === 'Finalizada'
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {tarea.estado}
                          </span>

                          <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {tarea.responsable}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900">{tarea.descripcion}</h4>

                        {/* Motivo de pausa si aplica */}
                        {tarea.estado === 'Pausada' &&
                          tarea.intervalos &&
                          tarea.intervalos.length > 0 &&
                          tarea.intervalos[tarea.intervalos.length - 1].pausaMotivo && (
                            <p className="text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded inline-block">
                              Pausa: {tarea.intervalos[tarea.intervalos.length - 1].pausaMotivo}
                              {tarea.intervalos[tarea.intervalos.length - 1].notas
                                ? ` · "${tarea.intervalos[tarea.intervalos.length - 1].notas}"`
                                : ''}
                            </p>
                          )}
                      </div>

                      {/* Display del Cronómetro y Tiempos */}
                      <div className="text-right sm:border-l sm:pl-4 border-slate-200 shrink-0 space-y-1">
                        <div className="flex items-center sm:justify-end gap-1.5 font-mono">
                          <Timer
                            className={`w-4 h-4 ${
                              tarea.estado === 'En curso'
                                ? 'text-blue-600 animate-spin'
                                : 'text-slate-400'
                            }`}
                          />
                          <span
                            className={`text-lg font-bold ${
                              excedeEstimado ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {formatearSegundos(segundosEnVivo)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          Est: <strong>{tarea.tiempoEstimadoMinutos} min</strong>
                          {tarea.estado === 'Finalizada' && (
                            <span
                              className={`ml-1.5 font-bold ${
                                excedeEstimado ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              ({excedeEstimado ? 'Excedido' : 'Cumplido'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botones de Control del Cronómetro */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      {tarea.estado !== 'Finalizada' && (
                        <>
                          {tarea.estado !== 'En curso' ? (
                            <button
                              type="button"
                              disabled={procesando}
                              onClick={() => handleAccionCronometro(tarea, 'iniciar')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{tarea.estado === 'Pausada' ? 'Reanudar' : 'Iniciar Tarea'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={procesando}
                              onClick={() => handleAccionCronometro(tarea, 'pausar')}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>Pausar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={procesando}
                            onClick={() => handleAccionCronometro(tarea, 'finalizar')}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Finalizar</span>
                          </button>
                        </>
                      )}

                      {tarea.estado === 'Finalizada' && (
                        <div className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Trabajo Concluido ({tarea.tiempoRealMinutos} min reales)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Pausa Rápida */}
        {tareaParaPausar && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 border border-slate-200 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Pause className="w-4 h-4 text-amber-500" />
                  Motivo de la Pausa
                </h4>
                <button
                  onClick={() => setTareaParaPausar(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Selecciona la razón para documentar con precisión la interrupción del tiempo de taller:
              </p>

              <div className="space-y-1.5">
                {[
                  'Espera de repuesto',
                  'Consulta técnica',
                  'Almuerzo / Descanso',
                  'Otra tarea',
                ].map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    onClick={() => setMotivoPausa(motivo as any)}
                    className={`w-full p-2 text-xs font-semibold rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                      motivoPausa === motivo
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{motivo}</span>
                    {motivoPausa === motivo && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nota Adicional (Opcional):
                </label>
                <input
                  type="text"
                  value={notasPausa}
                  onChange={(e) => setNotasPausa(e.target.value)}
                  placeholder="Ej. Esperando que llegue el retén de caja"
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setTareaParaPausar(null)}
                  className="px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarPausa}
                  className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600"
                >
                  Confirmar Pausa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Los intervalos quedan grabados en Firestore para cálculo exacto aunque se cierre la app.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
