import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CierreCaja, DuenoUsuario, MedioContacto, OrdenServicio, PagoOrden, TallerConfig } from '../../types';
import {
  calcularFinanzasOrden,
  cerrarCajaFirestore,
  diaLaPaz,
  diasDeSaldo,
  formatearDia,
  mediosPagoConfigurados,
  obtenerPagosDelDia,
  rangoAntiguedad,
  reabrirCajaFirestore,
  redondearBs,
  registrarContactoFirestore,
  resumirMovimientosDelDia,
} from '../../lib/caja';
import { formatearFecha, formatearMonedaBs } from '../../lib/storage';
import { llenarPlantilla, plantillaWhatsapp } from '../../lib/plantillas';
import { urlVerificacion } from '../../lib/verificacion';
import { AlertTriangle, Calculator, Lock, MessageCircle, Phone, Search, Unlock, Wallet } from 'lucide-react';

interface Props {
  ordenes: OrdenServicio[];
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onAbrirPagos: (orden: OrdenServicio) => void;
  onAbrirDetalle: (orden: OrdenServicio) => void;
  onExito: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

type FiltroAntiguedad = 'todas' | '0-30' | '31-60' | '60+';

export const CajaView: React.FC<Props> = (props) => {
  const [pestana, setPestana] = useState<'cobrar' | 'cierre'>('cobrar');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Caja y cobros</h2>
          <p className="text-xs text-slate-500">Cuentas por cobrar, pagos del día y cierre de caja</p>
        </div>
      </div>
      <div className="inline-flex bg-slate-100 rounded-xl p-1 text-sm font-bold">
        <button
          onClick={() => setPestana('cobrar')}
          className={`px-4 py-2 rounded-lg ${pestana === 'cobrar' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
        >
          Cuentas por cobrar
        </button>
        <button
          onClick={() => setPestana('cierre')}
          className={`px-4 py-2 rounded-lg ${pestana === 'cierre' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
        >
          Cierre de caja
        </button>
      </div>
      {pestana === 'cobrar' ? <CuentasPorCobrar {...props} /> : <CierreDeCaja {...props} />}
    </div>
  );
};

const CuentasPorCobrar: React.FC<Props> = ({ ordenes, config, usuarioActual, onAbrirPagos, onAbrirDetalle, onExito, onError }) => {
  const [busqueda, setBusqueda] = useState('');
  const [antiguedad, setAntiguedad] = useState<FiltroAntiguedad>('todas');
  const [soloEntregadasConSaldo, setSoloEntregadasConSaldo] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [ordenContacto, setOrdenContacto] = useState<OrdenServicio | null>(null);

  const filas = useMemo(() => {
    const ahora = new Date();
    return ordenes
      .filter((o) => o.estado !== 'Cancelada')
      .map((o) => ({ orden: o, fin: calcularFinanzasOrden(o), dias: diasDeSaldo(o, ahora) }))
      .filter((f) => f.fin.saldoBs !== null && f.fin.saldoBs > 0)
      .filter((f) => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return true;
        return [f.orden.clienteNombre, f.orden.clienteTelefono, f.orden.folio, f.orden.vehiculoPlaca]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .filter((f) => antiguedad === 'todas' || rangoAntiguedad(f.dias) === antiguedad)
      .filter((f) => !soloEntregadasConSaldo || f.orden.entregaConSaldo?.autorizada)
      .filter((f) => {
        const ref = (f.orden.saldoDesde || '').slice(0, 10);
        if (desde && (!ref || ref < desde)) return false;
        if (hasta && (!ref || ref > hasta)) return false;
        return true;
      })
      .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  }, [ordenes, busqueda, antiguedad, soloEntregadasConSaldo, desde, hasta]);

  const totalPorCobrar = redondearBs(filas.reduce((s, f) => s + (f.fin.saldoBs || 0), 0));

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
        <label className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, teléfono, folio o placa"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <select
          value={antiguedad}
          onChange={(e) => setAntiguedad(e.target.value as FiltroAntiguedad)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
        >
          <option value="todas">Toda antigüedad</option>
          <option value="0-30">0 a 30 días</option>
          <option value="31-60">31 a 60 días</option>
          <option value="60+">Más de 60 días</option>
        </select>
        <div className="flex gap-2">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs" title="Saldo desde" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs" title="Saldo hasta" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={soloEntregadasConSaldo} onChange={(e) => setSoloEntregadasConSaldo(e.target.checked)} className="w-4 h-4" />
          Entregados sin pago completo
        </label>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{filas.length} órdenes con saldo</span>
        <span className="font-bold text-slate-900">
          Total por cobrar: <span className="font-mono text-rose-700">{formatearMonedaBs(totalPorCobrar)}</span>
        </span>
      </div>

      {filas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          No hay órdenes con saldo pendiente con estos filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {filas.map(({ orden, fin, dias }) => {
            const rango = rangoAntiguedad(dias);
            const colorRango =
              rango === '60+'
                ? 'bg-rose-600 text-white'
                : rango === '31-60'
                ? 'bg-amber-500 text-white'
                : rango === '0-30'
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-slate-100 text-slate-600';
            const telefono = (orden.clienteTelefonoE164 || '').replace('+', '');
            return (
              <div key={orden.id} className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button onClick={() => onAbrirDetalle(orden)} className="font-bold text-slate-900 hover:underline text-left">
                      {orden.clienteNombre}
                    </button>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-700">{orden.folio}</span> · {orden.vehiculoPlaca} ·{' '}
                      {orden.vehiculoMarca} {orden.vehiculoModelo} · {orden.clienteTelefono}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${colorRango}`}>
                    {dias === null ? 'Sin fecha' : `${dias} días`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                  <Dato titulo="Total" valor={formatearMonedaBs(fin.totalAprobadoBs)} />
                  <Dato titulo="Pagado QR" valor={formatearMonedaBs(fin.pagadoQRBs)} />
                  <Dato titulo="Pagado efectivo" valor={formatearMonedaBs(fin.pagadoEfectivoBs)} />
                  <Dato titulo="Saldo" valor={formatearMonedaBs(fin.saldoBs)} fuerte />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-2 text-[11px] text-slate-600">
                  <span>Saldo desde: {orden.saldoDesde ? formatearFecha(orden.saldoDesde, false) : '—'}</span>
                  <span>
                    Entrega del auto: {orden.fechaEntrega ? formatearFecha(orden.fechaEntrega, false) : 'sigue en el taller'}
                  </span>
                  <span>
                    Último pago:{' '}
                    {orden.pagos?.ultimoPagoFecha
                      ? `${formatearFecha(orden.pagos.ultimoPagoFecha, false)} (${formatearMonedaBs(orden.pagos.ultimoPagoMontoBs)})`
                      : 'ninguno'}
                  </span>
                </div>
                {orden.entregaConSaldo?.autorizada && (
                  <p className="mt-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded p-2">
                    Entregado sin pago completo · autorizó {orden.entregaConSaldo.autorizadoPorNombre}: {orden.entregaConSaldo.motivo}
                    {orden.entregaConSaldo.fechaCompromisoPago
                      ? ` · compromiso de pago: ${formatearDia(orden.entregaConSaldo.fechaCompromisoPago)}`
                      : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => onAbrirPagos(orden)}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                  >
                    Registrar abono
                  </button>
                  {telefono && (
                    <a
                      href={`https://wa.me/${telefono}?text=${encodeURIComponent(llenarPlantilla(plantillaWhatsapp(config, 'saldo'), orden, config, { saldo: fin.saldoBs, enlace: urlVerificacion(config, orden) }))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg bg-green-50 text-green-800 border border-green-200 text-sm font-semibold"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => setOrdenContacto(orden)}
                    className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold"
                  >
                    <Phone className="w-4 h-4" /> Registrar contacto
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ordenContacto && (
        <ContactoModal
          orden={ordenContacto}
          usuarioActual={usuarioActual}
          onClose={() => setOrdenContacto(null)}
          onExito={(m) => {
            setOrdenContacto(null);
            onExito(m);
          }}
          onError={onError}
        />
      )}
    </div>
  );
};

const Dato: React.FC<{ titulo: string; valor: string; fuerte?: boolean }> = ({ titulo, valor, fuerte }) => (
  <div className={`rounded-lg p-2 ${fuerte ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50'}`}>
    <p className="text-[10px] uppercase font-bold text-slate-500">{titulo}</p>
    <p className={`font-mono font-bold ${fuerte ? 'text-rose-700' : 'text-slate-900'}`}>{valor}</p>
  </div>
);

export const ContactoModal: React.FC<{
  orden: OrdenServicio;
  usuarioActual: DuenoUsuario;
  motivoInicial?: 'Cobranza' | 'Aviso de vehículo listo' | 'Seguimiento';
  onClose: () => void;
  onExito: (m: string) => void;
  onError: (m: string) => void;
}> = ({ orden, usuarioActual, motivoInicial = 'Cobranza', onClose, onExito, onError }) => {
  const [medio, setMedio] = useState<MedioContacto>('Llamada');
  const [resumen, setResumen] = useState('');
  const [resultado, setResultado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await registrarContactoFirestore(
        {
          clienteId: orden.clienteId,
          clienteNombre: orden.clienteNombre,
          ordenId: orden.id,
          folio: orden.folio,
          medio,
          motivo: motivoInicial,
          resumen,
          resultado,
        },
        usuarioActual
      );
      onExito(`Contacto registrado en la bitácora de ${orden.clienteNombre}.`);
    } catch (e: any) {
      onError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl">
        <h4 className="font-bold text-slate-900">Registrar contacto · {motivoInicial}</h4>
        <p className="text-xs text-slate-500">
          {orden.clienteNombre} · {orden.folio}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {(['Llamada', 'WhatsApp', 'Mensaje', 'Visita'] as MedioContacto[]).map((m) => (
            <button
              key={m}
              onClick={() => setMedio(m)}
              className={`py-2 rounded-lg text-xs font-bold border ${medio === m ? 'bg-slate-900 text-white' : 'border-slate-300'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          placeholder="Resumen (qué se habló)"
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={resultado}
          onChange={(e) => setResultado(e.target.value)}
          placeholder="Resultado (ej. paga el viernes, no contestó)"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm font-semibold">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !resumen.trim()}
            className="px-4 py-2 rounded-lg bg-slate-900 disabled:opacity-50 text-white text-sm font-bold"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const CierreDeCaja: React.FC<Props> = ({ config, usuarioActual, onExito, onError }) => {
  const [dia, setDia] = useState(diaLaPaz());
  const [pagos, setPagos] = useState<PagoOrden[]>([]);
  const [caja, setCaja] = useState<CierreCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [efectivoContado, setEfectivoContado] = useState('');
  const [nota, setNota] = useState('');
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [guardando, setGuardando] = useState(false);
  const medios = mediosPagoConfigurados(config);

  const cargarPagos = async () => {
    setCargando(true);
    try {
      const lista = await obtenerPagosDelDia(dia);
      lista.sort((a, b) => (a.fechaLocal || '').localeCompare(b.fechaLocal || ''));
      setPagos(lista);
    } catch (e: any) {
      onError(`No se pudieron leer los pagos del día: ${e?.message || e}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPagos();
    const unsub = onSnapshot(
      doc(db, 'cajas', dia),
      (snap) => setCaja(snap.exists() ? (snap.data() as CierreCaja) : null),
      (err) => onError(`No se pudo leer el cierre de caja: ${err.message}`)
    );
    return () => unsub();
  }, [dia]);

  const resumen = resumirMovimientosDelDia(pagos);
  const contado = parseFloat(efectivoContado.replace(',', '.'));
  const diferencia = isNaN(contado) ? null : redondearBs(contado - resumen.efectivoEsperadoBs);
  const mediosMostrados = Array.from(new Set([...medios, ...Object.keys(resumen.totalPorMedio)]));

  const cerrar = async () => {
    setGuardando(true);
    try {
      await cerrarCajaFirestore(dia, contado, nota, usuarioActual);
      onExito(`Caja del ${formatearDia(dia)} cerrada.`);
      setEfectivoContado('');
      setNota('');
    } catch (e: any) {
      onError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  const reabrir = async () => {
    setGuardando(true);
    try {
      await reabrirCajaFirestore(dia, motivoReapertura, usuarioActual);
      onExito(`Caja del ${formatearDia(dia)} reabierta.`);
      setMotivoReapertura('');
      cargarPagos();
    } catch (e: any) {
      onError(e?.message || String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">
          Día:{' '}
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="ml-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <button onClick={cargarPagos} className="text-sm font-semibold text-sky-700">
          Actualizar
        </button>
        {caja?.cerrado ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-900 text-white px-2 py-1 rounded-full">
            <Lock className="w-3 h-3" /> Cerrada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-900 px-2 py-1 rounded-full">
            <Unlock className="w-3 h-3" /> Abierta
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {mediosMostrados.map((m) => (
          <div key={m} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500">{m}</p>
            <p className="font-mono font-bold text-slate-900">{formatearMonedaBs(resumen.totalPorMedio[m] || 0)}</p>
          </div>
        ))}
        <div className="bg-slate-900 text-white rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold opacity-80">Total del día</p>
          <p className="font-mono font-bold">{formatearMonedaBs(resumen.totalRecibidoBs)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {cargando ? (
          <p className="p-4 text-sm text-slate-500">Cargando movimientos…</p>
        ) : pagos.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Sin movimientos este día.</p>
        ) : (
          pagos.map((p) => (
            <div key={p.id} className="p-3 flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {p.folio} · {p.clienteNombre}
                </p>
                <p className="text-xs text-slate-500">
                  {formatearFecha(p.fecha || p.fechaLocal)} · {p.tipo} · {p.montos.map((m) => m.medio).join(' + ')} · {p.registradoPorNombre}
                </p>
              </div>
              <span className={`font-mono font-bold ${p.totalBs < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatearMonedaBs(p.totalBs)}
              </span>
            </div>
          ))
        )}
      </div>

      {caja?.cerrado ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4" /> Cierre registrado
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Dato titulo="Efectivo esperado" valor={formatearMonedaBs(caja.efectivoEsperadoBs)} />
            <Dato titulo="Efectivo contado" valor={formatearMonedaBs(caja.efectivoContadoBs)} />
            <Dato titulo="Diferencia" valor={formatearMonedaBs(caja.diferenciaBs)} fuerte={caja.diferenciaBs !== 0} />
            <Dato titulo="Movimientos" valor={String(caja.cantidadMovimientos)} />
          </div>
          <p className="text-xs text-slate-600">
            Cerró {caja.cerradoPorNombre} el {formatearFecha(caja.fechaCierreLocal)}
            {caja.nota ? ` · Nota: ${caja.nota}` : ''}
          </p>
          {resumen.totalRecibidoBs !== caja.totalRecibidoBs && (
            <p className="text-xs text-rose-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Los movimientos actuales no coinciden con el cierre. Revisa la auditoría.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={motivoReapertura}
              onChange={(e) => setMotivoReapertura(e.target.value)}
              placeholder="Motivo para reabrir (obligatorio)"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={reabrir}
              disabled={guardando || !motivoReapertura.trim()}
              className="px-4 py-2 rounded-lg border border-rose-300 text-rose-700 disabled:opacity-50 text-sm font-bold"
            >
              Reabrir caja
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Arqueo y cierre
          </h4>
          <p className="text-sm text-slate-600">
            Efectivo esperado: <b className="font-mono">{formatearMonedaBs(resumen.efectivoEsperadoBs)}</b>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Efectivo contado en caja (Bs)</span>
              <input
                inputMode="decimal"
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2.5 font-mono"
                placeholder="0,00"
              />
            </label>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] uppercase font-bold text-slate-500">Diferencia</p>
              <p className={`font-mono font-bold ${diferencia && diferencia !== 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {diferencia === null ? '—' : formatearMonedaBs(diferencia)}
              </p>
            </div>
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (obligatoria si hay diferencia)"
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={cerrar}
            disabled={guardando || isNaN(contado) || (diferencia !== null && diferencia !== 0 && !nota.trim())}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 disabled:opacity-50 text-white text-sm font-bold"
          >
            Cerrar caja del {formatearDia(dia)}
          </button>
        </div>
      )}
    </div>
  );
};
