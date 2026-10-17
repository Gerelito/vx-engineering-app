import React, { useMemo, useState } from 'react';
import {
  QueryConstraint,
  QueryDocumentSnapshot,
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AuditoriaEvento, OrdenServicio } from '../../types';
import { aMilisegundos } from '../../lib/storage';
import { AlertTriangle, Download, Filter, Loader2, Lock, Monitor, Search, Shield, X } from 'lucide-react';

const POR_PAGINA = 50;
const LOTE = 100;
const MAX_LOTES_POR_CLIC = 6;

const MODULOS = [
  'Clientes',
  'Vehículos',
  'Recepción',
  'Taller',
  'Cotizaciones',
  'Caja',
  'Entrega',
  'Documentos',
  'Historial',
  'Bitácora de contactos',
  'Configuración',
  'Seguridad',
];

interface Filtros {
  desde: string;
  hasta: string;
  usuario: string;
  modulo: string;
  accion: string;
  folio: string;
  soloSensibles: boolean;
}

const VACIO: Filtros = { desde: '', hasta: '', usuario: '', modulo: '', accion: '', folio: '', soloSensibles: false };

function fechaTxt(ev: AuditoriaEvento) {
  const ms = aMilisegundos(ev.fecha);
  if (!ms) return 'pendiente';
  const d = new Date(ms - 4 * 3_600_000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function aTexto(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    return JSON.stringify(v);
  }
  return String(v);
}

/** Pantalla de auditoría (Módulo 9): filtros, páginas de 50, antes/después y exportación a Excel. */
export const AuditoriaPantalla: React.FC<{ ordenes: OrdenServicio[] }> = ({ ordenes }) => {
  const [filtros, setFiltros] = useState<Filtros>(VACIO);
  const [aplicados, setAplicados] = useState<Filtros | null>(null);
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [leidos, setLeidos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [visto, setVisto] = useState<AuditoriaEvento | null>(null);
  const [exportando, setExportando] = useState(false);

  const idsPorFolio = useMemo(() => {
    const m = new Map<string, string[]>();
    ordenes.forEach((o) => {
      const k = o.folio.toLowerCase();
      m.set(k, [...(m.get(k) || []), o.id]);
    });
    return m;
  }, [ordenes]);

  const coincide = (ev: AuditoriaEvento, f: Filtros) => {
    if (f.soloSensibles && !ev.sensible) return false;
    if (f.modulo && ev.modulo !== f.modulo) return false;
    if (f.usuario) {
      const q = f.usuario.toLowerCase();
      if (!`${ev.usuarioNombre} ${ev.usuarioEmail}`.toLowerCase().includes(q)) return false;
    }
    if (f.accion && !String(ev.accion).toLowerCase().includes(f.accion.toLowerCase())) return false;
    if (f.folio) {
      const q = f.folio.toLowerCase().trim();
      const ids = [...idsPorFolio.entries()].filter(([folio]) => folio.includes(q)).flatMap(([, v]) => v);
      const texto = `${JSON.stringify(ev.antes || {})} ${JSON.stringify(ev.despues || {})}`.toLowerCase();
      if (!ids.includes(ev.entidadId) && !texto.includes(q)) return false;
    }
    return true;
  };

  const restricciones = (f: Filtros): QueryConstraint[] => {
    const r: QueryConstraint[] = [];
    if (f.desde) r.push(where('fecha', '>=', Timestamp.fromMillis(Date.parse(`${f.desde}T00:00:00-04:00`))));
    if (f.hasta) r.push(where('fecha', '<=', Timestamp.fromMillis(Date.parse(`${f.hasta}T23:59:59-04:00`))));
    r.push(orderBy('fecha', 'desc'));
    return r;
  };

  /** Lee de 100 en 100 por fecha (índice simple, sin índices compuestos) y filtra aquí hasta juntar 50. */
  const cargar = async (reiniciar: boolean, hastaAgotar = false): Promise<AuditoriaEvento[]> => {
    const f = reiniciar ? filtros : aplicados || filtros;
    setCargando(true);
    setError(null);
    let lista = reiniciar ? [] : [...eventos];
    let cur = reiniciar ? null : cursor;
    let fin = false;
    let nuevos = 0;
    let lotes = 0;
    let lecturas = reiniciar ? 0 : leidos;
    try {
      while (!fin && (hastaAgotar ? lotes < 60 : nuevos < POR_PAGINA && lotes < MAX_LOTES_POR_CLIC)) {
        const q = query(collection(db, 'auditoria'), ...restricciones(f), ...(cur ? [startAfter(cur)] : []), limit(LOTE));
        const snap = await getDocs(q);
        lotes++;
        lecturas += snap.size;
        if (snap.size < LOTE) fin = true;
        if (snap.size) cur = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
        const pagina = snap.docs.map((d) => ({ ...(d.data() as AuditoriaEvento), id: d.id })).filter((ev) => coincide(ev, f));
        nuevos += pagina.length;
        lista = [...lista, ...pagina];
      }
      setEventos(lista);
      setCursor(cur);
      setAgotado(fin);
      setLeidos(lecturas);
      if (reiniciar) setAplicados(f);
      return lista;
    } catch (e: any) {
      setError(e?.message || String(e));
      return lista;
    } finally {
      setCargando(false);
    }
  };

  const exportar = async (todo: boolean) => {
    setExportando(true);
    try {
      const lista = todo && !agotado ? await cargar(false, true) : eventos;
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const encabezado = ['Fecha', 'Usuario', 'Correo', 'Módulo', 'Acción', 'Sensible', 'Entidad', 'ID', 'Folio', 'Antes', 'Después', 'Dispositivo'].map((t) => ({
        value: t,
        fontWeight: 'bold' as const,
      }));
      const folioDe = new Map(ordenes.map((o) => [o.id, o.folio]));
      const filas = lista.map((ev) => [
        fechaTxt(ev),
        ev.usuarioNombre || '',
        ev.usuarioEmail || '',
        ev.modulo || '',
        String(ev.accion || ''),
        ev.sensible ? 'Sí' : 'No',
        ev.entidad || '',
        ev.entidadId || '',
        folioDe.get(ev.entidadId) || (ev.despues as any)?.folio || '',
        ev.antes ? JSON.stringify(ev.antes) : '',
        ev.despues ? JSON.stringify(ev.despues) : '',
        ev.dispositivo || '',
      ]);
      const hoy = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
      await writeXlsxFile([encabezado, ...filas] as any, {
        columns: [{ width: 20 }, { width: 22 }, { width: 26 }, { width: 16 }, { width: 30 }, { width: 9 }, { width: 14 }, { width: 24 }, { width: 12 }, { width: 50 }, { width: 50 }, { width: 28 }],
        stickyRowsCount: 1,
      } as any).toFile(`auditoria-${hoy}.xlsx`);
    } catch (e: any) {
      setError(`No se pudo exportar: ${e?.message || e}`);
    } finally {
      setExportando(false);
    }
  };

  const campo = (k: keyof Filtros, v: any) => setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Auditoría</h2>
          <p className="text-xs text-slate-500">Registro inmutable de todo lo que se guarda. Nadie puede editarlo ni borrarlo.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <Campo t="Desde"><input type="date" value={filtros.desde} onChange={(e) => campo('desde', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2" /></Campo>
          <Campo t="Hasta"><input type="date" value={filtros.hasta} onChange={(e) => campo('hasta', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2" /></Campo>
          <Campo t="Usuario"><input value={filtros.usuario} onChange={(e) => campo('usuario', e.target.value)} placeholder="nombre o correo" className="w-full border border-slate-300 rounded-lg px-2 py-2" /></Campo>
          <Campo t="Módulo">
            <select value={filtros.modulo} onChange={(e) => campo('modulo', e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2">
              <option value="">Todos</option>
              {MODULOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
          <Campo t="Tipo de acción"><input value={filtros.accion} onChange={(e) => campo('accion', e.target.value)} placeholder="ej. anulación, descuento" className="w-full border border-slate-300 rounded-lg px-2 py-2" /></Campo>
          <Campo t="Folio"><input value={filtros.folio} onChange={(e) => campo('folio', e.target.value)} placeholder="OS-000123" className="w-full border border-slate-300 rounded-lg px-2 py-2" /></Campo>
          <label className="flex items-center gap-2 self-end pb-2 font-semibold">
            <input type="checkbox" checked={filtros.soloSensibles} onChange={(e) => campo('soloSensibles', e.target.checked)} className="w-4 h-4" />
            Solo sensibles
          </label>
          <div className="flex gap-2 self-end">
            <button onClick={() => cargar(true)} disabled={cargando} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-50">
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
            </button>
            <button onClick={() => setFiltros(VACIO)} className="px-3 py-2 rounded-lg border border-slate-300" title="Limpiar filtros">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Se leen registros de 100 en 100 por fecha (para cuidar el plan gratuito) y se muestran de 50 en 50.
          {aplicados && ` Leídos: ${leidos}.`}
        </p>
      </div>

      {error && (
        <p className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {!aplicados ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">Elige filtros (o ninguno) y toca "Buscar".</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{eventos.length} registro(s){agotado ? '' : ' (hay más)'}</p>
            <div className="flex gap-2">
              <button onClick={() => exportar(false)} disabled={exportando || !eventos.length} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold disabled:opacity-40">
                <Download className="w-4 h-4" /> Excel (lo cargado)
              </button>
              {!agotado && (
                <button onClick={() => exportar(true)} disabled={exportando} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">
                  {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel (todo el filtro)
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {eventos.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Sin registros con estos filtros.</p>}
            {eventos.map((ev) => (
              <button key={ev.id} onClick={() => setVisto(ev)} className="w-full text-left p-3 hover:bg-slate-50 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                    {ev.sensible && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-800">
                        <Lock className="w-3 h-3" /> sensible
                      </span>
                    )}
                    {String(ev.accion)}
                    <span className="text-xs font-normal text-slate-500">· {ev.modulo}</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {ev.usuarioNombre} · {ev.entidad}/{ev.entidadId}
                    {ev.dispositivo ? ` · ${ev.dispositivo}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{fechaTxt(ev)}</span>
              </button>
            ))}
          </div>

          {!agotado && (
            <button onClick={() => cargar(false)} disabled={cargando} className="w-full py-3 rounded-xl border border-slate-300 bg-white text-sm font-bold disabled:opacity-50">
              {cargando ? 'Cargando…' : `Cargar ${POR_PAGINA} más`}
            </button>
          )}
        </>
      )}

      {visto && <DetalleAuditoria ev={visto} onClose={() => setVisto(null)} />}
    </div>
  );
};

const Campo: React.FC<{ t: string; children: React.ReactNode }> = ({ t, children }) => (
  <label className="block">
    <span className="text-[11px] font-semibold text-slate-500">{t}</span>
    {children}
  </label>
);

const DetalleAuditoria: React.FC<{ ev: AuditoriaEvento; onClose: () => void }> = ({ ev, onClose }) => {
  const antes = (ev.antes || {}) as Record<string, any>;
  const despues = (ev.despues || {}) as Record<string, any>;
  const claves = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)]));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{String(ev.accion)}</h3>
            <p className="text-xs text-slate-300">
              {fechaTxt(ev)} · {ev.usuarioNombre} ({ev.usuarioEmail}) · {ev.modulo}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-slate-100">
              {ev.entidad}/{ev.entidadId}
            </span>
            {ev.sensible && <span className="px-2 py-1 rounded bg-fuchsia-100 text-fuchsia-800 font-bold">Acción sensible</span>}
            {ev.dispositivo && (
              <span className="px-2 py-1 rounded bg-slate-100 inline-flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5" /> {ev.dispositivo}
              </span>
            )}
          </div>
          {claves.length === 0 ? (
            <p className="text-slate-500 text-xs">Sin datos de antes/después.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1.5 pr-2 border-b">Campo</th>
                    <th className="py-1.5 pr-2 border-b">Antes</th>
                    <th className="py-1.5 border-b">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {claves.map((k) => {
                    const a = aTexto(antes[k]);
                    const d = aTexto(despues[k]);
                    const cambio = a !== d;
                    return (
                      <tr key={k} className={cambio ? 'bg-amber-50' : ''}>
                        <td className="py-1.5 pr-2 align-top font-semibold border-b border-slate-100">{k}</td>
                        <td className="py-1.5 pr-2 align-top border-b border-slate-100 break-all text-rose-800">{a}</td>
                        <td className="py-1.5 align-top border-b border-slate-100 break-all text-emerald-800">{d}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
