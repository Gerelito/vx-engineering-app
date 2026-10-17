import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DuenoUsuario, FotoOrden, OrdenServicio, TallerConfig, TipoFotoRecepcion } from '../../types';
import {
  OBJETOS_ACCESORIOS,
  calcularAlmacenaje,
  entregarVehiculoFirestore,
  resumenTrabajosOrden,
  subirActaFirmadaFirestore,
  subirFotoOrdenFirestore,
} from '../../lib/entrega';
import { calcularFinanzasOrden, redondearBs } from '../../lib/caja';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import { formatearFecha, formatearMonedaBs } from '../../lib/storage';
import { AlertTriangle, MessageCircle, Camera, CheckCircle2, FileSignature, KeyRound, Loader2, Printer, Wallet, X } from 'lucide-react';

interface Props {
  orden: OrdenServicio;
  tipo: 'entrega' | 'devolucion';
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onClose: () => void;
  onAbrirPagos: (orden: OrdenServicio) => void;
  onEnviar?: (orden: OrdenServicio) => void;
  onExito: (m: string) => void;
}

const PARES_FOTOS: { salida: TipoFotoRecepcion; ingreso: TipoFotoRecepcion; texto: string }[] = [
  { salida: 'salida_frente', ingreso: 'frente', texto: 'Frente' },
  { salida: 'salida_trasera', ingreso: 'trasera', texto: 'Trasera' },
  { salida: 'salida_lateral_izq', ingreso: 'lateral_izq', texto: 'Lateral izquierdo' },
  { salida: 'salida_lateral_der', ingreso: 'lateral_der', texto: 'Lateral derecho' },
  { salida: 'salida_tablero', ingreso: 'tablero_kilometraje', texto: 'Tablero / km' },
];

