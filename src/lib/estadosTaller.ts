import { aMilisegundos } from './storage';
import { EstadoOrden, OrdenServicio, TallerConfig, HistorialEstado } from '../types';

/**
 * TABLA ÚNICA DE ESTADOS Y TRANSICIONES PERMITIDAS DEL TALLER
 * Especificación v1.2 Módulo 3. Taller
 * Cualquier transición fuera de esta tabla se bloquea estrictamente.
 */
export const TRANSICIONES_PERMITIDAS: Record<EstadoOrden, EstadoOrden[]> = {
  'Recibido': ['En diagnóstico', 'Cancelada'],
  'En diagnóstico': ['Esperando aprobación', 'Cancelada'],
  'Esperando aprobación': ['Esperando repuestos', 'En reparación', 'Cancelada'],
  'Esperando repuestos': ['En reparación', 'Cancelada'],
  'En reparación': ['Esperando aprobación', 'Control de calidad'],
  'Control de calidad': ['En reparación', 'Listo para entrega'],
  'Listo para entrega': ['Entregado'],
  'Entregado': [],
  'Cancelada': [],
};

export const ESTADOS_FINALES: EstadoOrden[] = ['Entregado', 'Cancelada'];

export const TODOS_LOS_ESTADOS_ORDEN: EstadoOrden[] = [
  'Recibido',
  'En diagnóstico',
  'Esperando aprobación',
  'Esperando repuestos',
  'En reparación',
  'Control de calidad',
  'Listo para entrega',
  'Entregado',
  'Cancelada',
];

/**
 * Colores y estilos visuales para cada estado del flujo de taller
 */
export const ESTILOS_ESTADO: Record<
  EstadoOrden,
  {
    bg: string;
    text: string;
    border: string;
    badge: string;
    dot: string;
    descripcion: string;
  }
> = {
  'Recibido': {
    bg: 'bg-slate-50',
    text: 'text-slate-800',
    border: 'border-slate-300',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    dot: 'bg-slate-500',
    descripcion: 'Vehículo recibido e ingresado al taller',
  },
  'En diagnóstico': {
    bg: 'bg-blue-50/70',
    text: 'text-blue-900',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    dot: 'bg-blue-600',
    descripcion: 'Inspección multipunto, escáner y mediciones en curso',
  },
  'Esperando aprobación': {
    bg: 'bg-amber-50/70',
    text: 'text-amber-900',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    dot: 'bg-amber-500',
    descripcion: 'Presupuesto o hallazgo enviado al cliente',
  },
  'Esperando repuestos': {
    bg: 'bg-purple-50/70',
    text: 'text-purple-900',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    dot: 'bg-purple-600',
    descripcion: 'Aguardando repuestos o piezas autorizadas',
  },
  'En reparación': {
    bg: 'bg-indigo-50/70',
    text: 'text-indigo-900',
    border: 'border-indigo-300',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    dot: 'bg-indigo-600',
    descripcion: 'Trabajos mecánicos en ejecución con tareas y cronómetro',
  },
  'Control de calidad': {
    bg: 'bg-cyan-50/70',
    text: 'text-cyan-900',
    border: 'border-cyan-300',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    dot: 'bg-cyan-600',
    descripcion: 'Verificación final de torque, niveles y prueba de ruta',
  },
  'Listo para entrega': {
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-600',
    descripcion: 'Vehículo lavado y listo; cliente notificado',
  },
  'Entregado': {
    bg: 'bg-teal-50/70',
    text: 'text-teal-900',
    border: 'border-teal-300',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    dot: 'bg-teal-600',
    descripcion: 'Orden finalizada; vehículo entregado al cliente',
  },
  'Cancelada': {
    bg: 'bg-rose-50/70',
    text: 'text-rose-900',
    border: 'border-rose-300',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    dot: 'bg-rose-600',
    descripcion: 'Recepción cancelada por cliente o diagnóstico inviable',
  },
};

