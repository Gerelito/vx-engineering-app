import React, { useState } from 'react';
import { OrdenServicio } from '../../types';
import { Camera, Upload, X, CheckCircle2, AlertCircle, FileCheck } from 'lucide-react';

interface SubirFirmaModalProps {
  orden: OrdenServicio | null;
  isOpen: boolean;
  onClose: () => void;
  onSubirFirma: (
    orden: OrdenServicio,
    fotoData: { nombreArchivo: string; base64Data: string; tamanioBytes?: number }
  ) => Promise<void>;
  onError: (mensaje: string) => void;
}

export const SubirFirmaModal: React.FC<SubirFirmaModalProps> = ({
  orden,
  isOpen,
  onClose,
  onSubirFirma,
  onError,
}) => {
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [tamanioBytes, setTamanioBytes] = useState<number>(0);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!isOpen || !orden) return null;

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNombreArchivo(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.55);
          const bytes = Math.round((compressed.length * 3) / 4);
          setFotoBase64(compressed);
          setTamanioBytes(bytes);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGuardar = async () => {
    if (!fotoBase64) {
      onError('Debes capturar o subir una foto clara de la orden firmada.');
      return;
    }

    setGuardando(true);
    try {
      await onSubirFirma(orden, {
        nombreArchivo: nombreArchivo || `firma_${orden.folio}.jpg`,
        base64Data: fotoBase64,
        tamanioBytes,
      });
      onClose();
    } catch (err: any) {
      onError(err?.message || 'Error al guardar la foto de la firma');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Subir Firma del Cliente</h3>
              <p className="text-[11px] text-slate-300">
                Orden {orden.folio} · {orden.vehiculoPlaca}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Fotografía la hoja física de la orden de servicio donde el cliente{' '}
            <strong>{orden.clienteNombre}</strong> estampó su firma. Se comprimirá a menos de 120 KB para custodia digital.
          </p>

          {fotoBase64 ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-emerald-300 aspect-3/2 bg-slate-900/5">
                <img
                  src={fotoBase64}
                  alt="Orden firmada"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Foto lista ({Math.round(tamanioBytes / 1024)} KB)
                </span>

                <label className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">
                  Cambiar foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSeleccionarArchivo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
              <Camera className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-800">
                Tomar Foto de la Hoja Firmada
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                o seleccionar archivo desde el dispositivo
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleSeleccionarArchivo}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Botones de acción */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={!fotoBase64 || guardando}
            className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {guardando ? 'Guardando firma...' : 'Confirmar Firma'}
          </button>
        </div>
      </div>
    </div>
  );
};
