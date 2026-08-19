import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  HelpCircle,
  PlayCircle,
  StopCircle,
  Send,
  BookOpen,
  MapPin,
  Users
} from 'lucide-react'

export const TOUR_STEPS = [
  {
    targetId: 'tour-step-1',
    title: '1. Aula, Fecha y Asignatura',
    badge: 'Paso 1 de 5',
    icon: MapPin,
    description:
      'Ingresa el aula o laboratorio donde dictarás clase. La fecha se coloca automáticamente y debes seleccionar tu Asignatura con su Sección respectiva.',
    tips: 'El número de correlativo de registro se incrementa automáticamente.',
  },
  {
    targetId: 'tour-step-2',
    title: '2. Unidad, Semana y Tema',
    badge: 'Paso 2 de 5',
    icon: BookOpen,
    description:
      'La semana y unidad se calculan con el calendario oficial 2026-II. Escribe brevemente el tema o actividad programada en tu sílabo.',
    tips: 'Puedes ajustar manualmente la unidad si tu cátedra maneja 2 o 3 unidades.',
  },
  {
    targetId: 'tour-step-3',
    title: '3. Recursos y Asistencia',
    badge: 'Paso 3 de 5',
    icon: Users,
    description:
      'Marca los recursos didácticos que emplearás (usa el botón "✨ Habituales" para marcar rápido) y registra la cantidad de estudiantes asistentes.',
    tips: 'Usa los botones (+ / -) o los accesos rápidos (15, 20, 25...) para agilizar.',
  },
  {
    targetId: 'tour-step-4',
    title: '4. Inicio de Clase y Alerta Sonora',
    badge: 'Paso 4 de 5',
    icon: PlayCircle,
    description:
      'Indica la duración de tu clase y haz clic en "Registrar Inicio de Clase". El sistema activará una alarma push silenciosa 10 minutos antes de terminar.',
    tips: 'La hora exacta de inicio quedará grabada en el sistema.',
  },
  {
    targetId: 'tour-step-5',
    title: '5. Salida y Ficha en Google Sheets',
    badge: 'Paso 5 de 5',
    icon: Send,
    description:
      'Al terminar tu clase, pulsa "Registrar Salida de Clase" y luego "Finalizar Sesión y Enviar Registro". Se abrirá tu ficha digital para confirmar y guardar en Google Sheets.',
    tips: 'Una vez enviado, podrás salir del sistema con un solo clic.',
  },
]

const OnboardingTour = ({
  isOpen,
  onClose,
  isDarkMode,
  currentStepIndex = 0,
  setCurrentStepIndex,
}) => {
  const [targetRect, setTargetRect] = useState(null)

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0]
  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === TOUR_STEPS.length - 1
  const StepIcon = currentStep.icon || Sparkles

  // Medir posición del elemento objetivo en pantalla y hacer scroll suave
  useEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const el = document.getElementById(currentStep.targetId)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
          viewportTop: rect.top,
          viewportLeft: rect.left,
        })

        // Auto-scroll centrado suave
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      } else {
        setTargetRect(null)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    const timer = setTimeout(updatePosition, 100)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
      clearTimeout(timer)
    }
  }, [isOpen, currentStepIndex, currentStep.targetId])

  if (!isOpen) return null

  const handleNext = () => {
    if (isLast) {
      onClose()
    } else {
      setCurrentStepIndex((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1))
    }
  }

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1))
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-auto overflow-hidden">
        {/* Fondo oscurecido con spotlight (recorte transparente o fondo atenuado) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
        />

        {/* Resaltador interactivo (Borde de luz en el elemento seleccionado) */}
        {targetRect && (
          <motion.div
            layoutId="tour-spotlight"
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed pointer-events-none z-50 rounded-3xl border-4 border-red-500 shadow-[0_0_40px_rgba(220,38,38,0.6)] ring-4 ring-white/30"
            style={{
              top: targetRect.viewportTop - 8,
              left: targetRect.viewportLeft - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          >
            <span className="absolute -top-3 -right-3 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-red-600 border-2 border-white items-center justify-center text-[10px] font-bold text-white">
                {currentStepIndex + 1}
              </span>
            </span>
          </motion.div>
        )}

        {/* Nube Flotante (Card del Tour) */}
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
          <motion.div
            key={`step-${currentStepIndex}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`
              pointer-events-auto w-full max-w-lg rounded-3xl shadow-2xl border-2 overflow-hidden
              ${isDarkMode
                ? 'bg-gradient-to-b from-[#200c0c] via-[#160808] to-[#100404] border-red-700/50 text-slate-100 shadow-black/90'
                : 'bg-white border-slate-200 text-slate-900 shadow-2xl shadow-slate-900/40'
              }
            `}
          >
            {/* Barra superior de progreso */}
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
              <motion.div
                className="h-full bg-gradient-to-r from-red-600 via-red-500 to-emerald-500"
                initial={{ width: `${(currentStepIndex / TOUR_STEPS.length) * 100}%` }}
                animate={{ width: `${((currentStepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="p-6 sm:p-7 space-y-4">
              {/* Header con Badge y Botón de Cerrar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-800/20 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-800/30">
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    isDarkMode ? 'bg-red-950/80 text-red-300 border border-red-800/50' : 'bg-red-900/10 text-red-900 border border-red-900/20'
                  }`}>
                    {currentStep.badge}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  title="Cerrar guía"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Título y Descripción */}
              <div className="space-y-2">
                <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentStep.title}
                </h3>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {currentStep.description}
                </p>
              </div>

              {/* Tip / Consejo */}
              {currentStep.tips && (
                <div className={`p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${
                  isDarkMode
                    ? 'bg-red-950/30 border-red-800/30 text-red-300'
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}>
                  <Sparkles className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{currentStep.tips}</span>
                </div>
              )}

              {/* Indicadores de bolitas de pasos */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentStepIndex
                        ? 'w-6 bg-red-600'
                        : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                    title={`Ir al paso ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Footer con Botones de Navegación */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`text-xs font-semibold hover:underline ${
                    isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Omitir guía
                </button>

                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className={`px-3.5 py-2.5 rounded-xl font-bold text-xs border flex items-center gap-1.5 transition-all ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-red-800 to-red-900 text-white shadow-lg shadow-red-950/40 hover:from-red-700 hover:to-red-800 flex items-center gap-1.5 transition-all"
                  >
                    <span>{isLast ? '¡Entendido, Comenzar!' : 'Siguiente'}</span>
                    {isLast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}

export default OnboardingTour