/**
 * Determina si una transición de estado es válida según la matriz única
 */
export function esTransicionValida(estadoActual: EstadoOrden, nuevoEstado: EstadoOrden): boolean {
  const permitidos = TRANSICIONES_PERMITIDAS[estadoActual] || [];
  return permitidos.includes(nuevoEstado);
}

/**
 * Obtiene la lista de estados a los que se puede transicionar desde el estado actual
 */
export function obtenerSiguientesEstadosPermitidos(estadoActual: EstadoOrden): EstadoOrden[] {
  return TRANSICIONES_PERMITIDAS[estadoActual] || [];
}

/**
 * Valida todas las reglas del taller para una transición:
 * 1. Conexión a internet (los cambios de estado requieren conexión)
 * 2. Matriz de transiciones
 * 3. Regla obligatoria: No se puede pasar a 'En reparación' sin aprobación del cliente
 */
export function validarTransicionTaller(
  orden: OrdenServicio,
  nuevoEstado: EstadoOrden,
  estaConectado: boolean
): {
  valido: boolean;
  requiereAprobacionCliente?: boolean;
  requiereFechaRepuestos?: boolean;
  mensajeError?: string;
} {
  // 1. Regla de conexión requerida
  if (!estaConectado) {
    return {
      valido: false,
      mensajeError: 'Los cambios de estado requieren conexión a internet activa para garantizar la sincronización transaccional con Firestore.',
    };
  }

  // 2. Regla de matriz de transiciones
  if (!esTransicionValida(orden.estado, nuevoEstado)) {
    const permitidos = obtenerSiguientesEstadosPermitidos(orden.estado);
    return {
      valido: false,
      mensajeError: `Transición no permitida de "${orden.estado}" a "${nuevoEstado}". Estados válidos: ${
        permitidos.length > 0 ? permitidos.join(', ') : 'Ninguno (estado final)'
      }.`,
    };
  }

  // 3. Regla "En reparación" requiere aprobación del cliente registrada
  if (nuevoEstado === 'En reparación') {
    const tieneAprobacionRegistrada = orden.aprobaciones?.aprobadoPorCliente === true;
    const tienePreAutorizacion = (orden.autorizaciones?.montoPreAutorizadoBs || 0) > 0;

    if (!tieneAprobacionRegistrada && !tienePreAutorizacion) {
      return {
        valido: false,
        requiereAprobacionCliente: true,
        mensajeError: 'No se puede pasar a "En reparación" sin una aprobación del cliente registrada (o monto pre-autorizado en la recepción). Registra la aprobación del cliente antes de iniciar.',
      };
    }
  }

  // 4. Regla "Esperando repuestos" pide fecha estimada de llegada
  if (nuevoEstado === 'Esperando repuestos') {
    return {
      valido: true,
      requiereFechaRepuestos: true,
    };
  }

  return { valido: true };
}

/**
 * CÁLCULO DE ALERTAS POR TIEMPO SOLO EN ESTADOS DEL TALLER
 * Especificación v1.2 Módulo 3. Taller
 * Se calculan en el navegador y se marcan en rojo:
 * - En diagnóstico > 4 h (o límite configurable)
 * - En reparación > 1.5 x tiempo estimado (o límite configurable)
 * - Control de calidad > 4 h (o límite configurable)
 */
export interface AlertaTiempoEstado {
  tieneAlerta: boolean;
  horasEnEstado: number;
  minutosEnEstado: number;
  limiteHoras: number;
  tiempoEstimadoHoras?: number;
  mensajeAlerta?: string;
  tiempoTranscurridoTexto: string;
}

