import React, { useState, useEffect } from 'react';
import {
  OrdenServicio,
  TallerConfig,
  CotizacionOrden,
  ItemCotizacion,
  TipoItemCotizacion,
  CalidadRepuesto,
  ClasificacionHallazgoCotizacion,
  OpcionComparable,
  PlantillaCotizacion,
  DuenoUsuario,
} from '../../types';
import {
  formatearFecha,
  formatearMonedaBs,
  guardarCotizacionFirestore,
  obtenerCotizacionesOrdenFirestore,
} from '../../lib/storage';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  FileText,
  Clock,
  Wrench,
  Package,
  Truck,
  Percent,
  Download,
  CheckCircle2,
  Tag,
  DollarSign,
  History,
  Copy,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CotizacionEditorModalProps {
  orden: OrdenServicio | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
  usuarioActual: DuenoUsuario;
  onCotizacionGuardada?: (cotizacion: CotizacionOrden) => void;
  onAbrirImprimir?: (cotizacion: CotizacionOrden) => void;
}

export const CotizacionEditorModal: React.FC<CotizacionEditorModalProps> = ({
  orden,
  config,
  isOpen,
  onClose,
  usuarioActual,
  onCotizacionGuardada,
  onAbrirImprimir,
}) => {
  const [cotizacionesExistentes, setCotizacionesExistentes] = useState<CotizacionOrden[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Formulario de cotización
  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [descuentoTotalBs, setDescuentoTotalBs] = useState<string>('0');
  const [descuentoTotalMotivo, setDescuentoTotalMotivo] = useState<string>('');
  const [diasVigencia, setDiasVigencia] = useState<number>(config.vigenciaCotizacionDias || 7);
  const [motivoCambioVersion, setMotivoCambioVersion] = useState<string>('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Modal para agregar/editar ítem
  const [modalItemAbierto, setModalItemAbierto] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<ItemCotizacion | null>(null);

  // Modal selector de plantilla
  const [modalPlantillasAbierto, setModalPlantillasAbierto] = useState(false);

  // Cargar cotizaciones existentes al abrir
  useEffect(() => {
    if (!isOpen || !orden) return;
    cargarCotizaciones();
  }, [isOpen, orden]);

  const cargarCotizaciones = async () => {
    if (!orden) return;
    setCargandoHistorial(true);
    setErrorLocal(null);
    try {
      const lista = await obtenerCotizacionesOrdenFirestore(orden.id);
      setCotizacionesExistentes(lista);

      if (lista.length > 0) {
        // Cargar la versión más reciente
        const ultima = lista[0];
        setItems(ultima.items || []);
        setDescuentoTotalBs(ultima.descuentoTotalMontoBs ? String(ultima.descuentoTotalMontoBs) : '0');
        setDescuentoTotalMotivo(ultima.descuentoTotalMotivo || '');
        setDiasVigencia(ultima.diasVigencia || config.vigenciaCotizacionDias || 7);
      } else {
        // Cotización nueva vacía
        setItems([]);
        setDescuentoTotalBs('0');
        setDescuentoTotalMotivo('');
        setDiasVigencia(config.vigenciaCotizacionDias || 7);
      }
    } catch (err: any) {
      console.error('Error cargando cotizaciones:', err);
      setErrorLocal('No se pudieron cargar las cotizaciones previas.');
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Cálculo de totales en tiempo real
  const tienePrecioPorDefinir = items.some((i) => i.precioPorDefinir);
  const subtotalCalculado = tienePrecioPorDefinir
    ? null
    : items.reduce((acc, it) => acc + (it.precioTotalBs || 0), 0);
  const descuentoNum = parseFloat(descuentoTotalBs) || 0;
  const totalCalculado = subtotalCalculado !== null ? Math.max(0, subtotalCalculado - descuentoNum) : null;

  // Cálculo interno de costos y márgenes
  const costoTotalInterno = items.reduce((acc, it) => {
    const cant = it.cantidad || it.horasManoObra || 1;
    return acc + (it.costoUnitarioBs || 0) * cant;
  }, 0);
  const margenPromedio =
    subtotalCalculado && subtotalCalculado > 0 && costoTotalInterno > 0
      ? Math.round(((subtotalCalculado - costoTotalInterno) / subtotalCalculado) * 100)
      : 0;
  const alertaMargenGeneral =
    !tienePrecioPorDefinir &&
    subtotalCalculado !== null &&
    subtotalCalculado > 0 &&
    margenPromedio < (config.margenMinimoPorcentaje || 25);

  // Importar hallazgos del diagnóstico técnico (Módulo 3)
  const handleImportarHallazgosDiagnostico = () => {
    if (!orden?.diagnosticoTecnico?.hallazgos || orden.diagnosticoTecnico.hallazgos.length === 0) {
      setErrorLocal('No hay hallazgos técnicos registrados en el diagnóstico para importar.');
      return;
    }

    const nuevosItems: ItemCotizacion[] = orden.diagnosticoTecnico.hallazgos.map((h, idx) => {
      let clasif: ClasificacionHallazgoCotizacion = 'General';
      if (h.clasificacion.includes('Seguridad')) clasif = 'Seguridad (Urgente)';
      else if (h.clasificacion.includes('Recomendado')) clasif = 'Recomendado';
      else if (h.clasificacion.includes('Puede esperar')) clasif = 'Puede esperar';

      const costoSugerido = h.costoEstimadoBs || 0;
      const tarifaHora = config.tarifaHoraEstandarBs || 90;

      return {
        id: `diag_${Date.now()}_${idx}`,
        tipo: 'mano_obra',
        descripcion: `[${h.sistema}] ${h.descripcion}`,
        clasificacion: clasif,
        origenHallazgoId: h.id,
        horasManoObra: 1,
        tarifaHoraBs: tarifaHora,
        costoUnitarioBs: 40,
        margenPorcentaje: 50,
        precioPorDefinir: costoSugerido === 0,
        precioUnitarioCalculadoBs: costoSugerido > 0 ? costoSugerido : tarifaHora,
        precioTotalBs: costoSugerido > 0 ? costoSugerido : tarifaHora,
        aprobado: null,
      };
    });

    setItems((prev) => [...prev, ...nuevosItems]);
  };

  // Cargar plantilla de servicio frecuente
  const handleCargarPlantilla = (plantilla: PlantillaCotizacion) => {
    const nuevosItems: ItemCotizacion[] = plantilla.items.map((it, idx) => ({
      ...it,
      id: `item_pl_${Date.now()}_${idx}`,
      aprobado: null,
    }));
    setItems((prev) => [...prev, ...nuevosItems]);
    setModalPlantillasAbierto(false);
  };

  // Eliminar ítem
  const handleEliminarItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Guardar cotización en Firestore (Crea nueva versión v1, v2...)
  const handleGuardar = async () => {
    if (!orden) return;
    if (items.length === 0) {
      setErrorLocal('Debes agregar al menos un ítem a la cotización.');
      return;
    }

    if (descuentoNum > 0 && !descuentoTotalMotivo.trim()) {
      setErrorLocal('Por normativa de auditoría, debes indicar el motivo del descuento global otorgado.');
      return;
    }

    setGuardando(true);
    setErrorLocal(null);

    try {
      const cotizacionGuardada = await guardarCotizacionFirestore(
        orden,
        {
          items,
          descuentoTotalMontoBs: descuentoNum,
          descuentoTotalMotivo: descuentoTotalMotivo.trim() || null,
          diasVigencia,
        },
        usuarioActual,
        motivoCambioVersion.trim() || undefined
      );

      setMotivoCambioVersion('');
      await cargarCotizaciones();
      if (onCotizacionGuardada) {
        onCotizacionGuardada(cotizacionGuardada);
      }
    } catch (err: any) {
      console.error('Error guardando cotización:', err);
      setErrorLocal(err?.message || 'Error al guardar la versión de la cotización.');
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen || !orden) return null;

  const versionActualNum = cotizacionesExistentes.length + 1;
  const ultimaCotizacion = cotizacionesExistentes[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Encabezado */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  Cotización de Servicio · {orden.folio}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 font-mono">
                  Nueva Versión v{versionActualNum}
                </span>
                {ultimaCotizacion?.esVencida && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                    v{ultimaCotizacion.versionNumero} Vencida
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Placa: <span className="font-mono font-bold text-white">{orden.vehiculoPlaca}</span> · Cliente:{' '}
                <span className="font-medium text-white">{orden.clienteNombre}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ultimaCotizacion && onAbrirImprimir && (
              <button
                type="button"
                onClick={() => onAbrirImprimir(ultimaCotizacion)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Ver Imprimible Cliente</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Acciones Rápidas */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setItemEnEdicion(null);
                setModalItemAbierto(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Ítem</span>
            </button>

            <button
              type="button"
              onClick={handleImportarHallazgosDiagnostico}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="Importar hallazgos del diagnóstico con clasificación"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Importar del Diagnóstico</span>
            </button>

            <button
              type="button"
              onClick={() => setModalPlantillasAbierto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Cargar Plantilla</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {cotizacionesExistentes.length > 0 && (
              <button
                type="button"
                onClick={() => setMostrarHistorial(!mostrarHistorial)}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>Historial ({cotizacionesExistentes.length} versiones)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mostrarHistorial ? 'rotate-180' : ''}`} />
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-600">Vigencia:</span>
              <input
                type="number"
                min="1"
                max="60"
                value={diasVigencia}
                onChange={(e) => setDiasVigencia(Math.max(1, parseInt(e.target.value, 10) || 7))}
                className="w-10 text-center font-bold text-slate-900 border-b border-slate-300 focus:outline-none"
              />
              <span className="text-[11px] text-slate-500">días</span>
            </div>
          </div>
        </div>

        {/* Panel Desplegable de Historial de Versiones */}
        {mostrarHistorial && (
          <div className="bg-amber-50/50 border-b border-amber-200 px-6 py-3 max-h-48 overflow-y-auto space-y-2 text-xs">
            <span className="font-bold text-slate-900 block">Historial de Cotizaciones Anteriores:</span>
            {cotizacionesExistentes.map((cot) => (
              <div
                key={cot.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">v{cot.versionNumero}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    cot.estado.startsWith('Aprobada') ? 'bg-emerald-100 text-emerald-800' :
                    cot.estado === 'Rechazada' ? 'bg-rose-100 text-rose-800' :
                    cot.estado === 'Vencida' ? 'bg-slate-200 text-slate-700' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {cot.estado}
                  </span>
                  <span className="text-slate-500">
                    Emitida: {formatearFecha(cot.fechaEmision)} por {cot.creadoPorNombre}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-900">
                    {cot.tienePrecioPorDefinir ? 'Pendiente de negociación' : formatearMonedaBs(cot.totalBs)}
                  </span>
                  {onAbrirImprimir && (
                    <button
                      type="button"
                      onClick={() => onAbrirImprimir(cot)}
                      className="text-amber-600 hover:text-amber-700 font-bold text-[11px] cursor-pointer"
                    >
                      Imprimir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cuerpo Principal del Editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorLocal && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
              <span>{errorLocal}</span>
              <button onClick={() => setErrorLocal(null)}>
                <X className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          )}

          {/* Banner si hay "Precio por definir" */}
          {tienePrecioPorDefinir && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="block font-bold">Cotización con ítems "Por definir"</strong>
                <p className="text-amber-900 text-[11px] mt-0.5">
                  El total oficial se mostrará como <strong>"Pendiente de negociación"</strong> tanto en pantalla como
                  en el documento que vea el cliente, evitando montos engañosos hasta acordar los repuestos o servicios pendientes.
                </p>
              </div>
            </div>
          )}

          {/* Alerta interna de margen bajo */}
          {alertaMargenGeneral && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong className="block font-bold">Protección Interna: Margen bajo el mínimo</strong>
                <p className="text-rose-900 text-[11px] mt-0.5">
                  El margen promedio calculado ({margenPromedio}%) está por debajo del mínimo establecido en Configuración ({config.margenMinimoPorcentaje}%).
                  (Este aviso es estrictamente interno y nunca se muestra en nada que vea el cliente).
                </p>
              </div>
            </div>
          )}

          {/* Tabla de Ítems de la Cotización */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">
                Ítems Cotizados ({items.length})
              </span>
              <span className="text-xs text-slate-500">
                Mano de Obra · Repuestos · Terceros
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No hay ítems en esta cotización aún.</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalItemAbierto(true)}
                    className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer"
                  >
                    + Agregar Primer Ítem
                  </button>
                  <button
                    type="button"
                    onClick={handleImportarHallazgosDiagnostico}
                    className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 font-bold rounded-lg cursor-pointer"
                  >
                    Importar del Diagnóstico
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Tipo */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                            it.tipo === 'mano_obra'
                              ? 'bg-blue-100 text-blue-800'
                              : it.tipo === 'repuesto'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {it.tipo === 'mano_obra' && <Wrench className="w-3 h-3" />}
                          {it.tipo === 'repuesto' && <Package className="w-3 h-3" />}
                          {it.tipo === 'terceros' && <Truck className="w-3 h-3" />}
                          {it.tipo.replace('_', ' ')}
                        </span>

                        {/* Clasificación de diagnóstico si aplica */}
                        {it.clasificacion && it.clasificacion !== 'General' && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.clasificacion === 'Seguridad (Urgente)'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : it.clasificacion === 'Recomendado'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {it.clasificacion}
                          </span>
                        )}

                        {/* Badge de "Por definir" */}
                        {it.precioPorDefinir && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase">
                            Precio por definir
                          </span>
                        )}

                        {/* Alerta de margen bajo */}
                        {it.alertaMargenBajo && !it.precioPorDefinir && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Margen bajo ({it.margenPorcentaje}%)
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-900 leading-snug">
                        {it.descripcion}
                      </p>

                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        {it.tipo === 'mano_obra' && (
                          <>
                            <span>Horas: <strong>{it.horasManoObra || 1} h</strong></span>
                            <span>Tarifa: <strong>{it.tarifaHoraBs || config.tarifaHoraEstandarBs} Bs/h</strong></span>
                          </>
                        )}
                        {it.tipo === 'repuesto' && (
                          <>
                            <span>Cant: <strong>{it.cantidad || 1}</strong></span>
                            <span>Marca: <strong>{it.marcaRepuesto || 'N/D'}</strong></span>
                            <span className="capitalize">Calidad: <strong>{it.calidadRepuesto || 'alterno'}</strong></span>
                            {/* Datos internos de costo (solo personal de taller) */}
                            <span className="text-slate-400 italic">
                              (Costo int: {it.costoUnitarioBs || 0} Bs · Margen: {it.margenPorcentaje || 0}%)
                            </span>
                          </>
                        )}
                        {it.tipo === 'terceros' && (
                          <>
                            <span>Proveedor: <strong>{it.proveedorTerceros || 'Especialista'}</strong></span>
                            <span className="text-slate-400 italic">(Costo int: {it.costoUnitarioBs || 0} Bs)</span>
                          </>
                        )}

                        {/* Descuento por ítem */}
                        {it.descuentoMontoBs ? (
                          <span className="text-rose-600 font-semibold">
                            Desc: -{it.descuentoMontoBs} Bs ({it.descuentoMotivo || 'Autorizado'})
                          </span>
                        ) : null}
                      </div>

                      {/* Alternativas comparables (Original vs Alterno) */}
                      {it.opcionesComparables && it.opcionesComparables.length > 0 && (
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                          <span className="font-bold text-slate-700 block">
                            Opciones comparables disponibles para el cliente:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {it.opcionesComparables.map((op) => (
                              <div
                                key={op.id}
                                className={`p-1.5 rounded border text-[11px] ${
                                  it.opcionSeleccionadaId === op.id
                                    ? 'bg-amber-50 border-amber-300 font-bold'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{op.titulo} ({op.marca})</span>
                                  <span className="font-mono">{formatearMonedaBs(op.precioBs)}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block">Garantía: {op.garantia}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Precio y Acciones */}
                    <div className="text-right shrink-0 space-y-1">
                      <div className="font-mono text-sm font-bold text-slate-900">
                        {it.precioPorDefinir ? (
                          <span className="text-amber-600 font-semibold text-xs">Por definir</span>
                        ) : (
                          formatearMonedaBs(it.precioTotalBs)
                        )}
                      </div>

                      <div className="flex items-center gap-1 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setItemEnEdicion(it);
                            setModalItemAbierto(true);
                          }}
                          className="px-2 py-0.5 text-xs text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarItem(it.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                          title="Eliminar ítem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bloque de Descuento Global y Totales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Descuentos (Solo dueños con motivo obligatorio) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-700" />
                <span className="font-bold text-slate-900 uppercase">
                  Descuento Comercial Global (Solo Dueños)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Todo descuento requiere un motivo explícito que queda registrado de manera inmutable en la auditoría.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Monto Descuento (Bs):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={descuentoTotalBs}
                    onChange={(e) => setDescuentoTotalBs(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Motivo Obligatorio:
                  </label>
                  <input
                    type="text"
                    value={descuentoTotalMotivo}
                    onChange={(e) => setDescuentoTotalMotivo(e.target.value)}
                    placeholder="Ej. Cliente frecuente / Promoción"
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Resumen de Totales */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-1.5 border-b border-slate-800 pb-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Subtotal Ítems:</span>
                  <span className="font-mono text-sm text-white">
                    {tienePrecioPorDefinir ? 'Pendiente' : formatearMonedaBs(subtotalCalculado)}
                  </span>
                </div>
                {descuentoNum > 0 && (
                  <div className="flex items-center justify-between text-rose-400">
                    <span>Descuento Aplicado:</span>
                    <span className="font-mono text-sm">-{formatearMonedaBs(descuentoNum)}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                    Total Cotización:
                  </span>
                  <span className="font-mono text-xl font-black text-amber-400">
                    {tienePrecioPorDefinir ? (
                      <span className="text-base text-amber-300 font-bold">Pendiente de negociación</span>
                    ) : (
                      formatearMonedaBs(totalCalculado)
                    )}
                  </span>
                </div>

                {/* Métricas internas protegidas */}
                <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Costo Interno Estimado: {formatearMonedaBs(costoTotalInterno)}</span>
                  <span>Margen Estimado: ~{margenPromedio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Motivo de la nueva versión (para historial inmutable) */}
          <div className="text-xs space-y-1">
            <label className="block font-semibold text-slate-700">
              Motivo o Justificación del Cambio (para versión v{versionActualNum}):
            </label>
            <input
              type="text"
              value={motivoCambioVersion}
              onChange={(e) => setMotivoCambioVersion(e.target.value)}
              placeholder="Ej. Se agregaron repuestos tras desmontaje / Cambio a repuesto original solicitado"
              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900"
            />
          </div>
        </div>

        {/* Barra de Acciones Finales */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGuardar}
              disabled={guardando || items.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{guardando ? 'Guardando Versión...' : `Guardar Versión v${versionActualNum}`}</span>
            </button>
          </div>
        </div>

        {/* Modal para Crear o Editar Ítem */}
        {modalItemAbierto && (
          <ModalEditarItem
            itemInicial={itemEnEdicion}
            config={config}
            onGuardarItem={(nuevoItem) => {
              if (itemEnEdicion) {
                setItems((prev) => prev.map((it) => (it.id === itemEnEdicion.id ? nuevoItem : it)));
              } else {
                setItems((prev) => [...prev, nuevoItem]);
              }
              setModalItemAbierto(false);
              setItemEnEdicion(null);
            }}
            onClose={() => {
              setModalItemAbierto(false);
              setItemEnEdicion(null);
            }}
          />
        )}

        {/* Modal Selector de Plantillas */}
        {modalPlantillasAbierto && (
          <ModalSelectorPlantilla
            config={config}
            onSeleccionar={handleCargarPlantilla}
            onClose={() => setModalPlantillasAbierto(false)}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUBCOMPONENTE: Modal para Crear / Editar Ítem de Cotización
// ---------------------------------------------------------------------------
interface ModalEditarItemProps {
  itemInicial: ItemCotizacion | null;
  config: TallerConfig;
  onGuardarItem: (item: ItemCotizacion) => void;
  onClose: () => void;
}

const ModalEditarItem: React.FC<ModalEditarItemProps> = ({
  itemInicial,
  config,
  onGuardarItem,
  onClose,
}) => {
  const [tipo, setTipo] = useState<TipoItemCotizacion>(itemInicial?.tipo || 'mano_obra');
  const [descripcion, setDescripcion] = useState(itemInicial?.descripcion || '');
  const [clasificacion, setClasificacion] = useState<ClasificacionHallazgoCotizacion>(
    itemInicial?.clasificacion || 'General'
  );

  // Mano de obra
  const [codigoManoObra, setCodigoManoObra] = useState(itemInicial?.codigoManoObra || '');
  const [horasManoObra, setHorasManoObra] = useState<number>(itemInicial?.horasManoObra || 1);
  const [tarifaHoraBs, setTarifaHoraBs] = useState<number>(
    itemInicial?.tarifaHoraBs || config.tarifaHoraEstandarBs || 90
  );

  // Repuesto
  const [marcaRepuesto, setMarcaRepuesto] = useState(itemInicial?.marcaRepuesto || '');
  const [calidadRepuesto, setCalidadRepuesto] = useState<CalidadRepuesto>(
    itemInicial?.calidadRepuesto || 'original'
  );
  const [cantidad, setCantidad] = useState<number>(itemInicial?.cantidad || 1);
  const [costoUnitarioBs, setCostoUnitarioBs] = useState<number>(itemInicial?.costoUnitarioBs || 100);
  const [margenPorcentaje, setMargenPorcentaje] = useState<number>(
    itemInicial?.margenPorcentaje || config.margenMinimoPorcentaje || 25
  );

  // Terceros
  const [proveedorTerceros, setProveedorTerceros] = useState(itemInicial?.proveedorTerceros || '');

  // Por definir
  const [precioPorDefinir, setPrecioPorDefinir] = useState<boolean>(
    itemInicial?.precioPorDefinir || false
  );

  // Precio manual o calculado
  const [precioUnitarioManual, setPrecioUnitarioManual] = useState<number>(
    itemInicial?.precioUnitarioCalculadoBs || 0
  );

  // Alternativas comparables (Original vs Alterno)
  const [opciones, setOpciones] = useState<OpcionComparable[]>(itemInicial?.opcionesComparables || []);
  const [mostrarFormOpcion, setMostrarFormOpcion] = useState(false);

  // Campos para nueva opción comparable
  const [nuevaOpTitulo, setNuevaOpTitulo] = useState('');
  const [nuevaOpMarca, setNuevaOpMarca] = useState('');
  const [nuevaOpCalidad, setNuevaOpCalidad] = useState<CalidadRepuesto>('alterno');
  const [nuevaOpPrecioBs, setNuevaOpPrecioBs] = useState<number>(0);
  const [nuevaOpGarantia, setNuevaOpGarantia] = useState('6 meses');

  // Calcular precio unitario y total
  let precioUnitarioCalculado = 0;
  if (tipo === 'mano_obra') {
    precioUnitarioCalculado = tarifaHoraBs;
  } else if (tipo === 'repuesto') {
    precioUnitarioCalculado = Math.round(costoUnitarioBs * (1 + margenPorcentaje / 100));
  } else {
    precioUnitarioCalculado = precioUnitarioManual || Math.round(costoUnitarioBs * 1.3);
  }

  const cantidadFinal = tipo === 'mano_obra' ? horasManoObra : cantidad;
  const precioTotal = precioPorDefinir ? 0 : Math.round(precioUnitarioCalculado * cantidadFinal);
  const alertaMargen = !precioPorDefinir && tipo === 'repuesto' && margenPorcentaje < (config.margenMinimoPorcentaje || 25);

  const handleAgregarOpcion = () => {
    if (!nuevaOpTitulo.trim()) return;
    const nueva: OpcionComparable = {
      id: `op_${Date.now()}`,
      titulo: nuevaOpTitulo.trim(),
      marca: nuevaOpMarca.trim() || 'Genérica',
      calidad: nuevaOpCalidad,
      costoBs: Math.round(nuevaOpPrecioBs * 0.7),
      margenPorcentaje: 30,
      precioBs: Number(nuevaOpPrecioBs) || 0,
      garantia: nuevaOpGarantia.trim() || '6 meses',
    };
    setOpciones((prev) => [...prev, nueva]);
    setNuevaOpTitulo('');
    setNuevaOpMarca('');
    setNuevaOpPrecioBs(0);
    setMostrarFormOpcion(false);
  };

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    const nuevoItem: ItemCotizacion = {
      id: itemInicial?.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tipo,
      descripcion: descripcion.trim(),
      clasificacion,
      origenHallazgoId: itemInicial?.origenHallazgoId || null,

      codigoManoObra: tipo === 'mano_obra' ? codigoManoObra.trim() || null : null,
      horasManoObra: tipo === 'mano_obra' ? horasManoObra : null,
      tarifaHoraBs: tipo === 'mano_obra' ? tarifaHoraBs : null,

      marcaRepuesto: tipo === 'repuesto' ? marcaRepuesto.trim() || null : null,
      calidadRepuesto: tipo === 'repuesto' ? calidadRepuesto : null,
      cantidad: tipo !== 'mano_obra' ? cantidad : undefined,
      costoUnitarioBs: costoUnitarioBs || 0,
      margenPorcentaje: margenPorcentaje || 0,

      proveedorTerceros: tipo === 'terceros' ? proveedorTerceros.trim() || null : null,

      precioPorDefinir,
      precioUnitarioCalculadoBs: precioUnitarioCalculado,
      precioTotalBs: precioTotal,

      opcionesComparables: opciones.length > 0 ? opciones : undefined,
      opcionSeleccionadaId: opciones.length > 0 ? opciones[0].id : null,

      aprobado: itemInicial?.aprobado ?? null,
      alertaMargenBajo: alertaMargen,
    };

    onGuardarItem(nuevoItem);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <span className="font-bold text-sm">
            {itemInicial ? 'Editar Ítem de Cotización' : 'Nuevo Ítem de Cotización'}
          </span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGuardar} className="p-5 space-y-4 text-xs">
          {/* Tipo de Ítem */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 uppercase text-[11px]">
              Tipo de Ítem *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'mano_obra' as const, label: 'Mano de Obra', icon: Wrench },
                { val: 'repuesto' as const, label: 'Repuesto', icon: Package },
                { val: 'terceros' as const, label: 'Servicio Terceros', icon: Truck },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setTipo(t.val)}
                  className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    tipo === t.val
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descripción y Clasificación */}
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Descripción del trabajo o repuesto *
              </label>
              <input
                type="text"
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Cambio de pastillas delanteras / Filtro de aceite original Toyota"
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Clasificación de Prioridad:
              </label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value as ClasificacionHallazgoCotizacion)}
                className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-300 text-slate-900"
              >
                <option value="General">General / Mantenimiento</option>
                <option value="Seguridad (Urgente)">Seguridad (Urgente)</option>
                <option value="Recomendado">Recomendado</option>
                <option value="Puede esperar">Puede esperar</option>
              </select>
            </div>
          </div>

          {/* Checkbox PRECIO POR DEFINIR */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 text-xs">
              <input
                type="checkbox"
                checked={precioPorDefinir}
                onChange={(e) => setPrecioPorDefinir(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <span>Precio "Por definir" (Pendiente de negociación)</span>
            </label>
            <p className="text-[11px] text-amber-800 mt-1 pl-6">
              Marca esta casilla si el repuesto debe cotizarse con proveedores o si el trabajo depende de desmontaje.
            </p>
          </div>

          {/* Campos específicos según el tipo */}
          {!precioPorDefinir && (
            <>
              {tipo === 'mano_obra' && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Código MO (Opcional):
                    </label>
                    <input
                      type="text"
                      value={codigoManoObra}
                      onChange={(e) => setCodigoManoObra(e.target.value)}
                      placeholder="MO-01"
                      className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Horas Estándar:
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={horasManoObra}
                      onChange={(e) => setHorasManoObra(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tarifa/Hora (Bs):
                    </label>
                    <input
                      type="number"
                      step="5"
                      min="10"
                      value={tarifaHoraBs}
                      onChange={(e) => setTarifaHoraBs(parseFloat(e.target.value) || 90)}
                      className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {tipo === 'repuesto' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Marca:
                      </label>
                      <input
                        type="text"
                        value={marcaRepuesto}
                        onChange={(e) => setMarcaRepuesto(e.target.value)}
                        placeholder="Bosch, Denso, etc."
                        className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Calidad:
                      </label>
                      <select
                        value={calidadRepuesto}
                        onChange={(e) => setCalidadRepuesto(e.target.value as CalidadRepuesto)}
                        className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 text-slate-900"
                      >
                        <option value="original">Original OEM</option>
                        <option value="alterno">Alterno Calidad A</option>
                        <option value="usado">Usado Garantizado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={cantidad}
                        onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Costo Unitario (Bs) [Interno]:
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={costoUnitarioBs}
                        onChange={(e) => setCostoUnitarioBs(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Margen % [Interno]:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        step="1"
                        value={margenPorcentaje}
                        onChange={(e) => setMargenPorcentaje(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  {alertaMargen && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 font-medium">
                      ⚠️ Alerta: Margen inferior al mínimo del taller ({config.margenMinimoPorcentaje || 25}%).
                    </div>
                  )}
                </div>
              )}

              {tipo === 'terceros' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Proveedor / Taller Externo:
                    </label>
                    <input
                      type="text"
                      value={proveedorTerceros}
                      onChange={(e) => setProveedorTerceros(e.target.value)}
                      placeholder="Rectificadora, Laboratorio diesel, etc."
                      className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Costo Terceros (Bs):
                    </label>
                    <input
                      type="number"
                      value={costoUnitarioBs}
                      onChange={(e) => setCostoUnitarioBs(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white rounded border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Opciones Comparables (ej. Original vs Alterno) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">
                Alternativas Comparables para el Cliente ({opciones.length})
              </span>
              <button
                type="button"
                onClick={() => setMostrarFormOpcion(!mostrarFormOpcion)}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
              >
                {mostrarFormOpcion ? 'Cancelar' : '+ Agregar Alternativa (ej. Original vs Alterno)'}
              </button>
            </div>

            {mostrarFormOpcion && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Título (ej. Repuesto Original Toyota)"
                    value={nuevaOpTitulo}
                    onChange={(e) => setNuevaOpTitulo(e.target.value)}
                    className="px-2 py-1 bg-white rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    placeholder="Marca (ej. Toyota OEM)"
                    value={nuevaOpMarca}
                    onChange={(e) => setNuevaOpMarca(e.target.value)}
                    className="px-2 py-1 bg-white rounded border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={nuevaOpCalidad}
                    onChange={(e) => setNuevaOpCalidad(e.target.value as CalidadRepuesto)}
                    className="px-2 py-1 bg-white rounded border border-slate-300"
                  >
                    <option value="original">Original</option>
                    <option value="alterno">Alterno</option>
                    <option value="usado">Usado</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Precio Venta Bs"
                    value={nuevaOpPrecioBs || ''}
                    onChange={(e) => setNuevaOpPrecioBs(parseFloat(e.target.value) || 0)}
                    className="px-2 py-1 bg-white rounded border border-slate-300 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Garantía (ej. 12 meses)"
                    value={nuevaOpGarantia}
                    onChange={(e) => setNuevaOpGarantia(e.target.value)}
                    className="px-2 py-1 bg-white rounded border border-slate-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAgregarOpcion}
                  className="px-3 py-1 bg-slate-900 text-white font-bold rounded cursor-pointer"
                >
                  Confirmar Alternativa
                </button>
              </div>
            )}

            {opciones.length > 0 && (
              <div className="space-y-1">
                {opciones.map((op, i) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-[11px]"
                  >
                    <span>
                      <strong>{op.titulo}</strong> ({op.marca}) · {formatearMonedaBs(op.precioBs)} · Garantía: {op.garantia}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpciones((prev) => prev.filter((o) => o.id !== op.id))}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen del Precio Resultante */}
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-amber-400">Precio Final Ítem:</span>
            <span className="font-mono text-base font-bold text-amber-400">
              {precioPorDefinir ? 'Por definir' : formatearMonedaBs(precioTotal)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow cursor-pointer"
            >
              Guardar Ítem
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUBCOMPONENTE: Selector de Plantilla de Servicio Frecuente
// ---------------------------------------------------------------------------
interface ModalSelectorPlantillaProps {
  config: TallerConfig;
  onSeleccionar: (plantilla: PlantillaCotizacion) => void;
  onClose: () => void;
}

const ModalSelectorPlantilla: React.FC<ModalSelectorPlantillaProps> = ({
  config,
  onSeleccionar,
  onClose,
}) => {
  // Plantillas por defecto si no hay en configuración
  const plantillasBase: PlantillaCotizacion[] = config.plantillasCotizacion || [
    {
      id: 'pl_10k',
      nombre: 'Mantenimiento Preventivo 10.000 km',
      descripcion: 'Cambio de aceite, filtro de motor, rotación y revisión de 25 puntos.',
      activo: true,
      items: [
        {
          tipo: 'mano_obra',
          descripcion: 'Mano de obra servicio 10.000 km y revisión general',
          clasificacion: 'Recomendado',
          horasManoObra: 1.5,
          tarifaHoraBs: 90,
          costoUnitarioBs: 60,
          margenPorcentaje: 50,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 90,
          precioTotalBs: 135,
        },
        {
          tipo: 'repuesto',
          descripcion: 'Aceite de motor sintético 5W-30 (4 Litros)',
          clasificacion: 'Recomendado',
          marcaRepuesto: 'Mobil 1',
          calidadRepuesto: 'original',
          cantidad: 1,
          costoUnitarioBs: 220,
          margenPorcentaje: 35,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 297,
          precioTotalBs: 297,
        },
        {
          tipo: 'repuesto',
          descripcion: 'Filtro de aceite original OEM',
          clasificacion: 'Recomendado',
          marcaRepuesto: 'Original OEM',
          calidadRepuesto: 'original',
          cantidad: 1,
          costoUnitarioBs: 45,
          margenPorcentaje: 40,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 63,
          precioTotalBs: 63,
        },
      ],
    },
    {
      id: 'pl_frenos',
      nombre: 'Cambio de Pastillas de Freno y Rectificado de Discos',
      descripcion: 'Juego de pastillas delanteras, rectificado en torno y purga de líquido.',
      activo: true,
      items: [
        {
          tipo: 'mano_obra',
          descripcion: 'Desmontaje, rectificado y purga de sistema de frenos',
          clasificacion: 'Seguridad (Urgente)',
          horasManoObra: 2,
          tarifaHoraBs: 90,
          costoUnitarioBs: 80,
          margenPorcentaje: 50,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 90,
          precioTotalBs: 180,
        },
        {
          tipo: 'repuesto',
          descripcion: 'Juego de pastillas de freno delanteras cerámicas',
          clasificacion: 'Seguridad (Urgente)',
          marcaRepuesto: 'Bosch / Akebono',
          calidadRepuesto: 'original',
          cantidad: 1,
          costoUnitarioBs: 210,
          margenPorcentaje: 35,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 284,
          precioTotalBs: 284,
        },
        {
          tipo: 'terceros',
          descripcion: 'Rectificado de discos en torno especializado',
          clasificacion: 'Seguridad (Urgente)',
          proveedorTerceros: 'Torno Mecánico Industrial',
          costoUnitarioBs: 80,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 120,
          precioTotalBs: 120,
        },
      ],
    },
    {
      id: 'pl_suspension',
      nombre: 'Alineación, Balanceo y Calibración',
      descripcion: 'Alineación computarizada 3D, balanceo de 4 ruedas y calibración.',
      activo: true,
      items: [
        {
          tipo: 'mano_obra',
          descripcion: 'Alineación 3D computarizada y calibración de tren delantero',
          clasificacion: 'Recomendado',
          horasManoObra: 1,
          tarifaHoraBs: 120,
          costoUnitarioBs: 40,
          margenPorcentaje: 60,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 120,
          precioTotalBs: 120,
        },
        {
          tipo: 'mano_obra',
          descripcion: 'Balanceo dinámico computarizado (4 ruedas)',
          clasificacion: 'Recomendado',
          horasManoObra: 0.75,
          tarifaHoraBs: 80,
          costoUnitarioBs: 20,
          margenPorcentaje: 60,
          precioPorDefinir: false,
          precioUnitarioCalculadoBs: 80,
          precioTotalBs: 60,
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <span className="font-bold text-sm">Seleccionar Plantilla de Servicio Frecuente</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs max-h-96 overflow-y-auto">
          {plantillasBase.map((pl) => (
            <div
              key={pl.id}
              onClick={() => onSeleccionar(pl)}
              className="p-3 bg-slate-50 hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 rounded-xl transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="text-xs">{pl.nombre}</span>
                <span className="text-[11px] font-mono text-amber-700">
                  {pl.items.length} ítems
                </span>
              </div>
              {pl.descripcion && (
                <p className="text-[11px] text-slate-500 leading-snug">{pl.descripcion}</p>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
