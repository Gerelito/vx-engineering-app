import React, { useState } from 'react';
import { Vehiculo, Cliente } from '../../types';
import { X, ArrowRightLeft, User, ShieldAlert, History } from 'lucide-react';

interface CambioPropietarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehiculo: Vehiculo | null;
  propietarioActual: Cliente | null;
  clientes: Cliente[];
  onConfirmarCambio: (vehiculoId: string, nuevoPropietario: Cliente, motivo: string) => void;
}

export const CambioPropietarioModal: React.FC<CambioPropietarioModalProps> = ({
  isOpen,
  onClose,
  vehiculo,
  propietarioActual,
  clientes,
  onConfirmarCambio,
}) => {
  const [nuevoPropietarioId, setNuevoPropietarioId] = useState('');
  const [motivoCambio, setMotivoCambio] = useState('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  if (!isOpen || !vehiculo) return null;

  const candidatos = clientes.filter((c) => c.id !== vehiculo.propietarioActualId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!nuevoPropietarioId) {
      setErrorValidacion('Debes seleccionar el nuevo cliente propietario.');
      return;
    }

    if (!motivoCambio.trim()) {
      setErrorValidacion('El motivo del cambio de propietario es obligatorio para el registro de auditoría.');
      return;
    }

    const nuevoCliente = clientes.find((c) => c.id === nuevoPropietarioId);
    if (!nuevoCliente) {
      setErrorValidacion('Cliente seleccionado no válido.');
      return;
    }

    onConfirmarCambio(vehiculo.id, nuevoCliente, motivoCambio.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Transferir Propiedad del Vehículo</h2>
              <p className="text-xs text-slate-400">
                Placa: <span className="font-mono text-amber-400 font-bold">{vehiculo.placa}</span> · {vehiculo.marca} {vehiculo.modelo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorValidacion && (
            <div className="bg-red-50 border border-red-200 text-red-900 p-3 rounded-xl flex items-center justify-between text-xs">
              <span>{errorValidacion}</span>
              <button
                type="button"
                onClick={() => setErrorValidacion(null)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Regla del documento destacada */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>Importante:</strong> El historial técnico es del vehículo. Al transferirlo, conserva toda su hoja de vida previa, pero los datos personales del anterior propietario dejan de mostrarse en los nuevos documentos.
            </p>
          </div>

          {/* Propietario actual */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Propietario Actual
            </span>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {propietarioActual ? propietarioActual.nombre : 'No asignado'}
            </p>
            <p className="text-xs text-slate-600">
              Teléfono: <span className="font-mono">{propietarioActual?.telefono}</span> · {propietarioActual?.tipo}
            </p>
          </div>

          {/* Selector de Nuevo Propietario */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Seleccionar Nuevo Propietario <span className="text-red-500">*</span>
            </label>
            <select
              value={nuevoPropietarioId}
              onChange={(e) => setNuevoPropietarioId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">-- Seleccionar nuevo cliente --</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.telefono} ({c.tipo})
                </option>
              ))}
            </select>
          </div>

          {/* Motivo Obligatorio */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Motivo del Cambio de Propietario <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Venta del vehículo, transferencia corporativa, traspaso familiar"
              value={motivoCambio}
              onChange={(e) => setMotivoCambio(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              Quedará registrado de forma inmutable en el registro de auditoría.
            </p>
          </div>

          {/* Historial previo de propietarios */}
          {vehiculo.historialPropietarios && vehiculo.historialPropietarios.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Historial de Propietarios de este Vehículo</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {vehiculo.historialPropietarios.map((h, i) => (
                  <div key={i} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800">{h.clienteNombre}</span>
                      <span className="text-slate-500 block">Tel: {h.telefono}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-600 block">{h.fechaInicio} – {h.fechaFin || 'Actual'}</span>
                      {h.motivoCambio && (
                        <span className="text-[10px] text-amber-700 block italic">{h.motivoCambio}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors"
            >
              Confirmar Transferencia
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