export function calcularAlertaTiempoEstado(
  orden: OrdenServicio,
  config: TallerConfig
): AlertaTiempoEstado {
  // Determinar timestamp de inicio del estado actual
  let inicioTimestamp: number | null = null;

  if (orden.historialEstados && orden.historialEstados.length > 0) {
    const ultimoCambio = orden.historialEstados[orden.historialEstados.length - 1];
    if (ultimoCambio.fechaTimestamp) {
      inicioTimestamp = ultimoCambio.fechaTimestamp;
    } else if (ultimoCambio.fecha) {
      const parsed = Date.parse(ultimoCambio.fecha);
      if (!isNaN(parsed)) inicioTimestamp = parsed;
    }
  }

  if (!inicioTimestamp) inicioTimestamp = aMilisegundos(orden.fechaIngresoEstadoActual);
  if (!inicioTimestamp) inicioTimestamp = aMilisegundos(orden.createdAt);

  if (!inicioTimestamp) {
    return {
      tieneAlerta: false,
      horasEnEstado: 0,
      minutosEnEstado: 0,
      limiteHoras: 0,
      tiempoTranscurridoTexto: '0 min',
    };
  }

  const ahora = Date.now();
  const diffMs = Math.max(0, ahora - inicioTimestamp);
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  const horasTotales = Math.round((diffMinutos / 60) * 10) / 10;

  // Formatear texto transcurrido amigable
  const dias = Math.floor(diffMinutos / (60 * 24));
  const horas = Math.floor((diffMinutos % (60 * 24)) / 60);
  const minutos = diffMinutos % 60;

  let texto = '';
  if (dias > 0) {
    texto = `${dias}d ${horas}h`;
  } else if (horas > 0) {
    texto = `${horas}h ${minutos}m`;
  } else {
    texto = `${minutos} min`;
  }

  // Comprobar alertas según el estado específico
  const limiteDiag = config.limiteDiagnosticoHoras || 4;
  const factorReparacion = config.factorTiempoEstimadoReparacion || 1.5;
  const limiteQC = config.limiteControlCalidadHoras || 4;

  if (orden.estado === 'En diagnóstico') {
    if (horasTotales > limiteDiag) {
      return {
        tieneAlerta: true,
        horasEnEstado: horasTotales,
        minutosEnEstado: diffMinutos,
        limiteHoras: limiteDiag,
        mensajeAlerta: `Tiempo de diagnóstico excedido: ${texto} (límite: ${limiteDiag}h)`,
        tiempoTranscurridoTexto: texto,
      };
    }
  } else if (orden.estado === 'En reparación') {
    // Calcular tiempo estimado total a partir de las tareas o usar base 4h si no hay tareas
    const totalEstimadoMin = (orden.tareas || []).reduce(
      (acc, t) => acc + (t.tiempoEstimadoMinutos || 0),
      0
    );
    const tiempoEstimadoHoras = totalEstimadoMin > 0 ? totalEstimadoMin / 60 : 4;
    const limiteHoras = tiempoEstimadoHoras * factorReparacion;

    if (horasTotales > limiteHoras) {
      return {
        tieneAlerta: true,
        horasEnEstado: horasTotales,
        minutosEnEstado: diffMinutos,
        limiteHoras: Math.round(limiteHoras * 10) / 10,
        tiempoEstimadoHoras: Math.round(tiempoEstimadoHoras * 10) / 10,
        mensajeAlerta: `Tiempo de reparación excedido: ${texto} (> ${factorReparacion}x del estimado de ${tiempoEstimadoHoras.toFixed(1)}h)`,
        tiempoTranscurridoTexto: texto,
      };
    }
  } else if (orden.estado === 'Control de calidad') {
    if (horasTotales > limiteQC) {
      return {
        tieneAlerta: true,
        horasEnEstado: horasTotales,
        minutosEnEstado: diffMinutos,
        limiteHoras: limiteQC,
        mensajeAlerta: `Control de calidad demorado: ${texto} (límite: ${limiteQC}h)`,
        tiempoTranscurridoTexto: texto,
      };
    }
  }

  return {
    tieneAlerta: false,
    horasEnEstado: horasTotales,
    minutosEnEstado: diffMinutos,
    limiteHoras: 0,
    tiempoTranscurridoTexto: texto,
  };
}
