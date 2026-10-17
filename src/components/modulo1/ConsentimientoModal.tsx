import React, { useState, useEffect } from 'react';
import { Cliente, ArchivoCliente } from '../../types';
import { procesarArchivoAdjunto, ArchivoProcesado } from '../../lib/fileCompression';
import { obtenerArchivoCliente } from '../../lib/storage';
import {
  X,
  Upload,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Eye,
  FileText,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

interface ConsentimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente | null;
  onSubirConsentimiento: (
    cliente: Cliente,
    archivo: {
      nombreArchivo: string;
      formato: 'jpeg' | 'png' | 'pdf';
      tamanioBytes: number;
      base64Data: string;
    }
  ) => Promise<void>;
  onError: (mensaje: string) => void;
}

export const ConsentimientoModal: React.FC<ConsentimientoModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onSubirConsentimiento,
  onError,
}) => {
  const [archivoProcesado, setArchivoProcesado] = useState<ArchivoProcesado | null>(null);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [vistaPreviaCompleta, setVistaPreviaCompleta] = useState(false);

  // Ver archivo existente si el cliente ya lo tiene firmado
  const [archivoExistente, setArchivoExistente] = useState<ArchivoCliente | null>(null);
  const [cargandoExistente, setCargandoExistente] = useState(false);

  useEffect(() => {
    setArchivoProcesado(null);
    setVistaPreviaCompleta(false);
    setArchivoExistente(null);

    if (isOpen && cliente?.consentimientoFirmado && cliente.consentimientoArchivoId) {
      setCargandoExistente(true);
      obtenerArchivoCliente(cliente.id, cliente.consentimientoArchivoId)
        .then((doc) => setArchivoExistente(doc))
        .catch((err) => console.error('Error al cargar archivo existente:', err))
        .finally(() => setCargandoExistente(false));
    }
  }, [isOpen, cliente]);

  if (!isOpen || !cliente) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoArchivo(true);
    try {
      const resultado = await procesarArchivoAdjunto(file);
      setArchivoProcesado(resultado);
    } catch (err: any) {
      onError(err.message || 'Error al procesar el archivo seleccionado.');
      setArchivoProcesado(null);
    } finally {
      setProcesandoArchivo(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoProcesado) {
      onError('Debes seleccionar y procesar una fotografía o archivo PDF del documento firmado.');
      return;
    }

    setGuardando(true);
    try {
      await onSubirConsentimiento(cliente, {
        nombreArchivo: archivoProcesado.nombreOriginal,
        formato: archivoProcesado.formato,
        tamanioBytes: archivoProcesado.tamanioBytes,
        base64Data: archivoProcesado.base64Data,
      });
      onClose();
    } catch (err: any) {
      onError(`Error al guardar en Firestore: ${err.message || 'Fallo de conexión o permisos'}`);
    } finally {
      setGuardando(false);
    }
  };

  const formatearKb = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Consentimiento de Protección de Datos</h2>
              <p className="text-xs text-slate-400">Cliente: {cliente.nombre} · Tel: {cliente.telefono}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal de Vista Previa Grande */}
        {vistaPreviaCompleta && (archivoProcesado || archivoExistente) && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-4 max-w-3xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-900">
                  Vista Previa Completa del Documento
                </span>
                <button
                  onClick={() => setVistaPreviaCompleta(false)}
                  className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 rounded-lg my-2">
                {(() => {
                  const docActual = archivoProcesado || archivoExistente;
                  if (!docActual) return null;
                  if (docActual.formato === 'pdf') {
                    return (
                      <iframe
                        src={docActual.base64Data}
                        title="Documento PDF"
                        className="w-full h-[65vh] rounded border border-slate-300"
                      />
                    );
                  }
                  return (
                    <img
                      src={docActual.base64Data}
                      alt="Documento firmado"
                      className="max-h-[65vh] max-w-full object-contain rounded shadow-md"
                    />
                  );
                })()}
              </div>

              <div className="text-right pt-2">
                <button
                  type="button"
                  onClick={() => setVistaPreviaCompleta(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  Cerrar Vista Previa
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">Almacenamiento Directo en Firestore:</p>
            <p>
              El archivo se comprime automáticamente en el navegador a formato JPEG (máx. 1280 px, calidad 0.6, objetivo &lt; 200 KB) o PDF (máx. 700 KB) y se guarda directamente en la base de datos sin incurrir en costos de Cloud Storage.
            </p>
          </div>

          {/* Si ya existe un archivo subido anteriormente, mostrarlo */}
          {cargandoExistente && (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span>Cargando documento registrado...</span>
            </div>
          )}

          {archivoExistente && !archivoProcesado && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950 block">Documento Firmado Vigente</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {archivoExistente.nombreArchivo} ({formatearKb(archivoExistente.tamanioBytes)}) · {archivoExistente.fecha}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVistaPreviaCompleta(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver Grande</span>
              </button>
            </div>
          )}

          {/* Selector de nuevo archivo */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              {archivoExistente ? 'Reemplazar con un nuevo archivo firmado:' : 'Adjuntar fotografía o archivo del documento firmado:'}
            </label>

            <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-slate-900 hover:bg-slate-50/50">
              <div className="flex flex-col items-center space-y-1 text-center">
                {procesandoArchivo ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                    <span className="font-semibold text-xs text-slate-700">Comprimiendo archivo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="font-semibold text-xs text-slate-700">
                      Haz clic para seleccionar o tomar foto
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Fotografía (JPG/PNG) o documento PDF (máx. 700 KB)
                    </span>
                  </>
                )}
              </div>
              <input
                type="file"
                disabled={procesandoArchivo || guardando}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Miniatura y detalles del archivo recién procesado */}
          {archivoProcesado && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {archivoProcesado.formato === 'pdf' ? (
                    <FileText className="w-5 h-5 text-red-600 shrink-0" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-blue-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold text-slate-900 block truncate max-w-[200px]">
                      {archivoProcesado.nombreOriginal}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold font-mono">
                      Optimizado: {formatearKb(archivoProcesado.tamanioBytes)} (Listo para Firestore)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVistaPreviaCompleta(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Completo</span>
                </button>
              </div>

              {/* Vista previa en miniatura si es imagen */}
              {archivoProcesado.formato !== 'pdf' && (
                <div className="h-24 w-full bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={archivoProcesado.base64Data}
                    alt="Miniatura"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={guardando}
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!archivoProcesado || guardando}
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando en Firestore...</span>
                </>
              ) : (
                <span>Confirmar y Guardar</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
