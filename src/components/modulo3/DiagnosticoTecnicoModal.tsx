import React, { useState } from 'react';
import {
  OrdenServicio,
  TallerConfig,
  DiagnosticoTecnico,
  ItemInspeccion,
  MedicionesTecnicas,
  CodigoObd2,
  EstadoSemaforo,
  DuenoUsuario,
} from '../../types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Stethoscope,
  Activity,
  Gauge,
  Camera,
  Plus,
  Trash2,
  FileText,
  Share2,
  Printer,
  Upload,
  Check,
} from 'lucide-react';

interface DiagnosticoTecnicoModalProps {
  orden: OrdenServicio | null;
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  usuarioActual: DuenoUsuario | null;
  onGuardarDiagnostico: (orden: OrdenServicio, diagnostico: DiagnosticoTecnico) => Promise<void>;
  onSubirFotoDiagnostico: (
    orden: OrdenServicio,
    fotoData: { titulo: string; base64Data: string; tamanioBytes?: number }
  ) => Promise<void>;
  onAbrirImprimirDiagnostico: (orden: OrdenServicio) => void;
}

const SISTEMAS_MULTICRITICO = [
  '1. Frenos (pastillas, discos, zapatas, mangueras)',
  '2. Suspensión y dirección (amortiguadores, bujes, rótulas)',
  '3. Neumáticos (dibujo, presión, deformaciones)',
  '4. Batería y sistema de carga (bornes, alternador)',
  '5. Fluidos (motor, frenos, refrigerante, dirección, caja)',
  '6. Correas y mangueras (accesorios, distribución, fugas)',
  '7. Luces e iluminación (bajas, altas, freno, guiñadores)',
  '8. Escape y emisiones (silenciador, catalizador, fugas)',
];

