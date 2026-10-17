import React, { useState } from 'react';
import { DuenoUsuario, MotivoCancelacion, OrdenServicio } from '../../types';
import { MOTIVOS_CANCELACION, iniciarCancelacionFirestore } from '../../lib/entrega';
import { formatearMonedaBs } from '../../lib/storage';
import { AlertTriangle, Ban, Loader2, X } from 'lucide-react';

interface Props {
  orden: OrdenServicio;
  usuarioActual: DuenoUsuario;
  onClose: () => void;
  onExito: (m: string) => void;
}

export const CancelacionModal: React.FC<Props> = ({ orden, usuarioActual, onClose, onExito }) => {
  const [motivo, setMotivo] = useState<MotivoCancelacion | ''>('');
  const [nota, setNota] = useState('');
  const [desarmado, setDesarmado] = useState(false);
  const autorizoDiag = !!orden.autorizaciones?.autorizaDiagnostico;
  const costoDiag = orden.autorizaciones?.costoDiagnosticoBs || 0;
  const [cobrarDiag, setCobrarDiag] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pagado = orden.pagos?.totalPagadoBs || 0;

  const guardar = async () => {
    if (!motivo) return;
    setGuardando(true);
    setError(null);
    try {
      await iniciarCancelacionFirestore(orden, { motivo, nota, vehiculoDesarmado: desarmado, cobrarDiagnostico: cobrarDiag }, usuarioActual);
      onExito(`${orden.folio} cancelada. Sigue en "Entregas → Cancelaciones abiertas" hasta devolver el vehículo.`);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const cobro = cobrarDiag && autorizoDiag ? costoDiag : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 bg-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ban className="w-6 h-6" />
            <div>
              <h3 className="font-bold">Cancelar orden</h3>
              <p className="text-xs text-rose-100">
                {orden.folio} · {orden.vehiculoPlaca} · {orden.clienteNombre}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-rose-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Motivo (obligatorio)</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoCancelacion)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm">
              <option value="">— Elige el motivo —</option>
              {MOTIVOS_CANCELACION.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={motivo === 'Otro' ? 'Describe el motivo (obligatorio)' : 'Nota (opcional)'}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={desarmado} onChange={(e) => setDesarmado(e.target.checked)} className="w-5 h-5 mt-0.5" />
            <span>El vehículo quedó desarmado (habrá que rearmarlo y fotografiarlo antes de devolverlo)</span>
          </label>
          <label className={`flex items-start gap-3 text-sm ${autorizoDiag ? '' : 'opacity-50'}`}>
            <input type="checkbox" disabled={!autorizoDiag} checked={cobrarDiag} onChange={(e) => setCobrarDiag(e.target.checked)} className="w-5 h-5 mt-0.5" />
            <span>
              Cobrar el diagnóstico pactado ({formatearMonedaBs(costoDiag)})
              {!autorizoDiag && <span className="block text-xs">El cliente no autorizó el cobro de diagnóstico en la recepción.</span>}
            </span>
          </label>
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <p>Se cobrará: <b>{formatearMonedaBs(cobro)}</b> (más almacenaje si corresponde al devolver).</p>
            <p>Pagado hasta ahora: <b>{formatearMonedaBs(pagado)}</b>.{pagado > cobro ? ' La diferencia queda como saldo a favor: devuélvela desde "Pagos".' : ''}</p>
            <p>Los repuestos reservados quedan liberados.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold">
              Volver
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !motivo || (motivo === 'Otro' && !nota.trim())}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-700 disabled:opacity-40 text-white text-sm font-bold"
            >
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar cancelación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
