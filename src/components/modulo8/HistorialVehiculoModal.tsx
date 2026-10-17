import React, { useEffect, useMemo, useState } from 'react';
import { Cliente, ContactoCliente, DuenoUsuario, OrdenServicio, TallerConfig, Vehiculo } from '../../types';
import {
  AlertaHistorial,
  EventoLinea,
  TipoEvento,
  Visita,
  alertasVehiculo,
  cargarVisitas,
  componenteDeItem,
  contactosDe,
  lineaDeTiempo,
  puntosKilometraje,
  ultimosComponentes,
} from '../../lib/historial';
import { formatearMonedaBs } from '../../lib/storage';
import {
  AlertTriangle,
  Ban,
  Car,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Gauge,
  History,
  KeyRound,
  Loader2,
  MessageCircle,
  PencilLine,
  ShieldCheck,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';

interface Props {
  vehiculo: Vehiculo;
  clientes: Cliente[];
  ordenes: OrdenServicio[];
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onAbrirOrden: (o: OrdenServicio) => void;
  onInformePdf: (vehiculo: Vehiculo, visitas: Visita[]) => void;
  onClose: () => void;
}

const DIA = 86_400_000;
const fecha = (ms: number | null | undefined, hora = false) => {
  if (!ms) return '—';
  const d = new Date(ms - 4 * 3_600_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}${hora ? ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : ''}`;
};

type Pestana = 'visitas' | 'linea' | 'componentes' | 'km' | 'contactos';

export const HistorialVehiculoModal: React.FC<Props> = ({ vehiculo, clientes, ordenes, usuarioActual, onAbrirOrden, onInformePdf, onClose }) => {
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('visitas');
  const [abierta, setAbierta] = useState<string | null>(null);
  // Filtros
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [responsable, setResponsable] = useState('');
  const [montoMin, setMontoMin] = useState('');
  const [repuesto, setRepuesto] = useState('');

  const ordenesVehiculo = useMemo(() => ordenes.filter((o) => o.vehiculoId === vehiculo.id), [ordenes, vehiculo.id]);
  const claveOrdenes = ordenesVehiculo.map((o) => `${o.id}:${o.estado}:${(o as any).updatedAt?.seconds || ''}`).join('|');
  void usuarioActual;

  useEffect(() => {
    let vivo = true;
    setError(null);
    cargarVisitas(ordenesVehiculo)
      .then((v) => vivo && setVisitas(v))
      .catch((e) => vivo && setError(e?.message || String(e)));
    if (ordenesVehiculo.length)
      contactosDe({ ordenIds: ordenesVehiculo.map((o) => o.id) })
        .then((c) => vivo && setContactos(c))
        .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [claveOrdenes]);

  const propietario = clientes.find((c) => c.id === vehiculo.propietarioActualId);
  const alertas: AlertaHistorial[] = visitas ? alertasVehiculo(vehiculo, visitas) : [];
  const responsables = Array.from(new Set(ordenesVehiculo.map((o) => o.mecanicoResponsable).filter(Boolean))) as string[];

  const filtradas = (visitas || []).filter((v) => {
    if (desde && v.ingresoMs < Date.parse(`${desde}T00:00:00-04:00`)) return false;
    if (hasta && v.ingresoMs > Date.parse(`${hasta}T23:59:59-04:00`)) return false;
    if (tipoServicio && v.orden.tipoServicio !== tipoServicio) return false;
    if (responsable && v.orden.mecanicoResponsable !== responsable) return false;
    if (montoMin && (v.totalBs || 0) < Number(montoMin)) return false;
    if (repuesto) {
      const q = repuesto.toLowerCase();
      if (!v.trabajos.some((t) => t.tipo === 'repuesto' && `${t.descripcion} ${t.marcaRepuesto || ''} ${t.serialRepuesto || ''}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[45] flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-900/60 overflow-y-auto">
      <div className="w-full max-w-5xl bg-slate-50 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[94vh]">
        <div className="px-4 sm:px-5 py-4 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-lg leading-tight">
                <span className="font-mono">{vehiculo.placa}</span> · {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
              </h3>
              <p className="text-xs text-slate-300 truncate">
                Hoja de vida · {propietario ? `${propietario.nombre} · ${propietario.telefono}` : 'sin propietario'}
                {vehiculo.vin ? ` · VIN ${vehiculo.vin}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => visitas && onInformePdf(vehiculo, visitas)}
              disabled={!visitas}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold disabled:opacity-40"
            >
              <FileText className="w-4 h-4" /> <span className="hidden sm:inline">Informe PDF</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5 space-y-4">
          {error && <p className="text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">{error}</p>}

          {/* Alertas */}
          {visitas && (
            <div className="space-y-1.5">
              {alertas.length === 0 ? (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Sin alertas para este vehículo.
                </p>
              ) : (
                alertas.map((a, i) => (
                  <p
                    key={i}
                    className={`text-sm rounded-lg px-3 py-2 flex gap-2 border ${
                      a.nivel === 'rojo' ? 'bg-rose-50 border-rose-200 text-rose-900' : a.nivel === 'ambar' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {a.texto}
                  </p>
                ))
              )}
              <p className="text-[11px] text-slate-400">Garantía vigente: disponible en una fase posterior.</p>
            </div>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Dato titulo="Visitas" valor={String(ordenesVehiculo.length)} />
            <Dato titulo="Último km" valor={vehiculo.ultimoKilometraje ? `${vehiculo.ultimoKilometraje.toLocaleString('es-BO')} km` : '—'} />
            <Dato titulo="SOAT" valor={vehiculo.vencimientoSoat || '—'} />
            <Dato titulo="ITV" valor={vehiculo.vencimientoItv || '—'} />
          </div>

          <div className="flex gap-1 overflow-x-auto bg-white border border-slate-200 rounded-xl p-1 text-sm font-bold">
            {(
              [
                ['visitas', 'Visitas', ClipboardList],
                ['linea', 'Línea de tiempo', History],
                ['componentes', 'Componentes', Wrench],
                ['km', 'Kilometraje', Gauge],
                ['contactos', 'Contactos', MessageCircle],
              ] as [Pestana, string, any][]
            ).map(([id, txt, Icono]) => (
              <button
                key={id}
                onClick={() => setPestana(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap ${pestana === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icono className="w-4 h-4" /> {txt}
              </button>
            ))}
          </div>

          {!visitas && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando historial…
            </div>
          )}

          {visitas && pestana === 'visitas' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <Filtro titulo="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white" /></Filtro>
                <Filtro titulo="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white" /></Filtro>
                <Filtro titulo="Tipo de servicio">
                  <select value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white">
                    <option value="">Todos</option>
                    <option>Programado</option>
                    <option>Preventivo</option>
                    <option>Correctivo</option>
                  </select>
                </Filtro>
                <Filtro titulo="Responsable">
                  <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white">
                    <option value="">Todos</option>
                    {responsables.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Filtro>
                <Filtro titulo="Monto mínimo (Bs)"><input inputMode="numeric" value={montoMin} onChange={(e) => setMontoMin(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white" /></Filtro>
                <Filtro titulo="Repuesto instalado"><input value={repuesto} onChange={(e) => setRepuesto(e.target.value)} placeholder="ej. Bosch" className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white" /></Filtro>
              </div>

              {filtradas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">{visitas.length ? 'Ninguna visita con estos filtros.' : 'Este vehículo todavía no tiene visitas.'}</p>
              ) : (
                <div className="space-y-2">
                  {filtradas.map((v) => (
                    <TarjetaVisita key={v.orden.id} v={v} abierta={abierta === v.orden.id} onToggle={() => setAbierta(abierta === v.orden.id ? null : v.orden.id)} onAbrirOrden={onAbrirOrden} />
                  ))}
                </div>
              )}
            </>
          )}

          {visitas && pestana === 'linea' && <LineaTiempo eventos={lineaDeTiempo(visitas, contactos)} />}

          {visitas && pestana === 'componentes' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {ultimosComponentes(visitas).map((c) => {
                const meses = c.fechaMs ? Math.floor((Date.now() - c.fechaMs) / (30 * DIA)) : null;
                return (
                  <div key={c.id} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold">{c.texto}</p>
                      <p className="text-xs text-slate-500 truncate">{c.detalle || 'Sin registro en el taller'}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      {c.fechaMs ? (
                        <>
                          <p className="font-semibold">{fecha(c.fechaMs)}</p>
                          <p className="text-slate-500">
                            {c.km ? `${c.km.toLocaleString('es-BO')} km · ` : ''}hace {meses} mes(es) · {c.folio}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="p-3 text-[11px] text-slate-400">
                Se toma de los trabajos entregados. Para que sea exacto, elige el "componente" al cargar el ítem en la cotización.
              </p>
            </div>
          )}

          {visitas && pestana === 'km' && <GraficaKm puntos={puntosKilometraje(visitas)} />}

          {visitas && pestana === 'contactos' && <ListaContactos contactos={contactos} />}
        </div>
      </div>
    </div>
  );
};

const Dato: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
    <p className="text-[11px] text-slate-500">{titulo}</p>
    <p className="font-bold text-sm">{valor}</p>
  </div>
);

const Filtro: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <label className="block">
    <span className="text-[11px] font-semibold text-slate-500">{titulo}</span>
    {children}
  </label>
);

const ESTADO_COLOR: Record<string, string> = {
  Entregado: 'bg-emerald-100 text-emerald-900',
  Cancelada: 'bg-rose-100 text-rose-900',
};

const TarjetaVisita: React.FC<{ v: Visita; abierta: boolean; onToggle: () => void; onAbrirOrden: (o: OrdenServicio) => void }> = ({ v, abierta, onToggle, onAbrirOrden }) => {
  const o = v.orden;
  const dt = o.diagnosticoTecnico;
  const obd = dt?.codigosObd2 || [];
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-sm">{o.folio}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ESTADO_COLOR[o.estado] || 'bg-sky-100 text-sky-900'}`}>{o.estado}</span>
            <span className="text-xs text-slate-500">
              {fecha(v.ingresoMs)}
              {v.entregaMs ? ` → ${fecha(v.entregaMs)}` : ''} · {o.kilometraje?.toLocaleString('es-BO')} km
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-1 line-clamp-2">"{o.motivoCliente}"</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{v.totalBs === null ? 'Por definir' : formatearMonedaBs(v.totalBs)}</p>
          {v.saldoBs !== null && v.saldoBs > 0.004 && <p className="text-[11px] font-bold text-rose-700">Saldo {formatearMonedaBs(v.saldoBs)}</p>}
          {abierta ? <ChevronUp className="w-4 h-4 ml-auto mt-1 text-slate-400" /> : <ChevronDown className="w-4 h-4 ml-auto mt-1 text-slate-400" />}
        </div>
      </button>

      {abierta && (
        <div className="border-t border-slate-100 p-3 sm:p-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <p><b>Servicio:</b> {o.tipoServicio} · {(o.sistemasAfectados || []).join(', ') || '—'}</p>
            <p><b>Responsable:</b> {o.mecanicoResponsable || '—'} · <b>Recibió:</b> {o.creadoPorNombre || '—'}</p>
            <p><b>Fotos:</b> {o.totalFotos || 0} · <b>Retrabajos:</b> {o.retrabajos || 0}</p>
          </div>

          {dt && (dt.hallazgos?.length || obd.length) ? (
            <Bloque titulo="Diagnóstico">
              {obd.length > 0 && <p className="text-xs"><b>Códigos OBD:</b> {obd.map((c) => `${c.codigo} (${c.descripcion})`).join(', ')}</p>}
              <ul className="list-disc pl-5 text-xs">
                {(dt.hallazgos || []).map((h) => (
                  <li key={h.id}>
                    [{h.sistema}] {h.descripcion} — {h.clasificacion}
                  </li>
                ))}
              </ul>
            </Bloque>
          ) : null}

          <Bloque titulo={`Trabajos realizados${o.estado === 'Entregado' ? '' : ' / aprobados'}`}>
            {v.trabajos.length === 0 ? (
              <p className="text-xs text-slate-500">Sin trabajos aprobados.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {v.trabajos.map((t) => {
                    const comp = componenteDeItem(t);
                    return (
                      <tr key={t.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-1 pr-2">
                          {t.descripcion}
                          {t.marcaRepuesto ? <span className="text-slate-500"> · {t.marcaRepuesto}</span> : null}
                          {t.serialRepuesto ? <span className="text-slate-500"> · S/N {t.serialRepuesto}</span> : null}
                          {comp ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{comp.replace('_', ' ')}</span> : null}
                        </td>
                        <td className="py-1 text-slate-500 whitespace-nowrap">{t.tipo === 'mano_obra' ? 'Mano de obra' : t.tipo === 'repuesto' ? 'Repuesto' : 'Externo'}</td>
                        <td className="py-1 text-right whitespace-nowrap">{t.precioPorDefinir ? 'Por definir' : formatearMonedaBs((t.precioTotalBs || 0) - (t.descuentoMontoBs || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Bloque>

          {v.recomendaciones.length > 0 && (
            <Bloque titulo="Recomendaciones no aprobadas">
              <ul className="list-disc pl-5 text-xs">{v.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </Bloque>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Bloque titulo="Cotizaciones y aprobaciones">
              {v.cotizaciones.length === 0 ? (
                <p className="text-xs text-slate-500">Sin cotizaciones.</p>
              ) : (
                <ul className="text-xs space-y-0.5">
                  {[...v.cotizaciones]
                    .sort((a, b) => (a.versionNumero || 0) - (b.versionNumero || 0))
                    .map((c) => (
                      <li key={c.id}>
                        v{c.versionNumero}
                        {c.esComplementariaTrabajoAdicional ? ' (adicional)' : ''} · {c.estado.replace('_', ' ')} ·{' '}
                        {c.totalBs === null ? 'por definir' : formatearMonedaBs(c.totalBs)}
                        {c.aprobacion ? ` · aprobó ${c.aprobacion.nombreAprobador || ''} por ${c.aprobacion.medio || ''}` : ''}
                      </li>
                    ))}
                </ul>
              )}
            </Bloque>
            <Bloque titulo="Pagos">
              {v.pagos.length === 0 ? (
                <p className="text-xs text-slate-500">Sin pagos.</p>
              ) : (
                <ul className="text-xs space-y-0.5">
                  {v.pagos.map((p) => (
                    <li key={p.id}>
                      {fecha(Date.parse(p.fechaLocal))} · {p.tipo} · {p.montos.filter((m) => m.montoBs).map((m) => m.medio).join(' + ')} · {formatearMonedaBs(p.totalBs)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs mt-1">
                Pagado {formatearMonedaBs(v.pagadoBs)} · Saldo <b>{v.saldoBs === null ? 'por calcular' : formatearMonedaBs(v.saldoBs)}</b>
              </p>
            </Bloque>
          </div>

          {o.actaEntrega && (
            <Bloque titulo={o.actaEntrega.tipo === 'entrega' ? 'Acta de entrega' : 'Acta de devolución'}>
              <p className="text-xs">
                {fecha(Date.parse(o.actaEntrega.fecha), true)} · retiró {o.actaEntrega.quienRetira.nombre} ({o.actaEntrega.quienRetira.relacion}) · {o.actaEntrega.kmSalida} km ·{' '}
                {o.actaEntrega.firmaSubida ? 'firmada' : 'sin firma subida'}
              </p>
            </Bloque>
          )}
          {(o.correcciones || []).length > 0 && (
            <Bloque titulo="Correcciones">
              <ul className="text-xs space-y-0.5">
                {o.correcciones!.map((c) => (
                  <li key={c.id}>
                    {fecha(Date.parse(c.fecha), true)} · {c.campo}: {String(c.antes ?? '—')} → {String(c.despues)} · {c.motivo} ({c.registradoPorNombre})
                  </li>
                ))}
              </ul>
            </Bloque>
          )}

          <button onClick={() => onAbrirOrden(o)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold">
            <ClipboardList className="w-4 h-4" /> Abrir ficha completa (fotos, PDF, correcciones)
          </button>
        </div>
      )}
    </div>
  );
};

const Bloque: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{titulo}</p>
    {children}
  </div>
);

const ICONO_EVENTO: Record<TipoEvento, [any, string]> = {
  ingreso: [Car, 'bg-sky-600'],
  estado: [Wrench, 'bg-slate-500'],
  cotizacion: [FileText, 'bg-indigo-600'],
  aprobacion: [ShieldCheck, 'bg-emerald-600'],
  pago: [Wallet, 'bg-emerald-600'],
  contacto: [MessageCircle, 'bg-green-600'],
  entrega: [KeyRound, 'bg-amber-600'],
  cancelacion: [Ban, 'bg-rose-600'],
  correccion: [PencilLine, 'bg-fuchsia-600'],
};

const LineaTiempo: React.FC<{ eventos: EventoLinea[] }> = ({ eventos }) =>
  eventos.length === 0 ? (
    <p className="text-sm text-slate-500 text-center py-8">Sin eventos.</p>
  ) : (
    <ol className="relative border-l-2 border-slate-200 ml-3 space-y-3">
      {eventos.map((e, i) => {
        const [Icono, color] = ICONO_EVENTO[e.tipo];
        return (
          <li key={i} className="ml-5">
            <span className={`absolute -left-[13px] w-6 h-6 rounded-full ${color} text-white flex items-center justify-center`}>
              <Icono className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs text-slate-500">
              {fecha(e.ms, true)} · <span className="font-mono">{e.folio}</span>
              {e.quien ? ` · ${e.quien}` : ''}
            </p>
            <p className="text-sm text-slate-800">{e.texto}</p>
          </li>
        );
      })}
    </ol>
  );

const GraficaKm: React.FC<{ puntos: { ms: number; km: number; folio: string }[] }> = ({ puntos }) => {
  if (puntos.length === 0) return <p className="text-sm text-slate-500 text-center py-8">Sin datos de kilometraje.</p>;
  const W = 640,
    H = 240,
    m = { l: 56, r: 16, t: 16, b: 32 };
  const x0 = puntos[0].ms,
    x1 = Math.max(puntos[puntos.length - 1].ms, x0 + DIA);
  const kmMin = Math.min(...puntos.map((p) => p.km)),
    kmMax = Math.max(...puntos.map((p) => p.km), kmMin + 1);
  const pad = (kmMax - kmMin) * 0.1 || 100;
  const y0 = Math.max(0, kmMin - pad),
    y1 = kmMax + pad;
  const X = (ms: number) => m.l + ((ms - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (km: number) => H - m.b - ((km - y0) / (y1 - y0)) * (H - m.t - m.b);
  const ticks = [0, 0.5, 1].map((t) => y0 + t * (y1 - y0));
  const ritmo =
    puntos.length > 1 ? Math.round(((puntos[puntos.length - 1].km - puntos[0].km) / Math.max(1, (puntos[puntos.length - 1].ms - puntos[0].ms) / DIA)) * 30) : null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Kilometraje por fecha">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="#e2e8f0" />
            <text x={m.l - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {Math.round(t).toLocaleString('es-BO')}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke="#c2410c" strokeWidth="2" points={puntos.map((p) => `${X(p.ms)},${Y(p.km)}`).join(' ')} />
        {puntos.map((p, i) => (
          <g key={i}>
            <circle cx={X(p.ms)} cy={Y(p.km)} r="4" fill="#c2410c">
              <title>{`${fecha(p.ms)} · ${p.km.toLocaleString('es-BO')} km · ${p.folio}`}</title>
            </circle>
          </g>
        ))}
        <text x={m.l} y={H - 8} fontSize="11" fill="#64748b">{fecha(x0)}</text>
        <text x={W - m.r} y={H - 8} fontSize="11" fill="#64748b" textAnchor="end">{fecha(x1)}</text>
      </svg>
      {ritmo !== null && <p className="text-xs text-slate-600 mt-1">Uso promedio: ~{ritmo.toLocaleString('es-BO')} km por mes.</p>}
    </div>
  );
};

export const ListaContactos: React.FC<{ contactos: ContactoCliente[] }> = ({ contactos }) =>
  contactos.length === 0 ? (
    <p className="text-sm text-slate-500 text-center py-8">Sin contactos registrados.</p>
  ) : (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
      {contactos.map((c) => (
        <div key={c.id} className="p-3 text-sm">
          <p className="text-xs text-slate-500">
            {fecha(Date.parse(c.fechaLocal), true)} · {c.medio} · {c.motivo}
            {c.folio ? ` · ${c.folio}` : ''} · {c.registradoPorNombre}
          </p>
          <p>{c.resumen}</p>
          {c.resultado && <p className="text-xs text-slate-600">Resultado: {c.resultado}</p>}
        </div>
      ))}
    </div>
  );
