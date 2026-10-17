import React, { useState } from 'react';
import { OrdenServicio, TallerConfig, DuenoUsuario } from '../../types';
import {
  X,
  AlertTriangle,
  Camera,
  Plus,
  DollarSign,
  FileText,
  CheckCircle2,
  Send,
} from 'lucide-react';

interface TrabajoAdicionalModalProps {
  orden: OrdenServicio | null;
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  usuarioActual: DuenoUsuario | null;
  onRegistrarTrabajoAdicional: (
    orden: OrdenServicio,
    hallazgo: {
      descripcion: string;
      piezasServiciosRequeridos?: string | null;
      costoEstimadoBs: number;
      autorizadoPorCliente: boolean;
      fotoBase64?: string | null;
    }
  ) => Promise<void>;
}

export const TrabajoAdicionalModal: React.FC<TrabajoAdicionalModalProps> = ({
  orden,
  isOpen,
  onClose,
  config,
  usuarioActual,
  onRegistrarTrabajoAdicional,
}) => {
  if (!isOpen || !orden) return null;

  const [descripcion, setDescripcion] = useState('');
  const [piezasRequeridas, setPiezasRequeridas] = useState('');
  const [costoEstimadoBs, setCostoEstimadoBs] = useState<string>('150');
  const [autorizadoPorCliente, setAutorizadoPorCliente] = useState(false);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const handleFotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setComprimiendo(true);
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
          setFotoBase64(compressed);
        }
        setComprimiendo(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) {
      setErrorLocal('Indica la descripción del hallazgo o trabajo adicional.');
      return;
    }

    setGuardando(true);
    setErrorLocal(null);
    try {
      await onRegistrarTrabajoAdicional(orden, {
        descripcion: descripcion.trim(),
        piezasServiciosRequeridos: piezasRequeridas.trim() || null,
        costoEstimadoBs: Number(costoEstimadoBs) || 0,
        autorizadoPorCliente,
        fotoBase64,
      });

      onClose();
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al registrar trabajo adicional');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 flex flex-col">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Trabajo Adicional</h2>
              <p className="text-xs text-slate-400">
                Folio: <span className="font-mono text-amber-400 font-bold">{orden.folio}</span> ·{' '}
                {orden.vehiculoPlaca}
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

        {errorLocal && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 text-xs text-rose-900 font-semibold flex items-center justify-between">
            <span>{errorLocal}</span>
            <button onClick={() => setErrorLocal(null)} className="text-rose-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
            <strong>Hallazgo imprevisto durante el desarme:</strong> Si el cliente aún no ha
            autorizado este trabajo, la orden cambiará automáticamente a{' '}
            <span className="font-bold underline">"Esperando aprobación"</span> para notificar al
            cliente antes de proseguir.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Descripción del Defecto / Trabajo Adicional <span className="text-red-500">*</span>:
            </label>
            <input
              type="text"
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Fuga en retén de bancada tras desmontar embrague"
              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Piezas / Repuestos / Servicios Requeridos:
            </label>
            <input
              type="text"
              value={piezasRequeridas}
              onChange={(e) => setPiezasRequeridas(e.target.value)}
              placeholder="Ej. Retén de cigüeñal original + 0.5h rectificado"
              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Costo Adicional Estimado (Bs):
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={costoEstimadoBs}
              onChange={(e) => setCostoEstimadoBs(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 font-mono font-bold"
            />
          </div>

          {/* Foto de evidencia */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Foto de Evidencia del Daño (Cámara / Archivo):
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFotoCapture}
              disabled={comprimiendo}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
            />
            {comprimiendo && (
              <p className="text-[11px] text-blue-600 font-bold animate-pulse">
                Comprimiendo imagen a 1024px...
              </p>
            )}
            {fotoBase64 && (
              <div className="mt-2 relative inline-block">
                <img
                  src={fotoBase64}
                  alt="Evidencia hallazgo"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setFotoBase64(null)}
                  className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Casilla de autorización */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="chkAutorizado"
              checked={autorizadoPorCliente}
              onChange={(e) => setAutorizadoPorCliente(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="chkAutorizado" className="text-xs text-slate-800 cursor-pointer">
              <strong>El cliente ya autorizó este trabajo adicional</strong> (por llamada o WhatsApp).
              Si se desmarca, la orden pasará a <em>"Esperando aprobación"</em>.
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || comprimiendo}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {guardando ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Registrar Hallazgo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
