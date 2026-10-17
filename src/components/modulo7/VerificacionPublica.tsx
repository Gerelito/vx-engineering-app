import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PASOS_CLIENTE, TipoDocumentoPublico, VerificacionPublica as Datos } from '../../lib/verificacion';
import { AlertTriangle, BadgeCheck, Ban, Loader2, MessageCircle, SearchX } from 'lucide-react';

const NOMBRE_DOC: Record<TipoDocumentoPublico, string> = {
  orden: 'Orden de servicio',
  cotizacion: 'Cotización',
  acta_entrega: 'Acta de entrega',
  acta_devolucion: 'Acta de devolución',
};

function leerHash() {
  const h = window.location.hash.replace(/^#/, '');
  const [ruta, qs] = h.split('?');
  const codigo = (ruta.split('/')[2] || '').trim();
  const p = new URLSearchParams(qs || '');
  const d = p.get('d') as TipoDocumentoPublico | null;
  const n = p.get('n') ? parseInt(p.get('n')!, 10) : null;
  return { codigo, d: d && d in NOMBRE_DOC ? d : null, n: Number.isFinite(n as number) ? n : null };
}

function fecha(iso?: string) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const d = new Date(t - 4 * 3_600_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Página pública /#/v/{codigo}: no exige iniciar sesión y solo lee /verificaciones/{codigo}. */
export const VerificacionPublica: React.FC = () => {
  const [{ codigo, d, n }] = useState(leerHash);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no_existe' | 'error'>('cargando');

  useEffect(() => {
    document.title = 'Verificación de documento';
    if (!/^[0-9A-Za-z]{16,}$/.test(codigo)) {
      setEstado('no_existe');
      return;
    }
    getDoc(doc(db, 'verificaciones', codigo))
      .then((s) => {
        if (!s.exists()) setEstado('no_existe');
        else {
          setDatos(s.data() as Datos);
          setEstado('ok');
        }
      })
      .catch(() => setEstado('error'));
  }, [codigo]);

  const anulado = datos?.activo === false;
  const reemplazado = !!datos && d === 'cotizacion' && n !== null && typeof datos.version === 'number' && n < datos.version;
  const docInfo = datos && d ? datos.documentos?.[d] : undefined;
  const tel = (datos?.tallerTelefono || '').replace(/\D/g, '');
  const telWa = tel.length === 8 ? `591${tel}` : tel;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white">
          <p className="text-[11px] uppercase tracking-widest text-slate-400">Verificación de documento</p>
          <p className="text-lg font-extrabold">{datos?.tallerNombre || 'Taller mecánico'}</p>
        </div>

        <div className="p-5 space-y-4">
          {estado === 'cargando' && (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Verificando…
            </div>
          )}

          {(estado === 'no_existe' || estado === 'error') && (
            <div className="text-center py-6 space-y-2">
              <SearchX className="w-12 h-12 mx-auto text-rose-600" />
              <p className="text-xl font-extrabold text-rose-700">{estado === 'error' ? 'No se pudo verificar' : 'Código no válido'}</p>
              <p className="text-sm text-slate-600">
                {estado === 'error'
                  ? 'Revise su conexión a internet e intente de nuevo.'
                  : 'Este código no corresponde a ningún documento del taller. Si cree que es un error, comuníquese con el taller.'}
              </p>
            </div>
          )}

          {estado === 'ok' && datos && (
            <>
              {anulado ? (
                <Sello color="rose" icono={<Ban className="w-7 h-7" />} titulo="Documento anulado" texto="El taller desactivó este enlace. Pida el documento vigente al taller." />
              ) : reemplazado ? (
                <Sello
                  color="amber"
                  icono={<AlertTriangle className="w-7 h-7" />}
                  titulo="Documento reemplazado"
                  texto={`Esta es la versión ${n} de la cotización. La versión vigente es la ${datos.version}.`}
                />
              ) : (
                <Sello color="emerald" icono={<BadgeCheck className="w-7 h-7" />} titulo="Documento auténtico" texto="Emitido por el taller y registrado en su sistema." />
              )}

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {d && (
                  <>
                    <dt className="text-slate-500">Documento</dt>
                    <dd className="font-semibold">
                      {NOMBRE_DOC[d]}
                      {d === 'cotizacion' && n ? ` · versión ${n}` : ''}
                    </dd>
                    <dt className="text-slate-500">Emitido</dt>
                    <dd className="font-semibold">{fecha(docInfo?.fechaEmision)}</dd>
                  </>
                )}
                <dt className="text-slate-500">Folio</dt>
                <dd className="font-mono font-bold">{datos.folio}</dd>
                <dt className="text-slate-500">Cliente</dt>
                <dd className="font-semibold">{datos.clienteNombre}</dd>
                <dt className="text-slate-500">Vehículo</dt>
                <dd className="font-semibold">
                  {datos.vehiculo?.marca} {datos.vehiculo?.modelo} · {datos.vehiculo?.placa}
                </dd>
              </dl>

              {!anulado && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Estado de su vehículo</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${datos.cancelada ? 'bg-rose-700' : 'bg-orange-700'}`}>
                      {datos.estadoCliente}
                    </span>
                  </div>
                  {!datos.cancelada && (
                    <ol className="space-y-1.5">
                      {PASOS_CLIENTE.map((p, i) => {
                        const hecho = i < datos.pasoCliente;
                        const ahora = i === datos.pasoCliente;
                        return (
                          <li key={p} className="flex items-center gap-2 text-sm">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                hecho ? 'bg-green-700 text-white' : ahora ? 'bg-orange-700 text-white' : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {hecho ? '✓' : i + 1}
                            </span>
                            <span className={ahora ? 'font-bold text-orange-800' : hecho ? 'text-slate-800' : 'text-slate-400'}>
                              {i === 2 && datos.estadoCliente === 'Esperando aprobación' ? 'Aprobación' : p}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <p className="text-[11px] text-slate-500 mt-3">Actualizado: {fecha(datos.actualizado)}</p>
                </div>
              )}

              {telWa && (
                <a
                  href={`https://wa.me/${telWa}?text=${encodeURIComponent(`Hola, consulto por la orden ${datos.folio}.`)}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold text-sm"
                >
                  <MessageCircle className="w-4 h-4" /> Escribir al taller
                </a>
              )}
            </>
          )}
          <p className="text-[11px] text-slate-400 text-center">Este documento no es una factura.</p>
        </div>
      </div>
    </div>
  );
};

const Sello: React.FC<{ color: 'emerald' | 'rose' | 'amber'; icono: React.ReactNode; titulo: string; texto: string }> = ({ color, icono, titulo, texto }) => {
  const c = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }[color];
  return (
    <div className={`flex items-start gap-3 border rounded-xl p-3 ${c}`}>
      {icono}
      <div>
        <p className="text-lg font-extrabold leading-tight">{titulo}</p>
        <p className="text-sm opacity-90">{texto}</p>
      </div>
    </div>
  );
};
