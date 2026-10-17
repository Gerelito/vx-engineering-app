import React, { useState } from 'react';
import {
  OrdenServicio,
  Cliente,
  Vehiculo,
  EstadoOrden,
  PrioridadOrden,
  TallerConfig,
} from '../../types';
import {
  Search,
  Plus,
  ClipboardList,
  Car,
  User,
  Clock,
  Gauge,
  Fuel,
  Camera,
  FileCheck,
  AlertTriangle,
  Printer,
  MessageSquare,
  Eye,
  CheckCircle2,
  RefreshCw,
  Phone,
  Tag,
  ArrowRight,
  Filter,
  FileText,
} from 'lucide-react';
import { formatearTelefonoBolivia, obtenerTelefonoE164, formatearFecha } from '../../lib/storage';

interface OrdenesListProps {
  ordenes: OrdenServicio[];
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  config: TallerConfig;
  onNuevaRecepcion: () => void;
  onVerDetalle: (orden: OrdenServicio) => void;
  onAbrirImprimir: (orden: OrdenServicio) => void;
  onAbrirSubirFirma: (orden: OrdenServicio) => void;
  onCambiarEstado: (orden: OrdenServicio, nuevoEstado: EstadoOrden) => void;
  onAbrirCotizacion?: (orden: OrdenServicio) => void;
  onSincronizarFolios?: () => void;
  sincronizandoFolios?: boolean;
}

const ESTADOS_ORDEN: { id: EstadoOrden | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'Recibido', label: 'Recibido' },
  { id: 'En diagnóstico', label: 'En diagnóstico' },
  { id: 'Esperando repuestos', label: 'Esperando repuestos' },
  { id: 'En reparación', label: 'En reparación' },
  { id: 'Control de calidad', label: 'Control de calidad' },
  { id: 'Listo para entrega', label: 'Listo para entrega' },
  { id: 'Entregado', label: 'Entregado' },
  { id: 'Cancelada', label: 'Cancelada' },
];

