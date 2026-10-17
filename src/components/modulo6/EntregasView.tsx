import React, { useState } from 'react';
import { AvisoCliente, DuenoUsuario, OrdenServicio, TallerConfig } from '../../types';
import {
  calcularAlmacenaje,
  horasDesdeAviso,
  registrarAvisoClienteFirestore,
  registrarRearmadoFirestore,
  registrarSeguimientoCancelacionFirestore,
  subirFotoOrdenFirestore,
} from '../../lib/entrega';
import { calcularFinanzasOrden, diaLaPaz, formatearDia, redondearBs } from '../../lib/caja';
import { procesarArchivoAdjunto } from '../../lib/fileCompression';
import { formatearMonedaBs } from '../../lib/storage';
import { AlertTriangle, Bell, Camera, ClipboardCheck, KeyRound, Loader2, MessageCircle, PhoneCall, ShieldCheck, Undo2, Wallet, Wrench, X } from 'lucide-react';

interface Props {
  ordenes: OrdenServicio[];
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onAbrirControlCalidad: (o: OrdenServicio) => void;
  onAbrirActa: (o: OrdenServicio, tipo: 'entrega' | 'devolucion') => void;
  onAbrirPagos: (o: OrdenServicio) => void;
  onAbrirDetalle: (o: OrdenServicio) => void;
  onExito: (m: string) => void;
}

const telWa = (o: OrdenServicio) => (o.clienteTelefonoE164 || '').replace('+', '');

