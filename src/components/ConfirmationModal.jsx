import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, X, Calendar, Clock, MapPin, BookOpen,
  User, Users, MonitorPlay, FileText, Send, Loader2,
  LogOut, PlusCircle, Sparkles, ShieldCheck, Database,
  ClipboardCheck, Edit3, RefreshCw, CalendarClock
} from 'lucide-react'

// Mapeo de recursos con iconos
const RECURSOS_MAP = {
  aula_virtual: { label: 'Aula Virtual', icon: '💻' },
  proyector: { label: 'Proyector', icon: '📽️' },
  software: { label: 'Software Especializado', icon: '🖥️' },
  laboratorio: { label: 'Laboratorio', icon: '🔬' },
  bibliografia: { label: 'Bibliografía', icon: '📚' },
  materiales: { label: 'Materiales', icon: '📐' },
  equipos: { label: 'Equipos', icon: '⚙️' },
  pizarra: { label: 'Pizarra', icon: '📝' },
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  data,
  docente,
  isDarkMode,
  isSending,
  isSent,
  onConfirmAndSend,
  onNuevoRegistro,
  onLogout,
}) => {
  if (!isOpen || !data) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop con Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={!isSending ? onClose : undefined}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className={`
            relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border-2 my-auto
            ${isDarkMode
              ? 'bg-gradient-to-b from-[#1c0c0c] via-[#150707] to-[#0f0404] border-white/15 text-slate-100 shadow-black/90'
              : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-900 shadow-slate-400/40'
            }
          `}
        >
          {/* Top Institutional Accent Line */}
          <div className={`h-2 w-full shrink-0 transition-all duration-500 ${isSent
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
            : 'bg-gradient-to-r from-red-800 via-red-600 to-red-900'
            }`} />

          {/* Close Button (X) */}
          {!isSending && (
            <button
              onClick={onClose}
              className={`
                absolute top-4 right-4 p-2 rounded-full border transition-all duration-200 z-20
                ${isDarkMode
                  ? 'bg-white/10 border-white/15 text-slate-300 hover:text-white hover:bg-white/20'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }
              `}
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Modal Content Body */}
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto custom-scrollbar">

            {/* Header: Changes dynamically between Pre-envío y Post-envío */}
            <div className="text-center space-y-3">
              <div className="relative inline-flex items-center justify-center">
                {isSent ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-emerald-400 opacity-25"></span>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white">
                      <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                    </div>
                  </>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-900 via-red-800 to-red-950 flex items-center justify-center shadow-lg shadow-red-950/40 text-red-200 border border-red-700/40">
                    <ClipboardCheck className="w-9 h-9" />
                  </div>
                )}
              </div>

              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2 border ${isSent
                  ? isDarkMode
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : isDarkMode
                    ? 'bg-red-950/60 border-red-800/40 text-red-300'
                    : 'bg-red-900/10 border-red-900/20 text-red-900'
                  }`}>
                  {isSent ? (
                    <>
                      <Database className="w-3 h-3 text-emerald-500" />
                      Sincronizado con la Base de datos
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 text-red-700 dark:text-red-400" />
                      Ficha Anexo C • Verificación Previa
                    </>
                  )}
                </span>

                <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {isSent ? '¡Sesión Registrada y Guardada con Éxito!' : 'Confirmación de Registro de Sesión'}
                </h2>
                <p className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isSent
                    ? 'La sesión ha sido guardada en la hoja BASE_DE_DATOS de Google Sheets.'
                    : 'Por favor, revise los datos de su clase antes de enviarlos a la base de datos institucional.'
                  }
                </p>
              </div>
            </div>

            {/* Ficha Resumen (Ticket Digital) */}
            <div className={`
              rounded-2xl border-2 p-5 sm:p-6 space-y-4
              ${isDarkMode
                ? 'bg-slate-900/85 border-slate-800 shadow-inner'
                : 'bg-white border-slate-200 shadow-md shadow-slate-200/50'
              }
            `}>
              {/* Ticket Top Bar: Correlativo + Semestre */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/50 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black ${isDarkMode ? 'bg-red-950/70 text-red-300 border border-red-800/40' : 'bg-red-900/10 text-red-900 border border-red-900/20'
                    }`}>
                    N° REGISTRO: #{data.numero}
                  </span>
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Semestre 2026-II
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${isSent ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSent ? 'Su registro se realizó con éxito' : 'Listo para Enviar'}</span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">

                {/* Docente */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Docente
                  </span>
                  <p className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <User className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0" />
                    <span className="truncate">{docente?.nombre || '—'}</span>
                  </p>
                </div>

                {/* Asignatura y Sección */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Asignatura y Sección
                  </span>
                  <p className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <BookOpen className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0" />
                    <span className="truncate">{data.asignatura || '—'}</span>
                  </p>
                </div>

                {/* Aula & Fecha */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Aula / Lab & Fecha
                  </span>
                  <p className={`font-semibold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    <MapPin className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0" />
                    <span>{data.aulaLab || '—'}</span>
                    <span className="opacity-40">•</span>
                    <Calendar className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0 ml-1" />
                    <span>{data.fecha}</span>
                  </p>
                </div>

                {/* Unidad & Semana */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Unidad y Semana Académica
                  </span>
                  <p className={`font-semibold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    <span className="font-bold text-red-800 dark:text-red-400">Unidad {data.unidad || 'I'}</span>
                    <span className="opacity-40">•</span>
                    <span>Semana {data.semanaAcademica || '1'}</span>
                  </p>
                </div>

                {/* Horario Registrado */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Horario de la Clase
                  </span>
                  <p className={`font-mono font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.horaInicio || '--:--'}</span>
                    <span>➔</span>
                    <span>{data.horaFinalizacion || '--:--'}</span>
                  </p>
                </div>

                {/* Asistencia */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Estudiantes Asistentes
                  </span>
                  <p className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    <Users className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0" />
                    <span>{data.numEstudiantes || '0'} alumnos</span>
                  </p>
                </div>

              </div>

                {/* Tipo de Sesión */}
                <div className="space-y-0.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tipo de Sesión
                  </span>
                  <p className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {(data.tipo_sesion || data.tipoSesion || 'Clase Regular') !== 'Clase Regular' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-amber-500 dark:text-amber-400">{data.tipo_sesion || data.tipoSesion}</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">Clase Regular</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Fecha a Recuperar (solo si aplica) */}
                {(data.fecha_recuperar || data.fechaRecuperar) && (
                  <div className="space-y-0.5">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Fecha de Clase a Recuperar
                    </span>
                    <p className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      <span>{data.fecha_recuperar || data.fechaRecuperar}</span>
                    </p>
                  </div>
                )}


              {/* Tema Desarrollado */}
              <div className="pt-2 border-t border-slate-200/50 dark:border-white/10 space-y-1">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tema Desarrollado en Sílabo
                </span>
                <p className={`text-xs font-medium italic p-2.5 rounded-xl border ${isDarkMode ? 'bg-black/30 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                  "{data.temaProgramado || 'Sin tema especificado'}"
                </p>
              </div>

              {/* Recursos Utilizados Chips */}
              {Array.isArray(data.recursos) && data.recursos.length > 0 && (
                <div className="space-y-1.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Recursos Empleados
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.recursos.map((recId) => {
                      const rec = RECURSOS_MAP[recId] || { label: recId, icon: '📌' }
                      return (
                        <span
                          key={recId}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                            }`}
                        >
                          <span>{rec.icon}</span>
                          <span>{rec.label}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer: Dynamic buttons according to isSent */}
            {isSent ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-base bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white shadow-2xl shadow-red-950/50 hover:from-red-800 hover:to-red-700 flex items-center justify-center gap-3 transition-all cursor-pointer ring-2 ring-red-500/30"
                >
                  <LogOut className="w-5 h-5 text-red-200" />
                  <span>Finalizar y Salir del Sistema</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onConfirmAndSend}
                  disabled={isSending}
                  className="w-full sm:flex-1 py-4 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white shadow-2xl shadow-red-950/50 hover:from-red-800 hover:to-red-700 flex items-center justify-center gap-2.5 transition-all cursor-pointer ring-2 ring-red-500/30"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Guardando en Google Sheets...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirmar y Guardar en Google Sheets</span>
                    </>
                  )}
                </button>

                {!isSending && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={`
                      w-full sm:w-auto py-4 px-5 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all cursor-pointer
                      ${isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }
                    `}
                  >
                    <Edit3 className="w-4 h-4 text-slate-400" />
                    <span>Revisar / Modificar</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default ConfirmationModal