export const ActaEntregaModal: React.FC<Props> = ({ orden, tipo, config, usuarioActual, onClose, onAbrirPagos, onEnviar, onExito }) => {
  const [fotos, setFotos] = useState<FotoOrden[]>([]);
  const [kmSalida, setKmSalida] = useState('');
  const [nombreRetira, setNombreRetira] = useState(orden.clienteNombre || '');
  const [documento, setDocumento] = useState('');
  const [relacion, setRelacion] = useState('Titular');
  const [llaves, setLlaves] = useState(String(orden.accesorios?.cantidadLlaves ?? 1));
  const [objetos, setObjetos] = useState<Record<string, boolean>>({});
  const [piezas, setPiezas] = useState<'si' | 'no' | 'na'>('na');
  const [trabajos, setTrabajos] = useState<string[]>([]);
  const [noAprobadas, setNoAprobadas] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'ordenes', orden.id, 'fotos'),
      (s) => setFotos(s.docs.map((d) => ({ ...(d.data() as FotoOrden), id: d.id }))),
      (e) => console.warn('Error leyendo fotos:', e)
    );
    return () => unsub();
  }, [orden.id]);

  useEffect(() => {
    resumenTrabajosOrden(orden)
      .then((r) => {
        setTrabajos(r.trabajos);
        setNoAprobadas(r.noAprobadas);
      })
      .catch((e) => setError(`No se pudieron leer las cotizaciones: ${e?.message || e}`));
  }, [orden.id]);

  const fotoDe = (t: TipoFotoRecepcion) =>
    fotos
      .filter((f) => f.tipo === t && !f.reemplazada)
      .sort((a, b) => String(b.fechaStr || '').localeCompare(String(a.fechaStr || '')))[0];

  const objetosIngreso = OBJETOS_ACCESORIOS.filter((o) => (orden.accesorios as any)?.[o.id]);
  const alm = calcularAlmacenaje(orden, config);
  const fin = calcularFinanzasOrden({ ...orden, cargosAdicionalesBs: redondearBs((orden.cargosAdicionalesBs || 0) + alm.montoBs) });
  const saldo = fin.saldoBs;
  const bloqueoSaldo = saldo !== null && saldo > 0 && !orden.entregaConSaldo?.autorizada;
  const bloqueoTotal = tipo === 'entrega' && fin.estadoTotal !== 'aprobado';
  const faltaRearmado = tipo === 'devolucion' && orden.cancelacion?.vehiculoDesarmado && !orden.cancelacion.rearmado?.completado;
  const fotosSalidaIds = useMemo(
    () => PARES_FOTOS.map((p) => fotoDe(p.salida)?.id).filter(Boolean) as string[],
    [fotos]
  );

  const subirFoto = async (file: File | undefined, t: TipoFotoRecepcion, titulo: string) => {
    if (!file) return;
    setSubiendo(t);
    setError(null);
    try {
      const r = await procesarArchivoAdjunto(file);
      await subirFotoOrdenFirestore(orden, t, titulo, r.base64Data, r.tamanioBytes, usuarioActual);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubiendo(null);
    }
  };

  const subirFirma = async (file: File | undefined) => {
    if (!file) return;
    setSubiendo('acta_firmada');
    setError(null);
    try {
      const r = await procesarArchivoAdjunto(file);
      await subirActaFirmadaFirestore(orden, r.base64Data, r.tamanioBytes, usuarioActual);
      onExito('Acta firmada guardada.');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubiendo(null);
    }
  };

  const registrar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await entregarVehiculoFirestore(
        orden.id,
        tipo,
        {
          kmSalida: parseFloat(kmSalida) || 0,
          quienRetira: { nombre: nombreRetira, documento, relacion },
          llavesDevueltas: parseInt(llaves, 10) || 0,
          objetosDevueltos: objetos,
          piezasRetiradasEntregadas: piezas === 'na' ? null : piezas === 'si',
          trabajosRealizados: trabajos,
          recomendacionesNoAprobadas: noAprobadas,
          observaciones,
          fotosSalidaIds,
        },
        config,
        usuarioActual
      );
      onExito(tipo === 'entrega' ? `${orden.folio} entregado. Imprime el acta para la firma.` : `Vehículo de ${orden.folio} devuelto. Cancelación cerrada.`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const acta = orden.actaEntrega && orden.actaEntrega.tipo === tipo ? orden.actaEntrega : null;
  const titulo = tipo === 'entrega' ? 'Acta de entrega' : 'Acta de devolución sin reparar';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="zona-impresion w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:shadow-none print:rounded-none">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-bold">{titulo}</h3>
              <p className="text-xs text-slate-300">
                {orden.folio} · {orden.vehiculoPlaca} · {orden.clienteNombre}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {acta && onEnviar && (
              <button onClick={() => onEnviar(orden)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold">
                <MessageCircle className="w-4 h-4" /> PDF / WhatsApp
              </button>
            )}
            {acta && (
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-900 text-sm font-bold">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 print:overflow-visible">
          {error && (
            <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3 print:hidden">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {acta ? (
            <ActaImprimible orden={orden} config={config} acta={acta} titulo={titulo} fotos={fotos} onSubirFirma={subirFirma} subiendo={subiendo === 'acta_firmada'} />
          ) : (
            <>
              {faltaRearmado && (
                <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3">
                  El vehículo quedó desarmado: primero registra el rearmado (con fotos) desde la lista de cancelaciones.
                </div>
              )}

              <section className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Total aprobado</span><b>{fin.totalAprobadoBs === null ? 'Sin total aprobado' : formatearMonedaBs(fin.totalAprobadoBs)}</b></div>
                {alm.montoBs > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Incluye almacenaje ({alm.diasCobrables} día(s) × {formatearMonedaBs(alm.costoDiario)})</span>
                    <b>{formatearMonedaBs(alm.montoBs)}</b>
                  </div>
                )}
                <div className="flex justify-between"><span>Pagado</span><b>{formatearMonedaBs(fin.totalPagadoBs)}</b></div>
                <div className="flex justify-between text-base"><span>Saldo</span><b className={saldo && saldo > 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatearMonedaBs(saldo)}</b></div>
                {orden.entregaConSaldo?.autorizada && (
                  <p className="text-xs text-amber-800">Entrega con saldo autorizada por {orden.entregaConSaldo.autorizadoPorNombre}.</p>
                )}
                {(bloqueoSaldo || bloqueoTotal) && (
                  <div className="pt-2">
                    <p className="text-xs text-rose-800 mb-2">
                      {bloqueoTotal
                        ? 'Falta registrar la aprobación de la cotización.'
                        : 'Hay saldo pendiente: registra el pago o pide a un dueño que autorice la entrega con saldo.'}
                    </p>
                    {!bloqueoTotal && (
                      <button onClick={() => onAbrirPagos(orden)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">
                        <Wallet className="w-4 h-4" /> Abrir pagos
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Campo titulo={`Km de salida (ingresó con ${orden.kilometraje} km)`}>
                  <input inputMode="numeric" value={kmSalida} onChange={(e) => setKmSalida(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
                </Campo>
                <Campo titulo="Llaves devueltas">
                  <input inputMode="numeric" value={llaves} onChange={(e) => setLlaves(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
                </Campo>
                <Campo titulo="Quién retira (nombre)">
                  <input value={nombreRetira} onChange={(e) => setNombreRetira(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
                </Campo>
                <Campo titulo="Documento (CI)">
                  <input value={documento} onChange={(e) => setDocumento(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
                </Campo>
                <Campo titulo="Relación con el titular">
                  <input value={relacion} onChange={(e) => setRelacion(e.target.value)} placeholder="Titular, chofer, familiar…" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
                </Campo>
                <Campo titulo="Piezas retiradas entregadas al cliente">
                  <select value={piezas} onChange={(e) => setPiezas(e.target.value as any)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm">
                    <option value="na">No aplica</option>
                    <option value="si">Sí, se entregaron</option>
                    <option value="no">No (el cliente no las quiso)</option>
                  </select>
                </Campo>
              </section>

              {objetosIngreso.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-bold">Objetos que ingresaron con el vehículo (marca los devueltos)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {objetosIngreso.map((o) => (
                      <label key={o.id} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg text-sm">
                        <input type="checkbox" checked={!!objetos[o.id]} onChange={(e) => setObjetos((p) => ({ ...p, [o.id]: e.target.checked }))} className="w-5 h-5" />
                        {o.texto}
                        {o.id === 'objetosValor' && orden.accesorios?.objetosValorDetalle ? ` (${orden.accesorios.objetosValorDetalle})` : ''}
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {tipo === 'entrega' && (
                <section className="text-sm">
                  <h4 className="font-bold mb-1">Trabajos realizados</h4>
                  {trabajos.length ? (
                    <ul className="list-disc pl-5 text-slate-700">{trabajos.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  ) : (
                    <p className="text-xs text-slate-500">Sin ítems aprobados.</p>
                  )}
                </section>
              )}
              {noAprobadas.length > 0 && (
                <section className="text-sm">
                  <h4 className="font-bold mb-1">Recomendaciones no aprobadas por el cliente</h4>
                  <ul className="list-disc pl-5 text-slate-700">{noAprobadas.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </section>
              )}

              <section className="space-y-2">
                <h4 className="text-sm font-bold">Fotos de salida (comparadas con las de ingreso)</h4>
                <div className="space-y-2">
                  {PARES_FOTOS.map((p) => {
                    const ing = fotoDe(p.ingreso);
                    const sal = fotoDe(p.salida);
                    return (
                      <div key={p.salida} className="grid grid-cols-[90px_1fr_1fr] gap-2 items-center">
                        <span className="text-xs font-semibold text-slate-600">{p.texto}</span>
                        <Miniatura foto={ing} vacio="Sin foto de ingreso" />
                        {sal ? (
                          <Miniatura foto={sal} vacio="" />
                        ) : (
                          <label className="h-20 flex items-center justify-center gap-1 border-2 border-dashed border-slate-300 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer">
                            {subiendo === p.salida ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Tomar foto
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0], p.salida, `Salida: ${p.texto}`)} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones (opcional)"
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />

              <button
                onClick={registrar}
                disabled={guardando || bloqueoSaldo || bloqueoTotal || !!faltaRearmado || !kmSalida || !nombreRetira.trim() || !documento.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-bold"
              >
                {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {tipo === 'entrega' ? 'Registrar entrega' : 'Registrar devolución'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Campo: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-600">{titulo}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const Miniatura: React.FC<{ foto?: FotoOrden; vacio: string }> = ({ foto, vacio }) =>
  foto ? (
    <img src={foto.base64Data} alt={foto.titulo} className="h-20 w-full object-cover rounded-lg border border-slate-200" />
  ) : (
    <div className="h-20 flex items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-400 text-center px-1">{vacio}</div>
  );

const ActaImprimible: React.FC<{
  orden: OrdenServicio;
  config: TallerConfig;
  acta: NonNullable<OrdenServicio['actaEntrega']>;
  titulo: string;
  fotos: FotoOrden[];
  onSubirFirma: (f: File | undefined) => void;
  subiendo: boolean;
}> = ({ orden, config, acta, titulo, fotos, onSubirFirma, subiendo }) => {
  const fotosSalida = fotos.filter((f) => (acta.fotosSalidaIds || []).includes(f.id));
  return (
    <div className="space-y-4 text-sm text-slate-800">
      <div className="flex justify-between items-start border-b border-slate-300 pb-3">
        <div>
          <p className="text-lg font-extrabold">{config.nombre || 'VX Engineering'}</p>
          <p className="text-xs text-slate-500">{[config.direccion, config.ciudad].filter(Boolean).join(', ')} {config.telefonoWhatsapp ? `· ${config.telefonoWhatsapp}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="font-bold uppercase">{titulo}</p>
          <p className="font-mono">{orden.folio}</p>
          <p className="text-xs">{formatearFecha(acta.fecha)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <p><b>Cliente:</b> {orden.clienteNombre}</p>
        <p><b>Vehículo:</b> {orden.vehiculoMarca} {orden.vehiculoModelo} · {orden.vehiculoPlaca}</p>
        <p><b>Km ingreso / salida:</b> {orden.kilometraje} / {acta.kmSalida}</p>
        <p><b>Llaves devueltas:</b> {acta.llavesDevueltas}</p>
        <p className="col-span-2"><b>Retira:</b> {acta.quienRetira.nombre} · CI {acta.quienRetira.documento} · {acta.quienRetira.relacion}</p>
      </div>

      {acta.trabajosRealizados.length > 0 && (
        <div>
          <p className="font-bold">Trabajos realizados</p>
          <ul className="list-disc pl-5">{acta.trabajosRealizados.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {acta.recomendacionesNoAprobadas.length > 0 && (
        <div>
          <p className="font-bold">Recomendaciones no aprobadas (el cliente fue informado)</p>
          <ul className="list-disc pl-5">{acta.recomendacionesNoAprobadas.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      <div>
        <p className="font-bold">Objetos devueltos</p>
        <p>
          {OBJETOS_ACCESORIOS.filter((o) => acta.objetosDevueltos[o.id]).map((o) => o.texto).join(', ') || 'Ninguno registrado'}
          {acta.piezasRetiradasEntregadas === true ? ' · Piezas retiradas entregadas' : acta.piezasRetiradasEntregadas === false ? ' · El cliente no quiso las piezas retiradas' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
        <p><b>Total:</b> {formatearMonedaBs(acta.totalBs)}</p>
        <p><b>Almacenaje:</b> {formatearMonedaBs(acta.almacenajeBs)}</p>
        <p><b>Pagado:</b> {formatearMonedaBs(acta.pagadoBs)}</p>
        <p><b>Saldo:</b> {formatearMonedaBs(acta.saldoAlEntregarBs)}</p>
      </div>
      {acta.observaciones && <p><b>Observaciones:</b> {acta.observaciones}</p>}

      {fotosSalida.length > 0 && (
        <div className="grid grid-cols-5 gap-1">
          {fotosSalida.map((f) => (
            <img key={f.id} src={f.base64Data} alt={f.titulo} className="h-16 w-full object-cover rounded border border-slate-200" />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        {acta.tipo === 'entrega'
          ? 'Declaro recibir el vehículo en las condiciones descritas, con los trabajos indicados realizados y los objetos marcados.'
          : 'Declaro recibir el vehículo sin reparar, en las condiciones descritas y con los objetos marcados.'}
      </p>
      <div className="grid grid-cols-2 gap-8 pt-10">
        <div className="border-t border-slate-500 pt-1 text-center text-xs">Firma de quien retira</div>
        <div className="border-t border-slate-500 pt-1 text-center text-xs">Por el taller ({acta.registradoPorNombre})</div>
      </div>

      <div className="print:hidden border-t border-slate-200 pt-3">
        {acta.firmaSubida ? (
          <p className="inline-flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> Acta firmada guardada</p>
        ) : (
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold cursor-pointer">
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />} Subir foto del acta firmada
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onSubirFirma(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );
};
