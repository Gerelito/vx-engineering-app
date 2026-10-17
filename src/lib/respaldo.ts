/**
 * Módulo 10: respaldo manual (el plan gratuito no tiene copias automáticas).
 * - Respaldo completo en .json (sin fotos ni archivos escaneados).
 * - Fotos por rango de fechas en .zip.
 * - Restaurar desde un .json solo en un proyecto vacío. Cada documento restaurado lleva su propia auditoría
 *   (las reglas lo exigen); los registros de auditoría originales se vuelven a registrar como "Auditoría restaurada".
 */
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,

  writeBatch,
  WriteBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { datosAuditoria, limpiarUndefined } from './storage';
import { sincronizarVerificacion } from './verificacion';
import { DuenoUsuario, OrdenServicio } from '../types';

export const VERSION_RESPALDO = 1;
const COLECCIONES = ['clientes', 'vehiculos', 'ordenes', 'pagos', 'contactos', 'cajas', 'plantillas', 'contadores', 'auditoria'] as const;

// ---------------------------------------------------------------------------
// Conversión de fechas de Firestore a JSON y de vuelta
// ---------------------------------------------------------------------------
function aJson(v: any): any {
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (Array.isArray(v)) return v.map(aJson);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) o[k] = aJson(x);
    return o;
  }
  return v;
}

function deJson(v: any): any {
  if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__ts === 'number') return Timestamp.fromMillis(v.__ts);
  if (Array.isArray(v)) return v.map(deJson);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const [k, x] of Object.entries(v)) o[k] = deJson(x);
    return o;
  }
  return v;
}

function nombre(d: DuenoUsuario) {
  return d.displayName || d.email;
}

function usuario(d: DuenoUsuario) {
  return { usuarioUid: d.uid, usuarioEmail: d.email.toLowerCase(), usuarioNombre: nombre(d) };
}

// ---------------------------------------------------------------------------
// Respaldo completo (.json)
// ---------------------------------------------------------------------------
export interface ArchivoRespaldo {
  app: 'vx-engineering';
  version: number;
  fecha: string;
  generadoPor: string;
  colecciones: Record<string, { id: string; datos: any }[]>;
  cotizaciones: { ordenId: string; id: string; datos: any }[];
  config: Record<string, any>;
}

export async function generarRespaldo(dueno: DuenoUsuario, progreso?: (t: string) => void): Promise<{ blob: Blob; nombre: string; resumen: Record<string, number> }> {
  const colecciones: ArchivoRespaldo['colecciones'] = {};
  const resumen: Record<string, number> = {};
  for (const c of COLECCIONES) {
    progreso?.(`Leyendo ${c}…`);
    const s = await getDocs(collection(db, c));
    colecciones[c] = s.docs.map((d) => ({ id: d.id, datos: aJson(d.data()) }));
    resumen[c] = s.size;
  }
  progreso?.('Leyendo cotizaciones…');
  const cotizaciones: ArchivoRespaldo['cotizaciones'] = [];
  for (const o of colecciones.ordenes || []) {
    const s = await getDocs(collection(db, 'ordenes', o.id, 'cotizaciones'));
    s.docs.forEach((d) => cotizaciones.push({ ordenId: o.id, id: d.id, datos: aJson(d.data()) }));
  }
  resumen.cotizaciones = cotizaciones.length;
  const config: Record<string, any> = {};
  for (const id of ['taller', 'acceso']) {
    const s = await getDoc(doc(db, 'config', id));
    if (s.exists()) config[id] = aJson(s.data());
  }
  const fecha = new Date().toISOString();
  const archivo: ArchivoRespaldo = { app: 'vx-engineering', version: VERSION_RESPALDO, fecha, generadoPor: dueno.email, colecciones, cotizaciones, config };
  const blob = new Blob([JSON.stringify(archivo)], { type: 'application/json' });
  const dia = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);

  // Dejar constancia (y la fecha del último respaldo para el aviso de 7 días)
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'auditoria'));
  batch.set(
    auditRef,
    limpiarUndefined(
      datosAuditoria({
        modulo: 'Configuración',
        accion: 'Respaldo completo descargado',
        entidad: 'configuracion',
        entidadId: 'respaldo',
        antes: null,
        despues: { fecha, ...resumen },
        ...usuario(dueno),
        fecha: serverTimestamp(),
      })
    )
  );
  batch.set(doc(db, 'config', 'respaldo'), { ultimoRespaldo: fecha, ultimoRespaldoPor: dueno.email.toLowerCase(), resumen, auditoriaId: auditRef.id });
  await batch.commit();

  return { blob, nombre: `respaldo-vx-engineering-${dia}.json`, resumen };
}