export const DiagnosticoTecnicoModal: React.FC<DiagnosticoTecnicoModalProps> = ({
  orden,
  isOpen,
  onClose,
  config,
  usuarioActual,
  onGuardarDiagnostico,
  onSubirFotoDiagnostico,
  onAbrirImprimirDiagnostico,
}) => {
  if (!isOpen || !orden) return null;

  const diagExistente = orden.diagnosticoTecnico;

  // Pestañas internas
  const [tab, setTab] = useState<'multipunto' | 'mediciones' | 'obd2' | 'evidencia' | 'recomendaciones'>('multipunto');

  // 1. Semáforo Multipunto
  const [inspeccion, setInspeccion] = useState<ItemInspeccion[]>(() => {
    if (diagExistente?.inspeccionMultipunto && diagExistente.inspeccionMultipunto.length > 0) {
      return diagExistente.inspeccionMultipunto;
    }
    return SISTEMAS_MULTICRITICO.map((sis) => ({
      sistema: sis,
      estado: 'Bueno' as EstadoSemaforo,
      observacion: '',
    }));
  });

  // 2. Mediciones Técnicas
  const [mediciones, setMediciones] = useState<MedicionesTecnicas>(() => {
    return (
      diagExistente?.mediciones || {
        espesorPastillasDelanterasIzqMm: null,
        espesorPastillasDelanterasDerMm: null,
        espesorPastillasTraserasIzqMm: null,
        espesorPastillasTraserasDerMm: null,
        espesorDiscosDelanterosMm: null,
        espesorDiscosTraserosMm: null,
        dibujoNeumaticoDelanteroIzqMm: null,
        dibujoNeumaticoDelanteroDerMm: null,
        dibujoNeumaticoTraseroIzqMm: null,
        dibujoNeumaticoTraseroDerMm: null,
        voltajeBateriaReposoV: 12.6,
        voltajeBateriaCargaV: 14.2,
        presionAceitePsi: null,
        compresionCilindro1Psi: null,
        compresionCilindro2Psi: null,
        compresionCilindro3Psi: null,
        compresionCilindro4Psi: null,
      }
    );
  });

  // 3. Códigos OBD-II
  const [codigosObd, setCodigosObd] = useState<CodigoObd2[]>(
    diagExistente?.codigosObd2 || []
  );
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevaDescripcionObd, setNuevaDescripcionObd] = useState('');
  const [severidadObd, setSeveridadObd] = useState<'Leve' | 'Grave'>('Leve');

  // 4. Evidencia y Notas
  const [notaInterna, setNotaInterna] = useState(diagExistente?.notaInternaTaller || '');
  const [notaCliente, setNotaCliente] = useState(diagExistente?.notaExplicativaCliente || '');
  const [fotoTitulo, setFotoTitulo] = useState('Desgaste irregular detectado');
  const [comprimiendoFoto, setComprimiendoFoto] = useState(false);
  const [fotosSubidasCount, setFotosSubidasCount] = useState(0);

  // 5. Recomendaciones Técnicas
  const [recomendacionesInmediatas, setRecomendacionesInmediatas] = useState(() => {
    const r = (diagExistente?.hallazgos || []).filter((h) => h.clasificacion === 'Seguridad (Urgente)');
    return r.map((h) => h.descripcion).join('\n');
  });
  const [recomendacionesMedianoPlazo, setRecomendacionesMedianoPlazo] = useState(() => {
    const r = (diagExistente?.hallazgos || []).filter((h) => h.clasificacion === 'Recomendado');
    return r.map((h) => h.descripcion).join('\n');
  });
  const [observacionesGenerales, setObservacionesGenerales] = useState(() => {
    const r = (diagExistente?.hallazgos || []).filter((h) => h.clasificacion === 'Puede esperar');
    return r.map((h) => h.descripcion).join('\n');
  });

  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Handlers para el semáforo multipunto
  const handleCambiarEstadoSemaforo = (index: number, nuevoEstado: EstadoSemaforo) => {
    setInspeccion((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], estado: nuevoEstado };
      return copy;
    });
  };

  const handleCambiarObservacionSemaforo = (index: number, texto: string) => {
    setInspeccion((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], observacion: texto };
      return copy;
    });
  };

  // Agregar código OBD-II
  const handleAgregarCodigoObd = () => {
    if (!nuevoCodigo.trim()) return;
    const item: CodigoObd2 = {
      id: `obd_${Date.now()}`,
      codigo: nuevoCodigo.trim().toUpperCase(),
      descripcion: nuevaDescripcionObd.trim() || 'Código de falla registrado por escáner OBD-II',
      estado: severidadObd === 'Grave' ? 'Activo' : 'Pendiente',
      freezeFrame: null,
      borrado: false,
    };
    setCodigosObd([...codigosObd, item]);
    setNuevoCodigo('');
    setNuevaDescripcionObd('');
  };

  const handleEliminarCodigoObd = (id: string) => {
    setCodigosObd(codigosObd.filter((c) => c.id !== id));
  };

  // Compresión y subida de foto de diagnóstico
  const handleCapturaFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setComprimiendoFoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
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

          try {
            await onSubirFotoDiagnostico(orden, {
              titulo: fotoTitulo.trim() || 'Foto de Diagnóstico Técnico',
              base64Data: compressed,
              tamanioBytes: bytes,
            });
            setFotosSubidasCount((c) => c + 1);
            setMensajeExito(`Foto de evidencia subida (${Math.round(bytes / 1024)} KB)`);
            setTimeout(() => setMensajeExito(null), 3000);
          } catch (err: any) {
            setErrorLocal(err?.message || 'Error al guardar foto');
          } finally {
            setComprimiendoFoto(false);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Guardar diagnóstico completo
  const handleGuardarTodo = async () => {
    setGuardando(true);
    setErrorLocal(null);

    try {
      // Ensamblar hallazgos clasificados para el cliente
      const hallazgosFinales: any[] = [];
      if (recomendacionesInmediatas.trim()) {
        recomendacionesInmediatas
          .split('\n')
          .filter(Boolean)
          .forEach((line, i) => {
            hallazgosFinales.push({
              id: `rec_inm_${i}`,
              descripcion: line.trim(),
              clasificacion: 'Seguridad (Urgente)',
              sistema: 'Seguridad / Inmediato',
            });
          });
      }
      if (recomendacionesMedianoPlazo.trim()) {
        recomendacionesMedianoPlazo
          .split('\n')
          .filter(Boolean)
          .forEach((line, i) => {
            hallazgosFinales.push({
              id: `rec_med_${i}`,
              descripcion: line.trim(),
              clasificacion: 'Recomendado',
              sistema: 'Preventivo / Mediano Plazo',
            });
          });
      }
      if (observacionesGenerales.trim()) {
        observacionesGenerales
          .split('\n')
          .filter(Boolean)
          .forEach((line, i) => {
            hallazgosFinales.push({
              id: `rec_obs_${i}`,
              descripcion: line.trim(),
              clasificacion: 'Puede esperar',
              sistema: 'Observaciones',
            });
          });
      }

      const payload: DiagnosticoTecnico = {
        inspeccionMultipunto: inspeccion,
        mediciones,
        codigosObd2: codigosObd,
        hallazgos: hallazgosFinales,
        notaInternaTaller: notaInterna.trim() || null,
        notaExplicativaCliente: notaCliente.trim() || null,
        completado: true,
      };

      await onGuardarDiagnostico(orden, payload);
      setMensajeExito('Diagnóstico guardado.');
      setTimeout(() => setMensajeExito(null), 3500);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al guardar el diagnóstico técnico');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Diagnóstico Técnico Automotriz</h2>
              <p className="text-xs text-slate-400">
                Folio: <span className="font-mono text-amber-400 font-bold">{orden.folio}</span> ·{' '}
                {orden.vehiculoPlaca} ({orden.vehiculoMarca} {orden.vehiculoModelo}) · Funciona sin conexión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAbrirImprimirDiagnostico(orden)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Abrir hoja imprimible para el cliente"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Hoja para Cliente</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        {mensajeExito && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs text-emerald-900 font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {errorLocal && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-900 font-semibold flex items-center justify-between shrink-0 animate-in fade-in">
            <span>{errorLocal}</span>
            <button onClick={() => setErrorLocal(null)} className="text-rose-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra de pestañas */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-5 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0 py-1.5">
          {[
            { id: 'multipunto', label: '1. Semáforo Multipunto (8)' },
            { id: 'mediciones', label: '2. Mediciones (mm / V / PSI)' },
            { id: 'obd2', label: `3. Códigos OBD-II (${codigosObd.length})` },
            { id: 'evidencia', label: '4. Fotos & Evidencia' },
            { id: 'recomendaciones', label: '5. Recomendaciones' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: INSPECCIÓN MULTIPUNTO CON SEMÁFORO VERDE/AMARILLO/ROJO */}
          {tab === 'multipunto' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Inspección Visual Multipunto con Semáforo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Evalúa cada sistema crítico con botones táctiles grandes: Verde (OK), Amarillo (Atención sugerida), Rojo (Crítico / Inseguro).
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {inspeccion.map((item, idx) => (
                  <div
                    key={item.sistema}
                    className={`p-3.5 rounded-xl border transition-all ${
                      item.estado === 'Urgente'
                        ? 'bg-rose-50/40 border-rose-300'
                        : item.estado === 'Observación'
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-emerald-50/20 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="text-xs font-bold text-slate-900 flex-1">
                        {item.sistema}
                      </span>

                      {/* Botones grandes de semáforo */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCambiarEstadoSemaforo(idx, 'Bueno')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            item.estado === 'Bueno'
                              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500'
                              : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                          <span>OK / Verde</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCambiarEstadoSemaforo(idx, 'Observación')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            item.estado === 'Observación'
                              ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400'
                              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                          <span>Atención / Amarillo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCambiarEstadoSemaforo(idx, 'Urgente')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            item.estado === 'Urgente'
                              ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500'
                              : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                          <span>Crítico / Rojo</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <input
                        type="text"
                        value={item.observacion || ''}
                        onChange={(e) => handleCambiarObservacionSemaforo(idx, e.target.value)}
                        placeholder="Observación técnica del sistema (ej: pastillas al 20%, guardapolvo roto...)"
                        className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MEDICIONES TÉCNICAS CUANTITATIVAS */}
          {tab === 'mediciones' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Mediciones Cuantitativas de Laboratorio
                </h3>
                <p className="text-[11px] text-slate-500">
                  Espesores en milímetros, dibujo de ruedas, voltajes y presiones para evidencia incontrovertible.
                </p>
              </div>

              {/* Frenos */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-700" />
                  Espesor de Pastillas y Discos de Freno (mm)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pastillas Del. Izq (mm):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.espesorPastillasDelanterasIzqMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          espesorPastillasDelanterasIzqMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 8.5"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pastillas Del. Der (mm):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.espesorPastillasDelanterasDerMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          espesorPastillasDelanterasDerMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 8.2"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pastillas Tras. Izq (mm):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.espesorPastillasTraserasIzqMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          espesorPastillasTraserasIzqMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 5.0"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Pastillas Tras. Der (mm):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.espesorPastillasTraserasDerMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          espesorPastillasTraserasDerMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 4.8"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Neumáticos */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-slate-700" />
                  Profundidad de Dibujo de Neumáticos por Rueda (mm)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Delantero Izquierdo:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.dibujoNeumaticoDelanteroIzqMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          dibujoNeumaticoDelanteroIzqMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 5.5"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Delantero Derecho:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.dibujoNeumaticoDelanteroDerMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          dibujoNeumaticoDelanteroDerMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 5.3"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Trasero Izquierdo:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.dibujoNeumaticoTraseroIzqMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          dibujoNeumaticoTraseroIzqMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 6.0"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Trasero Derecho:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.dibujoNeumaticoTraseroDerMm ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          dibujoNeumaticoTraseroDerMm: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 5.9"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Batería y Presión */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-slate-700" />
                  Batería (V), Presión de Aceite (PSI) y Compresión
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Batería en Reposo (V):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.voltajeBateriaReposoV ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          voltajeBateriaReposoV: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="12.6"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Carga / Alternador (V):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mediciones.voltajeBateriaCargaV ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          voltajeBateriaCargaV: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="14.2"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Presión Aceite (PSI):
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={mediciones.presionAceitePsi ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          presionAceitePsi: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 35"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Compresión Cil 1 (PSI):
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={mediciones.compresionCilindro1Psi ?? ''}
                      onChange={(e) =>
                        setMediciones({
                          ...mediciones,
                          compresionCilindro1Psi: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="ej. 150"
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CÓDIGOS OBD-II */}
          {tab === 'obd2' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Códigos de Diagnóstico por Computadora (DTC / OBD-II)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Registra los códigos leídos por escáner con su severidad técnica.
                </p>
              </div>

              {/* Formulario para agregar código */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Código DTC (ej. P0300):
                    </label>
                    <input
                      type="text"
                      value={nuevoCodigo}
                      onChange={(e) => setNuevoCodigo(e.target.value)}
                      placeholder="P0300"
                      className="w-full px-3 py-1.5 rounded border border-slate-300 font-mono font-bold uppercase bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Severidad:
                    </label>
                    <select
                      value={severidadObd}
                      onChange={(e: any) => setSeveridadObd(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                    >
                      <option value="Leve">Leve / Pendiente</option>
                      <option value="Grave">Grave / Activo con Check Engine</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Descripción de Falla:
                    </label>
                    <input
                      type="text"
                      value={nuevaDescripcionObd}
                      onChange={(e) => setNuevaDescripcionObd(e.target.value)}
                      placeholder="Fallo de encendido en cilindro aleatorio"
                      className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleAgregarCodigoObd}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Código OBD-II</span>
                  </button>
                </div>
              </div>

              {/* Lista de códigos registrados */}
              <div className="space-y-2">
                {codigosObd.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-4 text-center bg-slate-50 rounded-xl border">
                    No se han registrado códigos de escáner en este vehículo.
                  </p>
                ) : (
                  codigosObd.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            c.estado === 'Activo'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {c.codigo}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{c.descripcion}</p>
                          <span className="text-[10px] text-slate-500">
                            Estado: {c.estado}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEliminarCodigoObd(c.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FOTOS Y EVIDENCIA */}
          {tab === 'evidencia' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Evidencia Fotográfica de Diagnóstico (Taller)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Captura fotos directas desde la cámara del celular comprimidas a 1024px (&lt; 120 KB) guardadas en la subcolección de la orden.
                </p>
              </div>

              {/* Selector de subida con cámara */}
              <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Título o Pieza Fotografiada:
                    </label>
                    <input
                      type="text"
                      value={fotoTitulo}
                      onChange={(e) => setFotoTitulo(e.target.value)}
                      placeholder="Ej. Fuga en retén de bancada"
                      className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Capturar con Cámara / Subir Imagen:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCapturaFoto}
                      disabled={comprimiendoFoto}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                {comprimiendoFoto && (
                  <p className="text-xs text-blue-700 font-bold animate-pulse">
                    Comprimiendo y guardando...
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nota Interna de Taller (Solo visible para mecánicos y dueños):
                </label>
                <textarea
                  rows={3}
                  value={notaInterna}
                  onChange={(e) => setNotaInterna(e.target.value)}
                  placeholder="Detalles técnicos reservados: holgura excesiva, antecedentes del motor, etc."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Explicación Clara para el Cliente (Aparece en el informe):
                </label>
                <textarea
                  rows={3}
                  value={notaCliente}
                  onChange={(e) => setNotaCliente(e.target.value)}
                  placeholder="Explicación en lenguaje no técnico para que el cliente comprenda la necesidad del servicio."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 5: RECOMENDACIONES TÉCNICAS */}
          {tab === 'recomendaciones' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recomendaciones Técnicas Clasificadas
                </h3>
                <p className="text-[11px] text-slate-500">
                  Separa los trabajos obligatorios de seguridad de las sugerencias preventivas para la cotización y aprobación del cliente.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    1. Trabajos Inmediatos / Seguridad Vial (Urgente):
                  </label>
                  <textarea
                    rows={3}
                    value={recomendacionesInmediatas}
                    onChange={(e) => setRecomendacionesInmediatas(e.target.value)}
                    placeholder="Un item por línea: ej.&#10;Cambio urgente de pastillas delanteras (espesor crítico 2mm)&#10;Reemplazo de rótula derecha con juego peligroso"
                    className="w-full p-2 text-xs bg-white rounded-lg border border-rose-300 focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-600" />
                    2. Trabajos a Mediano Plazo / Preventivos (Recomendado):
                  </label>
                  <textarea
                    rows={3}
                    value={recomendacionesMedianoPlazo}
                    onChange={(e) => setRecomendacionesMedianoPlazo(e.target.value)}
                    placeholder="Un item por línea: ej.&#10;Limpieza y calibración de cuerpo de aceleración en 5,000 km&#10;Cambio preventivo de correa de accesorios"
                    className="w-full p-2 text-xs bg-white rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    3. Observaciones Adicionales (Puede esperar):
                  </label>
                  <textarea
                    rows={2}
                    value={observacionesGenerales}
                    onChange={(e) => setObservacionesGenerales(e.target.value)}
                    placeholder="Un item por línea: ej.&#10;Detalle estético menor en moldura de escape"
                    className="w-full p-2 text-xs bg-white rounded-lg border border-slate-300 font-medium"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            {diagExistente?.actualizadoPor ? (
              <span>
                Última edición por: <strong>{diagExistente.actualizadoPor}</strong>
              </span>
            ) : (
              <span>Queda registrado en la auditoría</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={handleGuardarTodo}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {guardando ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Guardar Diagnóstico Completo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
