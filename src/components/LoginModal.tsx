import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Wrench, Shield, AlertCircle, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const { iniciarSesionConGoogle, cargandoAuth, errorAcceso, limpiarErrorAcceso } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
        
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-inner border border-slate-700/60">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Taller Mecánico Automotriz</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema Integral de Gestión · La Paz, Bolivia
          </p>
        </div>

        {/* Mensaje de error de acceso no autorizado o error de autenticación */}
        {errorAcceso && (
          <div className="bg-red-50 border-b border-red-200 p-4 text-xs text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-red-900">Acceso No Autorizado</span>
              <p className="mt-0.5 leading-relaxed">{errorAcceso}</p>
              <button
                type="button"
                onClick={limpiarErrorAcceso}
                className="mt-2 text-[11px] font-semibold text-red-700 hover:text-red-900 underline"
              >
                Intentar con otra cuenta de Google
              </button>
            </div>
          </div>
        )}

        <div className="p-8 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              Acceso Exclusivo de Dueños
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              Ingresa con la cuenta de Google autorizada de tu taller. La seguridad y verificación en dos pasos (2FA) están garantizadas por tu cuenta de Google.
            </p>
          </div>

          {/* Botón único oficial de Google */}
          <button
            type="button"
            disabled={cargandoAuth}
            onClick={iniciarSesionConGoogle}
            className="w-full py-3 px-4 flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-xs transition-all hover:shadow-md disabled:opacity-60 cursor-pointer"
          >
            {cargandoAuth ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                <span>Conectando con Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Entrar con Google</span>
              </>
            )}
          </button>

          {/* Información sobre el primer arranque */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Regla de Primer Arranque y Acceso:</span>
            </div>
            <p>
              • Si el taller aún no tiene dueños registrados, la primera persona que inicie sesión con su cuenta de Google quedará configurada automáticamente como el primer dueño.
            </p>
            <p>
              • Posteriormente, ese primer dueño puede autorizar hasta 2 cuentas adicionales desde la pantalla de Configuración.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
