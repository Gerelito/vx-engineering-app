import React, { useEffect, useMemo, useState } from 'react';
import { Cliente, ContactoCliente, DuenoUsuario, OrdenServicio, Vehiculo } from '../../types';
import { contactosDe } from '../../lib/historial';
import { calcularFinanzasOrden, registrarContactoFirestore } from '../../lib/caja';
import { formatearMonedaBs } from '../../lib/storage';
import { ListaContactos } from './HistorialVehiculoModal';
import { Car, ClipboardList, Loader2, MessageCircle, Phone, Plus, User, X } from 'lucide-react';

interface Props {
  cliente: Cliente;
  vehiculos: Vehiculo[];
  ordenes: OrdenServicio[];
  usuarioActual: DuenoUsuario;
  onAbrirVehiculo: (v: Vehiculo) => void;
  onAbrirOrden: (o: OrdenServicio) => void;
  onClose: () => void;
  onExito: (m: string) => void;
}

const MEDIOS = ['Llamada', 'WhatsApp', 'Mensaje', 'Visita'] as const;

/** Ficha del cliente: vehículos, órdenes, saldo y bitácora de contactos (Módulos 5, 6, 7 y 8). */
export const FichaClienteModal: React.FC<Props> = ({ cliente, vehiculos, ordenes, usuarioActual, onAbrirVehiculo, onAbrirOrden, onClose, onExito }) => {
  const [contactos, setContactos] = useState<ContactoCliente[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [medio, setMedio] = useState<(typeof MEDIOS)[number]>('Llamada');
  const [resumen, setResumen] = useState('');
  const [resultado, setResultado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const susVehiculos = vehiculos.filter((v) => v.propietarioActualId === cliente.id || v.historialPropietarios?.some((h) => h.clienteId === cliente.id));
  const susOrdenes = useMemo(
    () =>
      ordenes
        .filter((o) => o.clienteId === cliente.id)
        .sort((a, b) => String(b.folio).localeCompare(String(a.folio))),
    [ordenes, cliente.id]
  );
  const saldo = susOrdenes.reduce((s, o) => {
    const f = calcularFinanzasOrden(o);
    return s + (f.saldoBs && f.saldoBs > 0 ? f.saldoBs : 0);
  }, 0);

  useEffect(() => {
    contactosDe({ clienteId: cliente.id })
      .then(setContactos)
      .catch((e) => setError(e?.message || String(e)));
  }, [cliente.id, recarga]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarContactoFirestore(
        { clienteId: cliente.id, clienteNombre: cliente.nombre, ordenId: null, folio: null, medio, motivo: 'Otro', resumen, resultado },
        usuarioActual
      );
      setNuevo(false);
      setResumen('');
      setResultado('');
      setRecarga((r) => r + 1);
      onExito('Contacto registrado.');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const tel = (cliente.telefonoE164 || '').replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-[45] flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-900/60 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-50 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[94vh]">
        <div className="px-4 sm:px-5 py-4 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-lg leading-tight truncate">{cliente.nombre}</h3>
              <p className="text-xs text-slate-300">
                {cliente.telefono}
                {cliente.documentoIdentidad ? ` · CI ${cliente.documentoIdentidad}` : ''} · {cliente.tipo}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5 space-y-4">
          {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <a href={`tel:${cliente.telefonoE164 || cliente.telefono}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold">
              <Phone className="w-4 h-4" /> Llamar
            </a>
            {tel && (
              <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {saldo > 0.004 && <span className="inline-flex items-center px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold">Saldo pendiente {formatearMonedaBs(saldo)}</span>}
          </div>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Vehículos</h4>
            {susVehiculos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin vehículos.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {susVehiculos.map((v) => (
                  <button key={v.id} onClick={() => onAbrirVehiculo(v)} className="text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-400">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <Car className="w-4 h-4" /> <span className="font-mono">{v.placa}</span> · {v.marca} {v.modelo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {v.propietarioActualId === cliente.id ? 'Propietario actual' : 'Propietario anterior'} · Ver hoja de vida
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Órdenes</h4>
            {susOrdenes.length === 0 ? (
              <p className="text-sm text-slate-500">Sin órdenes.</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {susOrdenes.map((o) => {
                  const f = calcularFinanzasOrden(o);
                  return (
                    <button key={o.id} onClick={() => onAbrirOrden(o)} className="w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="font-mono font-bold text-sm">{o.folio}</span> <span className="text-xs text-slate-500">· {o.vehiculoPlaca} · {o.estado}</span>
                      </span>
                      <span className="text-xs text-right shrink-0">
                        {f.totalAprobadoBs === null ? 'Por definir' : formatearMonedaBs(f.totalAprobadoBs)}
                        {f.saldoBs && f.saldoBs > 0.004 ? <b className="block text-rose-700">Saldo {formatearMonedaBs(f.saldoBs)}</b> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" /> Bitácora de contactos
              </h4>
              <button onClick={() => setNuevo((x) => !x)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                <Plus className="w-4 h-4" /> Registrar contacto
              </button>
            </div>
            {nuevo && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 mb-2">
                <div className="grid grid-cols-4 gap-1">
                  {MEDIOS.map((m) => (
                    <button key={m} onClick={() => setMedio(m)} className={`py-2 rounded-lg text-xs font-bold border ${medio === m ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <input value={resumen} onChange={(e) => setResumen(e.target.value)} placeholder="Resumen (qué se habló)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Resultado" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={guardar} disabled={guardando || !resumen.trim()} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-40">
                  {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                </button>
              </div>
            )}
            {contactos === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <ListaContactos contactos={contactos} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
