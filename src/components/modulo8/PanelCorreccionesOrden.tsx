import React, { useEffect, useState } from 'react';
import { ContactoCliente, DuenoUsuario, FotoOrden, OrdenServicio } from '../../types';
import { CAMPOS_CORREGIBLES, contactosDe, corregirOrdenFirestore, reemplazarFotoOrdenFirestore, valorCampo } from '../../lib/historial';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import { ListaContactos } from './HistorialVehiculoModal';
import { Camera, Loader2, MessageCircle, PencilLine } from 'lucide-react';

/** Bitácora de contactos de la orden y correcciones con motivo (Módulo 8). */
export const PanelCorreccionesOrden: React.FC<{ orden: OrdenServicio; usuarioActual: DuenoUsuario }> = ({ orden, usuarioActual }) => {
  const [contactos, setContactos] = useState<ContactoCliente[] | null>(null);
  const [campo, setCampo] = useState(CAMPOS_CORREGIBLES[0].id);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const cerrada = orden.estado === 'Entregado' || orden.estado === 'Cancelada';

  useEffect(() => {
    contactosDe({ ordenIds: [orden.id] })
      .then(setContactos)
      .catch(() => setContactos([]));
  }, [orden.id]);

  const def = CAMPOS_CORREGIBLES.find((c) => c.id === campo)!;
  const actual = valorCampo(orden, campo);

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await corregirOrdenFirestore(orden, campo, valor, motivo, usuarioActual);
      setValor('');
      setMotivo('');
      setMsg({ ok: true, t: 'Corrección guardada. El valor anterior queda en el historial y en la auditoría.' });
    } catch (e: any) {
      setMsg({ ok: false, t: e?.message || String(e) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
          <MessageCircle className="w-4 h-4" /> Bitácora de contactos de esta orden
        </h4>
        {contactos === null ? <p className="text-xs text-slate-400">Cargando…</p> : <ListaContactos contactos={contactos} />}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <PencilLine className="w-4 h-4" /> Corregir datos {cerrada && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800">orden cerrada · acción sensible</span>}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={campo} onChange={(e) => setCampo(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 bg-white">
            {CAMPOS_CORREGIBLES.filter((c) => c.id !== 'actaEntrega.kmSalida' || orden.actaEntrega).map((c) => (
              <option key={c.id} value={c.id}>
                {c.texto}
              </option>
            ))}
          </select>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode={def.tipo === 'numero' ? 'numeric' : undefined}
            placeholder={`Valor correcto (actual: ${actual ?? '—'})`}
            className="border border-slate-300 rounded-lg px-2 py-2 bg-white"
          />
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" className="border border-slate-300 rounded-lg px-2 py-2 bg-white" />
        </div>
        <button onClick={guardar} disabled={guardando || !valor.trim() || !motivo.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-40">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar corrección
        </button>
        {msg && <p className={msg.ok ? 'text-emerald-700' : 'text-rose-700'}>{msg.t}</p>}
        {(orden.correcciones || []).length > 0 && (
          <ul className="space-y-0.5 pt-1 border-t border-slate-200">
            {orden.correcciones!.map((c) => (
              <li key={c.id}>
                {new Date(c.fecha).toLocaleString('es-BO')} · <b>{c.campo}</b>: {String(c.antes ?? '—')} → {String(c.despues)} · {c.motivo} ({c.registradoPorNombre})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/** Reemplazo de una foto con motivo (la anterior se conserva marcada como reemplazada). */
export const ReemplazarFoto: React.FC<{ orden: OrdenServicio; foto: FotoOrden; usuarioActual: DuenoUsuario; onListo: () => void }> = ({ orden, foto, usuarioActual, onListo }) => {
  const [motivo, setMotivo] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (foto.reemplazada) return <p className="text-xs text-fuchsia-800 px-2 pb-1">Foto reemplazada: {foto.motivoReemplazo || ''}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 px-2 pt-2 text-xs" onClick={(e) => e.stopPropagation()}>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo para reemplazar" className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-2 py-1.5" />
      <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold ${motivo.trim() ? 'bg-slate-900 text-white cursor-pointer' : 'bg-slate-200 text-slate-400'}`}>
        {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} Reemplazar foto
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!motivo.trim() || subiendo}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setSubiendo(true);
            setError(null);
            try {
              const r = await procesarArchivoAdjunto(f);
              await reemplazarFotoOrdenFirestore(orden, foto, r.base64Data, r.tamanioBytes, motivo, usuarioActual);
              onListo();
            } catch (err: any) {
              setError(err?.message || String(err));
            } finally {
              setSubiendo(false);
            }
          }}
        />
      </label>
      {error && <p className="w-full text-rose-700">{error}</p>}
    </div>
  );
};