// ---------------------------------------------------------------------------
// Fotos por rango de fechas (.zip)
// ---------------------------------------------------------------------------
export async function generarZipFotos(
  ordenes: OrdenServicio[],
  desde: string,
  hasta: string,
  progreso?: (t: string) => void
): Promise<{ blob: Blob; nombre: string; cantidad: number }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const ini = Date.parse(`${desde}T00:00:00-04:00`);
  const fin = Date.parse(`${hasta}T23:59:59-04:00`);
  const elegidas = ordenes.filter((o) => {
    const t = (o.createdAt as any)?.toMillis?.() ?? Date.parse(o.historialEstados?.[0]?.fecha || '');
    return !isNaN(t) && t >= ini && t <= fin;
  });
  let cantidad = 0;
  for (const [i, o] of elegidas.entries()) {
    progreso?.(`Fotos de ${o.folio} (${i + 1}/${elegidas.length})…`);
    const s = await getDocs(collection(db, 'ordenes', o.id, 'fotos'));
    const carpeta = zip.folder(`${o.folio}_${o.vehiculoPlaca}`.replace(/[^\w.-]+/g, '_'))!;
    s.docs.forEach((d, j) => {
      const f = d.data() as any;
      const m = /^data:image\/(\w+);base64,(.*)$/.exec(f.base64Data || '');
      if (!m) return;
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const titulo = String(f.titulo || f.tipo || 'foto').replace(/[^\wáéíóúñÁÉÍÓÚÑ -]+/g, '').trim().replace(/\s+/g, '_');
      carpeta.file(`${String(j + 1).padStart(2, '0')}_${titulo}${f.reemplazada ? '_REEMPLAZADA' : ''}.${ext}`, m[2], { base64: true });
      cantidad++;
    });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, nombre: `fotos-vx-engineering-${desde}_a_${hasta}.zip`, cantidad };
}

// ---------------------------------------------------------------------------
// Restaurar (solo proyecto vacío)
// ---------------------------------------------------------------------------
export async function proyectoVacio(): Promise<boolean> {
  for (const c of ['clientes', 'vehiculos', 'ordenes', 'pagos']) {
    const s = await getDocs(query(collection(db, c), limit(1)));
    if (!s.empty) return false;
  }
  return true;
}

export function leerArchivoRespaldo(texto: string): ArchivoRespaldo {
  const a = JSON.parse(texto);
  if (a?.app !== 'vx-engineering' || !a.colecciones) throw new Error('El archivo no es un respaldo de esta app.');
  if (a.version > VERSION_RESPALDO) throw new Error('El respaldo es de una versión más nueva de la app.');
  return a as ArchivoRespaldo;
}

const ENTIDAD: Record<string, string> = {
  clientes: 'clientes',
  vehiculos: 'vehiculos',
  ordenes: 'ordenes',
  pagos: 'pagos',
  contactos: 'contactos',
  cajas: 'cajas',
  plantillas: 'plantillas',
  cotizaciones: 'cotizaciones',
};

