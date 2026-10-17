import { garantiasVigentes, textoGarantia, trabajosCubiertos } from '../../lib/garantia';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Cliente,
  Vehiculo,
  OrdenServicio,
  TallerConfig,
  DanioCarroceria,
  FotoOrden,
  TipoFotoRecepcion,
  NivelCombustible,
  TipoServicio,
  PrioridadOrden,
} from '../../types';
import { DiagramaCarroceria } from './DiagramaCarroceria';
import { formatearTelefonoBolivia } from '../../lib/storage';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Car,
  User,
  Gauge,
  Fuel,
  Clock,
  Mic,
  MicOff,
  AlertTriangle,
  Camera,
  Upload,
  Check,
  ShieldCheck,
  FileText,
  FileCheck,
  Wrench,
  Search,
  Plus,
} from 'lucide-react';

interface RecepcionWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  config: TallerConfig;
  onCrearOrden: (ordenData: any) => Promise<void>;
  clienteInicialId?: string;
  vehiculoInicialId?: string;
  onAbrirNuevoCliente: () => void;
  onAbrirNuevoVehiculo: (clienteId?: string) => void;
  ordenes?: OrdenServicio[];
}

const NIVELES_COMBUSTIBLE: NivelCombustible[] = [
  '0/8',
  '1/8',
  '2/8',
  '3/8',
  '4/8',
  '5/8',
  '6/8',
  '7/8',
  '8/8',
];

const SISTEMAS_OPCIONES = [
  'Frenos',
  'Suspensión y dirección',
  'Motor',
  'Transmisión',
  'Eléctrico',
  'Aire acondicionado',
  'Neumáticos',
  'Luces del tablero',
  'Ruidos extraños',
  'Otro',
];

const LUCES_TABLERO_OPCIONES = [
  { id: 'check_engine', label: 'Check Engine' },
  { id: 'aceite', label: 'Presión de Aceite' },
  { id: 'bateria', label: 'Batería / Carga' },
  { id: 'temperatura', label: 'Temperatura' },
  { id: 'frenos', label: 'Freno / Freno de Mano' },
  { id: 'abs', label: 'ABS' },
  { id: 'airbag', label: 'Bolsa de Aire / Airbag' },
  { id: 'presion_neumaticos', label: 'Presión Neumáticos (TPMS)' },
  { id: 'otra', label: 'Otra Luz de Alerta' },
];

const FOTOS_REQUERIDAS: { tipo: TipoFotoRecepcion; titulo: string; requerida: boolean }[] = [
  { tipo: 'frente', titulo: '1. Frente del Vehículo', requerida: true },
  { tipo: 'trasera', titulo: '2. Parte Trasera', requerida: true },
  { tipo: 'lateral_izq', titulo: '3. Costado Izquierdo (Piloto)', requerida: true },
  { tipo: 'lateral_der', titulo: '4. Costado Derecho (Copiloto)', requerida: true },
  { tipo: 'tablero_kilometraje', titulo: '5. Tablero y Odómetro', requerida: true },
  { tipo: 'neumaticos', titulo: '6. Estado de Neumáticos', requerida: true },
  { tipo: 'vin_chasis', titulo: '7. Placa de VIN / Chasis (Opcional)', requerida: false },
];

