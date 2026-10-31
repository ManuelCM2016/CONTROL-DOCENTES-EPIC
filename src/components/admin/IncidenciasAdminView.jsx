import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Siren,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Wrench,
  Check,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  Sparkles,
  UserCheck,
  XCircle,
  FileText,
  Trash2
} from 'lucide-react'
import {
  obtenerIncidencias,
  actualizarEstadoIncidencia,
  eliminarIncidencia,
  purgarIncidenciasLocales,
  getLocalIncidencias,
  TIPOS_INCIDENCIA,
  ESTADOS_INCIDENCIA
} from '../../services/incidenciasService'
import { playEmergencySirenSound, playAlertSound } from '../../utils/alertSound'

export default function IncidenciasAdminView({ isDarkMode = true }) {
  const [incidencias, setIncidencias] = useState(() => getLocalIncidencias())
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos') // 'todos' | 'urgente' | 'preventivo' | 'resueltos'
  const [busqueda, setBusqueda] = useState('')
  const [resolviendoId, setResolviendoId] = useState(null)
  const [notaResolucion, setNotaResolucion] = useState('')
  const [tecnicoNombre, setTecnicoNombre] = useState('Técnico de Soporte EPIC')

  // Cargar incidencias
  const cargarDatos = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await obtenerIncidencias(isManualRefresh)
      if (res && res.success && Array.isArray(res.data)) {
        setIncidencias(res.data)
      }
    } catch (e) {
      console.warn('Error cargando incidencias:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
    const handleUpdate = () => {
      const all = getLocalIncidencias()
      setIncidencias(all)
    }
    window.addEventListener('epic_incidencias_updated', handleUpdate)
    return () => window.removeEventListener('epic_incidencias_updated', handleUpdate)
  }, [cargarDatos])

  // Métricas
  const urgenciasActivas = useMemo(() => {
    return incidencias.filter(i => 
      i.tipo === TIPOS_INCIDENCIA.URGENTE && 
      (i.estado === ESTADOS_INCIDENCIA.NUEVO || i.estado === ESTADOS_INCIDENCIA.EN_CAMINO)
    )
  }, [incidencias])

  const preventivosPendientes = useMemo(() => {
    return incidencias.filter(i => 
      i.tipo === TIPOS_INCIDENCIA.PREVENTIVO && 
      i.estado !== ESTADOS_INCIDENCIA.RESUELTO &&
      i.estado !== ESTADOS_INCIDENCIA.CANCELADO
    )
  }, [incidencias])

  const resueltos = useMemo(() => {
    return incidencias.filter(i => i.estado === ESTADOS_INCIDENCIA.RESUELTO)
  }, [incidencias])

  // Filtrado de incidencias
  const incidenciasFiltradas = useMemo(() => {
    return incidencias.filter(i => {
      if (filtroTipo === 'urgente' && i.tipo !== TIPOS_INCIDENCIA.URGENTE) return false
      if (filtroTipo === 'preventivo' && i.tipo !== TIPOS_INCIDENCIA.PREVENTIVO) return false
      if (filtroTipo === 'resueltos' && i.estado !== ESTADOS_INCIDENCIA.RESUELTO) return false

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        return (
          (i.aula || '').toLowerCase().includes(q) ||
          (i.docenteNombre || '').toLowerCase().includes(q) ||
          (i.titulo || '').toLowerCase().includes(q) ||
          (i.descripcion || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [incidencias, filtroTipo, busqueda])

  // Marcar como "EN CAMINO"
  const handleAtenderEnCamino = async (id) => {
    await actualizarEstadoIncidencia({
      id,
      estado: ESTADOS_INCIDENCIA.EN_CAMINO,
      atendidoPor: tecnicoNombre
    })
    playAlertSound()
    cargarDatos(true)
  }

  // Marcar como "RESUELTO"
  const handleConfirmarResolucion = async (id) => {
    await actualizarEstadoIncidencia({
      id,
      estado: ESTADOS_INCIDENCIA.RESUELTO,
      atendidoPor: tecnicoNombre,
      notaResolucion: notaResolucion.trim() || 'Incidencia atendida y resuelta con éxito.'
    })
    setResolviendoId(null)
    setNotaResolucion('')
    playAlertSound()
    cargarDatos(true)
  }

  // Eliminar incidencia (Docente o Admin)
  const handleEliminar = async (id) => {
    if (window.confirm('¿Deseas eliminar este reporte de incidencia?')) {
      await eliminarIncidencia(id)
      setIncidencias(prev => prev.filter(i => i.id !== id))
    }
  }

  return (
    <div className="space-y-5">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-800 text-white flex items-center justify-center shadow-lg shadow-red-950/60 ring-1 ring-red-400/40 shrink-0">
            <Siren className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-white tracking-tight">
                Mesa de Ayuda & Soporte Técnico en Aula
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                Soporte EPIC
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Atención inmediata de urgencias en clases y gestión de mantenimiento preventivo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {incidencias.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('¿Deseas vaciar el historial de incidencias? Esto sincronizará con Google Sheets.')) {
                  purgarIncidenciasLocales()
                  cargarDatos(true)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 hover:text-red-200 transition-all text-xs font-bold cursor-pointer"
              title="Limpiar incidencias"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Historial</span>
            </button>
          )}

          <button
            onClick={() => cargarDatos(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-400' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* ── BANNER DE EMERGENCIA ACTIVA SI HAY URGENCIA EN CLASE ── */}
      {urgenciasActivas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-3xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-rose-950/90 border-2 border-red-500/80 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center animate-bounce shadow-lg shadow-red-950/80">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white flex items-center gap-2">
                🚨 {urgenciasActivas.length} {urgenciasActivas.length === 1 ? 'AULA CON EMERGENCIA EN VIVO' : 'AULAS CON EMERGENCIAS EN VIVO'}
              </p>
              <p className="text-xs text-red-200 mt-0.5">
                Hay docentes esperando asistencia técnica inmediata en dictado presencial.
              </p>
            </div>
          </div>

          <button
            onClick={() => playEmergencySirenSound()}
            className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-red-950/60 cursor-pointer self-start sm:self-auto"
            title="Probar sonido de sirena"
          >
            🔊 Probar Sirena
          </button>
        </motion.div>
      )}

      {/* ── KPIS STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-red-300/80 uppercase">Urgencias en Aula</p>
            <p className="text-2xl font-black text-red-300 mt-0.5">{urgenciasActivas.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-300 flex items-center justify-center font-bold">
            🚨
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-300/80 uppercase">Mantenimientos</p>
            <p className="text-2xl font-black text-amber-300 mt-0.5">{preventivosPendientes.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
            🛠️
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-300/80 uppercase">Resueltos</p>
            <p className="text-2xl font-black text-emerald-300 mt-0.5">{resueltos.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
            ✅
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-300/80 uppercase">Total Registrados</p>
            <p className="text-2xl font-black text-blue-300 mt-0.5">{incidencias.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
            📋
          </div>
        </div>
      </div>

      {/* ── FILTROS Y BÚSQUEDA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === 'todos'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos ({incidencias.length})
          </button>
          <button
            onClick={() => setFiltroTipo('urgente')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === 'urgente'
                ? 'bg-red-500/25 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            🚨 Urgencias ({urgenciasActivas.length})
          </button>
          <button
            onClick={() => setFiltroTipo('preventivo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === 'preventivo'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            🛠️ Mantenimiento ({preventivosPendientes.length})
          </button>
          <button
            onClick={() => setFiltroTipo('resueltos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === 'resueltos'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            ✅ Resueltos ({resueltos.length})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar aula, docente, falla..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-red-400/50"
          />
        </div>
      </div>

      {/* ── LISTADO DE INCIDENCIAS ── */}
      {incidenciasFiltradas.length === 0 ? (
        <div className="py-16 text-center text-white/40 space-y-2 rounded-3xl bg-white/[0.02] border border-white/10">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 opacity-60" />
          <h3 className="text-sm font-bold text-white">¡No hay incidencias en esta lista!</h3>
          <p className="text-xs text-white/40">Todas las aulas se encuentran funcionando con normalidad.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {incidenciasFiltradas.map(inc => {
            const isUrgente = inc.tipo === TIPOS_INCIDENCIA.URGENTE
            const isResuelto = inc.estado === ESTADOS_INCIDENCIA.RESUELTO
            const isEnCamino = inc.estado === ESTADOS_INCIDENCIA.EN_CAMINO
            const estaResolviendo = resolviendoId === inc.id

            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-3xl border transition-all space-y-3 ${
                  isResuelto
                    ? 'bg-white/[0.02] border-white/10 opacity-75'
                    : isUrgente
                      ? 'bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-950 border-red-500/60 shadow-xl shadow-red-950/30'
                      : 'bg-white/[0.03] border-amber-500/40 shadow-lg'
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-white">{inc.aula}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isResuelto
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isUrgente
                          ? 'bg-red-500/30 text-red-200 border border-red-500/50 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {isResuelto ? 'RESUELTO' : isUrgente ? '🚨 SOS URGENTE' : '🛠️ MANTENIMIENTO'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-white/40 font-mono">
                      {inc.hora || inc.fechaHora}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEliminar(inc.id)}
                      className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar este reporte"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Título y Descripción */}
                <div>
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    {inc.titulo}
                  </h4>
                  {inc.descripcion && (
                    <p className="text-[11px] text-white/70 mt-1 italic p-2 rounded-xl bg-black/40 border border-white/5">
                      &ldquo;{inc.descripcion}&rdquo;
                    </p>
                  )}
                </div>

                {/* Datos del Docente y Clase */}
                <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5 space-y-1 text-xs">
                  <div className="flex items-center gap-2 text-white/90">
                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="font-bold">{inc.docenteNombre}</span>
                    {inc.docenteDni && <span className="text-white/40 text-[10px]">({inc.docenteDni})</span>}
                  </div>
                  {inc.asignatura && (
                    <div className="flex items-center gap-2 text-white/60 text-[11px]">
                      <FileText className="w-3 h-3 text-purple-400 shrink-0" />
                      <span>{inc.asignatura}</span>
                    </div>
                  )}
                </div>

                {/* Estado y Acciones de Soporte */}
                {!isResuelto && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    {/* Alerta de técnico en camino */}
                    {isEnCamino && (
                      <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" />
                        <span>Técnico asignado: <strong>{inc.atendidoPor || 'Soporte EPIC'}</strong> acudiendo al aula.</span>
                      </div>
                    )}

                    {estaResolviendo ? (
                      /* Formulario de resolución */
                      <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-xs">
                        <label className="block text-[11px] font-bold text-emerald-300">
                          Solución aplicada / Nota técnica:
                        </label>
                        <input
                          type="text"
                          value={notaResolucion}
                          onChange={e => setNotaResolucion(e.target.value)}
                          placeholder="Ej. Se reconectó cable HDMI, se reinició PC..."
                          className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setResolviendoId(null)}
                            className="px-3 py-1 rounded-xl bg-white/10 text-white/70 hover:text-white text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmarResolucion(inc.id)}
                            className="px-4 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-emerald-950/60"
                          >
                            Finalizar Solución
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Botones de acción estándar */
                      <div className="flex items-center gap-2">
                        {!isEnCamino && (
                          <button
                            type="button"
                            onClick={() => handleAtenderEnCamino(inc.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40 cursor-pointer transition-all"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Voy en camino</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setResolviendoId(inc.id)
                            setNotaResolucion('')
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Marcar Solucionado</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Si está resuelto, mostrar nota */}
                {isResuelto && inc.notaResolucion && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center justify-between">
                    <span>✓ {inc.notaResolucion}</span>
                    {inc.tiempoRespuestaMin && (
                      <span className="font-mono text-[10px] opacity-75">
                        ({inc.tiempoRespuestaMin} min)
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

