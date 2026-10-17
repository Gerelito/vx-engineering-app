import React, { useState } from 'react';
import { procesarArchivoAdjunto } from '../lib/fileCompression';
import { useAuth } from '../context/AuthContext';
import { ClavePlantillaWhatsapp, ClaveTextoLegal, OrdenServicio, TallerConfig, TrabajoTarifario } from '../types';
import { PLANTILLAS_WHATSAPP, TEXTOS_LEGALES } from '../lib/plantillas';
import { PanelRespaldo } from './modulo10/PanelRespaldo';
import {
  X,
  Settings,
  Users,
  Plus,
  Trash2,
  Shield,
  Save,
  Check,
  AlertCircle,
  Database,
  Building,
  Wrench,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';
import { guardarConfiguracionTaller } from '../lib/storage';
import { AppDialog, DialogOptions } from './AppDialog';

interface ConfiguracionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  onUpdateConfig: (nuevaConfig: TallerConfig) => void;
  onError: (mensaje: string) => void;
  ordenes?: OrdenServicio[];
}

export const ConfiguracionModal: React.FC<ConfiguracionModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onError,
  ordenes = [],
}) => {
  const { usuarioActual, duenosEmails, modificarDuenos } = useAuth();
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [tabActiva, setTabActiva] = useState<'dueños' | 'taller' | 'operacion' | 'tarifario' | 'cobros' | 'mensajes' | 'seguridad' | 'respaldo'>('dueños');

  // Estados locales de configuración general
  const [nombreTaller, setNombreTaller] = useState(config.nombre);
  const [direccion, setDireccion] = useState(config.direccion);
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState(config.telefonoWhatsapp);
  const [horario, setHorario] = useState(config.horario);
  const [colorMarca, setColorMarca] = useState(config.colorMarca || '#C2410C');
  const [logoUrl, setLogoUrl] = useState<string | null>(config.logoUrl || null);
  const [urlVerificacion, setUrlVerificacion] = useState(config.dominioVerificacionQr || '');
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  // Módulo 10
  const [diasGratis, setDiasGratis] = useState<number>(config.almacenajeDiasGratis ?? 3);
  const [costoDiario, setCostoDiario] = useState<number>(config.almacenajeCostoDiarioBs ?? 0);
  const [mediosPago, setMediosPago] = useState<string[]>(config.mediosPago?.length ? config.mediosPago : ['QR', 'Efectivo']);
  const [nuevoMedio, setNuevoMedio] = useState('');
  const [plantillas, setPlantillas] = useState<Record<ClavePlantillaWhatsapp, string>>({
    listo: config.plantillasWhatsapp?.listo || PLANTILLAS_WHATSAPP.listo.texto,
    cotizacion: config.plantillasWhatsapp?.cotizacion || PLANTILLAS_WHATSAPP.cotizacion.texto,
    orden: config.plantillasWhatsapp?.orden || PLANTILLAS_WHATSAPP.orden.texto,
    saldo: config.plantillasWhatsapp?.saldo || PLANTILLAS_WHATSAPP.saldo.texto,
  });
  const [textos, setTextos] = useState<Record<ClaveTextoLegal, string>>({
    consentimiento: config.textosLegales?.consentimiento || TEXTOS_LEGALES.consentimiento.texto,
    condicionesOrden: config.textosLegales?.condicionesOrden || TEXTOS_LEGALES.condicionesOrden.texto,
    condicionesAlmacenaje: config.textosLegales?.condicionesAlmacenaje || TEXTOS_LEGALES.condicionesAlmacenaje.texto,
    exclusionesGarantia: config.textosLegales?.exclusionesGarantia || TEXTOS_LEGALES.exclusionesGarantia.texto,
  });
  const [minutosInactividad, setMinutosInactividad] = useState<number>(config.minutosInactividad ?? 30);
  const [tarifaHora, setTarifaHora] = useState(config.tarifaHoraEstandarBs);
  const [margenMinimo, setMargenMinimo] = useState(config.margenMinimoPorcentaje);
  const [vigenciaDias, setVigenciaDias] = useState<number>(config.vigenciaCotizacionDias || 7);
  const [alertaPresupuesto, setAlertaPresupuesto] = useState<number>(config.alertaPresupuestoPorcentaje || 15);

  // Estados del Módulo 3: Taller
  const [bahias, setBahias] = useState<string[]>(config.bahiasDisponibles || []);
  const [nuevaBahia, setNuevaBahia] = useState('');

  const [mecanicos, setMecanicos] = useState<string[]>(config.mecanicosResponsables || []);
  const [nuevoMecanico, setNuevoMecanico] = useState('');

  const [trabajosTarifario, setTrabajosTarifario] = useState<TrabajoTarifario[]>(
    config.trabajosTarifario || []
  );
  const [nuevoTrabajoNombre, setNuevoTrabajoNombre] = useState('');
  const [nuevoTrabajoHoras, setNuevoTrabajoHoras] = useState<number>(1.0);

  const [limiteDiagHoras, setLimiteDiagHoras] = useState<number>(config.limiteDiagnosticoHoras || 4);
  const [factorReparacion, setFactorReparacion] = useState<number>(
    config.factorTiempoEstimadoReparacion || 1.5
  );
  const [limiteQcHoras, setLimiteQcHoras] = useState<number>(config.limiteControlCalidadHoras || 4);

  // Estados de gestión de dueños
  const [nuevoEmailDueno, setNuevoEmailDueno] = useState('');
  const [guardandoDuenos, setGuardandoDuenos] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  if (!isOpen || !usuarioActual) return null;

  const notificarExito = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  // Dueños
  const handleAgregarDueno = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLimpio = nuevoEmailDueno.trim().toLowerCase();

    if (!emailLimpio || !emailLimpio.includes('@')) {
      onError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (duenosEmails.includes(emailLimpio)) {
      onError(`El correo ${emailLimpio} ya está en la lista de dueños.`);
      return;
    }

    if (duenosEmails.length >= 3) {
      onError('El sistema tiene un límite máximo de 3 cuentas de dueños autorizados.');
      return;
    }

    setGuardandoDuenos(true);
    try {
      const nuevaLista = [...duenosEmails, emailLimpio];
      await modificarDuenos(nuevaLista);
      setNuevoEmailDueno('');
      notificarExito(`Dueño autorizado agregado: ${emailLimpio}`);
    } catch (err: any) {
      onError(`Error al agregar dueño: ${err.message || 'Fallo de permisos en Firestore'}`);
    } finally {
      setGuardandoDuenos(false);
    }
  };

  const ejecutarEliminarDueno = async (emailAEliminar: string) => {
    setGuardandoDuenos(true);
    try {
      const nuevaLista = duenosEmails.filter((e) => e !== emailAEliminar);
      await modificarDuenos(nuevaLista);
      notificarExito(`Dueño removido: ${emailAEliminar}`);
    } catch (err: any) {
      onError(`Error al remover dueño: ${err.message || 'Fallo de permisos en Firestore'}`);
    } finally {
      setGuardandoDuenos(false);
    }
  };

  const handleEliminarDueno = (emailAEliminar: string) => {
    if (duenosEmails.length <= 1) {
      onError('No puedes eliminar al único dueño registrado. El taller debe tener al menos un dueño con acceso.');
      return;
    }

    setDialog({
      tipo: 'peligro',
      titulo: 'Retirar acceso al taller',
      mensaje: `¿Confirmas que deseas retirar el acceso para "${emailAEliminar}"? Esta cuenta ya no podrá ingresar a la aplicación ni consultar datos de clientes y vehículos.`,
      textoConfirmar: 'Sí, retirar acceso',
      textoCancelar: 'Cancelar',
      esConfirmacion: true,
      onConfirmar: () => ejecutarEliminarDueno(emailAEliminar),
    });
  };

  // Operaciones de Bahías y Mecánicos
  const handleAgregarBahia = () => {
    if (!nuevaBahia.trim()) return;
    if (bahias.includes(nuevaBahia.trim())) {
      onError('Esa bahía ya existe en la lista.');
      return;
    }
    setBahias([...bahias, nuevaBahia.trim()]);
    setNuevaBahia('');
  };

  const handleEliminarBahia = (nombre: string) => {
    setBahias(bahias.filter((b) => b !== nombre));
  };

  const handleAgregarMecanico = () => {
    if (!nuevoMecanico.trim()) return;
    if (mecanicos.includes(nuevoMecanico.trim())) {
      onError('Ese responsable ya existe en la lista.');
      return;
    }
    setMecanicos([...mecanicos, nuevoMecanico.trim()]);
    setNuevoMecanico('');
  };

  const handleEliminarMecanico = (nombre: string) => {
    setMecanicos(mecanicos.filter((m) => m !== nombre));
  };

  // Tarifario
  const handleAgregarTrabajoTarifario = () => {
    if (!nuevoTrabajoNombre.trim()) return;
    const item: TrabajoTarifario = {
      id: `tar_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      trabajo: nuevoTrabajoNombre.trim(),
      horasEstandar: Number(nuevoTrabajoHoras) || 1.0,
    };
    setTrabajosTarifario([...trabajosTarifario, item]);
    setNuevoTrabajoNombre('');
    setNuevoTrabajoHoras(1.0);
  };

  const handleEliminarTrabajoTarifario = (id: string) => {
    setTrabajosTarifario(trabajosTarifario.filter((t) => t.id !== id));
  };

  // Guardar configuración completa en Firestore
  const handleGuardarConfigGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoConfig(true);

    try {
      const nueva: TallerConfig = {
        ...config,
        nombre: nombreTaller.trim() || 'VX Engineering',
        direccion: direccion.trim(),
        telefonoWhatsapp: telefonoWhatsapp.trim(),
        horario: horario.trim(),
        colorMarca: /^#[0-9a-fA-F]{6}$/.test(colorMarca) ? colorMarca : '#C2410C',
        logoUrl: logoUrl || null,
        dominioVerificacionQr: urlVerificacion.trim().replace(/\/+$/, ''),
        tarifaHoraEstandarBs: Number(tarifaHora) || 90,
        margenMinimoPorcentaje: Number(margenMinimo) || 25,
        vigenciaCotizacionDias: Number(vigenciaDias) || 7,
        alertaPresupuestoPorcentaje: Number(alertaPresupuesto) || 15,
        bahiasDisponibles: bahias,
        mecanicosResponsables: mecanicos,
        trabajosTarifario,
        limiteDiagnosticoHoras: Number(limiteDiagHoras) || 4,
        factorTiempoEstimadoReparacion: Number(factorReparacion) || 1.5,
        limiteControlCalidadHoras: Number(limiteQcHoras) || 4,
        almacenajeDiasGratis: Math.max(0, Number(diasGratis) || 0),
        almacenajeCostoDiarioBs: Math.max(0, Number(costoDiario) || 0),
        mediosPago: mediosPago.length ? mediosPago : ['QR', 'Efectivo'],
        plantillasWhatsapp: plantillas,
        textosLegales: textos,
        minutosInactividad: Math.max(0, Math.round(Number(minutosInactividad) || 0)),
      };

      await guardarConfiguracionTaller(nueva, usuarioActual);
      onUpdateConfig(nueva);
      notificarExito('Configuración del taller guardada en Firestore.');
    } catch (err: any) {
      onError(`Error al guardar configuración: ${err.message || 'Fallo de permisos en Firestore'}`);
    } finally {
      setGuardandoConfig(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-500 flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Configuración del Taller</h2>
              <p className="text-xs text-slate-400">Dueños, Bahías, Tarifarios y Alertas de Taller</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mensajeExito && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 flex items-center gap-2 shrink-0 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Pestañas de configuración */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setTabActiva('dueños')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              tabActiva === 'dueños'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            1. Dueños & Acceso
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('taller')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              tabActiva === 'taller'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            2. Datos del Taller
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('operacion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              tabActiva === 'operacion'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            3. Bahías & Mecánicos
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('tarifario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              tabActiva === 'tarifario'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            4. Tarifario & Alertas
          </button>
          {(
            [
              ['cobros', '5. Almacenaje & Pagos'],
              ['mensajes', '6. WhatsApp & Textos'],
              ['seguridad', '7. Seguridad'],
              ['respaldo', '8. Respaldo'],
            ] as const
          ).map(([id, txt]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTabActiva(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tabActiva === id ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {txt}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: GESTIÓN DE DUEÑOS */}
          {tabActiva === 'dueños' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Cuentas de Dueños Autorizados (/config/acceso)
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-slate-200 rounded text-slate-700">
                  {duenosEmails.length} / 3 dueños
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Solo las personas cuyos correos de Google figuren en esta lista pueden ingresar a la aplicación y consultar o modificar la información. Cada dueño entra con su propia cuenta de Google. Al quitar a alguien pierde el acceso, pero todo lo que registró queda en el historial y en la auditoría.
              </p>

              {/* Lista actual de dueños */}
              <div className="space-y-1.5 pt-1">
                {duenosEmails.map((email) => {
                  const esYo = email === usuarioActual.email.toLowerCase();
                  return (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-900">{email}</span>
                        {esYo && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                            Tu sesión
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={duenosEmails.length <= 1 || guardandoDuenos}
                        onClick={() => handleEliminarDueno(email)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 cursor-pointer"
                        title={duenosEmails.length <= 1 ? 'No puedes eliminar al único dueño' : 'Remover acceso'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Formulario para agregar dueño si < 3 */}
              {duenosEmails.length < 3 && (
                <form onSubmit={handleAgregarDueno} className="flex gap-2 pt-2">
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@gmail.com"
                    value={nuevoEmailDueno}
                    onChange={(e) => setNuevoEmailDueno(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={guardandoDuenos || !nuevoEmailDueno.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Dueño</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: DATOS DEL TALLER */}
          {tabActiva === 'taller' && (
            <form onSubmit={handleGuardarConfigGeneral} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Datos Generales del Taller
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    required
                    value={nombreTaller}
                    onChange={(e) => setNombreTaller(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teléfono WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={telefonoWhatsapp}
                    onChange={(e) => setTelefonoWhatsapp(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dirección (La Paz / El Alto)</label>
                  <input
                    type="text"
                    required
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horario de Atención</label>
                  <input
                    type="text"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Color del taller (documentos PDF)</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={colorMarca} onChange={(e) => setColorMarca(e.target.value)} className="h-9 w-12 rounded border border-slate-300 bg-white" />
                    <input
                      type="text"
                      value={colorMarca}
                      onChange={(e) => setColorMarca(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Logo (PNG o JPG)</label>
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-9 w-9 object-contain rounded border border-slate-200 bg-white" />
                    ) : (
                      <span className="h-9 w-9 flex items-center justify-center rounded border border-dashed border-slate-300 text-[9px] text-slate-400">LOGO</span>
                    )}
                    <label className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold cursor-pointer">
                      Subir
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setErrorLogo(null);
                          try {
                            const r = await procesarArchivoAdjunto(f);
                            const chico = await achicarImagen(r.base64Data, 300);
                            if (chico.length > 200_000) throw new Error('El logo quedó muy pesado; usa una imagen más simple.');
                            setLogoUrl(chico);
                          } catch (err: any) {
                            setErrorLogo(err?.message || String(err));
                          }
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button type="button" onClick={() => setLogoUrl(null)} className="text-rose-700 font-semibold">
                        Quitar
                      </button>
                    )}
                  </div>
                  {errorLogo && <p className="text-rose-700 mt-1">{errorLogo}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">URL pública de verificación (QR)</label>
                  <input
                    type="url"
                    value={urlVerificacion}
                    onChange={(e) => setUrlVerificacion(e.target.value)}
                    placeholder="https://gerelito.github.io/vx-engineering-app"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <p className="text-slate-500 mt-1">Dirección donde está publicada la app. Los QR de los documentos apuntan aquí.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarifa Mano de Obra (Bs / Hora)</label>
                  <input
                    type="number"
                    min="0"
                    value={tarifaHora}
                    onChange={(e) => setTarifaHora(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Margen Mínimo en Repuestos (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={margenMinimo}
                    onChange={(e) => setMargenMinimo(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vigencia Cotizaciones (Días)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={vigenciaDias}
                    onChange={(e) => setVigenciaDias(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alerta Sobrecosto (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={alertaPresupuesto}
                    onChange={(e) => setAlertaPresupuesto(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={guardandoConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Datos Generales</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: BAHÍAS Y MECÁNICOS RESPONSABLES (MÓDULO 3) */}
          {tabActiva === 'operacion' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Bahías */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Bahías y Puestos de Trabajo ({bahias.length})
                    </h3>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevaBahia}
                    onChange={(e) => setNuevaBahia(e.target.value)}
                    placeholder="Ej. Bahía 6 (Diagnóstico Rápido)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarBahia}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                  >
                    + Agregar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {bahias.map((bahia) => (
                    <span
                      key={bahia}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-300 shadow-2xs"
                    >
                      <span>{bahia}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarBahia(bahia)}
                        className="text-slate-400 hover:text-red-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Mecánicos Responsables */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Mecánicos y Responsables de Taller ({mecanicos.length})
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Son nombres de texto asignables en tarjetas de taller y tareas (no requieren cuentas de usuario).
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevoMecanico}
                    onChange={(e) => setNuevoMecanico(e.target.value)}
                    placeholder="Ej. Fernando Ruiz (Frenos)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarMecanico}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                  >
                    + Agregar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {mecanicos.map((mec) => (
                    <span
                      key={mec}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-300 shadow-2xs"
                    >
                      <span>{mec}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarMecanico(mec)}
                        className="text-slate-400 hover:text-red-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGuardarConfigGeneral}
                  disabled={guardandoConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Bahías y Responsables</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: TARIFARIO & LÍMITES DE ALERTA (MÓDULO 3) */}
          {tabActiva === 'tarifario' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Límites de Alerta por Tiempo en Rojo */}
              <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-700" />
                  <h3 className="text-sm font-bold text-rose-950">
                    Límites Configurables para Alertas en Rojo
                  </h3>
                </div>
                <p className="text-xs text-rose-900">
                  Especificación v1.2: Cuando una orden supera estos límites en el taller, se resalta automáticamente en color rojo.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Límite Diagnóstico (Horas):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={limiteDiagHoras}
                      onChange={(e) => setLimiteDiagHoras(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Inicial: 4 horas</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Factor Tiempo Reparación:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={factorReparacion}
                      onChange={(e) => setFactorReparacion(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Inicial: 1.5 x estimado</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Límite Control Calidad (Horas):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={limiteQcHoras}
                      onChange={(e) => setLimiteQcHoras(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Inicial: 4 horas</span>
                  </div>
                </div>
              </div>

              {/* Tarifario Estándar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Tarifario Estándar de Trabajos ({trabajosTarifario.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Catálogo simple de trabajos y horas estándar para cargar tareas y cronómetros rápidamente.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={nuevoTrabajoNombre}
                    onChange={(e) => setNuevoTrabajoNombre(e.target.value)}
                    placeholder="Descripción del trabajo"
                    className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={nuevoTrabajoHoras}
                      onChange={(e) => setNuevoTrabajoHoras(Number(e.target.value))}
                      placeholder="Horas"
                      className="w-20 px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarTrabajoTarifario}
                      className="flex-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                  {trabajosTarifario.map((tar) => (
                    <div
                      key={tar.id}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <span className="font-medium text-slate-900">{tar.trabajo}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {tar.horasEstandar}h ({Math.round(tar.horasEstandar * 60)}m)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEliminarTrabajoTarifario(tar.id)}
                          className="text-slate-400 hover:text-red-600 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGuardarConfigGeneral}
                  disabled={guardandoConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Tarifario y Límites</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: ALMACENAJE Y MEDIOS DE PAGO (MÓDULO 10) */}
          {tabActiva === 'cobros' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Almacenaje</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="block font-semibold text-slate-700 mb-1">Días gratis después del aviso</span>
                    <input type="number" min="0" value={diasGratis} onChange={(e) => setDiasGratis(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  </label>
                  <label>
                    <span className="block font-semibold text-slate-700 mb-1">Cargo por día (Bs)</span>
                    <input type="number" min="0" value={costoDiario} onChange={(e) => setCostoDiario(Number(e.target.value))} className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  </label>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Medios de pago</h3>
                <div className="flex flex-wrap gap-2">
                  {mediosPago.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-300 font-semibold">
                      {m}
                      {mediosPago.length > 1 && (
                        <button type="button" onClick={() => setMediosPago((l) => l.filter((x) => x !== m))} className="text-slate-400 hover:text-red-600" aria-label={`Quitar ${m}`}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={nuevoMedio} onChange={(e) => setNuevoMedio(e.target.value)} placeholder="ej. Transferencia" className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  <button
                    type="button"
                    onClick={() => {
                      const m = nuevoMedio.trim();
                      if (m && !mediosPago.includes(m)) setMediosPago((l) => [...l, m]);
                      setNuevoMedio('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                  >
                    Agregar
                  </button>
                </div>
              </div>
              <BotonGuardar onClick={handleGuardarConfigGeneral} guardando={guardandoConfig} />
            </div>
          )}

          {/* TAB 6: PLANTILLAS DE WHATSAPP Y TEXTOS LEGALES (MÓDULO 10) */}
          {tabActiva === 'mensajes' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Plantillas de WhatsApp</h3>
                <p className="text-slate-600">
                  Campos: <code>{'{cliente}'}</code> <code>{'{vehiculo}'}</code> <code>{'{placa}'}</code> <code>{'{folio}'}</code> <code>{'{enlace}'}</code>{' '}
                  <code>{'{taller}'}</code> <code>{'{saldo}'}</code>
                </p>
                {(Object.keys(PLANTILLAS_WHATSAPP) as ClavePlantillaWhatsapp[]).map((k) => (
                  <label key={k} className="block">
                    <span className="flex justify-between font-semibold text-slate-700 mb-1">
                      {PLANTILLAS_WHATSAPP[k].titulo}
                      <button type="button" onClick={() => setPlantillas((p) => ({ ...p, [k]: PLANTILLAS_WHATSAPP[k].texto }))} className="text-slate-500 font-normal underline">
                        Restablecer
                      </button>
                    </span>
                    <textarea rows={3} value={plantillas[k]} onChange={(e) => setPlantillas((p) => ({ ...p, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white" />
                  </label>
                ))}
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Textos legales</h3>
                <p className="text-slate-600">
                  En almacenaje puedes usar <code>{'{dias}'}</code> y <code>{'{costo}'}</code>.
                </p>
                {(Object.keys(TEXTOS_LEGALES) as ClaveTextoLegal[]).map((k) => (
                  <label key={k} className="block">
                    <span className="block font-semibold text-slate-700 mb-1">{TEXTOS_LEGALES[k].titulo}</span>
                    <textarea rows={3} value={textos[k]} onChange={(e) => setTextos((p) => ({ ...p, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white" />
                  </label>
                ))}
              </div>
              <BotonGuardar onClick={handleGuardarConfigGeneral} guardando={guardandoConfig} />
            </div>
          )}

          {/* TAB 7: SEGURIDAD (MÓDULO 10) */}
          {tabActiva === 'seguridad' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Cierre de sesión por inactividad</h3>
                <p className="text-slate-600">Si nadie toca la app durante este tiempo, se cierra la sesión (útil si el celular o la computadora quedan en el taller). 0 = nunca.</p>
                <label className="inline-flex items-center gap-2">
                  <input type="number" min="0" max="480" value={minutosInactividad} onChange={(e) => setMinutosInactividad(Number(e.target.value))} className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  minutos
                </label>
              </div>
              <BotonGuardar onClick={handleGuardarConfigGeneral} guardando={guardandoConfig} />
            </div>
          )}

          {/* TAB 8: RESPALDO (MÓDULO 10) */}
          {tabActiva === 'respaldo' && <PanelRespaldo ordenes={ordenes} usuarioActual={usuarioActual} />}
        </div>

        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
};

const BotonGuardar: React.FC<{ onClick: (e: any) => void; guardando: boolean }> = ({ onClick, guardando }) => (
  <div className="flex justify-end">
    <button
      type="button"
      onClick={onClick}
      disabled={guardando}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
    >
      <Save className="w-3.5 h-3.5" /> Guardar
    </button>
  </div>
);

/** Achica una imagen a un lado máximo (px) para guardarla en /config/taller (logo de 300 px). */
function achicarImagen(dataUrl: string, max: number): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => rej(new Error('No se pudo leer la imagen.'));
    img.src = dataUrl;
  });
}
