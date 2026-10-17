import React, { useState } from 'react';
import {
  OrdenServicio,
  EstadoOrden,
  TallerConfig,
  Cliente,
  Vehiculo,
} from '../../types';
import {
  TODOS_LOS_ESTADOS_ORDEN,
  ESTILOS_ESTADO,
  calcularAlertaTiempoEstado,
  obtenerSiguientesEstadosPermitidos,
} from '../../lib/estadosTaller';
import { formatearTelefonoBolivia, obtenerTelefonoE164 } from '../../lib/storage';
import {
  Wrench,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  Play,
  Stethoscope,
  Timer,
  Car,
  User,
  MapPin,
  ArrowRight,
  Share2,
  CheckCircle2,
  Plus,
  Eye,
  Calendar,
  FileText,
} from 'lucide-react';

interface TableroKanbanProps {
  ordenes: OrdenServicio[];
  config: TallerConfig;
  onAbrirTransicionEstado: (orden: OrdenServicio, nuevoEstado?: EstadoOrden) => void;
  onAbrirDiagnostico: (orden: OrdenServicio) => void;
  onAbrirTareas: (orden: OrdenServicio) => void;
  onAbrirTrabajoAdicional?: (orden: OrdenServicio) => void;
  onAbrirDetalle: (orden: OrdenServicio) => void;
  onAbrirCotizacion?: (orden: OrdenServicio) => void;
  onAbrirAprobacion?: (orden: OrdenServicio) => void;
  onNuevaRecepcion: () => void;
  onAsignarBahiaYResponsable: (
    orden: OrdenServicio,
    bahia: string | null,
    mecanico: string | null
  ) => Promise<void>;
}

// Estados del flujo activo de taller para las columnas principales del Kanban
const COLUMNAS_KANBAN: { estado: EstadoOrden; titulo: string }[] = [
  { estado: 'Recibido', titulo: '1. Recibido' },
  { estado: 'En diagnóstico', titulo: '2. En Diagnóstico' },
  { estado: 'Esperando aprobación', titulo: '3. Esp. Aprobación' },
  { estado: 'Esperando repuestos', titulo: '4. Esp. Repuestos' },
  { estado: 'En reparación', titulo: '5. En Reparación' },
  { estado: 'Control de calidad', titulo: '6. Control de Calidad' },
  { estado: 'Listo para entrega', titulo: '7. Listo Entrega' },
];

