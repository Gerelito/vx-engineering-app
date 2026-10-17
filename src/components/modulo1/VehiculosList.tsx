import React, { useState } from 'react';
import { Vehiculo, Cliente } from '../../types';
import { formatearTelefonoBolivia } from '../../lib/storage';
import {
  Search,
  Car,
  User,
  ArrowRightLeft,
  Edit2,
  Trash2,
  XCircle,
  History,
} from 'lucide-react';

interface VehiculosListProps {
  vehiculos: Vehiculo[];
  clientes: Cliente[];
  onNuevoVehiculo: () => void;
  onEditarVehiculo: (vehiculo: Vehiculo) => void;
  onCambiarPropietario: (vehiculo: Vehiculo) => void;
  onDesactivarVehiculo: (vehiculo: Vehiculo) => void;
  onVerCliente: (clienteId: string) => void;
  onVerHistorial?: (vehiculo: Vehiculo) => void;
}

/** dd/mm/aaaa (o aaaa-mm-dd) vencido o dentro de 30 días. */
function porVencer(f?: string | null): boolean {
  if (!f) return false;
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const t = m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : Date.parse(f);
  if (!isFinite(t)) return false;
  return t - Date.now() < 30 * 86_400_000;
}

export const VehiculosList: React.FC<VehiculosListProps> = ({
  vehiculos,
  clientes,
  onNuevoVehiculo,
  onEditarVehiculo,
  onCambiarPropietario,
  onDesactivarVehiculo,
  onVerCliente,
  onVerHistorial,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroCombustible, setFiltroCombustible] = useState<string>('todos');
  const [verInactivos, setVerInactivos] = useState(false);

  const getPropietario = (propietarioId: string) => {
    return clientes.find((c) => c.id === propietarioId);
  };

  const vehiculosFiltrados = vehiculos.filter((v) => {
    const esActivo = v.activo !== false;
    if (verInactivos) {
      if (esActivo) return false;
    } else {
      if (!esActivo) return false;
    }

    const term = busqueda.toLowerCase().trim();
    const prop = getPropietario(v.propietarioActualId);
    const propNombre = prop ? prop.nombre.toLowerCase() : '';
    const propTel = prop ? prop.telefono.toLowerCase() : '';

    const coincideBusqueda =
      !term ||
      v.placa.toLowerCase().includes(term) ||
      v.marca.toLowerCase().includes(term) ||
      v.modelo.toLowerCase().includes(term) ||
      (v.vin && v.vin.toLowerCase().includes(term)) ||
      propNombre.includes(term) ||
      propTel.includes(term);

    if (!coincideBusqueda) return false;

    if (filtroCombustible !== 'todos') {
      return v.combustible === filtroCombustible;
    }
    return true;
  });

  const totalActivos = vehiculos.filter((v) => v.activo !== false).length;
  const totalInactivos = vehiculos.filter((v) => v.activo === false).length;
  const totalPorVencer = vehiculos.filter((v) => v.activo !== false && (porVencer(v.vencimientoSoat) || porVencer(v.vencimientoItv))).length;

  return (
    <div className="space-y-6">
      
      {/* Resumen superior */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block leading-tight">
            Vehículos registrados
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {totalActivos}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            Cada uno con su hoja de vida
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block leading-tight">
            SOAT / ITV por vencer
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-bold font-mono ${totalPorVencer > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totalPorVencer}
            </span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            Vencidos o que vencen en 30 días
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block leading-tight">
            Cambiaron de dueño
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {vehiculos.filter((v) => v.activo !== false && v.historialPropietarios.length > 1).length}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            Con propietarios anteriores guardados
          </span>
        </div>
      </div>

      {/* Controles de búsqueda y filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por placa, marca, modelo, VIN o propietario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto scrollbar-none">
          {['todos', 'Gasolina', 'Diésel', 'GNV'].map((tipo) => (
            <button
              key={tipo}
              onClick={() => {
                setVerInactivos(false);
                setFiltroCombustible(tipo);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap capitalize cursor-pointer ${
                !verInactivos && filtroCombustible === tipo ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tipo === 'todos' ? `Activos (${totalActivos})` : tipo}
            </button>
          ))}
          {totalInactivos > 0 && (
            <button
              onClick={() => setVerInactivos(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                verInactivos ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Desactivados ({totalInactivos})
            </button>
          )}
        </div>

      </div>

      {/* Tarjetas de vehículos */}
      <div className="space-y-4">
        {vehiculosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">
              {vehiculos.length === 0 ? 'Todavía no hay vehículos registrados' : 'No se encontraron vehículos'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {vehiculos.length === 0
                ? 'Registra el primer vehículo asociándolo a un cliente.'
                : 'Prueba con otra placa o borra los filtros de búsqueda.'}
            </p>
            <button
              onClick={onNuevoVehiculo}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Registrar Vehículo
            </button>
          </div>
        ) : (
          vehiculosFiltrados.map((vehiculo) => {
            const propietario = getPropietario(vehiculo.propietarioActualId);
            const tieneHistorialAnterior = vehiculo.historialPropietarios.length > 1;

            return (
              <div
                key={vehiculo.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-colors ${
                  vehiculo.activo === false ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  
                  {/* Bloque Identificador y Placa */}
                  <div className="space-y-2 flex-1">
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Placa estilo automotriz */}
                      <div className="bg-slate-900 text-amber-400 font-mono font-bold text-base px-3 py-1 rounded-md tracking-wider border border-slate-700 shadow-inner">
                        {vehiculo.placa}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {vehiculo.marca} {vehiculo.modelo}
                          {vehiculo.version ? ` · ${vehiculo.version}` : ''}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Año {vehiculo.anio} · Color {vehiculo.color}
                          {vehiculo.cilindrada ? ` · ${vehiculo.cilindrada}` : ''}
                        </p>
                      </div>

                      {vehiculo.activo === false && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          Desactivado
                        </span>
                      )}
                    </div>

                    {/* Especificaciones Técnicas */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 pt-1">
                      <span><strong>Combustible:</strong> {vehiculo.combustible}</span>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <span><strong>Transmisión:</strong> {vehiculo.transmision}</span>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <span><strong>Tracción:</strong> {vehiculo.traccion}</span>
                      {vehiculo.ultimoKilometraje && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">|</span>
                          <span className="font-mono">
                            <strong>Km:</strong> {vehiculo.ultimoKilometraje.toLocaleString('es-BO')} km
                          </span>
                        </>
                      )}
                    </div>

                    {/* VIN y Documentos Vehiculares */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                      {vehiculo.vin && (
                        <div className="font-mono">
                          <span className="text-slate-400">VIN/Chasis:</span>{' '}
                          <span className="text-slate-800 font-medium">{vehiculo.vin}</span>
                        </div>
                      )}
                      {vehiculo.vencimientoSoat && (
                        <div>
                          <span className="text-slate-400">SOAT:</span>{' '}
                          <span className="font-mono text-slate-700 font-medium">{vehiculo.vencimientoSoat}</span>
                        </div>
                      )}
                      {vehiculo.vencimientoItv && (
                        <div>
                          <span className="text-slate-400">ITV:</span>{' '}
                          <span className="font-mono text-slate-700 font-medium">{vehiculo.vencimientoItv}</span>
                        </div>
                      )}
                    </div>

                    {/* Propietario Actual */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-[11px] text-slate-400 block">Propietario Actual:</span>
                          <button
                            type="button"
                            onClick={() => propietario && onVerCliente(propietario.id)}
                            className="text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors text-left cursor-pointer"
                          >
                            {propietario ? propietario.nombre : 'Sin propietario asignado'}
                          </button>
                        </div>
                      </div>

                      {propietario && (
                        <div className="text-xs text-slate-600 font-mono">
                          Tel: {formatearTelefonoBolivia(propietario.telefono)}
                        </div>
                      )}
                    </div>

                    {/* Historial de Propietarios Previos */}
                    {tieneHistorialAnterior && (
                      <div className="pt-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Historial de Propietarios Anteriores:
                        </span>
                        <div className="space-y-1">
                          {vehiculo.historialPropietarios
                            .filter((h) => h.fechaFin !== 'Actual')
                            .map((h, i) => (
                              <div
                                key={i}
                                className="text-xs bg-slate-50/80 px-2.5 py-1.5 rounded border border-slate-100 flex items-center justify-between text-slate-600"
                              >
                                <div>
                                  <span className="font-medium text-slate-800">{h.clienteNombre}</span>
                                  {h.motivoCambio && (
                                    <span className="text-[11px] text-slate-400 ml-2 italic">
                                      ({h.motivoCambio})
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {h.fechaInicio} – {h.fechaFin}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Acciones */}
                  <div className="flex flex-row flex-wrap lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0">
                    {onVerHistorial && (
                      <button
                        type="button"
                        onClick={() => onVerHistorial(vehiculo)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                        title="Hoja de vida del vehículo"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Hoja de vida</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCambiarPropietario(vehiculo)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      title="Transferir vehículo a otro cliente"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Cambiar Propietario</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditarVehiculo(vehiculo)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      title="Editar ficha técnica"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Editar Ficha</span>
                    </button>

                    {vehiculo.activo !== false && (
                      <button
                        type="button"
                        onClick={() => onDesactivarVehiculo(vehiculo)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        title="Desactivar vehículo"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Desactivar</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
