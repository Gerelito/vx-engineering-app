import React from 'react';
import { OrdenServicio, TallerConfig } from '../../types';
import { formatearTelefonoBolivia, formatearFecha, formatearMonedaBs } from '../../lib/storage';
import { Printer, X, Wrench, AlertTriangle, AlertCircle, Calendar, ShieldCheck, Clock } from 'lucide-react';

interface OrdenImprimibleModalProps {
  orden: OrdenServicio | null;
  config: TallerConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const OrdenImprimibleModal: React.FC<OrdenImprimibleModalProps> = ({
  orden,
  config,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !orden) return null;

  const handleImprimir = () => {
    window.print();
  };

  const faltanDatosTaller = !config.direccion?.trim() || !config.telefonoWhatsapp?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="zona-impresion w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Barra superior de control (no se imprime) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">
              Hoja de Recepción para Firma del Cliente · {orden.folio}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimir}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Aviso no imprimible si faltan datos del taller */}
        {faltanDatosTaller && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2.5 print:hidden">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Completa los datos del taller en Configuración (dirección y teléfono WhatsApp).</span>
          </div>
        )}

        {/* CONTENIDO IMPRIMIBLE (Formato A4 Estándar) */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white" id="orden-imprimible">
          {/* Encabezado del Taller */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wrench className="w-6 h-6 text-slate-900" />
                <h1 className="text-xl font-extrabold tracking-tight">
                  {config.nombre || 'VX Engineering'}
                </h1>
              </div>
              {config.direccion?.trim() ? (
                <p className="text-xs text-slate-600">
                  {config.direccion} {config.ciudad ? `· ${config.ciudad}` : ''} {config.pais ? `, ${config.pais}` : ''}
                </p>
              ) : null}
              {config.telefonoWhatsapp?.trim() || config.horario?.trim() ? (
                <p className="text-xs text-slate-600 font-medium">
                  {config.telefonoWhatsapp ? `WhatsApp: ${config.telefonoWhatsapp}` : ''}
                  {config.telefonoWhatsapp && config.horario ? ' · ' : ''}
                  {config.horario ? `Horario: ${config.horario}` : ''}
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Orden de Servicio
              </span>
              <span className="font-mono text-2xl font-black text-slate-950 block">
                {orden.folio}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block">
                Ingreso: {formatearFecha(orden.createdAt || orden.fechaCreacion)}
              </span>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  orden.prioridad === 'Urgente'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-100 text-slate-800 border border-slate-300'
                }`}
              >
                Prioridad: {orden.prioridad}
              </span>
            </div>
          </div>

          {/* Bloque Cliente y Vehículo */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-200 pb-0.5">
                Datos del Cliente
              </span>
              <div>
                <strong>Titular:</strong> {orden.clienteNombre}
              </div>
              <div>
                <strong>Teléfono:</strong> {formatearTelefonoBolivia(orden.clienteTelefono)}
              </div>
              {orden.clienteDocumento && (
                <div>
                  <strong>Documento / CI:</strong> {orden.clienteDocumento}
                </div>
              )}
              <div>
                <strong>Autorización contacto WhatsApp:</strong>{' '}
                <span className={orden.autorizaciones?.aceptaContactoWhatsapp ? 'text-emerald-700 font-bold' : 'text-slate-600'}>
                  {orden.autorizaciones?.aceptaContactoWhatsapp ? 'Sí, autorizado' : 'No autorizado'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-200 pb-0.5">
                Datos del Vehículo
              </span>
              <div>
                <strong>Placa:</strong> <span className="font-mono font-bold">{orden.vehiculoPlaca}</span>
              </div>
              <div>
                <strong>Vehículo:</strong> {orden.vehiculoMarca} {orden.vehiculoModelo} ({orden.vehiculoAnio || 'N/D'})
              </div>
              <div>
                <strong>Odómetro / Km:</strong> {orden.kilometraje?.toLocaleString() || 0} km
              </div>
              <div>
                <strong>Nivel Combustible:</strong> {orden.nivelCombustible}
              </div>
              <div className="pt-0.5">
                <strong>Entrega prometida:</strong>{' '}
                <span className="font-bold text-slate-950">
                  {formatearFecha(orden.fechaPrometidaEntrega)}
                </span>
              </div>
            </div>
          </div>

          {/* Motivo e Inspección Técnica */}
          <div className="space-y-1.5 text-xs">
            <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-300 pb-0.5">
              1. Motivo de Ingreso y Diagnóstico Solicitado
            </span>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 italic leading-relaxed text-slate-800">
              "{orden.motivoCliente}"
            </div>

            {orden.sistemasAfectados?.length > 0 && (
              <div className="flex items-center gap-2 pt-0.5 flex-wrap text-[11px]">
                <strong className="text-slate-700">Sistemas afectados:</strong>
                {orden.sistemasAfectados.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Daños de Carrocería Registrados en Diagrama */}
          <div className="space-y-1.5 text-xs">
            <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-300 pb-0.5">
              2. Inspección de Daños de Carrocería (Diagrama Pericial)
            </span>
            {!orden.daniosCarroceria || orden.daniosCarroceria.length === 0 ? (
              <p className="text-slate-500 italic text-[11px]">
                Sin daños visibles registrados en la inspección visual de ingreso.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {orden.daniosCarroceria.map((d, i) => (
                  <div
                    key={d.id || i}
                    className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>#{i + 1} {d.tipo}</span>
                      <span className={`text-[10px] px-1 py-0.2 rounded uppercase ${
                        d.severidad === 'Grave' ? 'bg-rose-100 text-rose-800' :
                        d.severidad === 'Media' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-800'
                      }`}>
                        {d.severidad}
                      </span>
                    </div>
                    <span className="text-slate-600 block capitalize">
                      Zona: {d.zona.replace('_', ' ')}
                    </span>
                    {d.descripcion ? (
                      <span className="text-slate-500 italic block">{d.descripcion}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventario de Accesorios */}
          <div className="space-y-1.5 text-xs">
            <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-300 pb-0.5">
              3. Inventario de Objetos y Accesorios Dejados en el Vehículo
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                Llanta de repuesto: <strong>{orden.accesorios?.llantaRepuesto ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Gato mecánico: <strong>{orden.accesorios?.gato ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Triángulos de seguridad: <strong>{orden.accesorios?.triangulos ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Extintor: <strong>{orden.accesorios?.extintor ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Radio / Pantalla: <strong>{orden.accesorios?.radio ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Juego de tapetes: <strong>{orden.accesorios?.tapetes ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Documentos del auto: <strong>{orden.accesorios?.documentos ? 'SÍ' : 'NO'}</strong>
              </div>
              <div>
                Llaves recibidas: <strong>{orden.accesorios?.cantidadLlaves || 1}</strong>
              </div>
            </div>

            {orden.accesorios?.objetosValor && orden.accesorios?.objetosValorDetalle && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
                <strong>Objetos de valor declarados:</strong> {orden.accesorios.objetosValorDetalle}
              </div>
            )}
          </div>

          {/* Términos y Autorizaciones Legales */}
          <div className="space-y-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
            <span className="font-extrabold text-slate-900 uppercase block border-b border-slate-200 pb-0.5">
              4. Autorizaciones y Condiciones Legales
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              <li>
                <strong>Diagnóstico:</strong> El cliente autoriza pruebas mecánicas y desmontaje de partes para diagnóstico con un costo acordado de{' '}
                <strong>{orden.autorizaciones?.costoDiagnosticoBs || 150} Bs</strong>.
              </li>
              <li>
                <strong>Monto Pre-autorizado:</strong>{' '}
                {orden.autorizaciones?.montoPreAutorizadoBs ? (
                  <span>
                    El cliente pre-autoriza reparaciones inmediatas hasta{' '}
                    <strong className="text-slate-900">
                      {formatearMonedaBs(orden.autorizaciones.montoPreAutorizadoBs)}
                    </strong>{' '}
                    sin necesidad de llamada previa.
                  </span>
                ) : (
                  <span className="text-slate-500 italic">No especificado (toda reparación requerirá cotización y aprobación previa).</span>
                )}
              </li>
              <li>
                <strong>Custodia y Almacenaje:</strong> Una vez notificada la cotización o terminación del trabajo, el cliente dispone de{' '}
                <strong>{config.almacenajeDiasGratis || 3} días calendario libres</strong>. Cumplido este plazo se aplicará una tarifa de{' '}
                <strong>{config.almacenajeCostoDiarioBs || 35} Bs/día</strong>.
              </li>
              <li>
                <strong>Repuestos reemplazados:</strong>{' '}
                {orden.autorizaciones?.devolucionPiezas
                  ? 'Devolver repuestos usados al cliente al momento de la entrega.'
                  : 'Autoriza desecho ecológico de piezas por parte del taller.'}
              </li>
              <li>
                <strong>Canales de contacto:</strong>{' '}
                {orden.autorizaciones?.aceptaContactoWhatsapp
                  ? 'Autoriza el envío de cotizaciones, diagnósticos técnicos y reportes por WhatsApp / teléfono.'
                  : 'Solo contacto en persona o llamadas telefónicas.'}
              </li>
            </ul>
          </div>

          {/* Firmas */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="text-center space-y-1.5">
              <div className="border-b-2 border-slate-900 h-14" />
              <span className="font-bold text-xs block text-slate-900">
                Firma del Cliente o Quien Entrega
              </span>
              <span className="text-[11px] text-slate-500 block">
                {orden.autorizaciones?.nombreQuienEntrega || orden.clienteNombre}
              </span>
            </div>

            <div className="text-center space-y-1.5">
              <div className="border-b-2 border-slate-900 h-14" />
              <span className="font-bold text-xs block text-slate-900">
                Por {config.nombre || 'VX Engineering'}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Recepción Autorizada
              </span>
            </div>
          </div>

          {/* Código de Verificación al pie */}
          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
            Código Único de Verificación: <strong className="font-mono">{orden.codigoVerificacion}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
