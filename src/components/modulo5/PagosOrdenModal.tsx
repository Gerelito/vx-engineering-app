import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DuenoUsuario, OrdenServicio, PagoOrden, TallerConfig, TipoPago } from '../../types';
import {
  anularPagoFirestore,
  autorizarEntregaConSaldoFirestore,
  calcularFinanzasOrden,
  formatearDia,
  mediosPagoConfigurados,
  redondearBs,
  registrarPagoFirestore,
} from '../../lib/caja';
import { formatearFecha, formatearMonedaBs } from '../../lib/storage';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import { AlertTriangle, Ban, Camera, CheckCircle2, Loader2, Receipt, Wallet, X } from 'lucide-react';

interface Props {
  orden: OrdenServicio | null;
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onClose: () => void;
  onExito: (mensaje: string) => void;
}

const TIPOS: Exclude<TipoPago, 'Anulación'>[] = ['Anticipo', 'Abono', 'Pago final'];

export const PagosOrdenModal: React.FC<Props> = ({ orden, config, usuarioActual, onClose, onExito }) => {
  const medios = mediosPagoConfigurados(config);
  const [pagos, setPagos] = useState<PagoOrden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [tipo, setTipo] = useState<Exclude<TipoPago, 'Anulación'>>('Anticipo');
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [concepto, setConcepto] = useState('');
  const [comprobante, setComprobante] = useState<string | null>(null);

  const [pagoAAnular, setPagoAAnular] = useState<PagoOrden | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const [mostrarEntregaSaldo, setMostrarEntregaSaldo] = useState(false);
  const [motivoEntrega, setMotivoEntrega] = useState('');
  const [fechaCompromiso, setFechaCompromiso] = useState('');

  useEffect(() => {
    if (!orden) return;
    setCargando(true);
    const unsub = onSnapshot(
      query(collection(db, 'pagos'), where('ordenId', '==', orden.id)),
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as PagoOrden);
        lista.sort((a, b) => (b.fechaLocal || '').localeCompare(a.fechaLocal || ''));
        setPagos(lista);
        setCargando(false);
      },
      (err) => {
        setError(`No se pudieron leer los pagos: ${err.message}`);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [orden?.id]);

  useEffect(() => {
    if (!orden) return;
    const fin = calcularFinanzasOrden(orden);
    setTipo(fin.totalPagadoBs > 0 ? 'Abono' : 'Anticipo');
    setMontos({});
    setConcepto('');
    setComprobante(null);
    setError(null);
  }, [orden?.id]);

  const fin = useMemo(() => (orden ? calcularFinanzasOrden(orden) : null), [orden]);
  const idsAnulados = useMemo(
    () => new Set(pagos.filter((p) => p.anulaPagoId).map((p) => p.anulaPagoId as string)),
    [pagos]
  );

  if (!orden || !fin) return null;

  const totalIngresado = redondearBs(
    Object.values(montos).reduce((s, v) => s + (parseFloat(v.replace(',', '.')) || 0), 0)
  );

  const registrar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const lista = medios.map((m) => ({ medio: m, montoBs: parseFloat((montos[m] || '').replace(',', '.')) || 0 }));
      const pago = await registrarPagoFirestore(
        orden,
        { tipo, montos: lista, concepto: concepto || tipo, comprobanteBase64: comprobante },
        usuarioActual
      );
      onExito(`Pago de ${formatearMonedaBs(pago.totalBs)} registrado en ${orden.folio}.`);
      setMontos({});
      setConcepto('');
      setComprobante(null);
      setTipo('Abono');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarAnulacion = async () => {
    if (!pagoAAnular) return;
    setError(null);
    setGuardando(true);
    try {
      await anularPagoFirestore(orden, pagoAAnular, motivoAnulacion, usuarioActual);
      onExito(`Pago anulado en ${orden.folio}.`);
      setPagoAAnular(null);
      setMotivoAnulacion('');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEntregaConSaldo = async () => {
    setError(null);
    setGuardando(true);
    try {
      await autorizarEntregaConSaldoFirestore(orden, motivoEntrega, fechaCompromiso || null, usuarioActual);
      onExito(`Entrega con saldo autorizada para ${orden.folio}.`);
      setMostrarEntregaSaldo(false);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const subirComprobante = async (file?: File | null) => {
    if (!file) return;
    try {
      const r = await procesarArchivoAdjunto(file);
      setComprobante(r.base64Data);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const textoTotal =
    fin.estadoTotal === 'aprobado'
      ? formatearMonedaBs(fin.totalAprobadoBs)
      : fin.estadoTotal === 'pendiente_negociacion'
      ? 'Pendiente de negociación'
      : 'Sin cotización aprobada';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Pagos de la orden</h3>
              <p className="text-xs text-slate-300">
                <span className="font-mono font-bold text-white">{orden.folio}</span> · {orden.clienteNombre} ·{' '}
                {orden.vehiculoPlaca}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tarjeta titulo="Total aprobado" valor={textoTotal} />
            <Tarjeta titulo="Pagado QR" valor={formatearMonedaBs(fin.pagadoQRBs)} tono="verde" />
            <Tarjeta titulo="Pagado efectivo" valor={formatearMonedaBs(fin.pagadoEfectivoBs)} tono="verde" />
            <Tarjeta
              titulo="Saldo pendiente"
              valor={
                fin.saldoBs === null
                  ? fin.estadoTotal === 'pendiente_negociacion'
                    ? 'Pendiente de negociación'
                    : '—'
                  : formatearMonedaBs(fin.saldoBs)
              }
              tono={fin.saldoBs !== null && fin.saldoBs > 0 ? 'rojo' : 'oscuro'}
            />
          </div>
          {fin.pagadoOtrosBs !== 0 && (
            <p className="text-xs text-slate-500">Otros medios: {formatearMonedaBs(fin.pagadoOtrosBs)}</p>
          )}
          {fin.pagosACuenta && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
              Los pagos registrados quedan <b>a cuenta</b> hasta que se apruebe la cotización.
            </div>
          )}
          {fin.saldoBs !== null && fin.saldoBs < 0 && (
            <div className="text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded-lg p-3">
              El cliente pagó {formatearMonedaBs(-fin.saldoBs)} de más (saldo a favor del cliente).
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Registrar pago */}
          <section className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Registrar pago</h4>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-2.5 rounded-lg text-sm font-bold border ${
                    tipo === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {medios.map((m) => (
                <label key={m} className="block">
                  <span className="text-xs font-semibold text-slate-600">Monto por {m} (Bs)</span>
                  <input
                    inputMode="decimal"
                    value={montos[m] || ''}
                    onChange={(e) => setMontos((prev) => ({ ...prev, [m]: e.target.value }))}
                    placeholder="0,00"
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base font-mono"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Concepto</span>
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder={`${tipo} de la orden ${orden.folio}`}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold cursor-pointer hover:bg-slate-50">
                <Camera className="w-4 h-4" />
                {comprobante ? 'Cambiar comprobante' : 'Comprobante QR (opcional)'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => subirComprobante(e.target.files?.[0])}
                />
              </label>
              {comprobante && <img src={comprobante} alt="Comprobante" className="h-12 rounded border" />}
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-sm text-slate-600">
                Total: <b className="font-mono text-slate-900">{formatearMonedaBs(totalIngresado)}</b>
              </span>
              <button
                type="button"
                onClick={registrar}
                disabled={guardando || totalIngresado <= 0}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Registrar pago
              </button>
            </div>
          </section>

          {/* Entrega con saldo */}
          {fin.saldoBs !== null && fin.saldoBs > 0 && (
            <section className="border border-amber-300 bg-amber-50/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-amber-950">Entrega con saldo pendiente</h4>
                  <p className="text-xs text-amber-900">
                    {orden.entregaConSaldo?.autorizada
                      ? `Autorizada por ${orden.entregaConSaldo.autorizadoPorNombre} el ${formatearFecha(
                          orden.entregaConSaldo.fecha
                        )}: ${orden.entregaConSaldo.motivo}`
                      : 'Por defecto no se puede entregar el vehículo con saldo. Un dueño puede autorizarlo con motivo.'}
                  </p>
                </div>
                {!orden.entregaConSaldo?.autorizada && !mostrarEntregaSaldo && (
                  <button
                    type="button"
                    onClick={() => setMostrarEntregaSaldo(true)}
                    className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold"
                  >
                    Autorizar
                  </button>
                )}
              </div>
              {mostrarEntregaSaldo && (
                <div className="space-y-2">
                  <textarea
                    value={motivoEntrega}
                    onChange={(e) => setMotivoEntrega(e.target.value)}
                    placeholder="Motivo (obligatorio)"
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                  />
                  <label className="block text-xs font-semibold text-amber-900">
                    Fecha comprometida de pago (opcional)
                    <input
                      type="date"
                      value={fechaCompromiso}
                      onChange={(e) => setFechaCompromiso(e.target.value)}
                      className="mt-1 block border border-amber-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setMostrarEntregaSaldo(false)} className="px-3 py-2 text-sm font-semibold">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmarEntregaConSaldo}
                      disabled={guardando || !motivoEntrega.trim()}
                      className="px-4 py-2 rounded-lg bg-amber-600 disabled:opacity-50 text-white text-sm font-bold"
                    >
                      Confirmar autorización
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Historial */}
          <section className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Pagos registrados
            </h4>
            {cargando ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : pagos.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay pagos en esta orden.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {pagos.map((p) => {
                  const anulado = idsAnulados.has(p.id);
                  return (
                    <div key={p.id} className={`p-3 flex items-start justify-between gap-3 ${anulado ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              p.tipo === 'Anulación' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.tipo}
                          </span>
                          <span className="font-mono font-bold">{formatearMonedaBs(p.totalBs)}</span>
                          <span className="text-xs text-slate-500">{p.montos.map((m) => `${m.medio} ${formatearMonedaBs(m.montoBs)}`).join(' + ')}</span>
                          {p.aCuenta && <span className="text-[11px] text-amber-700 font-semibold">a cuenta</span>}
                          {anulado && <span className="text-[11px] text-rose-700 font-bold">ANULADO</span>}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {formatearFecha(p.fecha || p.fechaLocal)} · {p.concepto} · {p.registradoPorNombre}
                          {p.motivoAnulacion ? ` · Motivo: ${p.motivoAnulacion}` : ''}
                        </p>
                        {p.comprobanteBase64 && (
                          <a href={p.comprobanteBase64} target="_blank" rel="noreferrer" className="text-xs text-sky-700 underline">
                            Ver comprobante
                          </a>
                        )}
                      </div>
                      {p.tipo !== 'Anulación' && !anulado && (
                        <button
                          type="button"
                          onClick={() => {
                            setPagoAAnular(p);
                            setMotivoAnulacion('');
                          }}
                          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded"
                        >
                          <Ban className="w-3.5 h-3.5" /> Anular
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {pagoAAnular && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-3 shadow-xl">
              <h4 className="font-bold text-slate-900">Anular pago de {formatearMonedaBs(pagoAAnular.totalBs)}</h4>
              <p className="text-xs text-slate-600">
                Registrado el {formatearDia(pagoAAnular.fechaDia)}. No se borra: se registra un movimiento negativo y queda en la
                auditoría como acción sensible.
              </p>
              <textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Motivo (obligatorio)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPagoAAnular(null)} className="px-3 py-2 text-sm font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarAnulacion}
                  disabled={guardando || !motivoAnulacion.trim()}
                  className="px-4 py-2 rounded-lg bg-rose-600 disabled:opacity-50 text-white text-sm font-bold"
                >
                  Anular pago
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Tarjeta: React.FC<{ titulo: string; valor: string; tono?: 'verde' | 'rojo' | 'oscuro' }> = ({ titulo, valor, tono }) => (
  <div
    className={`rounded-xl p-3 border ${
      tono === 'rojo'
        ? 'bg-rose-600 text-white border-rose-600'
        : tono === 'verde'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : tono === 'oscuro'
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white border-slate-200 text-slate-900'
    }`}
  >
    <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">{titulo}</p>
    <p className="text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight">{valor}</p>
  </div>
);
