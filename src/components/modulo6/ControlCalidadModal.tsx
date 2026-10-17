import React, { useEffect, useState } from 'react';
import { DuenoUsuario, OrdenServicio, TallerConfig } from '../../types';
import {
  CHECKLIST_CONTROL_CALIDAD,
  registrarControlCalidadFirestore,
  resumenTrabajosOrden,
  subirFotoOrdenFirestore,
} from '../../lib/entrega';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import { AlertTriangle, Camera, CheckCircle2, Loader2, ShieldCheck, X, XCircle } from 'lucide-react';

interface Props {
  orden: OrdenServicio;
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onClose: () => void;
  onExito: (m: string) => void;
}

export const ControlCalidadModal: React.FC<Props> = ({ orden, config, usuarioActual, onClose, onExito }) => {
  const [revisor, setRevisor] = useState('');
  const [revisionPropia, setRevisionPropia] = useState(false);
  const [trabajos, setTrabajos] = useState<{ descripcion: string; ok: boolean }[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [hacerPrueba, setHacerPrueba] = useState(true);
  const [kmInicial, setKmInicial] = useState(String(orden.kilometraje || ''));
  const [kmFinal, setKmFinal] = useState('');
  const [recorrido, setRecorrido] = useState('');
  const [obsPrueba, setObsPrueba] = useState('');
  const [resultadoPrueba, setResultadoPrueba] = useState<'Satisfactoria' | 'Con observaciones' | 'No satisfactoria'>('Satisfactoria');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [fotosIds, setFotosIds] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resumenTrabajosOrden(orden)
      .then((r) => setTrabajos(r.trabajos.map((t) => ({ descripcion: t, ok: false }))))
      .catch((e) => setError(`No se pudieron leer los trabajos aprobados: ${e?.message || e}`));
  }, [orden.id]);

  const todoOk =
    trabajos.every((t) => t.ok) &&
    CHECKLIST_CONTROL_CALIDAD.every((c) => checklist[c.id]) &&
    (!hacerPrueba || resultadoPrueba !== 'No satisfactoria');

  const subirFoto = async (file: File | undefined, tipo: 'final' | 'piezas_retiradas') => {
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await procesarArchivoAdjunto(file);
      const id = await subirFotoOrdenFirestore(
        orden,
        tipo,
        tipo === 'final' ? 'Foto final del trabajo' : 'Piezas retiradas',
        r.base64Data,
        r.tamanioBytes,
        usuarioActual
      );
      setFotosIds((p) => [...p, id]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async (resultado: 'Aprobado' | 'Rechazado') => {
    setGuardando(true);
    setError(null);
    try {
      await registrarControlCalidadFirestore(
        orden,
        {
          revisor,
          revisionPropia,
          trabajosConfirmados: trabajos,
          checklist,
          pruebaRuta: hacerPrueba
            ? {
                realizada: true,
                kmInicial: parseFloat(kmInicial) || null,
                kmFinal: parseFloat(kmFinal) || null,
                recorrido: recorrido || null,
                observaciones: obsPrueba || null,
                resultado: resultadoPrueba,
              }
            : { realizada: false },
          resultado,
          motivoRechazo: resultado === 'Rechazado' ? motivoRechazo : null,
          fotosIds,
        },
        usuarioActual
      );
      onExito(
        resultado === 'Aprobado'
          ? `${orden.folio} pasó control de calidad: lista para entrega.`
          : `${orden.folio} vuelve a reparación (retrabajo).`
      );
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const responsables = config.mecanicosResponsables || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh]">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="font-bold">Control de calidad</h3>
              <p className="text-xs text-slate-300">
                {orden.folio} · {orden.vehiculoPlaca} · {orden.clienteNombre}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <section className="space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Revisor</span>
              <input
                list="lista-responsables"
                value={revisor}
                onChange={(e) => setRevisor(e.target.value)}
                placeholder="Nombre de quien revisa"
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
              />
              <datalist id="lista-responsables">
                {responsables.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
            {orden.mecanicoResponsable && revisor && revisor === orden.mecanicoResponsable && !revisionPropia && (
              <p className="text-xs text-amber-800">El revisor es el mismo responsable del trabajo: marca "Revisión propia".</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={revisionPropia} onChange={(e) => setRevisionPropia(e.target.checked)} className="w-5 h-5" />
              Revisión propia (la misma persona hizo el trabajo; queda en auditoría)
            </label>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-bold">Trabajos aprobados</h4>
            {trabajos.length === 0 ? (
              <p className="text-xs text-slate-500">No hay ítems aprobados en cotizaciones (o aún se están cargando).</p>
            ) : (
              trabajos.map((t, i) => (
                <label key={i} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg text-sm">
                  <input
                    type="checkbox"
                    checked={t.ok}
                    onChange={(e) => setTrabajos((p) => p.map((x, j) => (j === i ? { ...x, ok: e.target.checked } : x)))}
                    className="w-5 h-5"
                  />
                  {t.descripcion}
                </label>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-bold">Lista de verificación</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST_CONTROL_CALIDAD.map((c) => (
                <label key={c.id} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg text-sm">
                  <input
                    type="checkbox"
                    checked={!!checklist[c.id]}
                    onChange={(e) => setChecklist((p) => ({ ...p, [c.id]: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  {c.texto}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={hacerPrueba} onChange={(e) => setHacerPrueba(e.target.checked)} className="w-5 h-5" />
              Prueba de ruta
            </label>
            {hacerPrueba && (
              <div className="grid grid-cols-2 gap-2">
                <input inputMode="numeric" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} placeholder="Km inicial" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input inputMode="numeric" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} placeholder="Km final" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={recorrido} onChange={(e) => setRecorrido(e.target.value)} placeholder="Recorrido" className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <input value={obsPrueba} onChange={(e) => setObsPrueba(e.target.value)} placeholder="Observaciones" className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <select
                  value={resultadoPrueba}
                  onChange={(e) => setResultadoPrueba(e.target.value as any)}
                  className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option>Satisfactoria</option>
                  <option>Con observaciones</option>
                  <option>No satisfactoria</option>
                </select>
              </div>
            )}
          </section>

          <section className="flex flex-wrap items-center gap-2">
            {(['final', 'piezas_retiradas'] as const).map((t) => (
              <label key={t} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold cursor-pointer">
                <Camera className="w-4 h-4" />
                {t === 'final' ? 'Foto final del trabajo' : 'Foto piezas retiradas'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0], t)} />
              </label>
            ))}
            {subiendo && <Loader2 className="w-4 h-4 animate-spin" />}
            {fotosIds.length > 0 && <span className="text-xs text-emerald-700 font-semibold">{fotosIds.length} foto(s) guardada(s)</span>}
          </section>

          <section className="space-y-2 border-t border-slate-200 pt-3">
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo si se rechaza (vuelve a reparación como retrabajo)"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => guardar('Rechazado')}
                disabled={guardando || !revisor.trim() || !motivoRechazo.trim()}
                className="inline-flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-rose-300 text-rose-700 disabled:opacity-40 font-bold text-sm"
              >
                <XCircle className="w-4 h-4" /> Rechazar (retrabajo)
              </button>
              <button
                onClick={() => guardar('Aprobado')}
                disabled={guardando || !revisor.trim() || !todoOk}
                className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-bold text-sm"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aprobar
              </button>
            </div>
            {!todoOk && (
              <p className="text-xs text-slate-500">Para aprobar, marca todos los trabajos y todos los puntos de la lista.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
