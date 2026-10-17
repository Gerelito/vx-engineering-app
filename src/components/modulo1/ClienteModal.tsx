import React, { useState, useEffect } from 'react';
import { Cliente, TipoCliente, CanalContacto, OrigenCliente } from '../../types';
import { buscarDuplicadoPorTelefono, formatearTelefonoBolivia, obtenerTelefonoE164 } from '../../lib/storage';
import { AlertTriangle, Check, X, Phone, User, Mail, MapPin, Building, MessageSquare, AlertCircle } from 'lucide-react';

interface ClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cliente: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'activo'>, idExistente?: string) => void;
  clienteEditar?: Cliente | null;
  clientesExistentes: Cliente[];
  onSeleccionarClienteExistente?: (cliente: Cliente) => void;
}

export const ClienteModal: React.FC<ClienteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clienteEditar,
  clientesExistentes,
  onSeleccionarClienteExistente,
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [documentoIdentidad, setDocumentoIdentidad] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [canalPreferido, setCanalPreferido] = useState<CanalContacto>('WhatsApp');
  const [tipo, setTipo] = useState<TipoCliente>('Particular');
  const [origen, setOrigen] = useState<OrigenCliente>('Referido');
  const [notas, setNotas] = useState('');
  const [consentimientoFirmado, setConsentimientoFirmado] = useState(false);

  // Estado para detección de duplicados por teléfono
  const [duplicadoEncontrado, setDuplicadoEncontrado] = useState<Cliente | null>(null);
  const [confirmarDuplicadoConNota, setConfirmarDuplicadoConNota] = useState(false);
  const [notaDuplicado, setNotaDuplicado] = useState('');
  const [errorCorreo, setErrorCorreo] = useState('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  useEffect(() => {
    if (clienteEditar) {
      setNombre(clienteEditar.nombre);
      setTelefono(clienteEditar.telefono);
      setDocumentoIdentidad(clienteEditar.documentoIdentidad || '');
      setCorreo(clienteEditar.correo || '');
      setDireccion(clienteEditar.direccion || '');
      setCanalPreferido(clienteEditar.canalPreferido || 'WhatsApp');
      setTipo(clienteEditar.tipo || 'Particular');
      setOrigen(clienteEditar.origen || 'Referido');
      setNotas(clienteEditar.notas || '');
      setConsentimientoFirmado(clienteEditar.consentimientoFirmado || false);
    } else {
      setNombre('');
      setTelefono('');
      setDocumentoIdentidad('');
      setCorreo('');
      setDireccion('');
      setCanalPreferido('WhatsApp');
      setTipo('Particular');
      setOrigen('Referido');
      setNotas('');
      setConsentimientoFirmado(false);
    }
    setDuplicadoEncontrado(null);
    setConfirmarDuplicadoConNota(false);
    setNotaDuplicado('');
    setErrorCorreo('');
  }, [clienteEditar, isOpen]);

  // Detector de duplicados en tiempo real al escribir el teléfono
  const handleTelefonoChange = (valor: string) => {
    setTelefono(valor);
    if (valor.trim().length >= 6) {
      const dup = buscarDuplicadoPorTelefono(valor, clientesExistentes, clienteEditar?.id);
      setDuplicadoEncontrado(dup);
    } else {
      setDuplicadoEncontrado(null);
    }
  };

  const handleCorreoChange = (valor: string) => {
    setCorreo(valor);
    if (valor.trim() === '') {
      setErrorCorreo('');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) {
      setErrorCorreo('Formato de correo no válido');
    } else {
      setErrorCorreo('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!nombre.trim()) {
      setErrorValidacion('El nombre completo es obligatorio.');
      return;
    }

    if (!telefono.trim()) {
      setErrorValidacion('El teléfono es obligatorio para la búsqueda de duplicados y envíos de WhatsApp.');
      return;
    }

    if (errorCorreo) {
      setErrorValidacion('Por favor corrige el formato del correo electrónico.');
      return;
    }

    // Regla de duplicados por teléfono
    if (duplicadoEncontrado && !confirmarDuplicadoConNota && !clienteEditar) {
      setErrorValidacion('Se ha detectado un cliente con el mismo número de teléfono. Elige usar el cliente existente o confirma continuar con una nota justificativa.');
      return;
    }

    const notasFinales = confirmarDuplicadoConNota && notaDuplicado.trim()
      ? `${notas ? notas + '\n' : ''}[Nota de teléfono compartido con ${duplicadoEncontrado?.nombre}]: ${notaDuplicado.trim()}`
      : notas;

    onSave(
      {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        documentoIdentidad: documentoIdentidad.trim() || undefined,
        correo: correo.trim() || undefined,
        direccion: direccion.trim() || undefined,
        canalPreferido,
        tipo,
        origen,
        consentimientoFirmado,
        notas: notasFinales || undefined,
      },
      clienteEditar?.id
    );

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Cabecera del modal */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {clienteEditar ? 'Editar Ficha del Cliente' : 'Nuevo Cliente (Registro Rápido)'}
            </h2>
            <p className="text-xs text-slate-400">
              Módulo 1 · Bolivia · Registro mínimo con nombre y teléfono
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERTA CRÍTICA DE DUPLICADO POR TELÉFONO */}
        {duplicadoEncontrado && !clienteEditar && (
          <div className="bg-amber-50 border-b border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-amber-900">
                  ¡Atención! Este número de teléfono ya está registrado en el sistema:
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200 mt-2 space-y-1">
                  <p className="font-semibold text-slate-900">{duplicadoEncontrado.nombre}</p>
                  <p className="text-slate-600">
                    Tel: <span className="font-mono font-bold">{duplicadoEncontrado.telefono}</span> · Tipo: {duplicadoEncontrado.tipo} · Doc: {duplicadoEncontrado.documentoIdentidad || 'Sin CI/NIT'}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSeleccionarClienteExistente) {
                        onSeleccionarClienteExistente(duplicadoEncontrado);
                      }
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors text-xs shadow-xs"
                  >
                    Usar este cliente existente
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmarDuplicadoConNota(!confirmarDuplicadoConNota)}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-medium rounded-lg transition-colors text-xs"
                  >
                    {confirmarDuplicadoConNota ? 'Cancelar excepción' : 'Es otra persona (Continuar con nota)'}
                  </button>
                </div>

                {confirmarDuplicadoConNota && (
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                      Nota obligatoria: ¿Por qué comparte teléfono con {duplicadoEncontrado.nombre}? (ej: cónyuge, chofer de empresa, familiar)
                    </label>
                    <input
                      type="text"
                      required
                      value={notaDuplicado}
                      onChange={(e) => setNotaDuplicado(e.target.value)}
                      placeholder="Ej. Chofer autorizado de la empresa / Esposo del titular"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-amber-300 bg-white focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Alerta de validación sin alert() nativo */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nombre Completo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Nombre Completo o Razón Social <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez Mamani o Distribuidora Andina SRL"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Teléfono de Contacto */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Teléfono de Contacto (WhatsApp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ej. 7000-0001 o 70000001"
                  value={telefono}
                  onChange={(e) => handleTelefonoChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-mono"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              {telefono.trim().length >= 4 ? (
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5 mt-1 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                  <span>Visual: <strong className="font-mono text-slate-900">{formatearTelefonoBolivia(telefono)}</strong></span>
                  <span>·</span>
                  <span>E.164: <strong className="font-mono text-emerald-700">{obtenerTelefonoE164(telefono)}</strong></span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-0.5">Dato clave para control de duplicados y envíos de PDF.</p>
              )}
            </div>

            {/* Documento de Identidad / NIT */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Documento de Identidad (CI o NIT) <span className="text-slate-400">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. 4839201 LP o 1029384029 NIT"
                value={documentoIdentidad}
                onChange={(e) => setDocumentoIdentidad(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">Cédula con extensión boliviana (LP, SC, CB, etc.)</p>
            </div>

            {/* Tipo de Cliente */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Tipo de Cliente</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoCliente)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                <option value="Particular">Particular</option>
                <option value="Empresa">Empresa</option>
              </select>
            </div>

            {/* Canal de Contacto Preferido */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Canal de Contacto Preferido</label>
              <select
                value={canalPreferido}
                onChange={(e) => setCanalPreferido(e.target.value as CanalContacto)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                <option value="WhatsApp">WhatsApp (Recomendado)</option>
                <option value="Llamada">Llamada Telefónica</option>
              </select>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Correo Electrónico <span className="text-slate-400">(Opcional)</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="ejemplo@correo.bo"
                  value={correo}
                  onChange={(e) => handleCorreoChange(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 ${
                    errorCorreo ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:ring-slate-900'
                  }`}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              {errorCorreo && <p className="text-[11px] text-red-500 mt-0.5">{errorCorreo}</p>}
            </div>

            {/* Origen del Cliente */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Origen del Cliente</label>
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value as OrigenCliente)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                <option value="Referido">Referido</option>
                <option value="Cliente habitual">Cliente habitual</option>
                <option value="Redes sociales">Redes sociales</option>
                <option value="Carteles en la calle">Carteles en la calle</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {/* Dirección */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Dirección <span className="text-slate-400">(Opcional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. Calle Cuba #120, Miraflores, La Paz"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Notas / Observaciones */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Notas y Preferencias del Cliente <span className="text-slate-400">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Horarios de contacto, indicaciones específicas o notas de choferes autorizados..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            {/* Estado de Consentimiento */}
            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Consentimiento de Tratamiento de Datos</span>
                  <span className="text-[11px] text-slate-500">
                    Documento firmado en papel escaneado o fotografiado (Módulo 1)
                  </span>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                    consentimientoFirmado
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {consentimientoFirmado ? 'Consentimiento firmado' : 'Consentimiento pendiente'}
                </span>
              </div>
              {!consentimientoFirmado && (
                <p className="text-[11px] text-slate-500 mt-2">
                  * Si el cliente aún no firmó el documento, se guardará con la marca «Consentimiento pendiente». Podrás subir la foto o escaneo firmado en cualquier momento desde la ficha del cliente.
                </p>
              )}
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
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
            >
              {clienteEditar ? 'Guardar Cambios' : 'Registrar Cliente'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
