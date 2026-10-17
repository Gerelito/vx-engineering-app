import React, { useEffect, useState } from 'react';
import { DuenoUsuario, OrdenServicio } from '../../types';
import { ArchivoRespaldo, generarRespaldo, generarZipFotos, leerArchivoRespaldo, leerUltimoRespaldo, proyectoVacio, restaurarRespaldo } from '../../lib/respaldo';
import { descargarBlob } from '../../lib/envios';
import { AlertTriangle, Archive, Database, Download, Loader2, Upload } from 'lucide-react';

/** Respaldo manual (Módulo 10): el plan gratuito no tiene copias automáticas. */
export const PanelRespaldo: React.FC<{ ordenes: OrdenServicio[]; usuarioActual: DuenoUsuario }> = ({ ordenes, usuarioActual }) => {
  const [ultimo, setUltimo] = useState<string | null | undefined>(undefined);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hoy = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy);
  // Restauración
  const [archivo, setArchivo] = useState<ArchivoRespaldo | null>(null);
  const [vacio, setVacio] = useState<boolean | null>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [paso, setPaso] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    leerUltimoRespaldo().then(setUltimo).catch(() => setUltimo(null));
  }, []);

  const dias = ultimo ? Math.floor((Date.now() - Date.parse(ultimo)) / 86_400_000) : null;

  const correr = async (f: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await f();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className={`p-3 rounded-xl border flex gap-2 ${dias === null || dias > 7 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
        <Database className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">
            {ultimo === undefined ? 'Revisando…' : ultimo ? `Último respaldo: hace ${dias} día(s) (${new Date(ultimo).toLocaleString('es-BO')})` : 'Todavía no se hizo ningún respaldo.'}
          </p>
          <p>El plan gratuito no guarda copias automáticas. Descarga un respaldo al menos una vez por semana y guárdalo en Google Drive o en tu computadora.</p>
        </div>
      </div>

      {error && (
        <p className="flex gap-2 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {estado && <p className="text-slate-600">{estado}</p>}

      <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Download className="w-4 h-4" /> Respaldo completo (.json)
        </h3>
        <p className="text-slate-600">Clientes, vehículos, órdenes, cotizaciones, pagos, contactos, cajas, auditoría y configuración. No incluye fotos.</p>
        <button
          disabled={ocupado}
          onClick={() =>
            correr(async () => {
              const r = await generarRespaldo(usuarioActual, setEstado);
              descargarBlob(r.blob, r.nombre);
              setUltimo(new Date().toISOString());
              setEstado(`Respaldo descargado: ${Object.entries(r.resumen).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
            })
          }
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-50"
        >
          {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar respaldo completo
        </button>
      </section>

      <section className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Archive className="w-4 h-4" /> Fotos por rango de fechas (.zip)
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="block text-slate-500">Desde (ingreso)</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white" />
          </label>
          <label>
            <span className="block text-slate-500">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white" />
          </label>
          <button
            disabled={ocupado || !desde || !hasta}
            onClick={() =>
              correr(async () => {
                const r = await generarZipFotos(ordenes, desde, hasta, setEstado);
                if (!r.cantidad) {
                  setEstado('No hay fotos en ese rango.');
                  return;
                }
                descargarBlob(r.blob, r.nombre);
                setEstado(`${r.cantidad} foto(s) descargadas.`);
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold disabled:opacity-50"
          >
            <Archive className="w-4 h-4" /> Descargar fotos
          </button>
        </div>
      </section>

      <section className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2 text-rose-900">
          <Upload className="w-4 h-4" /> Restaurar desde respaldo
        </h3>
        <p className="text-rose-900">Solo funciona en una base de datos vacía (por ejemplo, un proyecto nuevo). Pide doble confirmación.</p>
        <input
          type="file"
          accept="application/json,.json"
          disabled={ocupado}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setError(null);
            setPaso(0);
            try {
              const a = leerArchivoRespaldo(await f.text());
              setArchivo(a);
              setVacio(await proyectoVacio());
            } catch (err: any) {
              setArchivo(null);
              setError(err?.message || String(err));
            }
          }}
        />
        {archivo && (
          <div className="space-y-2">
            <p>
              Respaldo del {new Date(archivo.fecha).toLocaleString('es-BO')} ({archivo.generadoPor}):{' '}
              {Object.entries(archivo.colecciones)
                .map(([k, v]) => `${k} ${v.length}`)
                .join(', ')}
              , cotizaciones {archivo.cotizaciones?.length || 0}.
            </p>
            {vacio === false ? (
              <p className="font-bold text-rose-800">Esta base de datos ya tiene datos: no se puede restaurar aquí.</p>
            ) : paso === 0 ? (
              <button onClick={() => setPaso(1)} className="px-4 py-2 rounded-lg border border-rose-300 text-rose-800 font-bold">
                Restaurar…
              </button>
            ) : (
              <div className="space-y-2">
                <p className="font-bold text-rose-900">Confirmación 2 de 2: escribe RESTAURAR para continuar.</p>
                <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="border border-rose-300 rounded-lg px-2 py-1.5 bg-white font-mono" />
                <button
                  disabled={ocupado || confirmacion !== 'RESTAURAR'}
                  onClick={() =>
                    correr(async () => {
                      setPaso(2);
                      const r = await restaurarRespaldo(archivo, usuarioActual, setEstado);
                      setEstado(`Restaurado: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(', ')}. Recarga la página.`);
                      setArchivo(null);
                      setConfirmacion('');
                    })
                  }
                  className="ml-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-700 text-white font-bold disabled:opacity-40"
                >
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Restaurar ahora
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