export const TableroKanban: React.FC<TableroKanbanProps> = ({
  ordenes,
  config,
  onAbrirTransicionEstado,
  onAbrirDiagnostico,
  onAbrirTareas,
  onAbrirTrabajoAdicional,
  onAbrirDetalle,
  onAbrirCotizacion,
  onAbrirAprobacion,
  onNuevaRecepcion,
  onAsignarBahiaYResponsable,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroBahia, setFiltroBahia] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<'Todas' | 'Solo Urgentes'>('Todas');
  const [filtroPendientesAprobacion, setFiltroPendientesAprobacion] = useState(false);
  const [mostrarFinalizadas, setMostrarFinalizadas] = useState(false);

  // Filtrado de órdenes
  const ordenesFiltradas = ordenes.filter((ord) => {
    // Filtro rápido para lista "Pendientes de Aprobación"
    if (filtroPendientesAprobacion && ord.estado !== 'Esperando aprobación') {
      return false;
    }

    // Filtro por búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      const matchFolio = ord.folio.toLowerCase().includes(q);
      const matchPlaca = ord.vehiculoPlaca.toLowerCase().includes(q);
      const matchCliente = ord.clienteNombre.toLowerCase().includes(q);
      const matchModelo = `${ord.vehiculoMarca} ${ord.vehiculoModelo}`.toLowerCase().includes(q);
      if (!matchFolio && !matchPlaca && !matchCliente && !matchModelo) {
        return false;
      }
    }

    // Filtro por bahía
    if (filtroBahia && ord.bahiaAsignada !== filtroBahia) {
      return false;
    }

    // Filtro por responsable
    if (filtroResponsable && ord.mecanicoResponsable !== filtroResponsable) {
      return false;
    }

    // Filtro por prioridad
    if (filtroPrioridad === 'Solo Urgentes' && ord.prioridad !== 'Urgente') {
      return false;
    }

    return true;
  });

  // Agrupar órdenes por estado
  const ordenesPorEstado: Record<EstadoOrden, OrdenServicio[]> = {
    'Recibido': [],
    'En diagnóstico': [],
    'Esperando aprobación': [],
    'Esperando repuestos': [],
    'En reparación': [],
    'Control de calidad': [],
    'Listo para entrega': [],
    'Entregado': [],
    'Cancelada': [],
  };

  ordenesFiltradas.forEach((ord) => {
    if (ordenesPorEstado[ord.estado]) {
      ordenesPorEstado[ord.estado].push(ord);
    }
  });

  // Contador de alertas rojas en vivo
  const totalAlertasRojas = ordenesFiltradas.filter(
    (o) => calcularAlertaTiempoEstado(o, config).tieneAlerta
  ).length;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Estadísticas de Taller */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Título & Alertas */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Tablero Kanban de Taller
                </h2>
                {totalAlertasRojas > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{totalAlertasRojas} Alerta(s) de Tiempo</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Flujo visual por estados · Alertas automáticas en rojo · Asignación de bahías
              </p>
            </div>
          </div>

          {/* Acciones principales */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNuevaRecepcion}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>+ Nueva Recepción</span>
            </button>
          </div>
        </div>

        {/* Fila de Controles de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar placa, folio o cliente..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Filtro por Bahía */}
          <div>
            <select
              value={filtroBahia}
              onChange={(e) => setFiltroBahia(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white font-medium"
            >
              <option value="">-- Todas las Bahías ({config.bahiasDisponibles.length}) --</option>
              {config.bahiasDisponibles.map((bahia) => (
                <option key={bahia} value={bahia}>
                  {bahia}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Responsable */}
          <div>
            <select
              value={filtroResponsable}
              onChange={(e) => setFiltroResponsable(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white font-medium"
            >
              <option value="">-- Todos los Responsables ({config.mecanicosResponsables.length}) --</option>
              {config.mecanicosResponsables.map((mec) => (
                <option key={mec} value={mec}>
                  {mec}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Prioridad y Toggle de Finalizadas */}
          <div className="flex items-center gap-2">
            <select
              value={filtroPrioridad}
              onChange={(e: any) => setFiltroPrioridad(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white font-medium"
            >
              <option value="Todas">Todas las Prioridades</option>
              <option value="Solo Urgentes">Solo Urgentes 🚨</option>
            </select>

            <button
              type="button"
              onClick={() => setFiltroPendientesAprobacion((v) => !v)}
              className={`px-3 py-2 rounded-lg font-bold whitespace-nowrap border cursor-pointer transition-colors flex items-center gap-1.5 ${
                filtroPendientesAprobacion
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="Filtrar órdenes pendientes de aprobación del cliente"
            >
              <span>⏳ Esperando Aprobación</span>
              {ordenesPorEstado['Esperando aprobación']?.length > 0 && (
                <span className="bg-slate-900 text-amber-400 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black">
                  {ordenesPorEstado['Esperando aprobación'].length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMostrarFinalizadas((v) => !v)}
              className={`px-3 py-2 rounded-lg font-bold whitespace-nowrap border cursor-pointer transition-colors ${
                mostrarFinalizadas
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Ver órdenes entregadas o canceladas"
            >
              {mostrarFinalizadas ? 'Ocultar Cierre' : 'Cierre'}
            </button>
          </div>
        </div>
      </div>

      {/* Tablero Kanban con Columnas Desplazables Horizontalmente */}
      <div className="overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex items-start gap-3.5 min-w-[1280px]">
          {COLUMNAS_KANBAN.map((col) => {
            const estilo = ESTILOS_ESTADO[col.estado];
            const ordenesCol = ordenesPorEstado[col.estado] || [];

            return (
              <div
                key={col.estado}
                className="w-72 shrink-0 bg-slate-100/90 rounded-2xl border border-slate-200 flex flex-col max-h-[80vh] shadow-2xs"
              >
                {/* Encabezado de la Columna */}
                <div
                  className={`p-3 rounded-t-2xl border-b ${estilo.bg} ${estilo.border} flex items-center justify-between shrink-0`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${estilo.dot}`} />
                    <span className={`text-xs font-bold ${estilo.text}`}>{col.titulo}</span>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-mono font-bold flex items-center justify-center ${
                      ordenesCol.length > 0
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {ordenesCol.length}
                  </span>
                </div>

                {/* Lista de Tarjetas en la Columna */}
                <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-32">
                  {ordenesCol.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic">
                      Sin órdenes en este estado
                    </div>
                  ) : (
                    ordenesCol.map((ord) => {
                      const alerta = calcularAlertaTiempoEstado(ord, config);
                      const telVisual = formatearTelefonoBolivia(ord.clienteTelefono);
                      const telE164 = ord.clienteTelefonoE164 || obtenerTelefonoE164(ord.clienteTelefono);
                      const waNumber = telE164.replace(/\+/g, '');
                      const siguientesEstados = obtenerSiguientesEstadosPermitidos(ord.estado);

                      // Conteo de tareas
                      const totalTareas = ord.tareas?.length || 0;
                      const tareasEnCurso = (ord.tareas || []).filter((t) => t.estado === 'En curso').length;

                      return (
                        <div
                          key={ord.id}
                          className={`bg-white rounded-xl p-3 border transition-all shadow-xs space-y-2.5 ${
                            alerta.tieneAlerta
                              ? 'border-rose-400 ring-2 ring-rose-500/30'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Fila Superior: Folio + Prioridad */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {ord.folio}
                            </span>

                            {ord.prioridad === 'Urgente' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse flex items-center gap-1">
                                <span>🚨 Urgente</span>
                              </span>
                            )}
                          </div>

                          {/* Vehículo y Placa */}
                          <div>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                                {ord.vehiculoPlaca}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate">
                                {ord.vehiculoMarca} {ord.vehiculoModelo}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-600 block truncate">
                              Cliente: <strong>{ord.clienteNombre}</strong>
                            </span>
                          </div>

                          {/* Asignación de Bahía y Mecánico */}
                          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                Bahía:
                              </span>
                              <select
                                value={ord.bahiaAsignada || ''}
                                onChange={(e) =>
                                  onAsignarBahiaYResponsable(
                                    ord,
                                    e.target.value || null,
                                    ord.mecanicoResponsable || null
                                  )
                                }
                                className="bg-white text-slate-800 text-[11px] font-semibold rounded border border-slate-200 px-1 py-0.5 max-w-[130px] truncate"
                              >
                                <option value="">Sin asignar</option>
                                {config.bahiasDisponibles.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" />
                                Resp:
                              </span>
                              <select
                                value={ord.mecanicoResponsable || ''}
                                onChange={(e) =>
                                  onAsignarBahiaYResponsable(
                                    ord,
                                    ord.bahiaAsignada || null,
                                    e.target.value || null
                                  )
                                }
                                className="bg-white text-slate-800 text-[11px] font-semibold rounded border border-slate-200 px-1 py-0.5 max-w-[130px] truncate"
                              >
                                <option value="">Sin asignar</option>
                                {config.mecanicosResponsables.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Indicador de Tiempo Transcurrido en este Estado */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              En estado:
                            </span>
                            <span className="font-mono font-bold text-slate-700">
                              {alerta.tiempoTranscurridoTexto}
                            </span>
                          </div>

                          {/* ALERTA EN ROJO SI EL TIEMPO EXCEDE EL LÍMITE (Requisito C) */}
                          {alerta.tieneAlerta && (
                            <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg text-[10px] text-rose-900 font-bold flex items-start gap-1.5 animate-in fade-in">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <span>{alerta.mensajeAlerta}</span>
                            </div>
                          )}

                          {/* Recordatorio Visual de Horas en "Esperando Aprobación" (Marcas 4h, 24h, 48h) */}
                          {(() => {
                            if (ord.estado !== 'Esperando aprobación') return null;
                            const entrada = ord.historialEstados
                              ?.slice()
                              .reverse()
                              .find((h) => h.estado === 'Esperando aprobación');
                            const fechaEntrada = entrada?.fecha || ord.fechaIngresoEstadoActual || ord.createdAt;
                            if (!fechaEntrada) return null;
                            const ms = Date.now() - new Date(fechaEntrada).getTime();
                            const horas = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));

                            const esCritico = horas >= 48;
                            const esMedio = horas >= 24 && horas < 48;
                            const esLeve = horas >= 4 && horas < 24;

                            return (
                              <div
                                className={`p-2 rounded-lg text-[10px] font-bold border flex items-center justify-between gap-1.5 ${
                                  esCritico
                                    ? 'bg-rose-100 text-rose-950 border-rose-300 animate-pulse'
                                    : esMedio
                                    ? 'bg-orange-100 text-orange-950 border-orange-300'
                                    : esLeve
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {esCritico
                                      ? `Recordatorio Crítico (+48h): ${horas}h esperando`
                                      : esMedio
                                      ? `Recordatorio Medio (+24h): ${horas}h esperando`
                                      : esLeve
                                      ? `Recordatorio (+4h): ${horas}h esperando`
                                      : `${horas}h esperando respuesta`}
                                  </span>
                                </div>
                                <span className="font-mono text-[9px] uppercase px-1 rounded bg-white/80">
                                  {esCritico ? '48h+' : esMedio ? '24h+' : esLeve ? '4h+' : '<4h'}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Fecha estimada de repuestos si está en ese estado */}
                          {ord.estado === 'Esperando repuestos' && ord.fechaEstimadaLlegadaRepuestos && (
                            <div className="p-1.5 bg-purple-50 border border-purple-200 rounded text-[10px] text-purple-900 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-purple-600" />
                              <span>Llegada repuestos: {ord.fechaEstimadaLlegadaRepuestos}</span>
                            </div>
                          )}

                          {/* Badges de Operación de Taller: Diagnóstico, Tareas, Cotización */}
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[11px] flex-wrap">
                            {/* Diagnóstico */}
                            <button
                              type="button"
                              onClick={() => onAbrirDiagnostico(ord)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                ord.diagnosticoTecnico?.completado
                                  ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title="Diagnóstico técnico multipunto y escáner"
                            >
                              <Stethoscope className="w-3 h-3 text-blue-600" />
                              <span>
                                {ord.diagnosticoTecnico?.completado ? 'Diag. OK' : 'Diagnóstico'}
                              </span>
                            </button>

                            {/* Tareas / Cronómetro */}
                            <button
                              type="button"
                              onClick={() => onAbrirTareas(ord)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                tareasEnCurso > 0
                                  ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-400 font-bold'
                                  : totalTareas > 0
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                              }`}
                              title="Tareas con cronómetro en taller"
                            >
                              <Timer
                                className={`w-3 h-3 ${
                                  tareasEnCurso > 0 ? 'text-amber-600 animate-spin' : 'text-slate-500'
                                }`}
                              />
                              <span>
                                {totalTareas > 0
                                  ? `${totalTareas} trab.${tareasEnCurso > 0 ? ' (Activo)' : ''}`
                                  : '+ Tareas'}
                              </span>
                            </button>

                            {/* Cotización (Módulo 4) */}
                            {onAbrirCotizacion && (
                              <button
                                type="button"
                                onClick={() => onAbrirCotizacion(ord)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                                title="Editar o ver cotizaciones"
                              >
                                <FileText className="w-3 h-3 text-amber-700" />
                                <span>Cotización</span>
                              </button>
                            )}

                            {/* Botón directo de Aprobar si está en Esperando Aprobación */}
                            {onAbrirAprobacion && ord.estado === 'Esperando aprobación' && (
                              <button
                                type="button"
                                onClick={() => onAbrirAprobacion(ord)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-2xs"
                                title="Registrar aprobación de la cotización"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Aprobar</span>
                              </button>
                            )}

                            {/* Hallazgo Adicional (Módulo 3) */}
                            {onAbrirTrabajoAdicional &&
                              (ord.estado === 'En reparación' ||
                                (ord.hallazgosAdicionales && ord.hallazgosAdicionales.length > 0)) && (
                                <button
                                  type="button"
                                  onClick={() => onAbrirTrabajoAdicional(ord)}
                                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                    (ord.hallazgosAdicionales?.length || 0) > 0
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                  }`}
                                  title="Registrar hallazgo adicional o trabajo complementario"
                                >
                                  <Plus className="w-3 h-3 text-purple-700" />
                                  <span>
                                    {(ord.hallazgosAdicionales?.length || 0) > 0
                                      ? `${ord.hallazgosAdicionales?.length} Adic.`
                                      : '+ Adic.'}
                                  </span>
                                </button>
                              )}
                          </div>

                          {/* Botones de Cambio de Estado Permitido (Tabla única) */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => onAbrirDetalle(ord)}
                              className="text-[11px] text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-100"
                              title="Ver ficha completa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {siguientesEstados.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => onAbrirTransicionEstado(ord)}
                                className="flex-1 py-1 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>Avanzar Estado</span>
                                <ArrowRight className="w-3 h-3 text-amber-400" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Estado Final
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Columnas Adicionales si se activa "Mostrar Finalizadas" (Entregado / Cancelada) */}
          {mostrarFinalizadas && (
            <>
              {/* Entregado */}
              <div className="w-72 shrink-0 bg-teal-50/60 rounded-2xl border border-teal-200 flex flex-col max-h-[80vh] shadow-2xs">
                <div className="p-3 bg-teal-100/70 border-b border-teal-200 rounded-t-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">8. Entregado</span>
                  <span className="w-5 h-5 rounded-full text-[11px] font-mono font-bold bg-teal-700 text-white flex items-center justify-center">
                    {ordenesPorEstado['Entregado'].length}
                  </span>
                </div>
                <div className="p-2.5 flex-1 overflow-y-auto space-y-2">
                  {ordenesPorEstado['Entregado'].map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => onAbrirDetalle(ord)}
                      className="p-2.5 bg-white rounded-xl border border-teal-200 text-xs cursor-pointer hover:border-teal-400 space-y-1"
                    >
                      <div className="flex justify-between font-mono font-bold text-slate-900">
                        <span>{ord.folio}</span>
                        <span>{ord.vehiculoPlaca}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{ord.clienteNombre}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cancelada */}
              <div className="w-72 shrink-0 bg-rose-50/60 rounded-2xl border border-rose-200 flex flex-col max-h-[80vh] shadow-2xs">
                <div className="p-3 bg-rose-100/70 border-b border-rose-200 rounded-t-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900">9. Cancelada</span>
                  <span className="w-5 h-5 rounded-full text-[11px] font-mono font-bold bg-rose-700 text-white flex items-center justify-center">
                    {ordenesPorEstado['Cancelada'].length}
                  </span>
                </div>
                <div className="p-2.5 flex-1 overflow-y-auto space-y-2">
                  {ordenesPorEstado['Cancelada'].map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => onAbrirDetalle(ord)}
                      className="p-2.5 bg-white rounded-xl border border-rose-200 text-xs cursor-pointer hover:border-rose-400 space-y-1"
                    >
                      <div className="flex justify-between font-mono font-bold text-slate-900">
                        <span>{ord.folio}</span>
                        <span>{ord.vehiculoPlaca}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{ord.clienteNombre}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
