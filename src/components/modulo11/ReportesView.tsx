import React, { useEffect, useMemo, useState } from 'react';
import { Cliente, OrdenServicio, PagoOrden } from '../../types';
import { calcularReporte, cargarPagosDelMes, mesActual, mesAnterior, mesSiguiente, nombreMes, ReporteMes } from '../../lib/reportes';
import { formatearMonedaBs } from '../../lib/storage';
import { BarChart3, ChevronLeft, ChevronRight, Download, Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  ordenes: OrdenServicio[];
  clientes: Cliente[];
}

const bs = (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatearMonedaBs(n));

/** Diferencia contra el mes anterior: "+12%" / "−3" (texto neutro, sin color de estado). */
function variacion(actual: number | null, anterior: number | null, porcentaje = true): string | null {
  if (actual === null || anterior === null) return null;
  if (porcentaje) {
    if (anterior === 0) return actual === 0 ? '= mes anterior' : 'nuevo vs mes anterior';
    const p = Math.round(((actual - anterior) / anterior) * 100);
    return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}% vs mes anterior`;
  }
  const d = Math.round((actual - anterior) * 10) / 10;
  return d === 0 ? '= mes anterior' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs mes anterior`;
}

const Tile: React.FC<{ titulo: string; valor: string; detalle?: string | null; fuerte?: boolean }> = ({ titulo, valor, detalle, fuerte }) => (
  <div className={`p-3 sm:p-4 rounded-xl border ${fuerte ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200'}`}>
    <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider leading-tight ${fuerte ? 'text-slate-300' : 'text-slate-500'}`}>{titulo}</p>
    <p className="text-lg sm:text-2xl font-bold font-mono mt-1 leading-tight">{valor}</p>
    {detalle && <p className={`text-[11px] mt-0.5 ${fuerte ? 'text-slate-300' : 'text-slate-500'}`}>{detalle}</p>}
  </div>
);

const Lista: React.FC<{ titulo: string; filas: { texto: string; cantidad: number }[]; vacio: string }> = ({ titulo, filas, vacio }) => {
  const max = Math.max(1, ...filas.map((f) => f.cantidad));
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-2">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-xs text-slate-500">{vacio}</p>
      ) : (
        <ul className="space-y-1.5">
          {filas.map((f) => (
            <li key={f.texto} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-800 truncate">{f.texto}</span>
                <span className="font-mono font-bold text-slate-900">{f.cantidad}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-0.5">
                <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${(f.cantidad / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Cobros por día: una sola serie (barras finas), tooltip al pasar o tocar. */
const CobrosPorDia: React.FC<{ datos: { dia: number; bs: number }[] }> = ({ datos }) => {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(0, ...datos.map((d) => d.bs));
  const sel = activo !== null ? datos[activo] : null;
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-slate-900">Cobros por día</h3>
        <p className="text-xs text-slate-600 font-mono h-4">{sel ? `Día ${sel.dia}: ${bs(sel.bs)}` : max > 0 ? `Máximo: ${bs(max)}` : ''}</p>
      </div>
      {max <= 0 ? (
        <p className="text-xs text-slate-500">No hubo cobros este mes.</p>
      ) : (
        <>
          <div className="flex items-end gap-[2px] h-32 border-b border-slate-300" onMouseLeave={() => setActivo(null)}>
            {datos.map((d, i) => (
              <button
                key={d.dia}
                type="button"
                aria-label={`Día ${d.dia}: ${bs(d.bs)}`}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onClick={() => setActivo(i)}
                className="flex-1 h-full flex items-end cursor-default"
              >
                <span
                  className={`w-full rounded-t-[4px] ${activo === i ? 'bg-slate-900' : 'bg-amber-500'}`}
                  style={{ height: d.bs > 0 ? `${Math.max(3, (d.bs / max) * 100)}%` : '0%' }}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>1</span>
            <span>{Math.ceil(datos.length / 2)}</span>
            <span>{datos.length}</span>
          </div>
        </>
      )}
    </section>
  );
};

export const ReportesView: React.FC<Props> = ({ ordenes, clientes }) => {
  const [mes, setMes] = useState(mesActual());
  const [pagos, setPagos] = useState<{ mes: string; actual: PagoOrden[]; anterior: PagoOrden[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setError(null);
    Promise.all([cargarPagosDelMes(mes), cargarPagosDelMes(mesAnterior(mes))])
      .then(([actual, anterior]) => vivo && setPagos({ mes, actual, anterior }))
      .catch((e) => vivo && setError(`No se pudieron leer los pagos: ${e?.message || e}`));
    return () => {
      vivo = false;
    };
  }, [mes]);

  const listo = pagos && pagos.mes === mes;
  const r: ReporteMes | null = useMemo(
    () => (listo ? calcularReporte(mes, { ordenes, clientes, pagos: pagos!.actual }) : null),
    [listo, mes, ordenes, clientes, pagos]
  );
  const ant: ReporteMes | null = useMemo(
    () => (listo ? calcularReporte(mesAnterior(mes), { ordenes, clientes, pagos: pagos!.anterior }) : null),
    [listo, mes, ordenes, clientes, pagos]
  );

  const exportar = async () => {
    if (!r) return;
    setExportando(true);
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const h = (t: string) => ({ value: t, fontWeight: 'bold' as const });
      const resumen = [
        [h('Indicador'), h(nombreMes(r.mes)), h(ant ? nombreMes(ant.mes) : 'Mes anterior')],
        ['Órdenes recibidas', r.recibidas, ant?.recibidas ?? null],
        ['Vehículos entregados', r.entregadas, ant?.entregadas ?? null],
        ['Órdenes canceladas', r.canceladas, ant?.canceladas ?? null],
        ['Facturado (trabajos entregados) Bs', r.facturadoBs, ant?.facturadoBs ?? null],
        ['Cobrado en caja Bs', r.cobradoBs, ant?.cobradoBs ?? null],
        ['Ticket promedio Bs', r.ticketPromedioBs, ant?.ticketPromedioBs ?? null],
        ['Días promedio en taller', r.diasPromedioTaller, ant?.diasPromedioTaller ?? null],
        ['Listos a tiempo %', r.cumplimientoPct, ant?.cumplimientoPct ?? null],
        ['Clientes nuevos', r.clientesNuevos, ant?.clientesNuevos ?? null],
        ['Reclamos de garantía', r.reclamosGarantia, ant?.reclamosGarantia ?? null],
        ['Retrabajos (control de calidad)', r.retrabajos, ant?.retrabajos ?? null],
        ['Saldo por cobrar hoy Bs', r.saldoPorCobrarBs, null],
        [],
        [h('Cobrado por medio'), h('Bs'), null],
        ...r.cobradoPorMedio.map((m) => [m.medio, m.bs, null]),
      ];
      const entregadas = [
        [h('Folio'), h('Placa'), h('Cliente'), h('Fecha de entrega'), h('Días en taller'), h('Total Bs'), h('Pagado Bs'), h('Saldo Bs'), h('Mecánico'), h('Listo a tiempo')],
        ...r.detalleEntregadas.map((d) => [
          d.folio,
          d.placa,
          d.cliente,
          d.fechaEntrega ? new Date(d.fechaEntrega).toLocaleDateString('es-BO') : '',
          d.dias === null ? null : Math.round(d.dias * 10) / 10,
          d.totalBs,
          d.pagadoBs,
          d.saldoBs,
          d.mecanico,
          d.aTiempo === null ? '' : d.aTiempo ? 'Sí' : 'No',
        ]),
      ];
      const mecanicos = [
        [h('Mecánico'), h('Vehículos entregados'), h('Facturado Bs'), h('Tareas terminadas'), h('Horas reales'), h('Horas estimadas')],
        ...r.mecanicos.map((m) => [m.nombre, m.entregadas, m.facturadoBs, m.tareas, m.horasReales, m.horasEstimadas]),
      ];
      const servicios = [
        [h('Trabajo realizado'), h('Veces')],
        ...r.topTrabajos.map((t) => [t.texto, t.cantidad]),
        [],
        [h('Sistema por el que ingresan'), h('Veces')],
        ...r.topSistemas.map((t) => [t.texto, t.cantidad]),
      ];
      await (writeXlsxFile as any)([
        { data: resumen, sheet: 'Resumen', columns: [{ width: 36 }, { width: 18 }, { width: 18 }], stickyRowsCount: 1 },
        { data: entregadas, sheet: 'Entregados', columns: [{ width: 12 }, { width: 10 }, { width: 28 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 10 }], stickyRowsCount: 1 },
        { data: mecanicos, sheet: 'Mecánicos', columns: [{ width: 22 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }], stickyRowsCount: 1 },
        { data: servicios, sheet: 'Servicios', columns: [{ width: 40 }, { width: 10 }] },
      ]).toFile(`reporte-${r.mes}.xlsx`);
    } catch (e: any) {
      setError(`No se pudo exportar: ${e?.message || e}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Reportes del mes</h2>
            <p className="text-xs text-slate-500">Cuánto se trabajó, se facturó y se cobró. Comparado con el mes anterior.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMes(mesAnterior(mes))} className="p-2 rounded-lg border border-slate-300 bg-white" aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            value={mes}
            max={mesActual()}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
          />
          <button
            onClick={() => setMes(mesSiguiente(mes))}
            disabled={mes >= mesActual()}
            className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={exportar}
            disabled={!r || exportando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
          </button>
        </div>
      </div>

      {error && (
        <p className="flex gap-2 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {!r ? (
        !error && (
          <p className="flex items-center gap-2 text-sm text-slate-500 p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculando {nombreMes(mes)}…
          </p>
        )
      ) : (
        <>
          <p className="text-sm font-bold text-slate-800">{nombreMes(r.mes)}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Tile titulo="Cobrado en caja" valor={bs(r.cobradoBs)} detalle={variacion(r.cobradoBs, ant?.cobradoBs ?? null)} fuerte />
            <Tile titulo="Facturado (entregados)" valor={bs(r.facturadoBs)} detalle={variacion(r.facturadoBs, ant?.facturadoBs ?? null)} />
            <Tile titulo="Vehículos entregados" valor={String(r.entregadas)} detalle={variacion(r.entregadas, ant?.entregadas ?? null, false)} />
            <Tile titulo="Ticket promedio" valor={bs(r.ticketPromedioBs)} detalle={variacion(r.ticketPromedioBs, ant?.ticketPromedioBs ?? null)} />
            <Tile titulo="Órdenes recibidas" valor={String(r.recibidas)} detalle={variacion(r.recibidas, ant?.recibidas ?? null, false)} />
            <Tile titulo="Días promedio en taller" valor={r.diasPromedioTaller === null ? '—' : String(r.diasPromedioTaller)} detalle="desde que entra hasta que se entrega" />
            <Tile titulo="Listos a tiempo" valor={r.cumplimientoPct === null ? '—' : `${r.cumplimientoPct}%`} detalle="antes de la fecha prometida" />
            <Tile titulo="Clientes nuevos" valor={String(r.clientesNuevos)} detalle={variacion(r.clientesNuevos, ant?.clientesNuevos ?? null, false)} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Tile titulo="Saldo por cobrar (hoy)" valor={bs(r.saldoPorCobrarBs)} detalle={`${r.ordenesConSaldo} orden(es) · ver Caja`} />
            <Tile titulo="Canceladas" valor={String(r.canceladas)} detalle={variacion(r.canceladas, ant?.canceladas ?? null, false)} />
            <Tile titulo="Reclamos de garantía" valor={String(r.reclamosGarantia)} detalle="vehículos que volvieron" />
            <Tile titulo="Retrabajos" valor={String(r.retrabajos)} detalle="no pasaron control de calidad" />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <CobrosPorDia datos={r.cobrosPorDia} />
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Cobrado por medio de pago</h3>
              {r.cobradoPorMedio.length === 0 ? (
                <p className="text-xs text-slate-500">No hubo cobros este mes.</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {r.cobradoPorMedio.map((m) => (
                      <tr key={m.medio} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-700">{m.medio}</td>
                        <td className="py-1.5 text-right font-mono font-bold">{bs(m.bs)}</td>
                        <td className="py-1.5 text-right text-slate-500 w-14">{r.cobradoBs ? `${Math.round((m.bs / r.cobradoBs) * 100)}%` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Lista titulo="Trabajos más realizados" filas={r.topTrabajos} vacio="Sin vehículos entregados este mes." />
            <Lista titulo="Por qué ingresan (sistemas)" filas={r.topSistemas} vacio="Sin recepciones este mes." />
            <Lista titulo="Motivos de cancelación" filas={r.motivosCancelacion} vacio="Sin cancelaciones este mes." />
          </div>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Por mecánico</h3>
            {r.mecanicos.length === 0 ? (
              <p className="text-xs text-slate-500">Sin entregas ni tareas terminadas este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 font-semibold">Mecánico</th>
                      <th className="py-1.5 font-semibold text-right">Entregados</th>
                      <th className="py-1.5 font-semibold text-right">Facturado</th>
                      <th className="py-1.5 font-semibold text-right">Tareas</th>
                      <th className="py-1.5 font-semibold text-right">Horas reales / estimadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.mecanicos.map((m) => (
                      <tr key={m.nombre} className="border-b border-slate-100">
                        <td className="py-1.5 font-semibold text-slate-800">{m.nombre}</td>
                        <td className="py-1.5 text-right font-mono">{m.entregadas}</td>
                        <td className="py-1.5 text-right font-mono">{bs(m.facturadoBs)}</td>
                        <td className="py-1.5 text-right font-mono">{m.tareas}</td>
                        <td className="py-1.5 text-right font-mono">
                          {m.horasReales} / {m.horasEstimadas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Vehículos entregados en el mes ({r.detalleEntregadas.length})</h3>
            {r.detalleEntregadas.length === 0 ? (
              <p className="text-xs text-slate-500">Ninguno.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 font-semibold">Folio</th>
                      <th className="py-1.5 font-semibold">Vehículo / cliente</th>
                      <th className="py-1.5 font-semibold text-right">Días</th>
                      <th className="py-1.5 font-semibold text-right">Total</th>
                      <th className="py-1.5 font-semibold text-right">Saldo</th>
                      <th className="py-1.5 font-semibold">Mecánico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.detalleEntregadas.map((d) => (
                      <tr key={d.folio} className="border-b border-slate-100">
                        <td className="py-1.5 font-mono font-bold">{d.folio}</td>
                        <td className="py-1.5">
                          <span className="font-mono">{d.placa}</span> · {d.cliente}
                        </td>
                        <td className="py-1.5 text-right font-mono">{d.dias === null ? '—' : d.dias.toFixed(1)}</td>
                        <td className="py-1.5 text-right font-mono">{bs(d.totalBs)}</td>
                        <td className="py-1.5 text-right font-mono">{d.saldoBs > 0 ? bs(d.saldoBs) : '—'}</td>
                        <td className="py-1.5">{d.mecanico}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="text-[11px] text-slate-500">
            "Facturado" suma el total aprobado de los vehículos entregados en el mes. "Cobrado" suma los pagos registrados en Caja en el mes (las
            anulaciones restan). Por eso pueden ser distintos.
          </p>
        </>
      )}
    </div>
  );
};
