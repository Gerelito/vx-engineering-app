import React, { useState, useRef } from 'react';
import { DanioCarroceria } from '../../types';
import { Plus, Trash2, Eye, AlertTriangle } from 'lucide-react';

interface DiagramaCarroceriaProps {
  danios: DanioCarroceria[];
  onChangeDanios: (nuevosDanios: DanioCarroceria[]) => void;
  soloLectura?: boolean;
}

type VistaDiagrama = 'frente' | 'trasera' | 'lateral_izq' | 'lateral_der' | 'techo';

const VISTAS: { id: VistaDiagrama; label: string }[] = [
  { id: 'frente', label: '1. Frente' },
  { id: 'trasera', label: '2. Trasera' },
  { id: 'lateral_izq', label: '3. Lateral Izquierdo' },
  { id: 'lateral_der', label: '4. Lateral Derecho' },
  { id: 'techo', label: '5. Techo' },
];

export const DiagramaCarroceria: React.FC<DiagramaCarroceriaProps> = ({
  danios,
  onChangeDanios,
  soloLectura = false,
}) => {
  const [vistaActiva, setVistaActiva] = useState<VistaDiagrama>('frente');
  const [pinPendiente, setPinPendiente] = useState<{ xPercent: number; yPercent: number } | null>(null);

  const [tipoDanio, setTipoDanio] = useState<DanioCarroceria['tipo']>('Rayón');
  const [severidad, setSeveridad] = useState<DanioCarroceria['severidad']>('Leve');
  const [descripcion, setDescripcion] = useState('');

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (soloLectura) return;
    const svg = svgRef.current;
    if (!svg) return;

    // Obtener coordenadas de pantalla en el momento exacto del toque o clic
    let clientX: number;
    let clientY: number;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0) {
      clientX = (e as React.TouchEvent).changedTouches[0].clientX;
      clientY = (e as React.TouchEvent).changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Cálculo exacto con getBoundingClientRect en el momento preciso del toque/clic
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xRelativo = clientX - rect.left;
    const yRelativo = clientY - rect.top;

    const xPct = (xRelativo / rect.width) * 100;
    const yPct = (yRelativo / rect.height) * 100;

    // Asegurar que el punto quede dentro de los límites del lienzo (0-100%)
    const clampedX = Math.max(0, Math.min(100, Math.round(xPct * 10) / 10));
    const clampedY = Math.max(0, Math.min(100, Math.round(yPct * 10) / 10));

    setPinPendiente({
      xPercent: clampedX,
      yPercent: clampedY,
    });
  };

  const handleGuardarPin = () => {
    if (!pinPendiente) return;
    const nuevoDanio: DanioCarroceria = {
      id: `danio_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      zona: vistaActiva,
      tipo: tipoDanio,
      severidad,
      xPercent: pinPendiente.xPercent,
      yPercent: pinPendiente.yPercent,
      descripcion: descripcion.trim() || null,
    };

    onChangeDanios([...danios, nuevoDanio]);
    setPinPendiente(null);
    setDescripcion('');
  };

  const handleEliminarDanio = (id: string) => {
    if (soloLectura) return;
    onChangeDanios(danios.filter((d) => d.id !== id));
  };

  const daniosEnVista = danios.filter((d) => d.zona === vistaActiva);

  const getColorSeveridad = (sev: DanioCarroceria['severidad']) => {
    switch (sev) {
      case 'Grave':
        return 'bg-rose-500 border-rose-700 text-white fill-rose-500';
      case 'Media':
        return 'bg-amber-500 border-amber-700 text-white fill-amber-500';
      case 'Leve':
      default:
        return 'bg-yellow-400 border-yellow-600 text-slate-900 fill-yellow-400';
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      {/* Selector de vistas del vehículo */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-700" />
          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
            Inspección Visual de Carrocería (5 Vistas)
          </h4>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
          {danios.length} daño(s) registrado(s)
        </span>
      </div>

      {/* Botones de navegación de vistas con targets táctiles grandes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
        {VISTAS.map((v) => {
          const count = danios.filter((d) => d.zona === v.id).length;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVistaActiva(v.id);
                setPinPendiente(null);
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                vistaActiva === v.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-300/60'
              }`}
            >
              <span>{v.label}</span>
              {count > 0 && (
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    vistaActiva === v.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-white'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lienzo SVG Interactivo */}
      <div className="relative bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-inner flex flex-col items-center justify-center p-2 select-none">
        <div className="text-[11px] text-slate-400 mb-1 font-medium text-center">
          {!soloLectura
            ? 'Toca o haz clic sobre la zona del auto para señalar un daño'
            : 'Marcas de daños registrados en la recepción'}
        </div>

        <svg
          ref={svgRef}
          onClick={handleSvgClick}
          onTouchEnd={handleSvgClick}
          viewBox="0 0 500 260"
          className="w-full max-w-lg aspect-[500/260] cursor-crosshair touch-manipulation block"
        >
          {/* Fondo cuadriculado suave */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="500" height="260" fill="url(#grid)" />

          {/* VISTA 1: FRENTE */}
          {vistaActiva === 'frente' && (
            <g className="text-slate-700">
              {/* Carrocería frontal */}
              <path
                d="M 120 180 L 120 130 C 120 100 150 70 250 70 C 350 70 380 100 380 130 L 380 180 C 380 200 360 210 250 210 C 140 210 120 200 120 180 Z"
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth="4"
              />
              {/* Parabrisas delantero */}
              <path
                d="M 150 125 L 170 85 C 200 78 300 78 330 85 L 350 125 Z"
                fill="#e2e8f0"
                stroke="#64748b"
                strokeWidth="2.5"
              />
              {/* Capó */}
              <path d="M 150 130 L 350 130 L 360 165 L 140 165 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
              {/* Parrilla central */}
              <rect x="200" y="170" width="100" height="28" rx="6" fill="#1e293b" />
              <line x1="210" y1="178" x2="290" y2="178" stroke="#475569" strokeWidth="2" />
              <line x1="210" y1="186" x2="290" y2="186" stroke="#475569" strokeWidth="2" />
              {/* Faros delanteros */}
              <polygon points="135,145 175,140 170,165 130,165" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
              <polygon points="365,145 325,140 330,165 370,165" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
              {/* Retrovisores */}
              <rect x="90" y="115" width="28" height="16" rx="6" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
              <rect x="382" y="115" width="28" height="16" rx="6" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
              {/* Neumáticos visibles */}
              <rect x="110" y="180" width="16" height="30" rx="3" fill="#0f172a" />
              <rect x="374" y="180" width="16" height="30" rx="3" fill="#0f172a" />
              {/* Texto de orientación */}
              <text x="250" y="240" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                PARACHOQUES Y CAPÓ DELANTERO
              </text>
            </g>
          )}

          {/* VISTA 2: TRASERA */}
          {vistaActiva === 'trasera' && (
            <g className="text-slate-700">
              {/* Carrocería trasera */}
              <path
                d="M 120 180 L 120 130 C 120 100 150 70 250 70 C 350 70 380 100 380 130 L 380 180 C 380 200 360 210 250 210 C 140 210 120 200 120 180 Z"
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth="4"
              />
              {/* Vidrio trasero */}
              <path
                d="M 150 125 L 170 85 C 200 78 300 78 330 85 L 350 125 Z"
                fill="#e2e8f0"
                stroke="#64748b"
                strokeWidth="2.5"
              />
              {/* Maletero / Compuerta */}
              <rect x="160" y="132" width="180" height="42" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
              {/* Faros traseros (stops) */}
              <polygon points="125,138 158,138 155,162 125,162" fill="#f43f5e" stroke="#9f1239" strokeWidth="2" />
              <polygon points="375,138 342,138 345,162 375,162" fill="#f43f5e" stroke="#9f1239" strokeWidth="2" />
              {/* Espacio de placa */}
              <rect x="215" y="152" width="70" height="20" rx="3" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
              {/* Parachoques trasero */}
              <path d="M 120 180 Q 250 195 380 180 L 380 200 Q 250 215 120 200 Z" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
              {/* Tubo de escape */}
              <circle cx="150" cy="204" r="5" fill="#475569" />
              {/* Texto de orientación */}
              <text x="250" y="240" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                MALETERO Y PARACHOQUES TRASERO
              </text>
            </g>
          )}

          {/* VISTA 3: LATERAL IZQUIERDO */}
          {vistaActiva === 'lateral_izq' && (
            <g className="text-slate-700">
              {/* Silueta lateral */}
              <path
                d="M 50 155 L 75 125 L 140 120 L 190 75 L 310 75 L 370 120 L 440 125 L 455 155 L 450 175 L 415 175 C 410 150 360 150 355 175 L 175 175 C 170 150 120 150 115 175 L 55 175 Z"
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth="4"
              />
              {/* Ventanillas */}
              <path d="M 195 82 L 245 82 L 245 118 L 150 118 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              <path d="M 252 82 L 305 82 L 355 118 L 252 118 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              {/* Puertas */}
              <path d="M 145 120 L 248 120 L 248 175 L 170 175" fill="none" stroke="#94a3b8" strokeWidth="2" />
              <path d="M 248 120 L 350 120 L 350 175" fill="none" stroke="#94a3b8" strokeWidth="2" />
              {/* Manijas */}
              <rect x="220" y="126" width="16" height="4" rx="2" fill="#334155" />
              <rect x="310" y="126" width="16" height="4" rx="2" fill="#334155" />
              {/* Ruedas */}
              <circle cx="145" cy="175" r="28" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <circle cx="145" cy="175" r="14" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              <circle cx="385" cy="175" r="28" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <circle cx="385" cy="175" r="14" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              {/* Retrovisor izquierdo */}
              <path d="M 152 110 L 140 105 L 140 118 Z" fill="#334155" />
              {/* Texto de orientación */}
              <text x="250" y="240" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                COSTADO IZQUIERDO (PILOTO)
              </text>
            </g>
          )}

          {/* VISTA 4: LATERAL DERECHO */}
          {vistaActiva === 'lateral_der' && (
            <g className="text-slate-700">
              {/* Silueta lateral invertida horizontalmente */}
              <path
                d="M 450 155 L 425 125 L 360 120 L 310 75 L 190 75 L 130 120 L 60 125 L 45 155 L 50 175 L 85 175 C 90 150 140 150 145 175 L 325 175 C 330 150 380 150 385 175 L 445 175 Z"
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth="4"
              />
              {/* Ventanillas */}
              <path d="M 305 82 L 255 82 L 255 118 L 350 118 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              <path d="M 248 82 L 195 82 L 145 118 L 248 118 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              {/* Puertas */}
              <path d="M 355 120 L 252 120 L 252 175 L 330 175" fill="none" stroke="#94a3b8" strokeWidth="2" />
              <path d="M 252 120 L 150 120 L 150 175" fill="none" stroke="#94a3b8" strokeWidth="2" />
              {/* Manijas */}
              <rect x="264" y="126" width="16" height="4" rx="2" fill="#334155" />
              <rect x="174" y="126" width="16" height="4" rx="2" fill="#334155" />
              {/* Ruedas */}
              <circle cx="355" cy="175" r="28" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <circle cx="355" cy="175" r="14" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              <circle cx="115" cy="175" r="28" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <circle cx="115" cy="175" r="14" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              {/* Retrovisor derecho */}
              <path d="M 348 110 L 360 105 L 360 118 Z" fill="#334155" />
              {/* Texto de orientación */}
              <text x="250" y="240" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                COSTADO DERECHO (COPILOTO)
              </text>
            </g>
          )}

          {/* VISTA 5: TECHO */}
          {vistaActiva === 'techo' && (
            <g className="text-slate-700">
              {/* Planta superior del vehículo */}
              <path
                d="M 200 30 C 200 20 300 20 300 30 L 320 80 L 325 180 L 310 220 C 300 230 200 230 190 220 L 175 180 L 180 80 Z"
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth="4"
              />
              {/* Parabrisas frontal */}
              <path d="M 185 70 L 315 70 L 310 95 L 190 95 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              {/* Techo superior */}
              <rect x="190" y="98" width="120" height="85" rx="6" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
              {/* Parabrisas trasero */}
              <path d="M 192 186 L 308 186 L 300 206 L 200 206 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              {/* Capó frontal */}
              <path d="M 195 32 Q 250 25 305 32 L 315 65 L 185 65 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
              {/* Retrovisores vistos desde arriba */}
              <rect x="160" y="80" width="18" height="12" rx="4" fill="#334155" />
              <rect x="322" y="80" width="18" height="12" rx="4" fill="#334155" />
              {/* Texto de orientación */}
              <text x="250" y="250" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                TECHO Y PLANTA SUPERIOR
              </text>
            </g>
          )}

          {/* PINES DE DAÑOS REGISTRADOS EN ESTA VISTA */}
          {daniosEnVista.map((d, index) => {
            const cx = (d.xPercent / 100) * 500;
            const cy = (d.yPercent / 100) * 260;
            return (
              <g key={d.id} className="cursor-pointer">
                <circle
                  cx={cx}
                  cy={cy}
                  r="12"
                  className={`${
                    d.severidad === 'Grave'
                      ? 'fill-rose-500 stroke-rose-900'
                      : d.severidad === 'Media'
                      ? 'fill-amber-500 stroke-amber-900'
                      : 'fill-yellow-400 stroke-yellow-800'
                  } stroke-2 animate-bounce`}
                />
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fill="#000000"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {index + 1}
                </text>
              </g>
            );
          })}

          {/* PIN PENDIENTE DE ASIGNACIÓN */}
          {pinPendiente && (
            <g>
              <circle
                cx={(pinPendiente.xPercent / 100) * 500}
                cy={(pinPendiente.yPercent / 100) * 260}
                r="14"
                fill="#3b82f6"
                stroke="#1d4ed8"
                strokeWidth="3"
                className="animate-pulse"
              />
              <text
                x={(pinPendiente.xPercent / 100) * 500}
                y={(pinPendiente.yPercent / 100) * 260 + 4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
              >
                +
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Formulario emergente para clasificar el pin marcado */}
      {pinPendiente && !soloLectura && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 space-y-3 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Detalle del daño marcado en posición ({pinPendiente.xPercent}%, {pinPendiente.yPercent}%)
            </span>
            <button
              type="button"
              onClick={() => setPinPendiente(null)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo de Daño</label>
              <select
                value={tipoDanio}
                onChange={(e) => setTipoDanio(e.target.value as DanioCarroceria['tipo'])}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900 font-medium"
              >
                <option value="Rayón">Rayón</option>
                <option value="Abolladura">Abolladura</option>
                <option value="Golpe">Golpe</option>
                <option value="Pintura desgastada">Pintura desgastada</option>
                <option value="Vidrio astillado">Vidrio astillado</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Severidad</label>
              <div className="flex gap-1.5">
                {(['Leve', 'Media', 'Grave'] as const).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeveridad(sev)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      severidad === sev
                        ? sev === 'Grave'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : sev === 'Media'
                          ? 'bg-amber-600 text-white border-amber-700'
                          : 'bg-yellow-400 text-slate-950 border-yellow-500'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Descripción / Detalle Opcional
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Raspa de 10 cm cerca al faro"
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPinPendiente(null)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarPin}
              className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg shadow-xs hover:bg-slate-800 cursor-pointer"
            >
              Guardar Daño en {VISTAS.find((v) => v.id === vistaActiva)?.label}
            </button>
          </div>
        </div>
      )}

      {/* Lista de daños registrados */}
      {danios.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-700 block">
            Detalle de Daños Registrados ({danios.length}):
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {danios.map((d, index) => {
              const vistaObj = VISTAS.find((v) => v.id === d.zona);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${getColorSeveridad(
                        d.severidad
                      )}`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {d.tipo} ({d.severidad})
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {vistaObj?.label} {d.descripcion ? `· ${d.descripcion}` : ''}
                      </div>
                    </div>
                  </div>

                  {!soloLectura && (
                    <button
                      type="button"
                      onClick={() => handleEliminarDanio(d.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                      title="Eliminar este daño"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
