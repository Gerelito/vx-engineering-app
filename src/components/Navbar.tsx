import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  Shield,
  Users,
  Car,
  LogOut,
  Settings,
  ClipboardList,
  LayoutGrid,
} from 'lucide-react';

interface NavbarProps {
  vistaActiva: 'recepciones' | 'taller' | 'clientes' | 'vehiculos' | 'auditoria';
  onCambiarVista: (vista: 'recepciones' | 'taller' | 'clientes' | 'vehiculos' | 'auditoria') => void;
  onNuevaRecepcion: () => void;
  onNuevoCliente: () => void;
  onNuevoVehiculo: () => void;
  onAbrirConfiguracion: () => void;
  estadoNube: 'sincronizado' | 'pendiente_offline' | 'error_permisos' | 'error_guardar';
  nombreTaller?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  vistaActiva,
  onCambiarVista,
  onNuevaRecepcion,
  onNuevoCliente,
  onNuevoVehiculo,
  onAbrirConfiguracion,
  estadoNube,
  nombreTaller,
}) => {
  const { usuarioActual, cerrarSesion } = useAuth();
  const [modalConfirmarLogout, setModalConfirmarLogout] = useState(false);

  const navItems: {
    id: 'recepciones' | 'taller' | 'clientes' | 'vehiculos' | 'auditoria';
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'recepciones',
      label: 'Recepciones',
      icon: <ClipboardList className="w-4 h-4 text-amber-500 shrink-0" />,
    },
    {
      id: 'taller',
      label: 'Taller (Kanban)',
      icon: <Wrench className="w-4 h-4 text-blue-500 shrink-0" />,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users className="w-4 h-4 text-slate-500 shrink-0" />,
    },
    {
      id: 'vehiculos',
      label: 'Vehículos',
      icon: <Car className="w-4 h-4 text-slate-500 shrink-0" />,
    },
    {
      id: 'auditoria',
      label: 'Auditoría',
      icon: <Shield className="w-4 h-4 text-slate-500 shrink-0" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Fila 1: Marca Wordmark, Estado Nube, Usuario y Ajustes */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Zona 1: Marca Wordmark "VX Engineering" */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 shadow-sm border border-slate-800">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-slate-900 whitespace-nowrap block">
                {nombreTaller || 'VX Engineering'}
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:block font-medium">
                Taller Mecánico Automotriz · Bolivia · Cloud Firestore
              </span>
            </div>
          </div>

          {/* Zona 2: Acciones Rápidas */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Indicador de estado de conexión */}
            <div
              title={
                estadoNube === 'sincronizado'
                  ? 'Conectado y sincronizado con Firestore en la nube'
                  : estadoNube === 'pendiente_offline'
                  ? 'Sin internet: trabajando con caché local, cambios pendientes'
                  : estadoNube === 'error_permisos'
                  ? 'Error de permisos al comunicarse con Firestore'
                  : 'Error al guardar los datos en Firestore'
              }
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                estadoNube === 'sincronizado'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : estadoNube === 'pendiente_offline'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : estadoNube === 'error_permisos'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  estadoNube === 'sincronizado'
                    ? 'bg-emerald-500 animate-pulse'
                    : estadoNube === 'pendiente_offline'
                    ? 'bg-amber-500'
                    : estadoNube === 'error_permisos'
                    ? 'bg-red-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline whitespace-nowrap font-semibold">
                {estadoNube === 'sincronizado' && 'Sincronizado'}
                {estadoNube === 'pendiente_offline' && 'Offline'}
                {estadoNube === 'error_permisos' && 'Permisos'}
                {estadoNube === 'error_guardar' && 'Error'}
              </span>
            </div>

            {/* Usuario autenticado */}
            {usuarioActual && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 bg-slate-100 rounded-lg border border-slate-200"
                title={`Sesión activa: ${usuarioActual.email}`}
              >
                {usuarioActual.photoURL ? (
                  <img
                    src={usuarioActual.photoURL}
                    alt={usuarioActual.displayName}
                    className="w-5 h-5 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                    {usuarioActual.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline font-semibold text-slate-800 max-w-[120px] truncate">
                  {usuarioActual.displayName}
                </span>
              </div>
            )}

            {/* Configuración */}
            <button
              onClick={onAbrirConfiguracion}
              className="p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Configuración general, bahías de taller y tarifario"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Cerrar Sesión */}
            <button
              onClick={() => setModalConfirmarLogout(true)}
              className="p-1.5 sm:p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
              title="Cerrar sesión de Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fila 2: Barra Adaptable de Navegación (Visible SIEMPRE en todas las pantallas, computadora y móvil) */}
        {/* Todas las 5 pestañas están permanentemente visibles y nunca se ocultan ni se cortan */}
        <div className="flex items-center justify-start sm:justify-start gap-1 sm:gap-2 pb-2 pt-0.5 overflow-x-auto scrollbar-thin border-t border-slate-100">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCambiarVista(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                vistaActiva === item.id
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-700 bg-slate-100/90 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modal de confirmación para cerrar sesión */}
      {modalConfirmarLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 mb-2">¿Deseas cerrar tu sesión de Google?</h3>
            <p className="text-xs text-slate-600 mb-4">
              Para volver a entrar, se requerirá iniciar sesión nuevamente con tu cuenta de Google autorizada.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalConfirmarLogout(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setModalConfirmarLogout(false);
                  cerrarSesion();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