export const OrdenesList: React.FC<OrdenesListProps> = ({
  ordenes,
  clientes,
  vehiculos,
  config,
  onNuevaRecepcion,
  onVerDetalle,
  onAbrirImprimir,
  onAbrirSubirFirma,
  onCambiarEstado,
  onAbrirCotizacion,
  onSincronizarFolios,
  sincronizandoFolios = false,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrden | 'todos'>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<'todas' | PrioridadOrden>('todas');
  const [filtroFirma, setFiltroFirma] = useState<'todas' | 'firmadas' | 'pendientes'>('todas');

  // Conteo de métricas rápidas
  const totalActivas = ordenes.filter(
    (o) => o.estado !== 'Entregado' && o.estado !== 'Cancelada'
  ).length;
  const enRecepcion = ordenes.filter((o) => o.estado === 'Recibido').length;
  const conFirmaPendiente = ordenes.filter((o) => !o.firmaSubida && o.estado !== 'Cancelada').length;
  const urgentes = ordenes.filter(
    (o) => o.prioridad === 'Urgente' && o.estado !== 'Entregado' && o.estado !== 'Cancelada'
  ).length;
  const foliosPendientes = ordenes.filter((o) => o.sincronizacionFolio === 'pendiente').length;

  // Filtrado de órdenes
  const ordenesFiltradas = ordenes.filter((o) => {
    // Filtro estado
    if (filtroEstado !== 'todos' && o.estado !== filtroEstado) {
      return false;
    }

    // Filtro prioridad
    if (filtroPrioridad !== 'todas' && o.prioridad !== filtroPrioridad) {
      return false;
    }

    // Filtro firma
    if (filtroFirma === 'firmadas' && !o.firmaSubida) return false;
    if (filtroFirma === 'pendientes' && o.firmaSubida) return false;

    // Búsqueda de texto
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();

    const coincideFolio = o.folio.toLowerCase().includes(q);
    const coincidePlaca = o.vehiculoPlaca.toLowerCase().includes(q);
    const coincideCliente = o.clienteNombre.toLowerCase().includes(q);
    const coincideTel = (o.clienteTelefono || '').includes(q) || (o.clienteTelefonoE164 || '').includes(q);
    const coincideVehiculo =
      o.vehiculoMarca.toLowerCase().includes(q) || o.vehiculoModelo.toLowerCase().includes(q);
    const coincideMotivo = (o.motivoCliente || '').toLowerCase().includes(q);

    return (
      coincideFolio ||
      coincidePlaca ||
      coincideCliente ||
      coincideTel ||
      coincideVehiculo ||
      coincideMotivo
    );
  });

  const getEstadoBadgeClass = (estado: EstadoOrden) => {
    switch (estado) {
      case 'Recibido':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'En diagnóstico':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'Esperando repuestos':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'En reparación':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'Control de calidad':
        return 'bg-cyan-100 text-cyan-900 border-cyan-200';
      case 'Listo para entrega':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'Entregado':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Cancelada':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado con Botón de Acción Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-slate-800" />
            <span>Recepción y Órdenes de Servicio</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingreso de vehículos con fotos, daños marcados y hoja para firma del cliente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {foliosPendientes > 0 && onSincronizarFolios && (
            <button
              onClick={onSincronizarFolios}
              disabled={sincronizandoFolios || !navigator.onLine}
              className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Asignar folio correlativo oficial a órdenes provisionales"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoFolios ? 'animate-spin' : ''}`} />
              <span>Sincronizar Folios ({foliosPendientes})</span>
            </button>
          )}

          <button
            onClick={onNuevaRecepcion}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Nueva Recepción (Ingreso)</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Órdenes Activas
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {totalActivas}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Vehículos en proceso de taller
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Recién Ingresados
          </span>
          <span className="text-2xl font-bold font-mono text-blue-700 mt-1 block">
            {enRecepcion}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Pendientes de diagnóstico
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Firma Física Pendiente
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                conFirmaPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {conFirmaPendiente}
            </span>
            {conFirmaPendiente > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                Por subir foto
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Hoja firmada por el cliente
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Atención Urgente
          </span>
          <span
            className={`text-2xl font-bold font-mono mt-1 block ${
              urgentes > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {urgentes}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Prioridad alta en taller
          </span>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Barra superior: Buscador + Filtros rápidos */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por folio (OS-000001), placa, cliente, teléfono o motivo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Filtros desplegables */}
          <div className="flex items-center gap-2">
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="todas">Prioridad: Todas</option>
              <option value="Normal">Normal</option>
              <option value="Urgente">Urgente</option>
            </select>

            <select
              value={filtroFirma}
              onChange={(e) => setFiltroFirma(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="todas">Firma: Todas</option>
              <option value="firmadas">Firma Subida</option>
              <option value="pendientes">Firma Pendiente</option>
            </select>
          </div>
        </div>

        {/* Pestañas de Estados */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-1 border-t border-slate-100">
          {ESTADOS_ORDEN.map((est) => {
            const count =
              est.id === 'todos'
                ? ordenes.length
                : ordenes.filter((o) => o.estado === est.id).length;

            return (
              <button
                key={est.id}
                onClick={() => setFiltroEstado(est.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                  filtroEstado === est.id
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{est.label}</span>
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                    filtroEstado === est.id
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Lista de Órdenes */}
      {ordenesFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {busqueda || filtroEstado !== 'todos' || filtroPrioridad !== 'todas' || filtroFirma !== 'todas'
              ? 'No se encontraron órdenes con esos criterios'
              : 'No hay órdenes de servicio registradas'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {busqueda || filtroEstado !== 'todos'
              ? 'Prueba modificando los filtros o el texto de búsqueda.'
              : 'Inicia el flujo de recepción para registrar el ingreso de un vehículo, documentar daños e imprimir la hoja de recepción.'}
          </p>
          {!busqueda && filtroEstado === 'todos' && (
            <button
              onClick={onNuevaRecepcion}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Crear Primera Recepción</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {ordenesFiltradas.map((orden) => {
            const telFormateado = formatearTelefonoBolivia(orden.clienteTelefono);
            const telE164 = orden.clienteTelefonoE164 || obtenerTelefonoE164(orden.clienteTelefono);
            const waNumber = telE164.replace(/\+/g, '');

            const textoWhatsapp = `Hola ${orden.clienteNombre}, nos comunicamos desde ${config.nombre}. Le confirmamos la recepción de su vehículo ${orden.vehiculoMarca} ${orden.vehiculoModelo} (Placa ${orden.vehiculoPlaca}) bajo la orden ${orden.folio}. Fecha estimada de entrega: ${orden.fechaPrometidaEntrega}.`;

            return (
              <div
                key={orden.id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors shadow-xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Bloque Izquierdo: Datos Principales */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Fila 1: Folio, Prioridad, Estado, Fecha */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Folio */}
                      <span
                        className={`font-mono text-xs font-extrabold px-2.5 py-0.5 rounded border ${
                          orden.sincronizacionFolio === 'confirmado'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                        title={
                          orden.sincronizacionFolio === 'confirmado'
                            ? 'Folio oficial registrado en el servidor'
                            : 'Folio provisional generado offline, pendiente de asignar correlativo'
                        }
                      >
                        {orden.folio}
                      </span>

                      {/* Prioridad */}
                      {orden.prioridad === 'Urgente' && (
                        <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                          Urgente
                        </span>
                      )}

                      {/* Estado */}
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${getEstadoBadgeClass(
                          orden.estado
                        )}`}
                      >
                        {orden.estado}
                      </span>

                      {/* Tipo de Servicio */}
                      <span className="text-[11px] font-medium text-slate-500">
                        · Servicio {orden.tipoServicio}
                      </span>

                      {/* Fecha de Creación */}
                      <span className="text-[11px] text-slate-400">
                        · Ingreso: {formatearFecha(orden.createdAt)}
                      </span>
                    </div>

                    {/* Fila 2: Placa, Vehículo y Cliente */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-mono font-black text-slate-900 text-sm tracking-wider">
                        <Car className="w-3.5 h-3.5 text-slate-500" />
                        <span>{orden.vehiculoPlaca}</span>
                      </div>

                      <span className="text-sm font-bold text-slate-900">
                        {orden.vehiculoMarca} {orden.vehiculoModelo}
                        {orden.vehiculoAnio && ` (${orden.vehiculoAnio})`}
                        {orden.vehiculoColor && ` · ${orden.vehiculoColor}`}
                      </span>

                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{orden.clienteNombre}</span>
                        <span className="font-mono text-slate-600">({telFormateado})</span>
                      </span>
                    </div>

                    {/* Fila 3: Kilometraje, Combustible, Fecha Prometida */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1 font-mono">
                        <Gauge className="w-3.5 h-3.5 text-slate-400" />
                        <span>{orden.kilometraje.toLocaleString()} km</span>
                      </div>

                      <div className="flex items-center gap-1 font-mono">
                        <Fuel className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanque: {orden.nivelCombustible}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Promesa: <strong className="text-slate-800">{orden.fechaPrometidaEntrega}</strong></span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-500">
                        <Camera className="w-3.5 h-3.5 text-slate-400" />
                        <span>{orden.totalFotos || 6} fotos</span>
                      </div>

                      {orden.daniosCarroceria && orden.daniosCarroceria.length > 0 && (
                        <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{orden.daniosCarroceria.length} daños marcados</span>
                        </div>
                      )}
                    </div>

                    {/* Fila 4: Motivo textual del cliente */}
                    {orden.motivoCliente && (
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-2">
                        <span className="font-bold text-slate-900">Motivo:</span> "{orden.motivoCliente}"
                      </p>
                    )}

                    {/* Estado de la Firma Física */}
                    <div className="flex items-center gap-2 pt-1">
                      {orden.firmaSubida ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Hoja firmada físicamente por cliente (Registrada)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAbrirSubirFirma(orden)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors cursor-pointer"
                          title="Hacer clic para subir fotografía de la hoja de recepción firmada"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pendiente de firma física (Subir foto aquí)</span>
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Bloque Derecho: Acciones de la Orden */}
                  <div className="flex flex-row flex-wrap lg:flex-nowrap lg:flex-col items-center lg:items-end justify-start gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Botón Ver Detalle */}
                    <button
                      onClick={() => onVerDetalle(orden)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ver Ficha</span>
                    </button>

                    {/* Botón Imprimir Hoja de Recepción */}
                    <button
                      onClick={() => onAbrirImprimir(orden)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                      title="Imprimir hoja para firma física del cliente"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-700" />
                      <span>Hoja Firma</span>
                    </button>

                    {/* Botón Cotización (Módulo 4) */}
                    {onAbrirCotizacion && (
                      <button
                        onClick={() => onAbrirCotizacion(orden)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                        title="Ver o editar cotizaciones y presupuestos de la orden"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>Cotización</span>
                      </button>
                    )}

                    {/* Botón WhatsApp */}
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(textoWhatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                        title="Enviar confirmación de recepción por WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* Selector Rápido de Estado */}
                    <div className="relative">
                      <select
                        value={orden.estado}
                        onChange={(e) => onCambiarEstado(orden, e.target.value as EstadoOrden)}
                        className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-700 font-medium cursor-pointer focus:ring-1 focus:ring-slate-900"
                        title="Avanzar estado del vehículo en taller"
                      >
                        {ESTADOS_ORDEN.filter((e) => e.id !== 'todos').map((e) => (
                          <option key={e.id} value={e.id}>
                            Estado: {e.label}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
