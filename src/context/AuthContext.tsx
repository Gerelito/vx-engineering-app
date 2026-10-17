import React, { createContext, useContext, useState, useEffect } from 'react';
import { DuenoUsuario } from '../types';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  inicializarOComprobarAcceso,
  actualizarListaDuenos,
} from '../lib/storage';

interface AuthContextType {
  usuarioActual: DuenoUsuario | null;
  cargandoAuth: boolean;
  esDuenoAutorizado: boolean;
  duenosEmails: string[];
  errorAcceso: string | null;
  iniciarSesionConGoogle: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
  modificarDuenos: (nuevosEmails: string[]) => Promise<void>;
  limpiarErrorAcceso: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuarioActual, setUsuarioActual] = useState<DuenoUsuario | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState<boolean>(true);
  const [esDuenoAutorizado, setEsDuenoAutorizado] = useState<boolean>(false);
  const [duenosEmails, setDuenosEmails] = useState<string[]>([]);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  // Manejo de redirect de Google (móviles) y escucha de sesión
  useEffect(() => {
    // Resolver posible retorno de signInWithRedirect en móviles
    getRedirectResult(auth).catch((err) => {
      console.warn('Redirect result:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      setCargandoAuth(true);

      if (!user) {
        setUsuarioActual(null);
        setEsDuenoAutorizado(false);
        setCargandoAuth(false);
        return;
      }

      const emailLimpio = (user.email || '').toLowerCase().trim();
      const duenoObj: DuenoUsuario = {
        uid: user.uid,
        email: emailLimpio,
        displayName: user.displayName || user.email || 'Dueño Taller',
        photoURL: user.photoURL || undefined,
      };

      try {
        const resultado = await inicializarOComprobarAcceso(duenoObj);
        setDuenosEmails(resultado.duenos);

        if (resultado.esDueno) {
          setUsuarioActual(duenoObj);
          setEsDuenoAutorizado(true);
          setErrorAcceso(null);
        } else {
          // Usuario no autorizado en /config/acceso
          setUsuarioActual(null);
          setEsDuenoAutorizado(false);
          setErrorAcceso(
            `El correo ${emailLimpio} no está registrado en la lista de dueños del taller. Pídele a uno de los dueños actuales que autorice tu correo en Configuración.`
          );
          await signOut(auth);
        }
      } catch (err: any) {
        console.error('Error al comprobar acceso en Firestore:', err);
        setUsuarioActual(null);
        setEsDuenoAutorizado(false);
        setErrorAcceso(
          `No se pudo verificar el acceso: ${err.message || 'Acceso denegado'}`
        );
      } finally {
        setCargandoAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const iniciarSesionConGoogle = async () => {
    setErrorAcceso(null);
    setCargandoAuth(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      // Si el navegador bloqueó la ventana emergente o en móviles, intentar redirect
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setErrorAcceso(`Error al redirigir con Google: ${redirectErr.message}`);
        }
      } else {
        setErrorAcceso(`Error al iniciar sesión con Google: ${err.message || err.code}`);
      }
      setCargandoAuth(false);
    }
  };

  const cerrarSesion = async () => {
    setErrorAcceso(null);
    await signOut(auth);
    setUsuarioActual(null);
    setEsDuenoAutorizado(false);
  };

  const modificarDuenos = async (nuevosEmails: string[]) => {
    if (!usuarioActual) throw new Error('No hay sesión de dueño activa.');
    await actualizarListaDuenos(nuevosEmails, usuarioActual);
    setDuenosEmails(nuevosEmails.map((e) => e.toLowerCase().trim()));
  };

  const limpiarErrorAcceso = () => setErrorAcceso(null);

  return (
    <AuthContext.Provider
      value={{
        usuarioActual,
        cargandoAuth,
        esDuenoAutorizado,
        duenosEmails,
        errorAcceso,
        iniciarSesionConGoogle,
        cerrarSesion,
        modificarDuenos,
        limpiarErrorAcceso,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