export const EntregasView: React.FC<Props> = ({ ordenes, config, usuarioActual, onAbrirControlCalidad, onAbrirActa, onAbrirPagos, onAbrirDetalle, onExito }) => {
  const [avisoPara, setAvisoPara] = useState<OrdenServicio | null>(null);
  const [rearmadoPara, setRearmadoPara] = useState<OrdenServicio | null>(null);
  const [seguimientoPara, setSeguimientoPara] = useState<OrdenServicio | null>(null);

  const hoy = diaLaPaz(new Date());
  const enControl = ordenes.filter((o) => o.estado === 'Control de calidad');
  const listos = ordenes.filter((o) => o.estado === 'Listo para entrega');
  const porAvisar = listos.filter((o) => !o.avisoCliente);
  const sinRetirar = listos
    .filter((o) => o.avisoCliente)
    .sort((a, b) => (horasDesdeAviso(b) || 0) - (horasDesdeAviso(a) || 0));
  const cancelAbiertas = ordenes.filter((o) => o.estado === 'Cancelada' && o.cancelacion?.estado === 'abierta');
  const seguimientos = ordenes.filter(
    (o) => o.cancelacion?.estado === 'cerrada' && !o.cancelacion.seguimientoRealizado && o.cancelacion.seguimientoFecha && o.cancelacion.seguimientoFecha <= hoy
  );
  const sinFirma = ordenes.filter((o) => o.actaEntrega && !o.actaEntrega.firmaSubida);

  const encabezado = (o: OrdenServicio) => (
    <div className="min-w-0">
      <button onClick={() => onAbrirDetalle(o)} className="font-bold text-slate-900 hover:underline text-left">
        {o.clienteNombre}
      </button>
      <p className="text-xs text-slate-500">
        <span className="font-mono font-bold text-slate-700">{o.folio}</span> · {o.vehiculoPlaca} · {o.vehiculoMarca} {o.vehiculoModelo} · {o.clienteTelefono}
      </p>
    </div>
  );

  const saldoTexto = (o: OrdenServicio) => {
    const alm = calcularAlmacenaje(o, config);
    const fin = calcularFinanzasOrden({ ...o, cargosAdicionalesBs: redondearBs((o.cargosAdicionalesBs || 0) + alm.montoBs) });
    return { alm, fin };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Entregas y cancelaciones</h2>
          <p className="text-xs text-slate-500">Control de calidad, aviso al cliente, retiro, devoluciones y seguimientos</p>
        </div>
      </div>

      <Seccion titulo="En control de calidad" icono={<ShieldCheck className="w-4 h-4" />} cantidad={enControl.length} vacio="Ninguna orden esperando control de calidad.">
        {enControl.map((o) => (
          <Tarjeta key={o.id}>
            <div className="flex justify-between gap-2">
              {encabezado(o)}
              {(o.retrabajos || 0) > 0 && <span className="text-[11px] font-bold px-2 py-1 h-fit rounded-full bg-amber-100 text-amber-900">Retrabajo ×{o.retrabajos}</span>}
            </div>
            <Botones>
              <Boton onClick={() => onAbrirControlCalidad(o)} fuerte>
                <ShieldCheck className="w-4 h-4" /> Hacer control de calidad
              </Boton>
            </Botones>
          </Tarjeta>
        ))}
      </Seccion>

      <Seccion titulo="Por avisar al cliente" icono={<Bell className="w-4 h-4" />} cantidad={porAvisar.length} vacio="No hay vehículos listos sin avisar.">
        {porAvisar.map((o) => (
          <Tarjeta key={o.id}>
            {encabezado(o)}
            <Botones>
              <Boton onClick={() => setAvisoPara(o)} fuerte>
                <Bell className="w-4 h-4" /> Registrar aviso
              </Boton>
              <Boton onClick={() => onAbrirActa(o, 'entrega')}>
                <KeyRound className="w-4 h-4" /> Entregar ahora
              </Boton>
            </Botones>
          </Tarjeta>
        ))}
      </Seccion>

      <Seccion titulo="Avisados, sin retirar" icono={<KeyRound className="w-4 h-4" />} cantidad={sinRetirar.length} vacio="No hay vehículos esperando retiro.">
        {sinRetirar.map((o) => {
          const h = horasDesdeAviso(o) || 0;
          const color = h >= 72 ? 'bg-rose-600 text-white' : h >= 24 ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-900';
          const { alm, fin } = saldoTexto(o);
          return (
            <Tarjeta key={o.id}>
              <div className="flex justify-between gap-2">
                {encabezado(o)}
                <span className={`text-[11px] font-bold px-2 py-1 h-fit rounded-full whitespace-nowrap ${color}`}>
                  {h < 24 ? `${h} h` : `${Math.floor(h / 24)} día(s)`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Avisado por {o.avisoCliente?.medio} · {o.avisoCliente?.resultado} · Almacenaje:{' '}
                {alm.montoBs > 0 ? <b className="text-amber-800">{formatearMonedaBs(alm.montoBs)} ({alm.diasCobrables} día(s))</b> : `gratis hasta ${alm.diasGratis} días`} · Saldo:{' '}
                <b>{formatearMonedaBs(fin.saldoBs)}</b>
              </p>
              <Botones>
                <Boton onClick={() => onAbrirActa(o, 'entrega')} fuerte>
                  <KeyRound className="w-4 h-4" /> Entregar
                </Boton>
                <Boton onClick={() => onAbrirPagos(o)}>
                  <Wallet className="w-4 h-4" /> Pagos
                </Boton>
                <Boton onClick={() => setAvisoPara(o)}>
                  <Bell className="w-4 h-4" /> Nuevo aviso
                </Boton>
              </Botones>
            </Tarjeta>
          );
        })}
      </Seccion>

      <Seccion titulo="Cancelaciones abiertas" icono={<Undo2 className="w-4 h-4" />} cantidad={cancelAbiertas.length} vacio="No hay cancelaciones abiertas.">
        {cancelAbiertas.map((o) => {
          const c = o.cancelacion!;
          const faltaRearmar = c.vehiculoDesarmado && !c.rearmado?.completado;
          const { fin } = saldoTexto(o);
          return (
            <Tarjeta key={o.id}>
              {encabezado(o)}
              <p className="text-xs text-slate-600 mt-2">
                {c.motivo}
                {c.nota ? ` · ${c.nota}` : ''} · Diagnóstico: {formatearMonedaBs(c.montoDiagnosticoBs)} · Saldo: <b>{formatearMonedaBs(fin.saldoBs)}</b>
              </p>
              {faltaRearmar && <p className="text-xs font-semibold text-amber-800 mt-1">Vehículo desarmado: falta rearmar.</p>}
              <Botones>
                {faltaRearmar ? (
                  <Boton onClick={() => setRearmadoPara(o)} fuerte>
                    <Wrench className="w-4 h-4" /> Registrar rearmado
                  </Boton>
                ) : (
                  <Boton onClick={() => onAbrirActa(o, 'devolucion')} fuerte>
                    <Undo2 className="w-4 h-4" /> Devolver vehículo
                  </Boton>
                )}
                <Boton onClick={() => onAbrirPagos(o)}>
                  <Wallet className="w-4 h-4" /> Pagos
                </Boton>
              </Botones>
            </Tarjeta>
          );
        })}
      </Seccion>

      <Seccion titulo="Seguimientos a 30 días" icono={<PhoneCall className="w-4 h-4" />} cantidad={seguimientos.length} vacio="No hay llamadas de seguimiento pendientes.">
        {seguimientos.map((o) => (
          <Tarjeta key={o.id}>
            {encabezado(o)}
            <p className="text-xs text-slate-600 mt-2">
              Cancelada por: {o.cancelacion?.motivo} · Llamar desde el {formatearDia(o.cancelacion?.seguimientoFecha || '')}
            </p>
            <Botones>
              <Boton onClick={() => setSeguimientoPara(o)} fuerte>
                <PhoneCall className="w-4 h-4" /> Registrar llamada
              </Boton>
            </Botones>
          </Tarjeta>
        ))}
      </Seccion>

      {sinFirma.length > 0 && (
        <Seccion titulo="Actas sin firma subida" icono={<ClipboardCheck className="w-4 h-4" />} cantidad={sinFirma.length} vacio="">
          {sinFirma.map((o) => (
            <Tarjeta key={o.id}>
              {encabezado(o)}
              <Botones>
                <Boton onClick={() => onAbrirActa(o, o.actaEntrega!.tipo)} fuerte>
                  <ClipboardCheck className="w-4 h-4" /> Ver / imprimir acta y subir firma
                </Boton>
              </Botones>
            </Tarjeta>
          ))}
        </Seccion>
      )}

      {avisoPara && <AvisoModal orden={avisoPara} config={config} usuarioActual={usuarioActual} onClose={() => setAvisoPara(null)} onExito={onExito} />}
      {rearmadoPara && <RearmadoModal orden={rearmadoPara} usuarioActual={usuarioActual} onClose={() => setRearmadoPara(null)} onExito={onExito} />}
      {seguimientoPara && <SeguimientoModal orden={seguimientoPara} usuarioActual={usuarioActual} onClose={() => setSeguimientoPara(null)} onExito={onExito} />}
    </div>
  );
};

const Seccion: React.FC<{ titulo: string; icono: React.ReactNode; cantidad: number; vacio: string; children: React.ReactNode }> = ({ titulo, icono, cantidad, vacio, children }) => (
  <section className="space-y-2">
    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
      {icono} {titulo}
      <span className={`text-[11px] px-2 py-0.5 rounded-full ${cantidad ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{cantidad}</span>
    </h3>
    {cantidad === 0 ? <p className="text-xs text-slate-400 pl-6">{vacio}</p> : <div className="space-y-2">{children}</div>}
  </section>
);

const Tarjeta: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">{children}</div>
);
const Botones: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="flex flex-wrap gap-2 mt-3">{children}</div>;
const Boton: React.FC<{ onClick: () => void; fuerte?: boolean; children: React.ReactNode }> = ({ onClick, fuerte, children }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-bold ${
      fuerte ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);

const MarcoModal: React.FC<{ titulo: string; sub: string; onClose: () => void; children: React.ReactNode }> = ({ titulo, sub, onClose, children }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <h3 className="font-bold">{titulo}</h3>
          <p className="text-xs text-slate-300">{sub}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  </div>
);

const ErrorCaja: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      {error}
    </div>
  ) : null;

const AvisoModal: React.FC<{ orden: OrdenServicio; config: TallerConfig; usuarioActual: DuenoUsuario; onClose: () => void; onExito: (m: string) => void }> = ({
  orden,
  config,
  usuarioActual,
  onClose,
  onExito,
}) => {
  const [medio, setMedio] = useState<AvisoCliente['medio']>('WhatsApp');
  const [resultado, setResultado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tel = telWa(orden);
  const texto = `Hola ${orden.clienteNombre}, le saluda ${config.nombre || 'VX Engineering'}. Su vehículo ${orden.vehiculoMarca} ${orden.vehiculoModelo} (${orden.vehiculoPlaca}) ya está listo para recoger (orden ${orden.folio}). Horario: ${config.horario || 'consultar'}. Después de ${config.almacenajeDiasGratis ?? 3} días se cobra almacenaje.`;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarAvisoClienteFirestore(orden, { medio, resultado: resultado.trim() || 'Avisado' }, usuarioActual);
      onExito(`Aviso registrado para ${orden.folio}. El almacenaje corre desde ahora.`);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <MarcoModal titulo="Avisar que el vehículo está listo" sub={`${orden.folio} · ${orden.clienteNombre}`} onClose={onClose}>
      <ErrorCaja error={error} />
      {tel ? (
        <a
          href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold text-sm"
        >
          <MessageCircle className="w-4 h-4" /> Abrir WhatsApp con el mensaje
        </a>
      ) : (
        <p className="text-xs text-slate-500">El cliente no tiene WhatsApp registrado: llama al {orden.clienteTelefono}.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(['WhatsApp', 'Llamada', 'Mensaje', 'En persona'] as AvisoCliente['medio'][]).map((m) => (
          <button key={m} onClick={() => setMedio(m)} className={`py-2.5 rounded-lg text-sm font-bold border ${medio === m ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300'}`}>
            {m}
          </button>
        ))}
      </div>
      <input value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Resultado (ej.: pasa mañana a las 10)" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
      <button onClick={guardar} disabled={guardando} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 disabled:opacity-40 text-white font-bold text-sm">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Registrar aviso
      </button>
    </MarcoModal>
  );
};

