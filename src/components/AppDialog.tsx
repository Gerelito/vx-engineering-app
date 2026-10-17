import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react';

export interface DialogOptions {
  tipo?: 'info' | 'advertencia' | 'peligro' | 'exito';
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  esConfirmacion?: boolean;
  onConfirmar: () => void;
  onCancelar?: () => void;
}

interface AppDialogProps {
  dialog: DialogOptions | null;
  onClose: () => void;
}

export const AppDialog: React.FC<AppDialogProps> = ({ dialog, onClose }) => {
  if (!dialog) return null;

  const tipo = dialog.tipo || 'info';
  const esConfirmacion = dialog.esConfirmacion ?? false;

  const handleConfirmar = () => {
    dialog.onConfirmar();
    onClose();
  };

  const handleCancelar = () => {
    if (dialog.onCancelar) {
      dialog.onCancelar();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                tipo === 'peligro'
                  ? 'bg-rose-100 text-rose-600'
                  : tipo === 'advertencia'
                  ? 'bg-amber-100 text-amber-600'
                  : tipo === 'exito'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {tipo === 'peligro' ? (
                <AlertCircle className="w-6 h-6" />
              ) : tipo === 'advertencia' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : tipo === 'exito' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <HelpCircle className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 id="dialog-title" className="text-base font-bold text-slate-900">
                {dialog.titulo}
              </h3>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {dialog.mensaje}
              </p>
            </div>

            <button
              onClick={handleCancelar}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Cerrar diálogo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          {esConfirmacion && (
            <button
              type="button"
              onClick={handleCancelar}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {dialog.textoCancelar || 'Cancelar'}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmar}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
              tipo === 'peligro'
                ? 'bg-rose-600 hover:bg-rose-700'
                : tipo === 'advertencia'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {dialog.textoConfirmar || (esConfirmacion ? 'Confirmar' : 'Entendido')}
          </button>
        </div>
      </div>
    </div>
  );
};
