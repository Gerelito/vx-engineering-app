import React from 'react';
import { OrdenServicio, TallerConfig } from '../../types';
import { formatearTelefonoBolivia, obtenerTelefonoE164 } from '../../lib/storage';
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Activity,
  Gauge,
  Phone,
  Calendar,
  Car,
  User,
  ShieldAlert,
} from 'lucide-react';

interface DiagnosticoImprimibleModalProps {
  orden: OrdenServicio | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticoImprimibleModal: React.FC<DiagnosticoImprimibleModalProps> = ({
  orden,
  config,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !orden) return null;

  const diag = orden.diagnosticoTecnico;

  const handleImprimir = () => {
    window.print();
  };

  // Generar texto estructurado para WhatsApp con semáforo y hallazgos
  const generarTextoWhatsApp = (): string => {
    const tel = orden.clienteTelefonoE164 || obtenerTelefonoE164(orden.clienteTelefono);
    let msg = `*INFORME DE DIAGNÓSTICO TÉCNICO*\n`;
    msg += `*${config.nombre.toUpperCase()}*\n`;
    msg += `------------------------------------\n`;
    msg += `*Folio:* ${orden.folio}\n`;
    msg += `*Vehículo:* ${orden.vehiculoMarca} ${orden.vehiculoModelo} (Placa: ${orden.vehiculoPlaca})\n`;
    msg += `*Kilometraje:* ${orden.kilometraje.toLocaleString()} km\n`;
    msg += `*Cliente:* ${orden.clienteNombre}\n`;
    msg += `------------------------------------\n\n`;

    if (diag?.inspeccionMultipunto && diag.inspeccionMultipunto.length > 0) {
      msg += `*INSPECCIÓN MULTIPUNTO:*\n`;
      diag.inspeccionMultipunto.forEach((item) => {
        const icon =
          item.estado === 'Bueno'
            ? '🟢'
            : item.estado === 'Observación'
            ? '🟡'
            : '🔴';
        msg += `${icon} *${item.sistema.split('(')[0].trim()}:* ${item.estado}`;
        if (item.observacion) msg += ` - ${item.observacion}`;
        msg += `\n`;
      });
      msg += `\n`;
    }

    if (diag?.codigosObd2 && diag.codigosObd2.length > 0) {
      msg += `*CÓDIGOS DE ESCÁNER (OBD-II):*\n`;
      diag.codigosObd2.forEach((c) => {
        msg += `⚠️ ${c.codigo}: ${c.descripcion} (${c.estado})\n`;
      });
      msg += `\n`;
    }

    const urgentes = (diag?.hallazgos || []).filter((h) => h.clasificacion === 'Seguridad (Urgente)');
    if (urgentes.length > 0) {
      msg += `*⚠️ TRABAJOS URGENTES DE SEGURIDAD:*\n`;
      urgentes.forEach((u) => {
        msg += `• ${u.descripcion}\n`;
      });
      msg += `\n`;
    }

    const recomendados = (diag?.hallazgos || []).filter((h) => h.clasificacion === 'Recomendado');
    if (recomendados.length > 0) {
      msg += `*🔧 RECOMENDACIONES PREVENTIVAS:*\n`;
      recomendados.forEach((r) => {
        msg += `• ${r.descripcion}\n`;
      });
      msg += `\n`;
    }

    if (diag?.notaExplicativaCliente) {
      msg += `*Nota del Taller:* ${diag.notaExplicativaCliente}\n\n`;
    }

    msg += `Cualquier consulta estamos a su servicio en el taller. ¡Gracias por su confianza!`;
    return msg;
  };

  const linkWhatsApp = () => {
    const tel = orden.clienteTelefonoE164 || obtenerTelefonoE164(orden.clienteTelefono);
    const cleanTel = tel.replace(/\+/g, '');
    const texto = encodeURIComponent(generarTextoWhatsApp());
    return `https://wa.me/${cleanTel}?text=${texto}`;
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="zona-impresion bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[95vh]">
        {/* Barra superior de herramientas (no imprimible) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold">Hoja de Diagnóstico para el Cliente</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={linkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar por WhatsApp</span>
            </a>

            <button
              onClick={handleImprimir}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Documento Imprimible */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible print:max-h-none text-slate-900 bg-white">
          {/* Encabezado del Taller */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                {config.nombre}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                {config.direccion} · {config.ciudad}, {config.pais}
              </p>
              <p className="text-xs text-slate-600">
                WhatsApp: {formatearTelefonoBolivia(config.telefonoWhatsapp)} · Horario: {config.horario}
              </p>
            </div>

            <div className="text-left sm:text-right border-l-2 sm:border-l-0 sm:border-r-2 border-amber-500 pl-3 sm:pl-0 sm:pr-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                INFORME TÉCNICO DE TALLER
              </span>
              <span className="text-xl font-black font-mono text-slate-900 block">
                {orden.folio}
              </span>
              <span className="text-xs text-slate-500">
                Fecha: {new Date().toLocaleDateString('es-BO')}
              </span>
            </div>
          </div>

          {/* Ficha Cliente & Vehículo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cliente</span>
              <span className="font-bold text-slate-900 block">{orden.clienteNombre}</span>
              <span className="text-slate-600">{formatearTelefonoBolivia(orden.clienteTelefono)}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehículo</span>
              <span className="font-bold text-slate-900 block">
                {orden.vehiculoMarca} {orden.vehiculoModelo}
              </span>
              <span className="text-slate-600">Año: {orden.vehiculoAnio || 'S/D'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Placa</span>
              <span className="font-mono font-black text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block mt-0.5">
                {orden.vehiculoPlaca}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Kilometraje</span>
              <span className="font-mono font-bold text-slate-900 block">
                {orden.kilometraje.toLocaleString()} km
              </span>
              <span className="text-slate-500 text-[11px]">Combustible: {orden.nivelCombustible}</span>
            </div>
          </div>

          {/* Motivo de Ingreso expresado por el cliente */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Motivo de Ingreso Reportado por el Cliente:
            </span>
            <p className="font-medium text-slate-800 italic">"{orden.motivoCliente}"</p>
          </div>

          {/* Tabla Semáforo Multipunto */}
          {diag?.inspeccionMultipunto && diag.inspeccionMultipunto.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                <Activity className="w-4 h-4 text-slate-700" />
                Resultado de Inspección Multipunto (Semáforo de Seguridad)
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-bold">Sistema Evaluado</th>
                      <th className="py-2 px-3 font-bold w-28 text-center">Estado</th>
                      <th className="py-2 px-3 font-bold">Observación Técnica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {diag.inspeccionMultipunto.map((item) => (
                      <tr key={item.sistema} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {item.sistema}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.estado === 'Bueno'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.estado === 'Observación'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.estado === 'Bueno' && '🟢 OK'}
                            {item.estado === 'Observación' && '🟡 Atención'}
                            {item.estado === 'Urgente' && '🔴 Crítico'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {item.observacion || 'Sin novedad aparente'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mediciones Cuantitativas Clave */}
          {diag?.mediciones && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                <Gauge className="w-4 h-4 text-slate-700" />
                Mediciones Técnicas Registradas
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {diag.mediciones.espesorPastillasDelanterasIzqMm && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border text-center">
                    <span className="text-[10px] text-slate-500 block">Pastillas Del. Izq</span>
                    <span className="font-mono font-bold text-slate-900">
                      {diag.mediciones.espesorPastillasDelanterasIzqMm} mm
                    </span>
                  </div>
                )}
                {diag.mediciones.espesorPastillasDelanterasDerMm && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border text-center">
                    <span className="text-[10px] text-slate-500 block">Pastillas Del. Der</span>
                    <span className="font-mono font-bold text-slate-900">
                      {diag.mediciones.espesorPastillasDelanterasDerMm} mm
                    </span>
                  </div>
                )}
                {diag.mediciones.voltajeBateriaReposoV && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border text-center">
                    <span className="text-[10px] text-slate-500 block">Batería en Reposo</span>
                    <span className="font-mono font-bold text-slate-900">
                      {diag.mediciones.voltajeBateriaReposoV} V
                    </span>
                  </div>
                )}
                {diag.mediciones.voltajeBateriaCargaV && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border text-center">
                    <span className="text-[10px] text-slate-500 block">Carga / Alternador</span>
                    <span className="font-mono font-bold text-slate-900">
                      {diag.mediciones.voltajeBateriaCargaV} V
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Códigos OBD-II leídos */}
          {diag?.codigosObd2 && diag.codigosObd2.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                Códigos de Falla OBD-II Registrados por Escáner
              </h3>
              <div className="space-y-1.5 text-xs">
                {diag.codigosObd2.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 bg-rose-50/50 border border-rose-200 rounded-lg flex items-center gap-2"
                  >
                    <span className="font-mono font-bold text-rose-800 bg-white px-2 py-0.5 rounded border border-rose-300">
                      {c.codigo}
                    </span>
                    <span className="font-semibold text-slate-900">{c.descripcion}</span>
                    <span className="text-[10px] text-rose-600 ml-auto font-medium">({c.estado})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hallazgos y Recomendaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Urgentes */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <h4 className="font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Trabajos Inmediatos (Seguridad Vial)
              </h4>
              <ul className="space-y-1 list-disc list-inside text-rose-800">
                {(diag?.hallazgos || [])
                  .filter((h) => h.clasificacion === 'Seguridad (Urgente)')
                  .map((h) => (
                    <li key={h.id}>{h.descripcion}</li>
                  ))}
                {!(diag?.hallazgos || []).some((h) => h.clasificacion === 'Seguridad (Urgente)') && (
                  <li className="list-none italic text-slate-400">Sin hallazgos críticos urgentes.</li>
                )}
              </ul>
            </div>

            {/* Preventivos */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                Recomendaciones Preventivas
              </h4>
              <ul className="space-y-1 list-disc list-inside text-amber-800">
                {(diag?.hallazgos || [])
                  .filter((h) => h.clasificacion === 'Recomendado')
                  .map((h) => (
                    <li key={h.id}>{h.descripcion}</li>
                  ))}
                {!(diag?.hallazgos || []).some((h) => h.clasificacion === 'Recomendado') && (
                  <li className="list-none italic text-slate-400">Sin recomendaciones preventivas.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Explicación al cliente */}
          {diag?.notaExplicativaCliente && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Conclusión y Explicación Técnica para el Cliente:
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">
                {diag.notaExplicativaCliente}
              </p>
            </div>
          )}

          {/* Firmas al pie */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-slate-300 w-44 mx-auto mb-2" />
              <p className="font-bold text-slate-900">
                {diag?.actualizadoPor || 'Mecánico Responsable'}
              </p>
              <p className="text-[10px] text-slate-500">Técnico Automotriz · {config.nombre}</p>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-300 w-44 mx-auto mb-2" />
              <p className="font-bold text-slate-900">{orden.clienteNombre}</p>
              <p className="text-[10px] text-slate-500">Firma del Cliente Propietario</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