/** Restaura en lotes; devuelve cuántos documentos escribió por colección. */
export async function restaurarRespaldo(a: ArchivoRespaldo, dueno: DuenoUsuario, progreso: (t: string) => void): Promise<Record<string, number>> {
  if (!(await proyectoVacio())) throw new Error('La base de datos ya tiene datos. Solo se puede restaurar en un proyecto vacío.');
  const hechos: Record<string, number> = {};
  let batch: WriteBatch = writeBatch(db);
  let ops = 0;
  const vaciar = async () => {
    if (ops) await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };
  const auditar = (entidad: string, entidadId: string, despues: any, accion = 'Restauración desde respaldo') => {
    const ref = doc(collection(db, 'auditoria'));
    batch.set(
      ref,
      limpiarUndefined(
        datosAuditoria(
          {
            modulo: 'Configuración',
            accion,
            entidad,
            entidadId,
            antes: null,
            despues,
            ...usuario(dueno),
            fecha: serverTimestamp(),
          },
          true
        )
      )
    );
    ops++;
    return ref.id;
  };

  // 1) Configuración del taller
  if (a.config?.taller) {
    const id = auditar('configuracion', 'taller', { respaldo: a.fecha });
    batch.set(doc(db, 'config', 'taller'), { ...deJson(a.config.taller), auditoriaId: id });
    ops++;
  }
  await vaciar();

  // 2) Colecciones en orden (los pagos antes que los cierres de caja)
  const orden = ['clientes', 'vehiculos', 'plantillas', 'ordenes', 'pagos', 'contactos', 'cajas'];
  for (const c of orden) {
    const lista = a.colecciones[c] || [];
    hechos[c] = 0;
    for (const [i, item] of lista.entries()) {
      if (ops >= 100) {
        progreso(`Restaurando ${c} (${i}/${lista.length})…`);
        await vaciar();
      }
      const datos = deJson(item.datos);
      const id = auditar(ENTIDAD[c], item.id, { respaldo: a.fecha, coleccion: c });
      if (c === 'pagos') {
        // Las reglas exigen que el pago lo registre quien escribe: se guarda el autor original aparte.
        datos.registradoOriginalUid = datos.registradoPorUid || null;
        datos.registradoPorUid = dueno.uid;
      }
      batch.set(doc(db, c, item.id), { ...datos, auditoriaId: id });
      ops++;
      if (c === 'ordenes' && datos.codigoVerificacion) {
        sincronizarVerificacion(batch, datos as OrdenServicio, datos.estado, id);
        ops++;
      }
      hechos[c]++;
    }
    await vaciar();
  }

  // 3) Cotizaciones
  hechos.cotizaciones = 0;
  for (const [i, c] of (a.cotizaciones || []).entries()) {
    if (ops >= 100) {
      progreso(`Restaurando cotizaciones (${i}/${a.cotizaciones.length})…`);
      await vaciar();
    }
    const id = auditar('cotizaciones', c.id, { respaldo: a.fecha, ordenId: c.ordenId });
    batch.set(doc(db, 'ordenes', c.ordenId, 'cotizaciones', c.id), { ...deJson(c.datos), auditoriaId: id });
    ops++;
    hechos.cotizaciones++;
  }
  await vaciar();

  // 4) Historial de auditoría original: se vuelve a registrar (las reglas no permiten fechas ni autores ajenos)
  hechos.auditoria = 0;
  for (const [i, ev] of (a.colecciones.auditoria || []).entries()) {
    if (ops >= 150) {
      progreso(`Restaurando historial de auditoría (${i}/${a.colecciones.auditoria.length})…`);
      await vaciar();
    }
    const d = ev.datos || {};
    auditar(String(d.entidad || 'configuracion'), String(d.entidadId || ev.id), {
      idOriginal: ev.id,
      fechaOriginal: d.fecha?.__ts ? new Date(d.fecha.__ts).toISOString() : null,
      modulo: d.modulo || null,
      accion: d.accion || null,
      usuario: d.usuarioEmail || null,
      sensible: !!d.sensible,
      antes: d.antes ?? null,
      despues: d.despues ?? null,
    }, 'Auditoría restaurada');
    hechos.auditoria++;
  }
  await vaciar();

  // 5) Contador de folios: solo puede subir de 1 en 1 (regla), así que se avanza hasta el último folio
  const ultimo = Math.max(0, ...((a.colecciones.contadores || []).map((x) => Number(x.datos?.ultimo || 0))));
  const ref = doc(db, 'contadores', 'ordenes');
  let actual = (await getDoc(ref)).data()?.ultimo || 0;
  while (actual < ultimo) {
    if (actual % 10 === 0) progreso(`Ajustando contador de folios (${actual}/${ultimo})…`);
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      const ant = s.exists() ? s.data().ultimo || 0 : 0;
      const auditRef = doc(collection(db, 'auditoria'));
      tx.set(
        auditRef,
        limpiarUndefined(
          datosAuditoria({
            modulo: 'Configuración',
            accion: 'Contador ajustado por restauración',
            entidad: 'contadores',
            entidadId: 'ordenes',
            antes: { ultimo: ant },
            despues: { ultimo: ant + 1 },
            ...usuario(dueno),
            fecha: serverTimestamp(),
          })
        )
      );
      if (s.exists()) tx.update(ref, { ultimo: ant + 1, auditoriaId: auditRef.id });
      else tx.set(ref, { ultimo: 1, auditoriaId: auditRef.id });
      actual = ant + 1;
    });
  }
  hechos.contadorFolios = actual;
  progreso('Restauración terminada.');
  return hechos;
}

/** Último respaldo registrado (para el aviso de 7 días). */
export async function leerUltimoRespaldo(): Promise<string | null> {
  const s = await getDoc(doc(db, 'config', 'respaldo'));
  return s.exists() ? (s.data().ultimoRespaldo as string) || null : null;
}

