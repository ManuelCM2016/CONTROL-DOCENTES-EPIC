import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Radio,
  Clock,
  MapPin,
  BookOpen,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Building,
  School
} from 'lucide-react'
import { obtenerMonitoreo } from '../../services/adminApi'

const MonitoreoView = ({ isDarkMode }) => {
  const [data, setData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    activas: [],
    completadasHoy: [],
    todosDocentes: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tab, setTab] = useState('activas') // 'activas' | 'completadas' | 'sin_registro'
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30)

  // Cargar datos del servidor
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await obtenerMonitoreo()
      if (res.success && res.data) {
        setData(res.data)
        setLastUpdated(new Date())
        setSecondsUntilRefresh(30)
      }
    } catch (err) {
      console.error('Error al cargar monitoreo:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Polling automático cada 30 segundos
  useEffect(() => {
    fetchData()
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchData()
          return 30
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [fetchData])

  // Calcular tiempo transcurrido desde la hora de inicio
  const getTiempoTranscurrido = (horaInicio) => {
    if (!horaInicio) return '--'
    try {
      const parts = horaInicio.split(':')
      if (parts.length < 2) return horaInicio
      const start = new Date()
      start.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || 0, 10))
      const now = new Date()
      const diffMs = now - start
      if (diffMs < 0) return 'Iniciando...'
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const horas = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      if (horas > 0) return `${horas}h ${mins}m en clase`
      return `${mins} min en clase`
    } catch {
      return horaInicio
    }
  }

  // Lista de DNIs de docentes con actividad hoy
  const dnisConActividadHoy = new Set([
    ...(data.activas || []).map((s) => String(s.dni).trim().replace(/^0+/, '')),
    ...(data.completadasHoy || []).map((s) => String(s.dni).trim().replace(/^0+/, ''))
  ])

  // Docentes sin registro hoy
  const docentesSinRegistro = (data.todosDocentes || []).filter((doc) => {
    const dniNorm = String(doc.dni || '').trim().replace(/^0+/, '')
    const codNorm = String(doc.codigo || '').trim().replace(/^0+/, '')
    return !dnisConActividadHoy.has(dniNorm) && !dnisConActividadHoy.has(codNorm)
  })

  // Filtros de búsqueda
  const filterSearch = (item, fields) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return fields.some((field) => String(item[field] || '').toLowerCase().includes(term))
  }

  const activasFiltradas = (data.activas || []).filter((s) =>
    filterSearch(s, ['docente', 'asignatura', 'aula', 'dni'])
  )
  const completadasFiltradas = (data.completadasHoy || []).filter((s) =>
    filterSearch(s, ['docente', 'asignatura', 'aula', 'tema', 'dni'])
  )
  const sinRegistroFiltrados = docentesSinRegistro.filter((d) =>
    filterSearch(d, ['nombre', 'dni', 'codigo'])
  )

  return (
    <div className="space-y-6">
      {/* Header con Estado en Vivo & Controles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-emerald-400 opacity-40"></span>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Aulas Activas en Vivo
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Monitoreo en Tiempo Real
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">
              Supervisión de clases en curso en la Escuela Profesional de Ingeniería Civil
            </p>
          </div>
        </div>

        {/* Refresco y Contador */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="text-right">
            <p className="text-[11px] text-white/40 font-mono">
              Auto-actualiza en: <span className="text-emerald-400 font-bold">{secondsUntilRefresh}s</span>
            </p>
            <p className="text-[10px] text-white/30 font-medium">
              Última sincronización: {lastUpdated.toLocaleTimeString('es-PE')}
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Refrescar datos ahora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen de Estado Hoy */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Activas Ahora */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('activas')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'activas'
              ? 'bg-gradient-to-br from-emerald-950/60 via-emerald-900/30 to-black/60 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {data.activas?.length || 0}
          </div>
          <div className="text-xs font-bold text-emerald-300">Clases en Curso Ahora</div>
          <div className="text-[11px] text-white/40 mt-1">Docentes dictando en aula</div>
        </motion.div>

        {/* Finalizadas Hoy */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('completadas')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'completadas'
              ? 'bg-gradient-to-br from-blue-950/60 via-blue-900/30 to-black/60 border-blue-500/60 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              Hoy
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {data.completadasHoy?.length || 0}
          </div>
          <div className="text-xs font-bold text-blue-300">Clases Finalizadas Hoy</div>
          <div className="text-[11px] text-white/40 mt-1">Registros de salida completados</div>
        </motion.div>

        {/* Sin Actividad Hoy */}
        <motion.div
          whileHover={{ y: -3 }}
          onClick={() => setTab('sin_registro')}
          className={`cursor-pointer p-5 rounded-3xl border transition-all duration-300 ${
            tab === 'sin_registro'
              ? 'bg-gradient-to-br from-amber-950/60 via-amber-900/30 to-black/60 border-amber-500/60 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/30'
              : 'bg-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase font-mono font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              Plana Docente
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono tracking-tight mb-1">
            {docentesSinRegistro.length}
          </div>
          <div className="text-xs font-bold text-amber-300">Docentes Sin Registro Hoy</div>
          <div className="text-[11px] text-white/40 mt-1">Sin clase iniciada hoy</div>
        </motion.div>
      </div>

      {/* Barra de Filtros & Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10">
        {/* Pestañas de Vista */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-black/40 rounded-xl border border-white/10">
          <button
            onClick={() => setTab('activas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'activas'
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En Vivo ({activasFiltradas.length})</span>
          </button>
          <button
            onClick={() => setTab('completadas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'completadas'
                ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Finalizadas ({completadasFiltradas.length})</span>
          </button>
          <button
            onClick={() => setTab('sin_registro')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'sin_registro'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 shadow-xs'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Sin Registro ({sinRegistroFiltrados.length})</span>
          </button>
        </div>

        {/* Campo de Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar docente, aula, curso..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder:text-white/30 text-xs font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {/* Contenido de la Pestaña Seleccionada */}
      <AnimatePresence mode="wait">
        {tab === 'activas' && (
          <motion.div
            key="tab-activas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {activasFiltradas.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  No hay clases en curso en este instante
                </h3>
                <p className="text-xs text-white/40 max-w-md mx-auto">
                  Cuando un docente presione <strong>"Registrar Inicio de Clase"</strong> en el sistema, aparecerá automáticamente aquí en tiempo real.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activasFiltradas.map((sesion, idx) => (
                  <motion.div
                    key={sesion.fila || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/40 via-white/[0.03] to-black/60 border-2 border-emerald-500/40 p-5 shadow-xl shadow-emerald-950/30 hover:border-emerald-400/70 transition-all duration-300"
                  >
                    {/* Badge de Aula Flotante */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{sesion.aula || 'Aula sin especificar'}</span>
                      </div>
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        EN VIVO
                      </span>
                    </div>

                    {/* Docente */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-white/40 shrink-0" />
                        <h4 className="text-sm font-black text-white leading-tight">
                          {sesion.docente || 'Docente'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <p className="text-[11px] font-mono text-white/40">DNI: {sesion.dni}</p>
                      </div>
                    </div>

                    {/* Asignatura */}
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 space-y-1">
                      <div className="flex items-start gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-slate-200 leading-snug">
                          {sesion.asignatura || 'Asignatura no especificada'}
                        </p>
                      </div>
                    </div>

                    {/* Footer con Horas & Tiempo transcurrido */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-white/60">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono font-bold text-white">
                          {sesion.horaInicio}
                        </span>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold font-mono">
                        ⏱️ {getTiempoTranscurrido(sesion.horaInicio)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'completadas' && (
          <motion.div
            key="tab-completadas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {completadasFiltradas.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
                <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  Aún no hay clases finalizadas hoy
                </h3>
                <p className="text-xs text-white/40 max-w-md mx-auto">
                  A medida que los docentes concluyan sus clases y envíen su registro, se listarán aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completadasFiltradas.map((sesion, idx) => (
                  <motion.div
                    key={sesion.fila || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 shadow-lg hover:border-blue-500/40 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-black">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>{sesion.aula || 'Aula'}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-500/30">
                        COMPLETADA
                      </span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <h4 className="text-sm font-black text-white leading-tight">
                        {sesion.docente}
                      </h4>
                      <p className="text-[11px] font-mono text-white/40">DNI: {sesion.dni}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 space-y-1.5">
                      <p className="text-xs font-bold text-slate-200">
                        {sesion.asignatura}
                      </p>
                      {sesion.tema && (
                        <p className="text-[11px] text-white/60 line-clamp-2">
                          <strong className="text-white/40">Tema:</strong> {sesion.tema}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-mono text-[11px]">
                          {sesion.horaInicio} ➔ {sesion.horaFin || 'Fin'}
                        </span>
                      </div>
                      {sesion.numEstudiantes && (
                        <div className="flex items-center gap-1 text-white/50 text-[11px]">
                          <Users className="w-3.5 h-3.5" />
                          <span>{sesion.numEstudiantes} est.</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === 'sin_registro' && (
          <motion.div
            key="tab-sin-registro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Plana Docente Sin Registro Hoy ({sinRegistroFiltrados.length})
                  </h3>
                  <p className="text-xs text-white/40">
                    Docentes inscritos en el Maestro que aún no han reportado actividad el día de hoy
                  </p>
                </div>
              </div>

              <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {sinRegistroFiltrados.length === 0 ? (
                  <div className="text-center py-10 text-xs text-white/40">
                    Todos los docentes han registrado actividad hoy o no coinciden con la búsqueda.
                  </div>
                ) : (
                  sinRegistroFiltrados.map((doc, idx) => (
                    <div
                      key={doc.dni || idx}
                      className="p-3.5 px-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{doc.nombre}</p>
                          <p className="text-[11px] font-mono text-white/40">
                            DNI: {doc.dni} {doc.codigo ? `• Cód: ${doc.codigo}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 font-medium">
                        Sin registro hoy
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MonitoreoView
