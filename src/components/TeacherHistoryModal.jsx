import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History, X, Search, Filter, Calendar, MapPin,
  BookOpen, Users, Clock, CheckCircle2, AlertCircle,
  Copy, Download, RefreshCw, FileText,
  Layers, ShieldCheck, Sparkles, ChevronRight, Loader2,
  CloudDownload
} from 'lucide-react'
import {
  getTeacherHistory,
  mergeHistoryFromCloud
} from '../utils/historyManager'
import { obtenerHistorialDocente } from '../services/api'

const TeacherHistoryModal = ({
  isOpen,
  onClose,
  docente,
  isDarkMode,
  onSelectTopic,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCurso, setSelectedCurso] = useState('ALL')
  const [historyList, setHistoryList] = useState(() => getTeacherHistory(docente?.dni))
  const [isFetchingCloud, setIsFetchingCloud] = useState(false)

  // Refrescar lista local
  const refreshHistory = () => {
    if (docente?.dni) {
      setHistoryList(getTeacherHistory(docente.dni))
    }
  }

  // Sincronizar / Descargar historial desde Google Sheets
  const handleSyncFromCloud = async () => {
    if (!docente?.dni || isFetchingCloud) return
    setIsFetchingCloud(true)
    showToast?.('info', 'Consultando historial en Google Sheets...')

    try {
      const result = await obtenerHistorialDocente(docente.dni)
      if (result.success && Array.isArray(result.data)) {
        const merged = mergeHistoryFromCloud(docente.dni, result.data)
        setHistoryList(merged)
        showToast?.('success', `✅ Se cargaron ${result.data.length} clases desde Google Sheets`)
      } else {
        showToast?.('warning', result.message || 'No se encontraron clases registradas en Google Sheets.')
      }
    } catch (err) {
      showToast?.('error', 'Error al conectar con Google Sheets')
    } finally {
      setIsFetchingCloud(false)
    }
  }

  // Al abrir el modal: refrescar y si está vacío, consultar automáticamente Google Sheets
  useEffect(() => {
    if (isOpen && docente?.dni) {
      const localData = getTeacherHistory(docente.dni)
      setHistoryList(localData)
      if (localData.length === 0 && navigator.onLine) {
        handleSyncFromCloud()
      }
    }
  }, [isOpen, docente?.dni])

  // Filtrado reactivo
  const filteredSessions = useMemo(() => {
    return historyList.filter((ses) => {
      const matchCurso = selectedCurso === 'ALL' || (ses.asignatura && ses.asignatura.includes(selectedCurso))
      const matchSearch =
        !searchTerm.trim() ||
        (ses.temaProgramado && ses.temaProgramado.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ses.aulaLab && ses.aulaLab.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ses.fecha && ses.fecha.includes(searchTerm)) ||
        (ses.asignatura && ses.asignatura.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchCurso && matchSearch
    })
  }, [historyList, selectedCurso, searchTerm])

  // Estadísticas rápidas
  const stats = useMemo(() => {
    const total = historyList.length
    const regulares = historyList.filter((s) => (s.tipo_sesion || s.tipoSesion || 'Clase Regular') === 'Clase Regular').length
    const recuperaciones = total - regulares
    const totalAlumnos = historyList.reduce((acc, s) => acc + (parseInt(s.numEstudiantes, 10) || 0), 0)
    return { total, regulares, recuperaciones, totalAlumnos }
  }, [historyList])

  // Exportar a CSV
  const handleExportCSV = () => {
    if (historyList.length === 0) {
      showToast?.('warning', 'No hay registros en el historial para exportar')
      return
    }

    const headers = [
      'N° Registro', 'Fecha', 'Tipo Sesión', 'Fecha a Recuperar', 'Aula/Lab',
      'Asignatura', 'Unidad', 'Semana', 'Tema Programado', 'Hora Inicio',
      'Hora Salida', 'N° Estudiantes', 'Estado Sync'
    ]

    const rows = historyList.map((s) => [
      `"${s.numero || ''}"`,
      `"${s.fecha || ''}"`,
      `"${s.tipo_sesion || s.tipoSesion || 'Clase Regular'}"`,
      `"${s.fecha_recuperar || s.fechaRecuperar || ''}"`,
      `"${s.aulaLab || ''}"`,
      `"${s.asignatura || ''}"`,
      `"${s.unidad || ''}"`,
      `"${s.semanaAcademica || ''}"`,
      `"${(s.temaProgramado || '').replace(/"/g, '""')}"`,
      `"${s.horaInicio || ''}"`,
      `"${s.horaFinalizacion || ''}"`,
      `"${s.numEstudiantes || ''}"`,
      `"${s.syncStatus === 'synced' ? 'Sincronizado' : 'Pendiente'}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Historial_Clases_${docente?.dni}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast?.('success', 'Historial exportado a CSV exitosamente')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`
            relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border-2 my-auto
            ${isDarkMode
              ? 'bg-gradient-to-b from-[#180808] via-[#120606] to-[#0c0404] border-white/15 text-slate-100 shadow-black/90'
              : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-900 shadow-slate-400/40'
            }
          `}
        >
          {/* Top Institutional Line */}
          <div className="h-2 w-full shrink-0 bg-gradient-to-r from-red-800 via-amber-600 to-red-900" />

          {/* Modal Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/50 dark:border-white/10 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-900 via-red-800 to-red-950 flex items-center justify-center shadow-lg shadow-red-950/40 text-red-200 border border-red-700/40 shrink-0">
                <History className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Mis Clases Anteriores
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-maroon-700/20 text-maroon-400 border border-maroon-700/30">
                    {stats.total} {stats.total === 1 ? 'sesión' : 'sesiones'}
                  </span>
                </div>
                <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Docente: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{docente?.nombre || docente?.dni}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botón Sincronizar desde Google Sheets */}
              <button
                type="button"
                onClick={handleSyncFromCloud}
                disabled={isFetchingCloud}
                title="Sincronizar historial con la base de datos de Google Sheets"
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isDarkMode
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  }`}
              >
                <RefreshCw className={`w-4 h-4 text-emerald-500 ${isFetchingCloud ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isFetchingCloud ? 'Consultando...' : 'Sincronizar Sheets'}</span>
              </button>

              <button
                onClick={handleExportCSV}
                title="Descargar historial en archivo Excel / CSV"
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isDarkMode
                    ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>

              <button
                onClick={onClose}
                className={`p-2 rounded-full border transition-all cursor-pointer ${isDarkMode
                    ? 'bg-white/10 border-white/15 text-slate-300 hover:text-white hover:bg-white/20'
                    : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-5 sm:px-6 py-3 border-b border-slate-200/50 dark:border-white/10 bg-black/10 dark:bg-white/5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Sesiones</span>
                <span className="text-base font-black text-maroon-500">{stats.total}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Clases Regulares</span>
                <span className="text-base font-black text-emerald-500">{stats.regulares}</span>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Recuperaciones</span>
                <span className="text-base font-black text-amber-500">{stats.recuperaciones}</span>
              </div>

            </div>
          </div>

          {/* Filters & Search */}
          <div className="p-5 sm:p-6 py-3 border-b border-slate-200/50 dark:border-white/10 flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por tema, aula, fecha..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-all ${isDarkMode
                    ? 'bg-black/40 border-white/15 text-white placeholder-slate-500 focus:border-maroon-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-red-700'
                  }`}
              />
            </div>

            {/* Course Filter Dropdown */}
            <div className="sm:w-64">
              <select
                value={selectedCurso}
                onChange={(e) => setSelectedCurso(e.target.value)}
                className={`w-full py-2 px-3 rounded-xl text-xs border outline-none cursor-pointer transition-all ${isDarkMode
                    ? 'bg-black/40 border-white/15 text-white focus:border-maroon-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-red-700'
                  }`}
              >
                <option value="ALL">📚 Todos los Cursos</option>
                {(docente?.cursos || []).map((curso) => (
                  <option key={curso} value={curso}>
                    {curso}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sessions List Content */}
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3.5 max-h-[50vh]">
            {isFetchingCloud && historyList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-maroon-500" />
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Descargando historial desde Google Sheets...
                </p>
                <p className="text-xs text-slate-500">Conectando con la base de datos de la escuela...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400">
                  <BookOpen className="w-7 h-7 stroke-[1.5]" />
                </div>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {historyList.length === 0
                    ? 'No se encontraron clases registradas aún.'
                    : 'No se encontraron clases con los filtros actuales.'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Las clases que envíe se registrarán automáticamente. Si ya tiene clases previas en Google Sheets, pulse el botón de abajo para cargarlas:
                </p>
                <button
                  type="button"
                  onClick={handleSyncFromCloud}
                  disabled={isFetchingCloud}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-maroon-700 text-white hover:bg-maroon-600 transition-all cursor-pointer shadow-md"
                >
                  <CloudDownload className="w-4 h-4" />
                  <span>{isFetchingCloud ? 'Descargando...' : 'Cargar Historial desde Google Sheets'}</span>
                </button>
              </div>
            ) : (
              filteredSessions.map((ses) => {
                const isRecovery = (ses.tipo_sesion || ses.tipoSesion || 'Clase Regular') !== 'Clase Regular'
                const isSynced = ses.syncStatus === 'synced'

                return (
                  <motion.div
                    key={ses.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-3 ${isDarkMode
                        ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                  >
                    {/* Card Top: Header + Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-black ${isDarkMode ? 'bg-red-950/70 text-red-300 border border-red-800/40' : 'bg-red-900/10 text-red-900 border border-red-900/20'
                          }`}>
                          #{ses.numero || '—'}
                        </span>
                        <h3 className={`text-xs sm:text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {ses.asignatura || 'Sin asignatura'}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Tipo de Sesion Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${isRecovery
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          }`}>
                          {isRecovery ? <RefreshCw className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          <span>{isRecovery ? 'Recuperación' : 'Clase Regular'}</span>
                        </span>

                        {/* Sync Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${isSynced
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse'
                          }`}>
                          {isSynced ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{isSynced ? 'Sheets OK' : 'En cola offline'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{ses.fecha}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                        <span className="truncate">{ses.aulaLab || '—'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Layers className="w-3.5 h-3.5 text-maroon-500 shrink-0" />
                        <span>Unidad {ses.unidad || 'I'} • Sem. {ses.semanaAcademica || '1'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono">{ses.horaInicio} ➔ {ses.horaFinalizacion || '--:--'}</span>
                      </div>
                    </div>

                    {/* Topic Developed Section */}
                    {ses.temaProgramado && (
                      <div className={`p-2.5 rounded-xl border text-xs italic ${isDarkMode ? 'bg-black/40 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                        <span className="not-italic font-bold text-[10px] uppercase block text-slate-400 mb-0.5">Tema Silábico Desarrollado:</span>
                        "{ses.temaProgramado}"
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-white/5 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>{ses.numEstudiantes || 0} estudiantes</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {ses.temaProgramado && onSelectTopic && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTopic(ses.temaProgramado, ses.asignatura)
                              onClose()
                            }}
                            className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${isDarkMode
                                ? 'bg-maroon-900/40 border-maroon-700/50 text-maroon-300 hover:bg-maroon-900/70'
                                : 'bg-red-900/10 border-red-900/20 text-red-900 hover:bg-red-900/20'
                              }`}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Continuar este tema</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Modal Bottom Bar */}
          <div className="p-4 sm:p-5 border-t border-slate-200/50 dark:border-white/10 flex flex-wrap items-center justify-end gap-3 bg-black/10 dark:bg-white/5">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${isDarkMode
                  ? 'bg-white/10 border-white/15 text-white hover:bg-white/20'
                  : 'bg-slate-200 border-slate-300 text-slate-800 hover:bg-slate-300'
                }`}
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default TeacherHistoryModal
