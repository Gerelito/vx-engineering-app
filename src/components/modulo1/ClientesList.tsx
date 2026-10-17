import React, { useState } from 'react';
import { Cliente, Vehiculo } from '../../types';
import { formatearTelefonoBolivia, obtenerTelefonoE164 } from '../../lib/storage';
import {
  Search,
  Phone,
  MessageSquare,
  Plus,
  Car,
  Edit2,
  ShieldAlert,
  CheckCircle2,
  User,
  Building,
  ExternalLink,
  UserX,
  FileText,
} from 'lucide-react';

interface ClientesListProps {
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  onNuevoCliente: () => void;
  onEditarCliente: (cliente: Cliente) => void;
  onNuevoVehiculoParaCliente: (cliente: Cliente) => void;
  onSubirConsentimiento: (cliente: Cliente) => void;
  onDesactivarCliente: (cliente: Cliente) => void;
  onVerVehiculo: (vehiculo: Vehiculo) => void;
}

export const ClientesList: React.FC<ClientesListProps> = ({
  clientes,
  vehiculos,
  onNuevoCliente,
  onEditarCliente,
  onNuevoVehiculoParaCliente,
  onSubirConsentimiento,
  onDesactivarCliente,
  onVerVehiculo,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'Particular' | 'Empresa' | 'pendiente' | 'inactivos'>('todos');

  // Solo mostrar clientes activos salvo que se filtre explícitamente por inactivos
  const clientesFiltrados = clientes.filter((c) => {
    const esActivo = c.activo !== false;

    if (filtroTipo === 'inactivos') {
      if (esActivo) return false;
    } else {
      if (!esActivo) return false;
    }

    const term = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      !term ||
      c.nombre.toLowerCase().includes(term) ||
      c.telefono.toLowerCase().includes(term) ||
      (c.documentoIdentidad && c.documentoIdentidad.toLowerCase().includes(term)) ||
      (c.correo && c.correo.toLowerCase().includes(term));

    if (!coincideBusqueda) return false;

    if (filtroTipo === 'Particular') return c.tipo === 'Particular';
    if (filtroTipo === 'Empresa') return c.tipo === 'Empresa';
    if (filtroTipo === 'pendiente') return !c.consentimientoFirmado;
    return true;
  });

  const totalActivos = clientes.filter((c) => c.activo !== false).length;
  const totalPendientesConsentimiento = clientes.filter((c) => c.activo !== false && !c.consentimientoFirmado).length;
  const totalInactivos = clientes.filter((c) => c.activo === false).length;

  return (
    <div className="space-y-6">
      
      {/* Resumen superior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Clientes Activos en Firestore
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {totalActivos}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Ficha única sin duplicados por teléfono
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Consentimiento Pendiente
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-bold font-mono ${totalPendientesConsentimiento > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totalPendientesConsentimiento}
            </span>
            {totalPendientesConsentimiento > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                Requiere documento firmado
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Archivos comprimidos en base de datos
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Vehículos en Taller
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {vehiculos.filter((v) => v.activo !== false).length}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Hoja de vida técnica central
          </span>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Input de Búsqueda */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, CI o NIT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filtroTipo === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activos ({totalActivos})
          </button>
          <button
            onClick={() => setFiltroTipo('Particular')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filtroTipo === 'Particular' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Particulares
          </button>
          <button
            onClick={() => setFiltroTipo('Empresa')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filtroTipo === 'Empresa' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Empresas
          </button>
          <button
            onClick={() => setFiltroTipo('pendiente')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filtroTipo === 'pendiente' ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Consentimiento Pendiente ({totalPendientesConsentimiento})
          </button>
          {totalInactivos > 0 && (
            <button
              onClick={() => setFiltroTipo('inactivos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filtroTipo === 'inactivos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Desactivados ({totalInactivos})
            </button>
          )}
        </div>

      </div>

      {/* Lista de Clientes */}
      <div className="space-y-3">
        {clientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">
              {clientes.length === 0 ? 'Base de datos en Firestore vacía' : 'No se encontraron clientes con los filtros aplicados'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {clientes.length === 0
                ? 'Comienza registrando al primer cliente real del taller mecánico.'
                : 'Intenta con otros términos de búsqueda o borra los filtros.'}
            </p>
            <button
              onClick={onNuevoCliente}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Primer Cliente</span>
            </button>
          </div>
        ) : (
          clientesFiltrados.map((cliente) => {
            const vehiculosCliente = vehiculos.filter((v) => v.propietarioActualId === cliente.id && v.activo !== false);

            const telVisual = formatearTelefonoBolivia(cliente.telefono);
            const telE164 = cliente.telefonoE164 || obtenerTelefonoE164(cliente.telefono);
            const waNumber = telE164.replace(/\+/g, '');

            return (
              <div
                key={cliente.id}
                className={`bg-white rounded-xl border p-4 sm:p-5 transition-colors shadow-xs ${
                  cliente.activo === false ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Información Principal del Cliente */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {cliente.nombre}
                      </h3>

                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span aria-hidden="true">·</span>
                        {cliente.tipo === 'Empresa' ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                            <Building className="w-3 h-3 text-slate-400" />
                            Empresa
                          </span>
                        ) : (
                          <span className="text-slate-600">Particular</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{cliente.origen}</span>
                      </span>

                      {/* Marca de Consentimiento */}
                      {!cliente.consentimientoFirmado ? (
                        <button
                          type="button"
                          onClick={() => onSubirConsentimiento(cliente)}
                          className="text-[11px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 px-2.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Haz clic para subir documento firmado"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                          <span>Consentimiento pendiente</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSubirConsentimiento(cliente)}
                          className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Ver documento firmado en Firestore"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Consentimiento firmado (Ver)</span>
                        </button>
                      )}

                      {cliente.activo === false && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          Desactivado
                        </span>
                      )}
                    </div>

                    {/* Fila de Contacto y Documentos */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1 font-mono font-medium text-slate-900">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{telVisual}</span>
                      </div>

                      {cliente.documentoIdentidad && (
                        <div>
                          <span className="text-slate-400">Doc:</span>{' '}
                          <span className="font-mono text-slate-700 font-medium">
                            {cliente.documentoIdentidad}
                          </span>
                        </div>
                      )}

                      {cliente.correo && (
                        <div>
                          <span className="text-slate-400">Email:</span> {cliente.correo}
                        </div>
                      )}

                      {cliente.direccion && (
                        <div>
                          <span className="text-slate-400">Dir:</span> {cliente.direccion}
                        </div>
                      )}
                    </div>

                    {cliente.notas && (
                      <p className="text-xs text-slate-500 italic pt-1">
                        "{cliente.notas}"
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    
                    {/* Botón WhatsApp */}
                    <a
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola ${cliente.nombre}, nos comunicamos desde Taller Mecánico Automotriz.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="Abrir chat en WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    {/* Botón Llamada */}
                    <a
                      href={`tel:${telE164}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                      title="Llamar al cliente"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar</span>
                    </a>

                    {/* Botón Asociar Vehículo */}
                    <button
                      onClick={() => onNuevoVehiculoParaCliente(cliente)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Registrar vehículo para este cliente"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                      <span>Vehículo</span>
                    </button>

                    {/* Botón Editar Ficha */}
                    <button
                      onClick={() => onEditarCliente(cliente)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Editar ficha del cliente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Desactivar cliente (prohibido borrar según reglas) */}
                    {cliente.activo !== false && (
                      <button
                        onClick={() => onDesactivarCliente(cliente)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Desactivar cliente (en Firestore con activo: false)"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>

                {/* Subsección: Vehículos pertenecientes a este cliente */}
                {vehiculosCliente.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Vehículos Registrados ({vehiculosCliente.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {vehiculosCliente.map((veh) => (
                        <button
                          key={veh.id}
                          onClick={() => onVerVehiculo(veh)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs transition-colors group text-left cursor-pointer"
                        >
                          <Car className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900" />
                          <span className="font-mono font-bold text-slate-900">{veh.placa}</span>
                          <span className="text-slate-600">
                            {veh.marca} {veh.modelo} ({veh.anio})
                          </span>
                          <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
