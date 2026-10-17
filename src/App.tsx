import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ClientesList } from './components/modulo1/ClientesList';
import { VehiculosList } from './components/modulo1/VehiculosList';
import { AuditoriaView } from './components/modulo1/AuditoriaView';
import { ClienteModal } from './components/modulo1/ClienteModal';
import { VehiculoModal } from './components/modulo1/VehiculoModal';
import { CambioPropietarioModal } from './components/modulo1/CambioPropietarioModal';
import { ConsentimientoModal } from './components/modulo1/ConsentimientoModal';
import { ConfiguracionModal } from './components/ConfiguracionModal';
import { LoginModal } from './components/LoginModal';
import { AppDialog, DialogOptions } from './components/AppDialog';

// Módulo 2: Recepción y Órdenes de Servicio
import { OrdenesList } from './components/modulo2/OrdenesList';
import { RecepcionWizardModal } from './components/modulo2/RecepcionWizardModal';
import { DetalleOrdenModal } from './components/modulo2/DetalleOrdenModal';
import { OrdenImprimibleModal } from './components/modulo2/OrdenImprimibleModal';
import { SubirFirmaModal } from './components/modulo2/SubirFirmaModal';

// Módulo 3: Taller, Bahías, Kanban, Cronómetro y Diagnóstico Técnico
import { TableroKanban } from './components/modulo3/TableroKanban';
import { TransicionEstadoModal } from './components/modulo3/TransicionEstadoModal';
import { TareasCronometroModal } from './components/modulo3/TareasCronometroModal';
import { DiagnosticoTecnicoModal } from './components/modulo3/DiagnosticoTecnicoModal';
import { DiagnosticoImprimibleModal } from './components/modulo3/DiagnosticoImprimibleModal';
import { TrabajoAdicionalModal } from './components/modulo3/TrabajoAdicionalModal';

// Módulo 4: Cotizaciones, Aprobaciones y Plantillas
import { CotizacionEditorModal } from './components/modulo4/CotizacionEditorModal';
import { AprobacionClienteModal } from './components/modulo4/AprobacionClienteModal';
import { CotizacionImprimibleModal } from './components/modulo4/CotizacionImprimibleModal';

import {
  guardarClienteFirestore,
  desactivarClienteFirestore,
  guardarConsentimientoConArchivo,
  guardarVehiculoFirestore,
  cambiarPropietarioFirestore,
  desactivarVehiculoFirestore,
  crearOrdenRecepcionFirestore,
  subirFirmaOrdenFirestore,
  actualizarEstadoOrdenFirestore,
  sincronizarOrdenesPendientes,
  DEFAULT_CONFIG,
  formatearTelefonoBolivia,
  obtenerTelefonoE164,
  asignarBahiaYResponsableFirestore,
  registrarAprobacionClienteFirestore,
  guardarTareaOrdenFirestore,
  cronometroTareaFirestore,
  guardarDiagnosticoTecnicoFirestore,
  subirFotoDiagnosticoFirestore,
  registrarTrabajoAdicionalFirestore,
  obtenerCotizacionesOrdenFirestore,
  aMilisegundos,
} from './lib/storage';
import {
  Cliente,
  Vehiculo,
  AuditoriaEvento,
  TallerConfig,
  OrdenServicio,
  EstadoOrden,
  DiagnosticoTecnico,
  TareaOrden,
  AprobacionCliente,
  CotizacionOrden,
} from './types';
import { db } from './lib/firebase';
import { CajaView } from './components/modulo5/CajaView';
import { PagosOrdenModal } from './components/modulo5/PagosOrdenModal';
import { collection, doc, onSnapshot, onSnapshotsInSync } from 'firebase/firestore';
import { CheckCircle2, ShieldCheck, AlertCircle, X, Loader2, ClipboardList, Wrench } from 'lucide-react';

