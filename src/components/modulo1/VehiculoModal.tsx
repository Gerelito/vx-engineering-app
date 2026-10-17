import React, { useState, useEffect } from 'react';
import { Vehiculo, Cliente, TipoCombustible, TipoTransmision, TipoTraccion } from '../../types';
import { validarFormatoVin, buscarDuplicadoPorPlaca, normalizarPlaca } from '../../lib/storage';
import { X, Car, Calendar, ShieldCheck, AlertCircle, AlertTriangle, ArrowRightLeft, Eye } from 'lucide-react';

interface VehiculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    vehiculo: Omit<Vehiculo, 'id' | 'createdAt' | 'updatedAt' | 'historialPropietarios' | 'activo'>,
    propietario: Cliente,
    idExistente?: string
  ) => void;
  vehiculoEditar?: Vehiculo | null;
  clientes: Cliente[];
  vehiculosExistentes: Vehiculo[];
  clientePreseleccionadoId?: string;
  onVerVehiculoExistente?: (vehiculo: Vehiculo) => void;
  onCambiarPropietarioVehiculo?: (vehiculo: Vehiculo) => void;
}

export const VehiculoModal: React.FC<VehiculoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  vehiculoEditar,
  clientes,
  vehiculosExistentes,
  clientePreseleccionadoId,
  onVerVehiculoExistente,
  onCambiarPropietarioVehiculo,
}) => {
  const [placa, setPlaca] = useState('');
  const [vin, setVin] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [version, setVersion] = useState('');
  const [anio, setAnio] = useState('');
  const [color, setColor] = useState('');
  const [cilindrada, setCilindrada] = useState('');
  const [combustible, setCombustible] = useState<TipoCombustible>('Gasolina');
  const [transmision, setTransmision] = useState<TipoTransmision>('Manual');
  const [traccion, setTraccion] = useState<TipoTraccion>('4x2');
  const [vencimientoSoat, setVencimientoSoat] = useState('');
  const [vencimientoItv, setVencimientoItv] = useState('');
  const [propietarioId, setPropietarioId] = useState('');
  const [ultimoKilometraje, setUltimoKilometraje] = useState<number | undefined>(undefined);
  const [notasTecnicas, setNotasTecnicas] = useState('');

  const [errorVin, setErrorVin] = useState('');
  const [duplicadoPlaca, setDuplicadoPlaca] = useState<Vehiculo | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  useEffect(() => {
    if (vehiculoEditar) {
      setPlaca(vehiculoEditar.placa);
      setVin(vehiculoEditar.vin || '');
      setMarca(vehiculoEditar.marca);
      setModelo(vehiculoEditar.modelo);
      setVersion(vehiculoEditar.version || '');
      setAnio(vehiculoEditar.anio);
      setColor(vehiculoEditar.color);
      setCilindrada(vehiculoEditar.cilindrada || '');
      setCombustible(vehiculoEditar.combustible);
      setTransmision(vehiculoEditar.transmision);
      setTraccion(vehiculoEditar.traccion);
      setVencimientoSoat(vehiculoEditar.vencimientoSoat || '');
      setVencimientoItv(vehiculoEditar.vencimientoItv || '');
      setPropietarioId(vehiculoEditar.propietarioActualId);
      setUltimoKilometraje(vehiculoEditar.ultimoKilometraje ?? undefined);
      setNotasTecnicas(vehiculoEditar.notasTecnicas || '');
    } else {
      setPlaca('');
      setVin('');
      setMarca('');
      setModelo('');
      setVersion('');
      setAnio(new Date().getFullYear().toString());
      setColor('');
      setCilindrada('');
      setCombustible('Gasolina');
      setTransmision('Manual');
      setTraccion('4x2');
      setVencimientoSoat('');
      setVencimientoItv('');
      setPropietarioId(clientePreseleccionadoId || (clientes.length > 0 ? clientes[0].id : ''));
      setUltimoKilometraje(undefined);
      setNotasTecnicas('');
    }
    setErrorVin('');
    setDuplicadoPlaca(null);
  }, [vehiculoEditar, isOpen, clientePreseleccionadoId, clientes]);

  const handlePlacaChange = (valor: string) => {
    setPlaca(valor);
    if (valor.trim().length >= 3) {
      const dup = buscarDuplicadoPorPlaca(valor, vehiculosExistentes, vehiculoEditar?.id);
      setDuplicadoPlaca(dup);
    } else {
      setDuplicadoPlaca(null);
    }
  };

  const handleVinChange = (valor: string) => {
    const val = valor.toUpperCase();
    setVin(val);
    if (val.trim()) {
      const res = validarFormatoVin(val);
      if (!res.valido) {
        setErrorVin(res.mensaje || 'Formato de VIN inválido');
      } else {
        setErrorVin('');
      }
    } else {
      setErrorVin('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!placa.trim()) {
      setErrorValidacion('La placa del vehículo es obligatoria.');
      return;
    }

    if (duplicadoPlaca && !vehiculoEditar) {
      setErrorValidacion(`La placa ${duplicadoPlaca.placa} ya está registrada en el sistema.`);
      return;
    }

    if (!marca.trim() || !modelo.trim()) {
      setErrorValidacion('La marca y el modelo son obligatorios.');
      return;
    }

    if (!propietarioId) {
      setErrorValidacion('Debes seleccionar o asignar un propietario para el vehículo.');
      return;
    }

    if (errorVin) {
      setErrorValidacion('Por favor verifica el formato del número de VIN.');
      return;
    }

    const propietarioCliente = clientes.find((c) => c.id === propietarioId);
    if (!propietarioCliente) {
      setErrorValidacion('El propietario seleccionado no existe.');
      return;
    }

    onSave(
      {
        placa: placa.trim().toUpperCase(),
        vin: vin.trim() || undefined,
        marca: marca.trim(),
        modelo: modelo.trim(),
        version: version.trim() || undefined,
        anio: anio.trim() || new Date().getFullYear().toString(),
        color: color.trim() || 'No especificado',
        cilindrada: cilindrada.trim() || undefined,
        combustible,
        transmision,
        traccion,
        vencimientoSoat: vencimientoSoat.trim() || undefined,
        vencimientoItv: vencimientoItv.trim() || undefined,
        propietarioActualId: propietarioId,
        ultimoKilometraje,
        notasTecnicas: notasTecnicas.trim() || undefined,
      },
      propietarioCliente,
      vehiculoEditar?.id
    );

    onClose();
  };

  const propietarioDuplicado = duplicadoPlaca ? clientes.find((c) => c.id === duplicadoPlaca.propietarioActualId) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {vehiculoEditar ? 'Editar Ficha de Vehículo' : 'Registrar Nuevo Vehículo'}
              </h2>
              <p className="text-xs text-slate-400">
                Placa, datos técnicos e historial de propietarios
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

        {/* ALERTA DE PLACA DUPLICADA CON ACCIONES: VER VEHÍCULO Y CAMBIAR PROPIETARIO */}
        {duplicadoPlaca && !vehiculoEditar && (
          <div className="bg-amber-50 border-b border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-amber-900">
                  ¡Atención! La placa <span className="font-mono underline">{duplicadoPlaca.placa}</span> ya está registrada en el taller:
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200 mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">{duplicadoPlaca.placa}</span>
                    <span className="text-slate-600 font-medium">{duplicadoPlaca.marca} {duplicadoPlaca.modelo} ({duplicadoPlaca.anio})</span>
                  </div>
                  <p className="text-slate-600">
                    Propietario actual: <strong>{propietarioDuplicado?.nombre || 'Desconocido'}</strong> {propietarioDuplicado && `(Tel: ${propietarioDuplicado.telefono})`}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onVerVehiculoExistente) {
                        onVerVehiculoExistente(duplicadoPlaca);
                      }
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Vehículo Existente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onCambiarPropietarioVehiculo) {
                        onCambiarPropietarioVehiculo(duplicadoPlaca);
                      }
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Cambiar Propietario de este Vehículo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {errorValidacion && (
            <div className="bg-red-50 border border-red-200 text-red-900 p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-semibold">{errorValidacion}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorValidacion(null)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Asignación de Propietario */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Propietario Actual del Vehículo <span className="text-red-500">*</span>
            </label>
            <select
              value={propietarioId}
              onChange={(e) => setPropietarioId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">-- Selecciona el cliente titular --</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · Tel: {c.telefono} ({c.tipo})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              * El vehículo es la entidad central del historial. Puede cambiar de dueño conservando su hoja de vida técnica.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Placa Libre */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Placa del Vehículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 1234ABC, 4820XYX o CD-123"
                value={placa}
                onChange={(e) => handlePlacaChange(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border tracking-wider uppercase focus:outline-none focus:ring-2 ${
                  duplicadoPlaca && !vehiculoEditar ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/50' : 'border-slate-300 focus:ring-slate-900'
                }`}
              />
              <p className="text-[11px] text-slate-500 mt-0.5">Texto libre: acepta placas bolivianas, antiguas o del extranjero.</p>
            </div>

            {/* VIN o Número de Chasis */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                VIN / Número de Chasis <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                maxLength={17}
                placeholder="17 caracteres alfanuméricos"
                value={vin}
                onChange={(e) => handleVinChange(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono rounded-lg border focus:outline-none focus:ring-2 ${
                  errorVin ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:ring-slate-900'
                } uppercase`}
              />
              {errorVin ? (
                <p className="text-[11px] text-red-500 mt-0.5">{errorVin}</p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-0.5">Validación de formato si tiene 17 car.</p>
              )}
            </div>

            {/* Marca */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Marca <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Toyota, Nissan, Suzuki, Ford"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Hilux, Corolla, Frontier, RAV4"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Versión */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Versión / Motor <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. 2.4 D-4D, 1.8 GLi, SR5"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Año de Fabricación */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Año <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1960"
                max="2030"
                required
                placeholder="Ej. 2018"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Color de Carrocería <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Blanco, Gris Metálico, Rojo Perlado"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Cilindrada */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Cilindrada <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. 2400 cc o 2.4L"
                value={cilindrada}
                onChange={(e) => setCilindrada(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Tipo de Combustible */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Combustible</label>
              <select
                value={combustible}
                onChange={(e) => setCombustible(e.target.value as TipoCombustible)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="Gasolina">Gasolina</option>
                <option value="Diésel">Diésel</option>
                <option value="GNV">GNV (Gas Natural Vehicular)</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Eléctrico">Eléctrico</option>
              </select>
            </div>

            {/* Transmisión */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Transmisión</label>
              <select
                value={transmision}
                onChange={(e) => setTransmision(e.target.value as TipoTransmision)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="Manual">Manual</option>
                <option value="Automática">Automática</option>
                <option value="Secuencial">Secuencial</option>
              </select>
            </div>

            {/* Tracción */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Tracción</label>
              <select
                value={traccion}
                onChange={(e) => setTraccion(e.target.value as TipoTraccion)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="4x2">4x2 (Simple)</option>
                <option value="4x4">4x4 (Doble tracción)</option>
                <option value="AWD">AWD (All Wheel Drive)</option>
              </select>
            </div>

            {/* Kilometraje de Referencia */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Kilometraje de Referencia (km) <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="Ej. 128450"
                value={ultimoKilometraje !== undefined ? ultimoKilometraje : ''}
                onChange={(e) => setUltimoKilometraje(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Vencimiento SOAT */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Vencimiento SOAT <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="dd/mm/aaaa (ej. 15/12/2026)"
                value={vencimientoSoat}
                onChange={(e) => setVencimientoSoat(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Vencimiento ITV */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Vencimiento Insp. Técnica (ITV) <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="dd/mm/aaaa (ej. 20/11/2026)"
                value={vencimientoItv}
                onChange={(e) => setVencimientoItv(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Notas Técnicas */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Notas Técnicas del Vehículo <span className="text-slate-400">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Especificaciones particulares, modificaciones, tipo de aceite recomendado..."
                value={notasTecnicas}
                onChange={(e) => setNotasTecnicas(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

          </div>

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
              disabled={Boolean(duplicadoPlaca && !vehiculoEditar)}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
            >
              {vehiculoEditar ? 'Guardar Cambios' : 'Registrar Vehículo'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
