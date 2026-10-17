import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cliente, OrdenServicio, Vehiculo } from '../../types';
import { ResultadoBusqueda, buscarGlobal } from '../../lib/historial';
import { Car, ClipboardList, Search, User, X } from 'lucide-react';

interface Props {
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  ordenes: OrdenServicio[];
  onElegir: (r: ResultadoBusqueda) => void;
}

const ICONO = { vehiculo: Car, cliente: User, orden: ClipboardList };
const ETIQUETA = { vehiculo: 'Vehículo', cliente: 'Cliente', orden: 'Orden' };

/** Búsqueda global: placa, VIN, nombre, teléfono, folio o CI. Tolera un error de tipeo en placas, teléfonos y folios. */
export const BusquedaGlobal: React.FC<Props> = ({ clientes, vehiculos, ordenes, onElegir }) => {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => buscarGlobal(texto, { clientes, vehiculos, ordenes }), [texto, clientes, vehiculos, ordenes]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const elegir = (r: ResultadoBusqueda) => {
    onElegir(r);
    setAbierto(false);
    setTexto('');
  };

  return (
    <div ref={caja} className="relative w-full">
      <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 focus-within:ring-2 focus-within:ring-amber-400">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(0);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActivo((a) => Math.min(a + 1, resultados.length - 1));
            else if (e.key === 'ArrowUp') setActivo((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && resultados[activo]) elegir(resultados[activo]);
            else if (e.key === 'Escape') setAbierto(false);
          }}
          placeholder="Buscar placa, VIN, cliente, teléfono, CI o folio…"
          className="flex-1 min-w-0 py-2.5 text-sm bg-transparent outline-none"
          aria-label="Búsqueda global"
        />
        {texto && (
          <button onClick={() => setTexto('')} className="p-1 text-slate-400" aria-label="Limpiar">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {abierto && texto.trim().length >= 2 && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[60vh] overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Sin resultados.</p>
          ) : (
            resultados.map((r, i) => {
              const Icono = ICONO[r.tipo];
              return (
                <button
                  key={`${r.tipo}-${r.id}`}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(r)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 ${i === activo ? 'bg-amber-50' : ''}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icono className="w-4 h-4 text-slate-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 truncate">{r.titulo}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {ETIQUETA[r.tipo]} · {r.detalle}
                      {r.puntaje >= 1 ? ' · coincidencia aproximada' : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