function TallerAppContent() {
  const { usuarioActual, esDuenoAutorizado, cargandoAuth } = useAuth();

  // Estados de datos en tiempo real desde Firestore (ÚNICA fuente de verdad)
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]);
  const [auditoriaEventos, setAuditoriaEventos] = useState<AuditoriaEvento[]>([]);
  const [config, setConfig] = useState<TallerConfig>(DEFAULT_CONFIG);

  // Estados de navegación
  const [vistaActiva, setVistaActiva] = useState<'recepciones' | 'taller' | 'caja' | 'clientes' | 'vehiculos' | 'auditoria'>('taller');

  // Estado del indicador de nube (verde = sincronizado; amarillo = pendiente offline; rojo = error de permisos; rosa = error al guardar)
  const [estadoNube, setEstadoNube] = useState<'sincronizado' | 'pendiente_offline' | 'error_permisos' | 'error_guardar'>('sincronizado');

  // Referencia mutable para verificar escrituras pendientes en listeners de Firestore
  const pendingWritesRef = useRef({
    clientes: false,
    vehiculos: false,
    ordenes: false,
    auditoria: false,
  });

  // Diálogo modal reutilizable para confirmaciones y alertas (sustituye alert y confirm)
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  // Modales operativos de Clientes y Vehículos (Módulo 1)
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [clienteEditar, setClienteEditar] = useState<Cliente | null>(null);

  const [modalVehiculoAbierto, setModalVehiculoAbierto] = useState(false);
  const [vehiculoEditar, setVehiculoEditar] = useState<Vehiculo | null>(null);
  const [clientePreseleccionadoId, setClientePreseleccionadoId] = useState<string | undefined>(undefined);

  const [modalCambioPropAbierto, setModalCambioPropAbierto] = useState(false);
  const [vehiculoParaCambio, setVehiculoParaCambio] = useState<Vehiculo | null>(null);

  const [modalConsentimientoAbierto, setModalConsentimientoAbierto] = useState(false);
  const [clienteConsentimiento, setClienteConsentimiento] = useState<Cliente | null>(null);

  const [modalConfiguracionAbierto, setModalConfiguracionAbierto] = useState(false);

  // Modales operativos de Recepción y Órdenes (Módulo 2)
  const [modalRecepcionAbierto, setModalRecepcionAbierto] = useState(false);
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenServicio | null>(null);
  const [ordenImprimir, setOrdenImprimir] = useState<OrdenServicio | null>(null);
  const [ordenSubirFirma, setOrdenSubirFirma] = useState<OrdenServicio | null>(null);
  const [sincronizandoFolios, setSincronizandoFolios] = useState(false);

  // Modales operativos de Taller (Módulo 3)
  const [ordenParaTransicion, setOrdenParaTransicion] = useState<OrdenServicio | null>(null);
  const [transicionObjetivo, setTransicionObjetivo] = useState<EstadoOrden | null>(null);
  const [ordenParaTareas, setOrdenParaTareas] = useState<OrdenServicio | null>(null);
  const [ordenParaDiagnostico, setOrdenParaDiagnostico] = useState<OrdenServicio | null>(null);
  const [ordenDiagnosticoImprimir, setOrdenDiagnosticoImprimir] = useState<OrdenServicio | null>(null);
  const [ordenParaTrabajoAdicional, setOrdenParaTrabajoAdicional] = useState<OrdenServicio | null>(null);

  // Modales operativos de Cotizaciones y Aprobaciones (Módulo 4)
  const [ordenParaCotizacion, setOrdenParaCotizacion] = useState<OrdenServicio | null>(null);
  const [ordenParaAprobacion, setOrdenParaAprobacion] = useState<OrdenServicio | null>(null);
  const [cotizacionParaAprobacion, setCotizacionParaAprobacion] = useState<CotizacionOrden | null>(null);
  const [cotizacionParaImprimir, setCotizacionParaImprimir] = useState<CotizacionOrden | null>(null);

  // Módulo 5: Caja y pagos (se guarda el id para mostrar siempre la orden actualizada en vivo)
  const [ordenPagosId, setOrdenPagosId] = useState<string | null>(null);

  // Preselección para asistente de recepción (Módulo 2 revisión 1)
  const [recepcionClienteId, setRecepcionClienteId] = useState<string | undefined>(undefined);
  const [recepcionVehiculoId, setRecepcionVehiculoId] = useState<string | undefined>(undefined);

  // Notificación de éxito flotante
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'info' } | null>(null);

  // Notificación visible de error con motivo explícito
  const [errorVisible, setErrorVisible] = useState<string | null>(null);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'info' = 'exito') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 4500);
  };

  const manejarErrorFirestore = (err: any, prefijo: string = 'operación') => {
    const errMsg = err?.message || String(err);
    const esPermiso =
      err?.code === 'permission-denied' ||
      errMsg.toLowerCase().includes('permission-denied') ||
      errMsg.toLowerCase().includes('insufficient permissions');

    if (esPermiso) {
      setEstadoNube('error_permisos');
      setErrorVisible(`Error de permisos en Firestore (${prefijo}): ${errMsg}`);
    } else {
      setEstadoNube('error_guardar');
      setErrorVisible(`Error al guardar (${prefijo}): ${errMsg}`);
    }
  };

  // Función reactiva para sincronizar estado de nube
  // Verde ('sincronizado') si navigator.onLine y no hay hasPendingWrites
  const actualizarEstadoNube = () => {
    const tienePendientes = Object.values(pendingWritesRef.current).some(Boolean);
    if (!navigator.onLine) {
      setEstadoNube('pendiente_offline');
    } else if (tienePendientes) {
      setEstadoNube('pendiente_offline');
    } else {
      setEstadoNube('sincronizado');
    }
  };

  // Escuchar estado de red del navegador y sincronizaciones pendientes
  useEffect(() => {
    const handleOnline = () => {
      actualizarEstadoNube();
      // Si hay folios provisionales pendientes al volver la red, intentar sincronizarlos
      if (usuarioActual) {
        const pendientes = ordenes.filter((o) => o.sincronizacionFolio === 'pendiente');
        if (pendientes.length > 0) {
          sincronizarOrdenesPendientes(pendientes, usuarioActual).then((c) => {
            if (c > 0) {
              mostrarNotificacion(`Red recuperada: ${c} órdenes provisionales recibieron folio oficial.`);
            }
          }).catch(console.warn);
        }
      }
    };

    const handleOffline = () => {
      setEstadoNube('pendiente_offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    actualizarEstadoNube();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [usuarioActual, ordenes]);

  // Suscripciones en tiempo real con Firestore solo cuando el dueño está autenticado y autorizado
  useEffect(() => {
    if (!usuarioActual || !esDuenoAutorizado) {
      setClientes([]);
      setVehiculos([]);
      setOrdenes([]);
      setAuditoriaEventos([]);
      return;
    }

    // Listener global de Firestore: onSnapshotsInSync
    // Pasa inmediatamente a verde ('sincronizado') cuando se han aplicado y confirmado todas las escrituras
    const unsubSync = onSnapshotsInSync(db, () => {
      actualizarEstadoNube();
    });

    // 1. Clientes en tiempo real (Requisito 3: calcula formato 7000-0001 y telefonoE164 al cargar para registros antiguos)
    const unsubClientes = onSnapshot(
      collection(db, 'clientes'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const lista: Cliente[] = snapshot.docs.map((d) => {
          const c = d.data() as Cliente;
          return {
            ...c,
            telefono: formatearTelefonoBolivia(c.telefono),
            telefonoE164: c.telefonoE164 || obtenerTelefonoE164(c.telefono),
          };
        });
        setClientes(lista);
        pendingWritesRef.current.clientes = snapshot.metadata.hasPendingWrites;
        actualizarEstadoNube();
      },
      (err) => {
        console.error('Error de lectura en /clientes:', err);
        manejarErrorFirestore(err, 'lectura /clientes');
      }
    );

    // 2. Vehículos en tiempo real
    const unsubVehiculos = onSnapshot(
      collection(db, 'vehiculos'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const lista: Vehiculo[] = snapshot.docs.map((d) => d.data() as Vehiculo);
        setVehiculos(lista);
        pendingWritesRef.current.vehiculos = snapshot.metadata.hasPendingWrites;
        actualizarEstadoNube();
      },
      (err) => {
        console.error('Error de lectura en /vehiculos:', err);
        manejarErrorFirestore(err, 'lectura /vehiculos');
      }
    );

    // 3. Órdenes de servicio en tiempo real (Módulo 2)
    const unsubOrdenes = onSnapshot(
      collection(db, 'ordenes'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const lista: OrdenServicio[] = snapshot.docs.map((d) => d.data() as OrdenServicio);
        // Ordenar por fecha descendente
        lista.sort((a, b) => {
          const tA = aMilisegundos(a.createdAt) ?? Date.now();
          const tB = aMilisegundos(b.createdAt) ?? Date.now();
          return tB - tA;
        });
        setOrdenes(lista);
        pendingWritesRef.current.ordenes = snapshot.metadata.hasPendingWrites;
        actualizarEstadoNube();
      },
      (err) => {
        console.error('Error de lectura en /ordenes:', err);
        manejarErrorFirestore(err, 'lectura /ordenes');
      }
    );

    // 4. Auditoría en tiempo real
    const unsubAuditoria = onSnapshot(
      collection(db, 'auditoria'),
      { includeMetadataChanges: true },
      (snapshot) => {
        const lista: AuditoriaEvento[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            modulo: data.modulo || 'General',
            accion: data.accion || 'Registro',
            entidad: data.entidad || 'clientes',
            entidadId: data.entidadId || d.id,
            antes: data.antes || null,
            despues: data.despues || null,
            usuarioUid: data.usuarioUid || '',
            usuarioEmail: data.usuarioEmail || '',
            usuarioNombre: data.usuarioNombre || '',
            fecha: data.fecha,
          };
        });

        // Ordenar por fecha descendente
        lista.sort((a, b) => {
          const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
          const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
          return timeB - timeA;
        });

        setAuditoriaEventos(lista);
        pendingWritesRef.current.auditoria = snapshot.metadata.hasPendingWrites;
        actualizarEstadoNube();
      },
      (err) => {
        console.error('Error de lectura en /auditoria:', err);
        manejarErrorFirestore(err, 'lectura /auditoria');
      }
    );

    // 5. Configuración del taller (/config/taller)
    const unsubConfig = onSnapshot(
      doc(db, 'config', 'taller'),
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig(snapshot.data() as TallerConfig);
        }
      },
      (err) => {
        console.warn('Aviso: configuración de taller aún no inicializada o pendiente:', err.message);
      }
    );

    return () => {
      unsubSync();
      unsubClientes();
      unsubVehiculos();
      unsubOrdenes();
      unsubAuditoria();
      unsubConfig();
    };
  }, [usuarioActual, esDuenoAutorizado]);

  // Handlers para Clientes
  const handleGuardarCliente = async (
    clienteData: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'activo'>,
    idExistente?: string
  ) => {
    if (!usuarioActual) return;
    try {
      const clienteExistente = idExistente ? clientes.find((c) => c.id === idExistente) : undefined;
      const res = await guardarClienteFirestore(clienteData, usuarioActual, clienteExistente);
      if (modalRecepcionAbierto) {
        setRecepcionClienteId(res.id);
      }
      mostrarNotificacion(
        idExistente ? `Ficha de ${res.nombre} actualizada en Firestore` : `Cliente ${res.nombre} registrado en Firestore con auditoría atómica`
      );
    } catch (err: any) {
      manejarErrorFirestore(err, idExistente ? 'actualizar cliente' : 'guardar cliente');
    }
  };

  const handleDesactivarCliente = (cliente: Cliente) => {
    if (!usuarioActual) return;
    setDialog({
      tipo: 'advertencia',
      titulo: 'Desactivar cliente',
      mensaje: `¿Deseas desactivar al cliente "${cliente.nombre}"?\n\nPor normativa de auditoría del taller, los clientes no se eliminan físicamente; su estado se marca como inactivo conservando su historial.`,
      textoConfirmar: 'Sí, desactivar',
      textoCancelar: 'Cancelar',
      esConfirmacion: true,
      onConfirmar: async () => {
        try {
          await desactivarClienteFirestore(cliente, usuarioActual);
          mostrarNotificacion(`Cliente ${cliente.nombre} marcado como desactivado`);
        } catch (err: any) {
          manejarErrorFirestore(err, 'desactivar cliente');
        }
      },
    });
  };

  const handleSubirConsentimiento = async (
    cliente: Cliente,
    archivo: {
      nombreArchivo: string;
      formato: 'jpeg' | 'png' | 'pdf';
      tamanioBytes: number;
      base64Data: string;
    }
  ) => {
    if (!usuarioActual) return;
    try {
      await guardarConsentimientoConArchivo(cliente, archivo, usuarioActual);
      mostrarNotificacion(`Consentimiento firmado registrado para ${cliente.nombre}. Marca pendiente retirada.`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'subir consentimiento');
      throw err;
    }
  };

  // Handlers para Vehículos
  const handleGuardarVehiculo = async (
    vehiculoData: Omit<Vehiculo, 'id' | 'createdAt' | 'updatedAt' | 'historialPropietarios' | 'activo'>,
    propietario: Cliente,
    idExistente?: string
  ) => {
    if (!usuarioActual) return;
    try {
      const vehiculoExistente = idExistente ? vehiculos.find((v) => v.id === idExistente) : undefined;
      const res = await guardarVehiculoFirestore(vehiculoData, propietario, usuarioActual, vehiculoExistente);
      if (modalRecepcionAbierto) {
        setRecepcionClienteId(res.propietarioActualId);
        setRecepcionVehiculoId(res.id);
      }
      mostrarNotificacion(
        idExistente ? `Vehículo ${res.placa} actualizado en Firestore` : `Vehículo ${res.placa} registrado para ${propietario.nombre}`
      );
    } catch (err: any) {
      manejarErrorFirestore(err, idExistente ? 'actualizar vehículo' : 'guardar vehículo');
    }
  };

  const handleConfirmarCambioPropietario = async (
    vehiculoId: string,
    nuevoPropietario: Cliente,
    motivo: string
  ) => {
    if (!usuarioActual) return;
    const vehiculo = vehiculos.find((v) => v.id === vehiculoId);
    if (!vehiculo) return;

    try {
      const res = await cambiarPropietarioFirestore(vehiculo, nuevoPropietario, motivo, usuarioActual);
      mostrarNotificacion(
        `Propiedad de ${res.placa} transferida a ${nuevoPropietario.nombre}. Historial archivado.`,
        'info'
      );
    } catch (err: any) {
      manejarErrorFirestore(err, 'cambiar propietario');
    }
  };

  const handleDesactivarVehiculo = (vehiculo: Vehiculo) => {
    if (!usuarioActual) return;
    setDialog({
      tipo: 'advertencia',
      titulo: 'Desactivar vehículo',
      mensaje: `¿Deseas desactivar el vehículo con placa "${vehiculo.placa}"?\n\nPor normativa de auditoría, los registros no se eliminan físicamente; se marcan como inactivos conservando su hoja de vida técnica.`,
      textoConfirmar: 'Sí, desactivar',
      textoCancelar: 'Cancelar',
      esConfirmacion: true,
      onConfirmar: async () => {
        try {
          await desactivarVehiculoFirestore(vehiculo, usuarioActual);
          mostrarNotificacion(`Vehículo ${vehiculo.placa} desactivado`);
        } catch (err: any) {
          manejarErrorFirestore(err, 'desactivar vehículo');
        }
      },
    });
  };

  // Handlers para Módulo 2: Recepción y Órdenes de Servicio
  const handleCrearOrden = async (ordenInput: any) => {
    if (!usuarioActual) return;
    try {
      const { orden, esProvisional } = await crearOrdenRecepcionFirestore(ordenInput, usuarioActual);
      setModalRecepcionAbierto(false);

      mostrarNotificacion(
        esProvisional
          ? `Recepción guardada con folio temporal ${orden.folio}. Se asignará el correlativo oficial al tener internet.`
          : `Recepción registrada exitosamente con folio oficial ${orden.folio}.`,
        'exito'
      );

      // Abrir inmediatamente la hoja imprimible para que el cliente la firme físicamente
      setOrdenImprimir(orden);
    } catch (err: any) {
      manejarErrorFirestore(err, 'crear recepción');
      throw err;
    }
  };

  const handleSubirFirma = async (
    orden: OrdenServicio,
    fotoData: { nombreArchivo: string; base64Data: string; tamanioBytes?: number }
  ) => {
    if (!usuarioActual) return;
    try {
      await subirFirmaOrdenFirestore(orden, fotoData, usuarioActual);
      setOrdenSubirFirma(null);
      mostrarNotificacion(`Hoja firmada registrada para la orden ${orden.folio}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'subir firma de orden');
      throw err;
    }
  };

  const handleCambiarEstadoOrden = async (
    orden: OrdenServicio,
    nuevoEstado: EstadoOrden
  ) => {
    if (!usuarioActual) return;
    try {
      await actualizarEstadoOrdenFirestore(orden, nuevoEstado, usuarioActual);
      mostrarNotificacion(`Estado de orden ${orden.folio} actualizado a: ${nuevoEstado}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'cambiar estado orden');
    }
  };

  const handleConfirmarTransicionEstado = async (
    orden: OrdenServicio,
    nuevoEstado: EstadoOrden,
    opciones?: {
      notas?: string;
      fechaEstimadaRepuestos?: string;
      aprobacionRegistrada?: AprobacionCliente;
    }
  ) => {
    if (!usuarioActual) return;
    try {
      if (opciones?.aprobacionRegistrada) {
        await registrarAprobacionClienteFirestore(orden, opciones.aprobacionRegistrada, usuarioActual);
      }
      await actualizarEstadoOrdenFirestore(orden, nuevoEstado, usuarioActual, {
        notas: opciones?.notas,
        fechaEstimadaRepuestos: opciones?.fechaEstimadaRepuestos,
      });
      setOrdenParaTransicion(null);
      setTransicionObjetivo(null);
      mostrarNotificacion(`Estado de orden ${orden.folio} actualizado a: ${nuevoEstado}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'transición de estado de orden');
      throw err;
    }
  };

  const handleAsignarBahiaYResponsable = async (
    orden: OrdenServicio,
    bahia: string | null,
    mecanico: string | null
  ) => {
    if (!usuarioActual) return;
    try {
      await asignarBahiaYResponsableFirestore(orden, bahia, mecanico, usuarioActual);
      mostrarNotificacion(`Asignación actualizada para orden ${orden.folio}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'asignar bahía o mecánico');
    }
  };

  const handleGuardarTarea = async (
    orden: OrdenServicio,
    tarea: Omit<TareaOrden, 'id' | 'ordenId' | 'fechaCreacion'> & { id?: string }
  ) => {
    if (!usuarioActual) return;
    try {
      await guardarTareaOrdenFirestore(orden, tarea, usuarioActual);
      mostrarNotificacion(`Tarea guardada en orden ${orden.folio}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'guardar tarea en orden');
      throw err;
    }
  };

  const handleControlCronometro = async (
    orden: OrdenServicio,
    tareaId: string,
    accion: 'iniciar' | 'pausar' | 'finalizar',
    motivoPausa?: TareaOrden['intervalos'][0]['pausaMotivo'],
    notasPausa?: string
  ) => {
    if (!usuarioActual) return;
    try {
      await cronometroTareaFirestore(orden, tareaId, accion, usuarioActual, motivoPausa, notasPausa);
      mostrarNotificacion(`Cronómetro de tarea: ${accion}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'cronómetro de tarea');
      throw err;
    }
  };

  const handleGuardarDiagnostico = async (
    orden: OrdenServicio,
    diagnostico: DiagnosticoTecnico
  ) => {
    if (!usuarioActual) return;
    try {
      await guardarDiagnosticoTecnicoFirestore(orden, diagnostico, usuarioActual);
      mostrarNotificacion(`Diagnóstico técnico de orden ${orden.folio} guardado`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'guardar diagnóstico técnico');
      throw err;
    }
  };

  const handleSubirFotoDiagnostico = async (
    orden: OrdenServicio,
    fotoData: { titulo: string; base64Data: string; tamanioBytes?: number }
  ) => {
    if (!usuarioActual) return;
    try {
      await subirFotoDiagnosticoFirestore(orden, fotoData, usuarioActual);
      mostrarNotificacion(`Foto de diagnóstico agregada a la orden ${orden.folio}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'subir foto de diagnóstico');
      throw err;
    }
  };

  const handleRegistrarTrabajoAdicional = async (
    orden: OrdenServicio,
    hallazgo: {
      descripcion: string;
      piezasServiciosRequeridos?: string | null;
      costoEstimadoBs: number;
      autorizadoPorCliente: boolean;
      fotoBase64?: string | null;
    }
  ) => {
    if (!usuarioActual) return;
    try {
      await registrarTrabajoAdicionalFirestore(orden, hallazgo, usuarioActual);
      setOrdenParaTrabajoAdicional(null);
      mostrarNotificacion(`Hallazgo adicional registrado para la orden ${orden.folio}`);
    } catch (err: any) {
      manejarErrorFirestore(err, 'registrar hallazgo adicional');
      throw err;
    }
  };

  const handleSincronizarFoliosPendientes = async () => {
    if (!usuarioActual || !navigator.onLine) return;
    const pendientes = ordenes.filter((o) => o.sincronizacionFolio === 'pendiente');
    if (pendientes.length === 0) return;

    setSincronizandoFolios(true);
    try {
      const count = await sincronizarOrdenesPendientes(pendientes, usuarioActual);
      mostrarNotificacion(
        `Se asignaron ${count} folios oficiales correlativos a las órdenes pendientes.`
      );
    } catch (err: any) {
      manejarErrorFirestore(err, 'sincronizar folios');
    } finally {
      setSincronizandoFolios(false);
    }
  };

  // Si está verificando sesión de Firebase
  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <span className="text-sm font-semibold tracking-wide">Comprobando autenticación con Google...</span>
      </div>
    );
  }

  // Si no está autenticado o no está en la lista de dueños de /config/acceso
  if (!usuarioActual || !esDuenoAutorizado) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <LoginModal isOpen={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      
      {/* Barra de Navegación con indicador de nube */}
      {/* Barra de Navegación con indicador de nube */}
      <Navbar
        vistaActiva={vistaActiva}
        onCambiarVista={setVistaActiva}
        onNuevaRecepcion={() => {
          setRecepcionClienteId(undefined);
          setRecepcionVehiculoId(undefined);
          setModalRecepcionAbierto(true);
        }}
        onNuevoCliente={() => {
          setClienteEditar(null);
          setModalClienteAbierto(true);
        }}
        onNuevoVehiculo={() => {
          setVehiculoEditar(null);
          setClientePreseleccionadoId(undefined);
          setModalVehiculoAbierto(true);
        }}
        onAbrirConfiguracion={() => setModalConfiguracionAbierto(true)}
        estadoNube={estadoNube}
        nombreTaller={config.nombre}
      />

      {/* Alerta de Error Visible en Pantalla */}
      {errorVisible && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-xs text-red-900">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorVisible}</span>
            </div>
            <button
              onClick={() => setErrorVisible(null)}
              className="text-red-600 hover:text-red-900 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Notificación Flotante de Éxito */}
      {notificacion && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Banner de Guía Informativa */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                  Módulos 1, 2, 3 & 4 Activos · {config.nombre || 'VX Engineering'}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Recepción, Tablero Kanban, Diagnóstico y Cotizaciones
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Tablero Kanban por estados · Alertas de tiempo · Diagnóstico multipunto · Cotizaciones multiversión · Aprobaciones parciales/totales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 self-end md:self-center shrink-0">
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Dueño autenticado:</span>
              <span className="font-bold text-slate-800">{usuarioActual.displayName}</span>
            </div>
          </div>
        </div>

        {/* Renderizado de la Vista Seleccionada */}
        {vistaActiva === 'recepciones' && (
          <OrdenesList
            ordenes={ordenes}
            clientes={clientes}
            vehiculos={vehiculos}
            config={config}
            onNuevaRecepcion={() => {
              setRecepcionClienteId(undefined);
              setRecepcionVehiculoId(undefined);
              setModalRecepcionAbierto(true);
            }}
            onVerDetalle={(o) => setOrdenDetalle(o)}
            onAbrirImprimir={(o) => setOrdenImprimir(o)}
            onAbrirSubirFirma={(o) => setOrdenSubirFirma(o)}
            onCambiarEstado={handleCambiarEstadoOrden}
            onAbrirCotizacion={(o) => setOrdenParaCotizacion(o)}
            onSincronizarFolios={handleSincronizarFoliosPendientes}
            sincronizandoFolios={sincronizandoFolios}
          />
        )}

        {vistaActiva === 'taller' && (
          <TableroKanban
            ordenes={ordenes}
            config={config}
            onAbrirTransicionEstado={(ord, nuevoEst) => {
              setOrdenParaTransicion(ord);
              setTransicionObjetivo(nuevoEst || null);
            }}
            onAbrirDiagnostico={(ord) => setOrdenParaDiagnostico(ord)}
            onAbrirTareas={(ord) => setOrdenParaTareas(ord)}
            onAbrirTrabajoAdicional={(ord) => setOrdenParaTrabajoAdicional(ord)}
            onAbrirCotizacion={(ord) => setOrdenParaCotizacion(ord)}
            onAbrirAprobacion={async (ord) => {
              try {
                const cots = await obtenerCotizacionesOrdenFirestore(ord.id);
                if (cots.length === 0) {
                  mostrarNotificacion(
                    `La orden ${ord.folio} aún no tiene cotizaciones guardadas. Crea una primero en el editor.`,
                    'info'
                  );
                  setOrdenParaCotizacion(ord);
                } else {
                  setOrdenParaAprobacion(ord);
                  setCotizacionParaAprobacion(cots[0]);
                }
              } catch (e: any) {
                manejarErrorFirestore(e, 'cargar cotización para aprobación');
              }
            }}
            onAbrirDetalle={(ord) => setOrdenDetalle(ord)}
            onAbrirPagos={(ord) => setOrdenPagosId(ord.id)}
            onNuevaRecepcion={() => {
              setRecepcionClienteId(undefined);
              setRecepcionVehiculoId(undefined);
              setModalRecepcionAbierto(true);
            }}
            onAsignarBahiaYResponsable={handleAsignarBahiaYResponsable}
          />
        )}

        {vistaActiva === 'caja' && usuarioActual && (
          <CajaView
            ordenes={ordenes}
            config={config}
            usuarioActual={usuarioActual}
            onAbrirPagos={(ord) => setOrdenPagosId(ord.id)}
            onAbrirDetalle={(ord) => setOrdenDetalle(ord)}
            onExito={(m) => mostrarNotificacion(m)}
            onError={(m) => setErrorVisible(m)}
          />
        )}

        {vistaActiva === 'clientes' && (
          <ClientesList
            clientes={clientes}
            vehiculos={vehiculos}
            onNuevoCliente={() => {
              setClienteEditar(null);
              setModalClienteAbierto(true);
            }}
            onEditarCliente={(c) => {
              setClienteEditar(c);
              setModalClienteAbierto(true);
            }}
            onNuevoVehiculoParaCliente={(c) => {
              setVehiculoEditar(null);
              setClientePreseleccionadoId(c.id);
              setModalVehiculoAbierto(true);
            }}
            onSubirConsentimiento={(c) => {
              setClienteConsentimiento(c);
              setModalConsentimientoAbierto(true);
            }}
            onDesactivarCliente={handleDesactivarCliente}
            onVerVehiculo={() => {
              setVistaActiva('vehiculos');
            }}
          />
        )}

        {vistaActiva === 'vehiculos' && (
          <VehiculosList
            vehiculos={vehiculos}
            clientes={clientes}
            onNuevoVehiculo={() => {
              setVehiculoEditar(null);
              setClientePreseleccionadoId(undefined);
              setModalVehiculoAbierto(true);
            }}
            onEditarVehiculo={(v) => {
              setVehiculoEditar(v);
              setClientePreseleccionadoId(v.propietarioActualId);
              setModalVehiculoAbierto(true);
            }}
            onCambiarPropietario={(v) => {
              setVehiculoParaCambio(v);
              setModalCambioPropAbierto(true);
            }}
            onDesactivarVehiculo={handleDesactivarVehiculo}
            onVerCliente={() => {
              setVistaActiva('clientes');
            }}
          />
        )}

        {vistaActiva === 'auditoria' && (
          <AuditoriaView eventos={auditoriaEventos} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{config.nombre || 'VX Engineering'} · Bolivia · 100% Plan Gratuito</span>
          <span>Firestore ai-studio-65e0c1e2-0a62-4c89-8659-5972c9333b3f · 3 dueños en /config/acceso</span>
        </div>
      </footer>

      {/* MODALES DEL MÓDULO 2 (ASISTENTE Y RECEPCIÓN) */}
      <RecepcionWizardModal
        isOpen={modalRecepcionAbierto}
        onClose={() => {
          setModalRecepcionAbierto(false);
          setRecepcionClienteId(undefined);
          setRecepcionVehiculoId(undefined);
        }}
        clientes={clientes}
        vehiculos={vehiculos}
        config={config}
        clienteInicialId={recepcionClienteId}
        vehiculoInicialId={recepcionVehiculoId}
        onCrearOrden={handleCrearOrden}
        onAbrirNuevoCliente={() => {
          setClienteEditar(null);
          setModalClienteAbierto(true);
        }}
        onAbrirNuevoVehiculo={(cliId) => {
          setVehiculoEditar(null);
          setClientePreseleccionadoId(cliId || recepcionClienteId);
          setModalVehiculoAbierto(true);
        }}
      />

      <DetalleOrdenModal
        orden={ordenDetalle}
        config={config}
        isOpen={ordenDetalle !== null}
        onClose={() => setOrdenDetalle(null)}
        onAbrirImprimir={(ord) => {
          setOrdenImprimir(ord);
        }}
        onAbrirSubirFirma={(ord) => {
          setOrdenSubirFirma(ord);
        }}
        onCambiarEstado={handleCambiarEstadoOrden}
        onAbrirTransicion={(ord) => {
          setOrdenParaTransicion(ord);
          setTransicionObjetivo(null);
        }}
        onAbrirDiagnostico={(ord) => {
          setOrdenParaDiagnostico(ord);
        }}
        onAbrirTareas={(ord) => {
          setOrdenParaTareas(ord);
        }}
        onAbrirTrabajoAdicional={(ord) => {
          setOrdenParaTrabajoAdicional(ord);
        }}
        onAbrirCotizacion={(ord) => setOrdenParaCotizacion(ord)}
        onAbrirAprobacion={async (ord) => {
          try {
            const cots = await obtenerCotizacionesOrdenFirestore(ord.id);
            if (cots.length === 0) {
              mostrarNotificacion(
                `La orden ${ord.folio} aún no tiene cotizaciones guardadas. Crea una primero en el editor.`,
                'info'
              );
              setOrdenParaCotizacion(ord);
            } else {
              setOrdenParaAprobacion(ord);
              setCotizacionParaAprobacion(cots[0]);
            }
          } catch (e: any) {
            manejarErrorFirestore(e, 'cargar cotización para aprobación');
          }
        }}
        onAbrirImprimirCotizacion={async (ord) => {
          try {
            const cots = await obtenerCotizacionesOrdenFirestore(ord.id);
            if (cots.length === 0) {
              mostrarNotificacion(
                `No hay cotizaciones registradas para imprimir en la orden ${ord.folio}.`,
                'info'
              );
            } else {
              setCotizacionParaImprimir(cots[0]);
            }
          } catch (e: any) {
            manejarErrorFirestore(e, 'cargar cotización para imprimir');
          }
        }}
      />

      <OrdenImprimibleModal
        orden={ordenImprimir}
        config={config}
        isOpen={ordenImprimir !== null}
        onClose={() => setOrdenImprimir(null)}
      />

      <SubirFirmaModal
        orden={ordenSubirFirma}
        isOpen={ordenSubirFirma !== null}
        onClose={() => setOrdenSubirFirma(null)}
        onSubirFirma={handleSubirFirma}
        onError={(msg) => manejarErrorFirestore(new Error(msg), 'firma física')}
      />

      {/* MODALES DEL MÓDULO 1 (CLIENTES Y VEHÍCULOS) - Renderizados con z-[90] para superponerse encima del asistente */}
      <ClienteModal
        isOpen={modalClienteAbierto}
        onClose={() => setModalClienteAbierto(false)}
        onSave={handleGuardarCliente}
        clienteEditar={clienteEditar}
        clientesExistentes={clientes}
        onSeleccionarClienteExistente={(existente) => {
          if (modalRecepcionAbierto) {
            setRecepcionClienteId(existente.id);
          }
          mostrarNotificacion(`Se seleccionó el cliente existente: ${existente.nombre}`, 'info');
        }}
      />

      <VehiculoModal
        isOpen={modalVehiculoAbierto}
        onClose={() => setModalVehiculoAbierto(false)}
        onSave={handleGuardarVehiculo}
        vehiculoEditar={vehiculoEditar}
        clientes={clientes}
        vehiculosExistentes={vehiculos}
        clientePreseleccionadoId={clientePreseleccionadoId || recepcionClienteId}
        onVerVehiculoExistente={(veh) => {
          if (modalRecepcionAbierto) {
            setRecepcionClienteId(veh.propietarioActualId);
            setRecepcionVehiculoId(veh.id);
          } else {
            setVistaActiva('vehiculos');
          }
          mostrarNotificacion(`Vehículo seleccionado: ${veh.placa} (${veh.marca} ${veh.modelo})`, 'info');
        }}
        onCambiarPropietarioVehiculo={(veh) => {
          setVehiculoParaCambio(veh);
          setModalCambioPropAbierto(true);
        }}
      />

      <CambioPropietarioModal
        isOpen={modalCambioPropAbierto}
        onClose={() => setModalCambioPropAbierto(false)}
        vehiculo={vehiculoParaCambio}
        propietarioActual={
          vehiculoParaCambio
            ? clientes.find((c) => c.id === vehiculoParaCambio.propietarioActualId) || null
            : null
        }
        clientes={clientes}
        onConfirmarCambio={handleConfirmarCambioPropietario}
      />

      <ConsentimientoModal
        isOpen={modalConsentimientoAbierto}
        onClose={() => setModalConsentimientoAbierto(false)}
        cliente={clienteConsentimiento}
        onSubirConsentimiento={handleSubirConsentimiento}
        onError={(msg) => manejarErrorFirestore(new Error(msg), 'consentimiento')}
      />

      <ConfiguracionModal
        isOpen={modalConfiguracionAbierto}
        onClose={() => setModalConfiguracionAbierto(false)}
        config={config}
        onUpdateConfig={(nueva) => setConfig(nueva)}
        onError={(msg) => manejarErrorFirestore(new Error(msg), 'configuración')}
      />

      {/* MODALES DEL MÓDULO 3: TALLER */}
      <TransicionEstadoModal
        orden={ordenParaTransicion}
        nuevoEstadoObjetivo={transicionObjetivo}
        isOpen={ordenParaTransicion !== null}
        onClose={() => {
          setOrdenParaTransicion(null);
          setTransicionObjetivo(null);
        }}
        config={config}
        onConfirmarTransicion={handleConfirmarTransicionEstado}
      />

      <TareasCronometroModal
        orden={ordenParaTareas}
        isOpen={ordenParaTareas !== null}
        onClose={() => setOrdenParaTareas(null)}
        config={config}
        onGuardarTarea={handleGuardarTarea}
        onControlCronometro={handleControlCronometro}
      />

      <DiagnosticoTecnicoModal
        orden={ordenParaDiagnostico}
        isOpen={ordenParaDiagnostico !== null}
        onClose={() => setOrdenParaDiagnostico(null)}
        config={config}
        usuarioActual={usuarioActual}
        onGuardarDiagnostico={handleGuardarDiagnostico}
        onSubirFotoDiagnostico={handleSubirFotoDiagnostico}
        onAbrirImprimirDiagnostico={(ord) => setOrdenDiagnosticoImprimir(ord)}
      />

      <DiagnosticoImprimibleModal
        orden={ordenDiagnosticoImprimir}
        config={config}
        isOpen={ordenDiagnosticoImprimir !== null}
        onClose={() => setOrdenDiagnosticoImprimir(null)}
      />

      <TrabajoAdicionalModal
        orden={ordenParaTrabajoAdicional}
        isOpen={ordenParaTrabajoAdicional !== null}
        onClose={() => setOrdenParaTrabajoAdicional(null)}
        config={config}
        usuarioActual={usuarioActual}
        onRegistrarTrabajoAdicional={handleRegistrarTrabajoAdicional}
      />

      {/* MODALES DEL MÓDULO 4: COTIZACIONES, APROBACIONES Y VISTA IMPRIMIBLE */}
      {usuarioActual && (
        <>
          <CotizacionEditorModal
            orden={ordenParaCotizacion}
            config={config}
            isOpen={ordenParaCotizacion !== null}
            onClose={() => setOrdenParaCotizacion(null)}
            usuarioActual={usuarioActual}
            onCotizacionGuardada={(cot) => {
              mostrarNotificacion(
                `Cotización v${cot.versionNumero} de la orden ${cot.folioOrden} guardada correctamente.`
              );
              actualizarEstadoNube();
            }}
            onAbrirImprimir={(cot) => {
              setCotizacionParaImprimir(cot);
            }}
          />

          <AprobacionClienteModal
            orden={ordenParaAprobacion}
            cotizacion={cotizacionParaAprobacion}
            config={config}
            isOpen={ordenParaAprobacion !== null && cotizacionParaAprobacion !== null}
            onClose={() => {
              setOrdenParaAprobacion(null);
              setCotizacionParaAprobacion(null);
            }}
            usuarioActual={usuarioActual}
            onAprobacionRegistrada={() => {
              mostrarNotificacion(`Aprobación de cotización registrada correctamente.`);
              setOrdenParaAprobacion(null);
              setCotizacionParaAprobacion(null);
              actualizarEstadoNube();
            }}
            onRechazoRegistrado={() => {
              mostrarNotificacion(`Cotización rechazada. Orden de servicio cancelada.`, 'info');
              setOrdenParaAprobacion(null);
              setCotizacionParaAprobacion(null);
              actualizarEstadoNube();
            }}
          />

          <CotizacionImprimibleModal
            cotizacion={cotizacionParaImprimir}
            orden={ordenes.find((o) => o.id === cotizacionParaImprimir?.ordenId) || null}
            config={config}
            isOpen={cotizacionParaImprimir !== null}
            onClose={() => setCotizacionParaImprimir(null)}
          />
        </>
      )}

      {/* Diálogo Propio de la Aplicación (sin window.confirm / alert) */}
      {ordenPagosId && usuarioActual && (
        <PagosOrdenModal
          orden={ordenes.find((o) => o.id === ordenPagosId) || null}
          config={config}
          usuarioActual={usuarioActual}
          onClose={() => setOrdenPagosId(null)}
          onExito={(m) => mostrarNotificacion(m)}
        />
      )}

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TallerAppContent />
    </AuthProvider>
  );
}