const RearmadoModal: React.FC<{ orden: OrdenServicio; usuarioActual: DuenoUsuario; onClose: () => void; onExito: (m: string) => void }> = ({ orden, usuarioActual, onClose, onExito }) => {
  const [notas, setNotas] = useState('');
  const [fotosIds, setFotosIds] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = async (file: File | undefined) => {
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await procesarArchivoAdjunto(file);
      const id = await subirFotoOrdenFirestore(orden, 'rearmado', 'Vehículo rearmado', r.base64Data, r.tamanioBytes, usuarioActual);
      setFotosIds((p) => [...p, id]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarRearmadoFirestore(orden, notas, fotosIds, usuarioActual);
      onExito(`Rearmado registrado. Ya puedes devolver el vehículo de ${orden.folio}.`);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <MarcoModal titulo="Rearmado del vehículo" sub={`${orden.folio} · ${orden.vehiculoPlaca}`} onClose={onClose}>
      <ErrorCaja error={error} />
      <label className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm font-bold cursor-pointer">
        {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Tomar foto del vehículo rearmado
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
      </label>
      {fotosIds.length > 0 && <p className="text-xs text-emerald-700 font-semibold">{fotosIds.length} foto(s) guardada(s)</p>}
      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (qué se volvió a montar)" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <button onClick={guardar} disabled={guardando || fotosIds.length === 0} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 disabled:opacity-40 text-white font-bold text-sm">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar rearmado
      </button>
    </MarcoModal>
  );
};

const SeguimientoModal: React.FC<{ orden: OrdenServicio; usuarioActual: DuenoUsuario; onClose: () => void; onExito: (m: string) => void }> = ({ orden, usuarioActual, onClose, onExito }) => {
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarSeguimientoCancelacionFirestore(orden, nota, usuarioActual);
      onExito('Seguimiento registrado.');
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <MarcoModal titulo="Llamada de seguimiento" sub={`${orden.folio} · ${orden.clienteNombre} · ${orden.clienteTelefono}`} onClose={onClose}>
      <ErrorCaja error={error} />
      <a href={`tel:${orden.clienteTelefonoE164 || orden.clienteTelefono}`} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 text-sm font-bold">
        <PhoneCall className="w-4 h-4" /> Llamar
      </a>
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué dijo el cliente? (ej.: ya lo arregló en otro lado, quiere cotizar de nuevo…)" rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <button onClick={guardar} disabled={guardando || !nota.trim()} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 disabled:opacity-40 text-white font-bold text-sm">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
      </button>
    </MarcoModal>
  );
};