export const RecepcionWizardModal: React.FC<RecepcionWizardModalProps> = ({
  isOpen,
  onClose,
  clientes,
  vehiculos,
  config,
  onCrearOrden,
  clienteInicialId,
  vehiculoInicialId,
  onAbrirNuevoCliente,
  onAbrirNuevoVehiculo,
  ordenes = [],
}) => {
  const [reclamoDe, setReclamoDe] = useState<string>('');

  // Estado del paso activo (1 a 8)
  const [paso, setPaso] = useState<number>(1);
  const [guardando, setGuardando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Paso 1: Selección de Cliente y Vehículo
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string>('');
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>('');

  // Paso 2: Datos de Ingreso
  const [kilometraje, setKilometraje] = useState<string>('');
  const [justificacionKm, setJustificacionKm] = useState('');
  const [nivelCombustible, setNivelCombustible] = useState<NivelCombustible>('4/8');
  const [prioridad, setPrioridad] = useState<PrioridadOrden>('Normal');
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const yyyy = manana.getFullYear();
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    const dd = String(manana.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T18:00`;
  });

  // Paso 3: Motivo y Diagnóstico
  const [motivoCliente, setMotivoCliente] = useState('');
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [soportaVoz, setSoportaVoz] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [motivoTecnico, setMotivoTecnico] = useState('');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>('Correctivo');
  const [sistemasAfectados, setSistemasAfectados] = useState<string[]>([]);
  const [lucesTablero, setLucesTablero] = useState<string[]>([]);

  const [temperaturaMotor, setTemperaturaMotor] = useState<'Frío' | 'Caliente' | 'Indistinto' | null>(null);
  const [velocidadSintoma, setVelocidadSintoma] = useState<'Baja (< 40 km/h)' | 'Alta (> 60 km/h)' | 'Ralentí' | 'Indistinto' | null>(null);
  const [alAccionar, setAlAccionar] = useState<'Al frenar' | 'Al girar' | 'Al acelerar' | 'En baches' | 'Constante' | null>(null);
  const [desdeCuando, setDesdeCuando] = useState<'Hoy' | 'Hace unos días' | 'Más de una semana' | 'Intermitente' | null>(null);
  const [frecuencia, setFrecuencia] = useState<'Siempre' | 'A veces' | 'Rara vez' | null>(null);

  // Paso 4: Daños de Carrocería (Diagrama SVG)
  const [danios, setDanios] = useState<DanioCarroceria[]>([]);

  // Paso 5: Fotos de Recepción (6 obligatorias)
  const [fotosCapturadas, setFotosCapturadas] = useState<{
    [tipo in TipoFotoRecepcion]?: { base64Data: string; tamanioBytes: number };
  }>({});

  // Paso 6: Checklist de Accesorios (Empiezan SIN marcar por defecto)
  const [checklist, setChecklist] = useState({
    llantaRepuesto: false,
    gato: false,
    triangulos: false,
    extintor: false,
    radio: false,
    tapetes: false,
    documentos: false,
    objetosValor: false,
    objetosValorDetalle: '',
    cantidadLlaves: 1,
    obsNeumaticos: '',
    obsLuces: '',
    obsRetrovisores: '',
  });

  // Paso 7: Autorizaciones (La aceptación de condiciones debe ser un acto explícito del cliente)
  const [autorizaciones, setAutorizaciones] = useState({
    autorizaDiagnostico: true,
    costoDiagnosticoBs: 150,
    montoPreAutorizadoBs: '',
    devolucionPiezas: false,
    aceptaContactoWhatsapp: false,
    aceptaCondicionesAlmacenaje: false,
    nombreQuienEntrega: '',
  });

  // Detectar soporte para reconocimiento de voz (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSoportaVoz(true);
      const recog = new SpeechRecognition();
      recog.lang = 'es-BO';
      recog.continuous = true;
      recog.interimResults = false;

      recog.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setMotivoCliente((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        }
      };

      recog.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        setGrabandoVoz(false);
      };

      recog.onend = () => {
        setGrabandoVoz(false);
      };

      recognitionRef.current = recog;
    }
  }, []);

  const toggleDictadoVoz = () => {
    if (!recognitionRef.current) return;
    if (grabandoVoz) {
      recognitionRef.current.stop();
      setGrabandoVoz(false);
    } else {
      try {
        recognitionRef.current.start();
        setGrabandoVoz(true);
      } catch (err) {
        console.warn('Speech start error:', err);
      }
    }
  };

  // Inicialización y selección automática dinámica de cliente/vehículo
  useEffect(() => {
    if (clienteInicialId) {
      setClienteSeleccionadoId(clienteInicialId);
    }
  }, [clienteInicialId]);

  useEffect(() => {
    if (vehiculoInicialId) {
      setVehiculoSeleccionadoId(vehiculoInicialId);
    }
  }, [vehiculoInicialId]);

  // Selección automática de vehículo si el cliente seleccionado solo tiene uno
  useEffect(() => {
    if (clienteSeleccionadoId && !vehiculoSeleccionadoId) {
      const vehs = vehiculos.filter((v) => v.propietarioActualId === clienteSeleccionadoId && v.activo !== false);
      if (vehs.length === 1) {
        setVehiculoSeleccionadoId(vehs[0].id);
      }
    }
  }, [clienteSeleccionadoId, vehiculoSeleccionadoId, vehiculos]);

  // Garantías vigentes del vehículo elegido (los hooks van antes de cualquier "return")
  useEffect(() => setReclamoDe(''), [vehiculoSeleccionadoId, isOpen]);
  const garantiasDelVehiculo = useMemo(() => {
    if (!vehiculoSeleccionadoId) return [];
    const v = vehiculos.find((x) => x.id === vehiculoSeleccionadoId);
    return garantiasVigentes(ordenes, vehiculoSeleccionadoId, v?.ultimoKilometraje);
  }, [ordenes, vehiculos, vehiculoSeleccionadoId]);

  if (!isOpen) return null;

  const clienteActual = clientes.find((c) => c.id === clienteSeleccionadoId);
  const vehiculoActual = vehiculos.find((v) => v.id === vehiculoSeleccionadoId);

  // Vehículos del cliente seleccionado
  const vehiculosDelCliente = clienteSeleccionadoId
    ? vehiculos.filter((v) => v.propietarioActualId === clienteSeleccionadoId && v.activo)
    : [];

  // Clientes filtrados por búsqueda
  const clientesFiltrados = clientes.filter((c) => {
    if (!c.activo) return false;
    if (!busquedaCliente.trim()) return true;
    const q = busquedaCliente.toLowerCase().trim();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.telefono.includes(q) ||
      (c.documentoIdentidad && c.documentoIdentidad.toLowerCase().includes(q))
    );
  });

  // Compresión y carga de fotos (1024 px, calidad 0.55)
  const handleCargarFoto = (tipo: TipoFotoRecepcion, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.55);
          const approxBytes = Math.round((compressedBase64.length * 3) / 4);

          setFotosCapturadas((prev) => ({
            ...prev,
            [tipo]: {
              base64Data: compressedBase64,
              tamanioBytes: approxBytes,
            },
          }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleToggleSistema = (sistema: string) => {
    setSistemasAfectados((prev) =>
      prev.includes(sistema) ? prev.filter((s) => s !== sistema) : [...prev, sistema]
    );
  };

  const handleToggleLuzTablero = (luzId: string) => {
    setLucesTablero((prev) =>
      prev.includes(luzId) ? prev.filter((l) => l !== luzId) : [...prev, luzId]
    );
  };

  // Validaciones antes de avanzar de paso
  const validarPasoActual = (): boolean => {
    setErrorLocal(null);

    if (paso === 1) {
      if (!clienteSeleccionadoId) {
        setErrorLocal('Debes seleccionar o registrar al cliente propietario.');
        return false;
      }
      if (!vehiculoSeleccionadoId) {
        setErrorLocal('Debes seleccionar o registrar el vehículo que ingresa al taller.');
        return false;
      }
      return true;
    }

    if (paso === 2) {
      const kmNum = parseInt(kilometraje, 10);
      if (isNaN(kmNum) || kmNum <= 0) {
        setErrorLocal('El kilometraje es obligatorio y debe ser un número positivo.');
        return false;
      }
      const ultimoKm = vehiculoActual?.ultimoKilometraje || 0;
      if (ultimoKm > 0 && kmNum < ultimoKm && !justificacionKm.trim()) {
        setErrorLocal(
          `El kilometraje ingresado (${kmNum} km) es MENOR al último registrado (${ultimoKm} km). Debes escribir una justificación obligatoria.`
        );
        return false;
      }
      if (!fechaEntrega) {
        setErrorLocal('Indica la fecha y hora estimada de entrega prometida.');
        return false;
      }
      return true;
    }

    if (paso === 3) {
      if (!motivoCliente.trim()) {
        setErrorLocal('El motivo expresado por el cliente es obligatorio.');
        return false;
      }
      return true;
    }

    if (paso === 5) {
      // Validar las 6 fotos obligatorias
      const obligatorias = FOTOS_REQUERIDAS.filter((f) => f.requerida);
      for (const req of obligatorias) {
        if (!fotosCapturadas[req.tipo]) {
          setErrorLocal(`Falta capturar la foto obligatoria: "${req.titulo}".`);
          return false;
        }
      }
      return true;
    }

    if (paso === 7) {
      if (!autorizaciones.autorizaDiagnostico) {
        setErrorLocal('El cliente debe aceptar la autorización del diagnóstico para ingresar el vehículo.');
        return false;
      }
      if (!autorizaciones.aceptaCondicionesAlmacenaje) {
        setErrorLocal('El cliente debe aceptar las condiciones de almacenaje del taller.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleSiguiente = () => {
    if (validarPasoActual()) {
      setPaso((prev) => Math.min(prev + 1, 8));
    }
  };

  const handleAnterior = () => {
    setErrorLocal(null);
    setPaso((prev) => Math.max(prev - 1, 1));
  };

  // Finalizar y crear orden
  const handleCrearOrdenFinal = async () => {
    if (!clienteActual || !vehiculoActual) return;

    if (!autorizaciones.aceptaCondicionesAlmacenaje) {
      setErrorLocal('El cliente debe aceptar explícitamente las condiciones de almacenaje del taller para poder emitir la orden.');
      setPaso(7); // Regresar al paso 7 para que lo marque explícitamente
      return;
    }

    setGuardando(true);
    setErrorLocal(null);

    try {
      // Formatear fotos para el payload
      const fotosArray = Object.entries(fotosCapturadas).map(([tipo, data]) => {
        const itemInfo = FOTOS_REQUERIDAS.find((f) => f.tipo === tipo);
        return {
          tipo: tipo as TipoFotoRecepcion,
          titulo: itemInfo?.titulo || `Foto ${tipo}`,
          base64Data: data.base64Data,
          tamanioBytes: data.tamanioBytes,
        };
      });

      const kmNum = parseInt(kilometraje, 10);

      const fechaPrometidaFormateada = fechaEntrega.replace('T', ' ');

      await onCrearOrden({
        cliente: clienteActual,
        vehiculo: vehiculoActual,
        kilometraje: kmNum,
        kilometrajeAnterior: vehiculoActual.ultimoKilometraje || null,
        justificacionKilometraje: justificacionKm.trim() || null,
        nivelCombustible,
        prioridad,
        fechaPrometidaEntrega: fechaPrometidaFormateada,
        motivoCliente: motivoCliente.trim(),
        motivoTecnico: motivoTecnico.trim() || null,
        tipoServicio,
        sistemasAfectados,
        preguntasGuiadas: {
          temperaturaMotor,
          velocidad: velocidadSintoma,
          alAccionar,
          desdeCuando,
          frecuencia,
        },
        lucesAdvertenciaTablero: lucesTablero,
        daniosCarroceria: danios,
        accesorios: checklist,
        autorizaciones: {
          ...autorizaciones,
          montoPreAutorizadoBs: autorizaciones.montoPreAutorizadoBs
            ? parseFloat(autorizaciones.montoPreAutorizadoBs)
            : null,
          textoAlmacenaje: `${config.almacenajeDiasGratis} días gratis; luego ${config.almacenajeCostoDiarioBs} Bs/día.`,
        },
        reclamoGarantia: (() => {
          const g = garantiasDelVehiculo.find((x) => x.orden.id === reclamoDe);
          return g
            ? { ordenOrigenId: g.orden.id, folioOrigen: g.orden.folio, hastaFecha: g.garantia.hastaFecha, hastaKm: g.garantia.hastaKm }
            : null;
        })(),
        fotos: fotosArray,
      });

      onClose();
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al guardar la orden de servicio');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        role="dialog"
      >
        {/* Encabezado del Asistente */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                Nueva Recepción de Vehículo
              </h2>
              <p className="text-[11px] text-slate-300">
                Paso {paso} de 8 · Documentación con evidencia en menos de 5 min
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar asistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progreso de 8 Pasos */}
        <div className="grid grid-cols-8 h-1.5 bg-slate-200 shrink-0">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
            <div
              key={num}
              className={`h-full transition-colors ${
                num <= paso ? 'bg-amber-500' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Notificación de Error Local si existe */}
        {errorLocal && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800 font-medium shrink-0 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorLocal}</span>
            <button
              onClick={() => setErrorLocal(null)}
              className="text-rose-500 hover:text-rose-800 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cuerpo del Asistente (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* ============================================================== */}
          {/* PASO 1: SELECCIONAR O CREAR CLIENTE Y VEHÍCULO */}
          {/* ============================================================== */}
          {paso === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-700" />
                    Paso 1: Identificación de Cliente y Vehículo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Elige el titular y el vehículo que entra al taller, o regístralos al instante.
                  </p>
                </div>
              </div>

              {/* Sección Cliente */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-900">
                    1. Cliente Propietario:
                  </label>
                  <button
                    type="button"
                    onClick={onAbrirNuevoCliente}
                    className="flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Cliente Rápido</span>
                  </button>
                </div>

                {/* Buscador de clientes */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Buscar por nombre, teléfono o CI..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                {/* Lista seleccionable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {clientesFiltrados.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClienteSeleccionadoId(c.id);
                        setVehiculoSeleccionadoId('');
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        clienteSeleccionadoId === c.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{c.nombre}</div>
                      <div
                        className={`text-[11px] truncate ${
                          clienteSeleccionadoId === c.id ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Tel: {formatearTelefonoBolivia(c.telefono)} {c.documentoIdentidad ? `· CI: ${c.documentoIdentidad}` : ''}
                      </div>
                    </button>
                  ))}
                </div>

                {clienteActual && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center justify-between">
                    <span>
                      Cliente seleccionado: <strong>{clienteActual.nombre}</strong> ({formatearTelefonoBolivia(clienteActual.telefono)})
                    </span>
                    <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                      Listo
                    </span>
                  </div>
                )}
              </div>

              {/* Sección Vehículo */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-900">
                    2. Vehículo que Ingresa:
                  </label>
                  <button
                    type="button"
                    onClick={() => onAbrirNuevoVehiculo(clienteSeleccionadoId || undefined)}
                    className="flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Vehículo para este cliente</span>
                  </button>
                </div>

                {!clienteSeleccionadoId ? (
                  <p className="text-xs text-slate-400 italic">
                    Selecciona primero al cliente para ver sus vehículos asociados.
                  </p>
                ) : vehiculosDelCliente.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                    <p className="text-xs text-amber-800">
                      Este cliente no tiene ningún vehículo registrado aún.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAbrirNuevoVehiculo(clienteSeleccionadoId)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      Registrar Vehículo Ahora
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vehiculosDelCliente.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVehiculoSeleccionadoId(v.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          vehiculoSeleccionadoId === v.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-extrabold text-xs tracking-wider">
                            {v.placa}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              vehiculoSeleccionadoId === v.id
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {v.anio}
                          </span>
                        </div>
                        <div
                          className={`text-xs mt-1 font-semibold truncate ${
                            vehiculoSeleccionadoId === v.id ? 'text-slate-200' : 'text-slate-700'
                          }`}
                        >
                          {v.marca} {v.modelo} {v.color ? `· ${v.color}` : ''}
                        </div>
                        {v.ultimoKilometraje && (
                          <div
                            className={`text-[11px] mt-0.5 ${
                              vehiculoSeleccionadoId === v.id ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            Último kilometraje: {v.ultimoKilometraje.toLocaleString()} km
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {garantiasDelVehiculo.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-2 text-xs text-emerald-950">
                  <p className="font-bold flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" /> Este vehículo tiene garantía vigente
                  </p>
                  {garantiasDelVehiculo.map((g) => (
                    <label key={g.orden.id} className="flex items-start gap-2 bg-white/70 border border-emerald-200 rounded-lg p-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={reclamoDe === g.orden.id}
                        onChange={(e) => setReclamoDe(e.target.checked ? g.orden.id : '')}
                      />
                      <span>
                        <b>{g.orden.folio}</b>: {textoGarantia(g.garantia)}
                        <span className="block text-emerald-800">Cubre: {trabajosCubiertos(g.orden)}</span>
                        <span className="block font-semibold">Marcar si el cliente vuelve por un problema de ese trabajo (reclamo de garantía).</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 2: DATOS DE INGRESO (KILOMETRAJE, COMBUSTIBLE, PRIORIDAD) */}
          {/* ============================================================== */}
          {paso === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-slate-700" />
                  Paso 2: Datos de Ingreso del Vehículo ({vehiculoActual?.placa})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Odómetro obligatorio, combustible visual en octavos y fecha de entrega.
                </p>
              </div>

              {/* Kilometraje Actual */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-slate-700" />
                    Kilometraje Actual * (Obligatorio)
                  </label>
                  {vehiculoActual?.ultimoKilometraje ? (
                    <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Último registrado: {vehiculoActual.ultimoKilometraje.toLocaleString()} km
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    value={kilometraje}
                    onChange={(e) => setKilometraje(e.target.value)}
                    placeholder="Ej. 85400"
                    className="w-full px-4 py-3 text-lg font-mono font-bold bg-white rounded-xl border-2 border-slate-300 focus:border-slate-900 focus:outline-none"
                  />
                  <span className="absolute right-4 top-3.5 text-sm font-bold text-slate-400">
                    KM
                  </span>
                </div>

                {/* Detección de Discrepancia de Odómetro */}
                {vehiculoActual?.ultimoKilometraje &&
                  parseInt(kilometraje, 10) < vehiculoActual.ultimoKilometraje && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Alerta: Kilometraje menor al último registrado</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Por seguridad jurídica del taller, debes ingresar una justificación escrita
                        (ej. cambio de motor, odómetro reemplazado o error de lectura previo).
                      </p>
                      <textarea
                        rows={2}
                        value={justificacionKm}
                        onChange={(e) => setJustificacionKm(e.target.value)}
                        placeholder="Escribe la justificación obligatoria..."
                        className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-amber-300 focus:outline-none"
                      />
                    </div>
                  )}
              </div>

              {/* Selector visual de Combustible en Octavos */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-slate-700" />
                    Nivel de Combustible: <span className="text-amber-600 font-extrabold">{nivelCombustible}</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {nivelCombustible === '0/8'
                      ? 'Vacío / Reserva'
                      : nivelCombustible === '4/8'
                      ? 'Medio tanque (1/2)'
                      : nivelCombustible === '8/8'
                      ? 'Tanque lleno'
                      : `${nivelCombustible} de tanque`}
                  </span>
                </div>

                {/* Barra de progreso de octavos */}
                <div className="grid grid-cols-9 gap-1 sm:gap-2">
                  {NIVELES_COMBUSTIBLE.map((nivel, index) => {
                    const seleccionado = nivelCombustible === nivel;
                    return (
                      <button
                        key={nivel}
                        type="button"
                        onClick={() => setNivelCombustible(nivel)}
                        className={`py-3 px-1 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                          seleccionado
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-slate-900 shadow-sm scale-105'
                            : index <= NIVELES_COMBUSTIBLE.indexOf(nivelCombustible)
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs">{nivel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prioridad y Fecha Prometida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-900 block">
                    Prioridad del Servicio
                  </label>
                  <div className="flex gap-2">
                    {(['Normal', 'Urgente'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrioridad(p)}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          prioridad === p
                            ? p === 'Urgente'
                              ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                              : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-700" />
                    Fecha y Hora Prometida de Entrega
                  </label>
                  <input
                    type="datetime-local"
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-white rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 3: MOTIVO DE INGRESO Y DIAGNÓSTICO GUIADO */}
          {/* ============================================================== */}
          {paso === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-700" />
                  Paso 3: Motivo de Ingreso y Síntomas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registra textualmente las palabras del cliente (con voz o teclado) y preguntas guiadas.
                </p>
              </div>

              {/* Motivo Cliente con Dictado por Voz */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900">
                    Motivo en Palabras del Cliente * (Textual)
                  </label>
                  {soportaVoz && (
                    <button
                      type="button"
                      onClick={toggleDictadoVoz}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        grabandoVoz
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                      }`}
                    >
                      {grabandoVoz ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{grabandoVoz ? 'Detener Dictado' : 'Dictar por Voz'}</span>
                    </button>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={motivoCliente}
                  onChange={(e) => setMotivoCliente(e.target.value)}
                  placeholder="Ej. Siento que frena disparejo y hace un chillido fuerte al girar a la derecha..."
                  className="w-full px-3 py-2.5 text-xs bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />

                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Traducción / Apreciación Técnica (Opcional del Mecánico):
                  </label>
                  <input
                    type="text"
                    value={motivoTecnico}
                    onChange={(e) => setMotivoTecnico(e.target.value)}
                    placeholder="Ej. Posible desgaste de pastillas y rodamiento delantero derecho"
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* Tipo de Servicio */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">Tipo de Servicio</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Programado', 'Preventivo', 'Correctivo'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoServicio(t)}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        tipoServicio === t
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sistemas Afectados */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Sistemas Afectados (Selecciona los que correspondan):
                </label>
                <div className="flex flex-wrap gap-2">
                  {SISTEMAS_OPCIONES.map((sis) => {
                    const sel = sistemasAfectados.includes(sis);
                    return (
                      <button
                        key={sis}
                        type="button"
                        onClick={() => handleToggleSistema(sis)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          sel
                            ? 'bg-amber-400 text-slate-950 border-amber-500 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sis}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preguntas Guiadas de Diagnóstico */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-900 block">
                  Cuestionario Guiado de Síntomas:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      ¿Temperatura del motor al manifestarse?
                    </label>
                    <select
                      value={temperaturaMotor || ''}
                      onChange={(e) => setTemperaturaMotor((e.target.value as any) || null)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Frío">En frío</option>
                      <option value="Caliente">En caliente / después de andar</option>
                      <option value="Indistinto">Indistinto / Siempre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      ¿Velocidad a la que ocurre?
                    </label>
                    <select
                      value={velocidadSintoma || ''}
                      onChange={(e) => setVelocidadSintoma((e.target.value as any) || null)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Baja (< 40 km/h)">Baja velocidad (&lt; 40 km/h)</option>
                      <option value="Alta (> 60 km/h)">Alta velocidad (&gt; 60 km/h)</option>
                      <option value="Ralentí">Al ralentí / detenido</option>
                      <option value="Indistinto">Indistinto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      ¿En qué momento o maniobra?
                    </label>
                    <select
                      value={alAccionar || ''}
                      onChange={(e) => setAlAccionar((e.target.value as any) || null)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Al frenar">Al frenar</option>
                      <option value="Al girar">Al girar la dirección</option>
                      <option value="Al acelerar">Al acelerar</option>
                      <option value="En baches">En baches o desnivel</option>
                      <option value="Constante">De forma constante</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      ¿Desde cuándo ocurre?
                    </label>
                    <select
                      value={desdeCuando || ''}
                      onChange={(e) => setDesdeCuando((e.target.value as any) || null)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Hoy">Hoy mismo</option>
                      <option value="Hace unos días">Hace unos días</option>
                      <option value="Más de una semana">Hace más de una semana</option>
                      <option value="Intermitente">Intermitente desde hace tiempo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Luces del Tablero Encendidas */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Luces de Advertencia Encendidas en el Tablero:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LUCES_TABLERO_OPCIONES.map((luz) => {
                    const activa = lucesTablero.includes(luz.id);
                    return (
                      <button
                        key={luz.id}
                        type="button"
                        onClick={() => handleToggleLuzTablero(luz.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                          activa
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            activa ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate">{luz.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 4: INSPECCIÓN DE CARROCERÍA (DIAGRAMA SVG) */}
          {/* ============================================================== */}
          {paso === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <DiagramaCarroceria danios={danios} onChangeDanios={setDanios} />
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 5: FOTOS OBLIGATORIAS (MÁXIMO 10, < 120 KB) */}
          {/* ============================================================== */}
          {paso === 5 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-700" />
                    Paso 5: Fotos de Recepción Obligatorias
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Las 6 fotos principales son obligatorias. Se comprimen automáticamente a menos de 120 KB.
                  </p>
                </div>

                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                  {Object.keys(fotosCapturadas).length} de 6 fotos obligatorias
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {FOTOS_REQUERIDAS.map((item) => {
                  const foto = fotosCapturadas[item.tipo];
                  return (
                    <div
                      key={item.tipo}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        foto
                          ? 'bg-emerald-50/60 border-emerald-300'
                          : item.requerida
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-slate-50/60 border-dashed border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.titulo}
                        </span>
                        {foto ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {Math.round(foto.tamanioBytes / 1024)} KB
                          </span>
                        ) : item.requerida ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            Obligatoria
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            Opcional
                          </span>
                        )}
                      </div>

                      {foto ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-200 aspect-video bg-black/5">
                          <img
                            src={foto.base64Data}
                            alt={item.titulo}
                            className="w-full h-full object-cover"
                          />
                          <label className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors">
                            Cambiar
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleCargarFoto(item.tipo, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 bg-white hover:bg-slate-100/80 transition-colors cursor-pointer">
                          <Camera className="w-7 h-7 text-slate-400 mb-1.5" />
                          <span className="text-xs font-bold text-slate-700">
                            Tomar Foto con Cámara
                          </span>
                          <span className="text-[11px] text-slate-400">
                            o seleccionar archivo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCargarFoto(item.tipo, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 6: OBJETOS Y ACCESORIOS */}
          {/* ============================================================== */}
          {paso === 6 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-slate-700" />
                  Paso 6: Inventario de Objetos y Accesorios
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Marca los elementos presentes en el vehículo al momento de la entrega.
                </p>
              </div>

              {/* Casillas de accesorios */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'llantaRepuesto', label: 'Llanta de Repuesto' },
                  { id: 'gato', label: 'Gato Mecánico' },
                  { id: 'triangulos', label: 'Triángulos Seg.' },
                  { id: 'extintor', label: 'Extintor' },
                  { id: 'radio', label: 'Radio / Pantalla' },
                  { id: 'tapetes', label: 'Juego de Tapetes' },
                  { id: 'documentos', label: 'Documentos' },
                  { id: 'objetosValor', label: 'Objetos de Valor' },
                ].map((acc) => {
                  const check = (checklist as any)[acc.id];
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() =>
                        setChecklist((prev) => ({ ...prev, [acc.id]: !check }))
                      }
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        check
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{acc.label}</span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          check ? 'bg-amber-400 text-slate-950 font-extrabold' : 'border border-slate-300'
                        }`}
                      >
                        {check ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Detalle si hay objetos de valor */}
              {checklist.objetosValor && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 animate-in fade-in">
                  <label className="text-xs font-bold text-amber-900">
                    Detalle de Objetos de Valor Declarados:
                  </label>
                  <input
                    type="text"
                    value={checklist.objetosValorDetalle}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, objetosValorDetalle: e.target.value }))
                    }
                    placeholder="Ej. Gafas de sol, cargador original en guantera"
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-amber-300 focus:outline-none"
                  />
                </div>
              )}

              {/* Cantidad de llaves */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Cantidad de Llaves Recibidas:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Incluye llaveros o llaves de repuesto
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setChecklist((prev) => ({ ...prev, cantidadLlaves: num }))}
                      className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-colors cursor-pointer ${
                        checklist.cantidadLlaves === num
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observaciones rápidas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Obs. Neumáticos
                  </label>
                  <input
                    type="text"
                    value={checklist.obsNeumaticos}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, obsNeumaticos: e.target.value }))
                    }
                    placeholder="Ej. Desgaste 40% regular"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Obs. Luces Externas
                  </label>
                  <input
                    type="text"
                    value={checklist.obsLuces}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, obsLuces: e.target.value }))
                    }
                    placeholder="Ej. Stop izquierdo quemado"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Obs. Retrovisores
                  </label>
                  <input
                    type="text"
                    value={checklist.obsRetrovisores}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, obsRetrovisores: e.target.value }))
                    }
                    placeholder="Ej. Ambos espejos intactos"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 7: AUTORIZACIONES DEL CLIENTE */}
          {/* ============================================================== */}
          {paso === 7 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  Paso 7: Autorizaciones y Condiciones de Servicio
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirmación de términos legales, diagnóstico y condiciones de almacenaje.
                </p>
              </div>

              {/* Autorización Diagnóstico */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      (1) Autorización de Diagnóstico *
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      El cliente autoriza el desmontaje y pruebas necesarias para el diagnóstico.
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-700">Bs</span>
                    <input
                      type="number"
                      value={autorizaciones.costoDiagnosticoBs}
                      onChange={(e) =>
                        setAutorizaciones((prev) => ({
                          ...prev,
                          costoDiagnosticoBs: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-20 px-2 py-1 text-xs font-bold bg-white rounded border border-slate-300 text-right"
                    />
                  </div>
                </div>

                {/* Monto pre-autorizado opcional */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      (2) Monto Pre-autorizado (Opcional):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Monto límite que el taller puede ejecutar de inmediato sin llamar.
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-700">Bs</span>
                    <input
                      type="number"
                      value={autorizaciones.montoPreAutorizadoBs}
                      onChange={(e) =>
                        setAutorizaciones((prev) => ({
                          ...prev,
                          montoPreAutorizadoBs: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className="w-24 px-2 py-1 text-xs font-bold bg-white rounded border border-slate-300 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Devolución de repuestos y contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block">
                    (3) Devolución de Repuestos Reemplazados:
                  </span>
                  <div className="flex gap-2">
                    {[
                      { val: true, label: 'Sí, devolver al cliente' },
                      { val: false, label: 'No, desechar en taller' },
                    ].map((opt) => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() =>
                          setAutorizaciones((prev) => ({ ...prev, devolucionPiezas: opt.val }))
                        }
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                          autorizaciones.devolucionPiezas === opt.val
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block">
                    (4) Notificaciones por WhatsApp / Teléfono:
                  </span>
                  <div className="flex gap-2">
                    {[
                      { val: true, label: 'Sí, acepta avisos' },
                      { val: false, label: 'No' },
                    ].map((opt) => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() =>
                          setAutorizaciones((prev) => ({
                            ...prev,
                            aceptaContactoWhatsapp: opt.val,
                          }))
                        }
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                          autorizaciones.aceptaContactoWhatsapp === opt.val
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Condiciones de Almacenaje */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    (5) Condiciones de Almacenaje * (Configuración Oficial)
                  </span>
                  <span className="text-[11px] text-slate-600 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                    {config.almacenajeDiasGratis} días libres · {config.almacenajeCostoDiarioBs} Bs/día
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                  Una vez notificado que el vehículo está terminado o cotizado, el cliente dispone de{' '}
                  <strong>{config.almacenajeDiasGratis} días calendario gratuitos</strong> para su retiro o aprobación.
                  A partir del día {config.almacenajeDiasGratis + 1}, se aplicará una tarifa de custodia de{' '}
                  <strong>{config.almacenajeCostoDiarioBs} Bs por día</strong> de almacenaje.
                </p>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autorizaciones.aceptaCondicionesAlmacenaje}
                    onChange={(e) =>
                      setAutorizaciones((prev) => ({
                        ...prev,
                        aceptaCondicionesAlmacenaje: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-900">
                    El cliente acepta las condiciones de almacenaje y retiro.
                  </span>
                </label>
              </div>

              {/* Persona que entrega si es diferente */}
              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de quien entrega el vehículo (si difiere del titular):
                </label>
                <input
                  type="text"
                  value={autorizaciones.nombreQuienEntrega || ''}
                  onChange={(e) =>
                    setAutorizaciones((prev) => ({
                      ...prev,
                      nombreQuienEntrega: e.target.value,
                    }))
                  }
                  placeholder={`Titular: ${clienteActual?.nombre}`}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASO 8: RESUMEN Y CREACIÓN DE LA ORDEN DE SERVICIO */}
          {/* ============================================================== */}
          {paso === 8 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  Paso 8: Revisión Final y Emisión de Orden
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifica todos los datos antes de emitir la orden correlativa de servicio.
                </p>
              </div>

              {/* Ficha Resumen */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 block uppercase font-semibold">
                      Cliente
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {clienteActual?.nombre}
                    </span>
                    <span className="text-slate-600 block">
                      Tel: {clienteActual?.telefono}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block uppercase font-semibold">
                      Vehículo
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm tracking-wider">
                      {vehiculoActual?.placa}
                    </span>
                    <span className="text-slate-600 block">
                      {vehiculoActual?.marca} {vehiculoActual?.modelo} ({vehiculoActual?.anio})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Kilometraje:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {parseInt(kilometraje, 10).toLocaleString()} km
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Combustible:</span>
                    <span className="font-bold text-amber-600 text-xs">
                      {nivelCombustible}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Prioridad:</span>
                    <span
                      className={`font-bold text-xs ${
                        prioridad === 'Urgente' ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {prioridad}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Fotos Tomadas:</span>
                    <span className="font-bold text-emerald-700 text-xs">
                      {Object.keys(fotosCapturadas).length} fotos
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">
                    Motivo Registrado:
                  </span>
                  <p className="text-slate-700 italic text-xs leading-relaxed">
                    "{motivoCliente}"
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900 text-[11px] leading-relaxed flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    La orden se creará con estado <strong>"Recibido"</strong> y se generará la
                    hoja para firma y el código QR de verificación.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Navegación y Acciones del Asistente */}
        <div className="px-5 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {paso > 1 ? (
              <button
                type="button"
                onClick={handleAnterior}
                disabled={guardando}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          <div>
            {paso < 8 ? (
              <button
                type="button"
                onClick={handleSiguiente}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <span>Siguiente ({paso + 1}/8)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCrearOrdenFinal}
                disabled={guardando}
                className="flex items-center gap-2 px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {guardando ? (
                  <span>Emitiendo orden...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar y Crear Orden</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
