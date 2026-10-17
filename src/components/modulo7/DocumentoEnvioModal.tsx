import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CotizacionOrden, DuenoUsuario, OrdenServicio, TallerConfig } from '../../types';
import { TipoDocumentoPublico } from '../../lib/verificacion';
import {
  NOMBRE_DOC,
  cambiarActivoVerificacionFirestore,
  descargarBlob,
  enviarPorWhatsApp,
  mensajeWhatsApp,
  puedeCompartirArchivos,
  registrarDocumentoEmitidoFirestore,
  registrarEnvioDocumentoFirestore,
} from '../../lib/envios';
import { AlertTriangle, Copy, Download, ExternalLink, FileText, Link2, Loader2, MessageCircle, ShieldCheck, ShieldOff, X } from 'lucide-react';

interface Props {
  orden: OrdenServicio;
  tipo: TipoDocumentoPublico;
  cotizacion?: CotizacionOrden | null;
  config: TallerConfig;
  usuarioActual: DuenoUsuario;
  onClose: () => void;
  onExito: (m: string) => void;
}

interface Pdf {
  blob: Blob;
  nombre: string;
  url: string;
}

export const DocumentoEnvioModal: React.FC<Props> = ({ orden, tipo, cotizacion, config, usuarioActual, onClose, onExito }) => {
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [verPdf, setVerPdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [activo, setActivo] = useState<boolean | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cambiandoActivo, setCambiandoActivo] = useState(false);
  const generado = useRef(false);
  const version = tipo === 'cotizacion' ? cotizacion?.versionNumero || 1 : null;
  const titulo = `${NOMBRE_DOC[tipo]}${version ? ` v${version}` : ''}`;

  useEffect(() => {
    if (generado.current) return;
    generado.current = true;
    (async () => {
      try {
        const m = await import('../../lib/documentos');
        let r: Pdf;
        if (tipo === 'orden') r = await m.generarPdfOrden(orden, config);
        else if (tipo === 'cotizacion') {
          if (!cotizacion) throw new Error('Falta la cotización.');
          r = await m.generarPdfCotizacion(orden, cotizacion, config);
        } else r = await m.generarPdfActa(orden, config);
        setPdf(r);
        setVerPdf(URL.createObjectURL(r.blob));
        // Constancia pública del documento emitido (sin montos). No bloquea los botones.
        registrarDocumentoEmitidoFirestore(orden, tipo, version, config, usuarioActual).catch((e) =>
          setAviso(`El PDF está listo, pero no se pudo registrar en la verificación: ${e?.message || e}`)
        );
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
    getDoc(doc(db, 'verificaciones', orden.codigoVerificacion))
      .then((s) => setActivo(s.exists() ? s.data().activo !== false : true))
      .catch(() => setActivo(null));
  }, []);

  useEffect(() => () => {
    if (verPdf) URL.revokeObjectURL(verPdf);
  }, [verPdf]);

  const mensaje = pdf ? mensajeWhatsApp(orden, tipo, pdf.url, config, version) : '';
  const enCelular = pdf ? puedeCompartirArchivos(pdf.blob, pdf.nombre) : false;

  const whatsapp = () => {
    if (!pdf) return;
    setError(null);
    setEnviando(true);
    // Sin esperas antes de compartir: el navegador exige que salga directo del toque.
    enviarPorWhatsApp(pdf, mensaje, orden)
      .then(async (via) => {
        if (via === 'cancelado') return;
        await registrarEnvioDocumentoFirestore(orden, tipo, via, version, usuarioActual);
        onExito(
          via === 'compartido'
            ? `${titulo} compartido. Quedó en la bitácora de contactos.`
            : `Se abrió WhatsApp y se descargó el PDF: adjúntalo en el chat. El mensaje también quedó copiado.`
        );
      })
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setEnviando(false));
  };

  const cambiarActivo = async (nuevo: boolean) => {
    setCambiandoActivo(true);
    setError(null);
    try {
      await cambiarActivoVerificacionFirestore(orden, nuevo, motivo, usuarioActual);
      setActivo(nuevo);
      setMotivo('');
      onExito(nuevo ? 'Enlace de verificación reactivado.' : 'Enlace de verificación desactivado.');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setCambiandoActivo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-bold">{titulo}</h3>
              <p className="text-xs text-slate-300">
                {orden.folio} · {orden.vehiculoPlaca} · {orden.clienteNombre}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {aviso && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2">{aviso}</p>}

          {!pdf && !error && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Generando PDF…
            </div>
          )}

          {pdf && (
            <>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={whatsapp}
                  disabled={enviando}
                  className="inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold"
                >
                  {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />} Enviar por WhatsApp
                </button>
                <p className="text-[11px] text-slate-500 text-center -mt-1">
                  {enCelular
                    ? 'Se abrirá el menú de compartir: elige WhatsApp y el contacto. El mensaje queda copiado para pegarlo.'
                    : 'Se abrirá WhatsApp con el mensaje y se descargará el PDF para que lo adjuntes.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => descargarBlob(pdf.blob, pdf.nombre)}
                    className="inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 font-bold text-sm"
                  >
                    <Download className="w-4 h-4" /> Descargar PDF
                  </button>
                  <a
                    href={verPdf || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 font-bold text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver PDF
                  </a>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-600">Mensaje</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{mensaje}</p>
                <button
                  onClick={() => navigator.clipboard?.writeText(mensaje).then(() => onExito('Mensaje copiado.'))}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar mensaje
                </button>
              </div>
            </>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold flex items-center gap-1.5">
                <Link2 className="w-4 h-4" /> Enlace de verificación
              </p>
              {activo === null ? (
                <span className="text-xs text-slate-400">—</span>
              ) : activo ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="w-4 h-4" /> Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                  <ShieldOff className="w-4 h-4" /> Desactivado
                </span>
              )}
            </div>
            {pdf && (
              <a href={pdf.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-700 underline break-all">
                {pdf.url}
              </a>
            )}
            {activo !== null &&
              (activo ? (
                <div className="flex gap-2">
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo para desactivar"
                    className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => cambiarActivo(false)}
                    disabled={cambiandoActivo || !motivo.trim()}
                    className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-bold disabled:opacity-40"
                  >
                    Desactivar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => cambiarActivo(true)}
                  disabled={cambiandoActivo}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold disabled:opacity-40"
                >
                  Reactivar enlace
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
