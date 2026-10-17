import React, { useState } from 'react';
import { AuditoriaEvento } from '../../types';
import { Shield, Search, Download, Clock, User, CheckCircle2, Lock } from 'lucide-react';

interface AuditoriaViewProps {
  eventos: AuditoriaEvento[];
}

export const AuditoriaView: React.FC<AuditoriaViewProps> = ({ eventos }) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<string>('todos');

  const formatearFecha = (ev: AuditoriaEvento) => {
    if (ev.fecha?.toDate) {
      const d = ev.fecha.toDate();
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return ev.fechaLocalStr || 'Reciente';
  };

  const eventosFiltrados = eventos.filter((ev) => {
    const term = busqueda.toLowerCase().trim();
    const usuarioStr = `${ev.usuarioNombre} ${ev.usuarioEmail}`.toLowerCase();
    const antesStr = ev.antes ? JSON.stringify(ev.antes).toLowerCase() : '';
    const despuesStr = ev.despues ? JSON.stringify(ev.despues).toLowerCase() : '';

    const coincideTermino =
      !term ||
      usuarioStr.includes(term) ||
      ev.entidadId.toLowerCase().includes(term) ||
      ev.accion.toLowerCase().includes(term) ||
      ev.modulo.toLowerCase().includes(term) ||
      antesStr.includes(term) ||
      despuesStr.includes(term);

    if (!coincideTermino) return false;
    if (filtroModulo !== 'todos' && ev.modulo !== filtroModulo) return false;

    return true;
  });

  const exportarExcel = () => {
    const encabezados = ['ID', 'FechaHora', 'UsuarioEmail', 'UsuarioNombre', 'Modulo', 'Accion', 'Entidad', 'EntidadID', 'Antes', 'Despues'];
    const filas = eventosFiltrados.map((ev) => [
      ev.id,
      `"${formatearFecha(ev)}"`,
      `"${ev.usuarioEmail}"`,
      `"${ev.usuarioNombre}"`,
      `"${ev.modulo}"`,
      `"${ev.accion}"`,
      `"${ev.entidad}"`,
      `"${ev.entidadId}"`,
      `"${(ev.antes ? JSON.stringify(ev.antes) : '').replace(/"/g, '""')}"`,
      `"${(ev.despues ? JSON.stringify(ev.despues) : '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [encabezados.join(';'), ...filas.map((f) => f.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_taller_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner de inmutabilidad normativa */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Bitácora Inmutable en Firestore (/auditoria)</h2>
                <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded uppercase">
                  Reglas: Solo Create
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Módulo 9 · Cada alta, modificación o desactivación se escribe en el mismo lote atómico (writeBatch) con validación estricta de UID de Google y fecha del servidor. Modificar o borrar registros de auditoría está absolutamente prohibido para todos.
              </p>
            </div>
          </div>

          <button
            onClick={exportarExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer self-start sm:self-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por correo, dueño, entidad, acción o datos modificados..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            <option value="todos">Todos los Módulos ({eventos.length})</option>
            <option value="Clientes">Clientes</option>
            <option value="Vehículos">Vehículos</option>
            <option value="Seguridad">Seguridad / Acceso</option>
            <option value="Configuración">Configuración</option>
          </select>
        </div>

      </div>

      {/* Lista de Eventos de Auditoría */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {eventosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            {eventos.length === 0
              ? 'Aún no hay registros de auditoría en Firestore. Realiza tu primer alta de cliente o vehículo para generar el primer evento atómico.'
              : 'No se encontraron eventos de auditoría con los filtros seleccionados.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {eventosFiltrados.map((ev) => {
              const fechaStr = formatearFecha(ev);
              return (
                <div key={ev.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-500 font-medium">{fechaStr}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-900">{ev.usuarioNombre}</span>
                      <span className="font-mono text-slate-500 text-[11px]">({ev.usuarioEmail})</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                        {ev.modulo}
                      </span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        ev.accion === 'Creación'
                          ? 'bg-emerald-50 text-emerald-700'
                          : ev.accion === 'Desactivación'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ev.accion}
                      </span>
                    </div>

                    <span className="font-mono text-[11px] text-slate-400">
                      Doc: {ev.entidad}/{ev.entidadId}
                    </span>
                  </div>

                  {/* Comparación Antes / Después en bloque de código visual */}
                  {(ev.antes || ev.despues) && (
                    <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                      {ev.antes ? (
                        <div className="bg-red-50/70 text-red-950 p-2.5 rounded-lg border border-red-100">
                          <span className="font-bold block text-[10px] text-red-700 uppercase tracking-wider mb-1">
                            Estado Anterior:
                          </span>
                          <pre className="whitespace-pre-wrap break-all text-[11px]">
                            {JSON.stringify(ev.antes, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="bg-slate-50 text-slate-500 p-2.5 rounded-lg border border-slate-100 text-[11px] italic flex items-center">
                          (Registro nuevo sin estado previo)
                        </div>
                      )}

                      {ev.despues && (
                        <div className="bg-emerald-50/70 text-emerald-950 p-2.5 rounded-lg border border-emerald-100">
                          <span className="font-bold block text-[10px] text-emerald-700 uppercase tracking-wider mb-1">
                            Nuevo Estado:
                          </span>
                          <pre className="whitespace-pre-wrap break-all text-[11px]">
                            {JSON.stringify(ev.despues, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
