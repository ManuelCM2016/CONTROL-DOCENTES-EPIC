import { motion } from 'framer-motion'
import { Loader2, Database, CheckCircle2 } from 'lucide-react'

const LoadingView = () => {
  const steps = [
    { label: 'Verificando identidad', delay: 0 },
    { label: 'Cargando datos del docente', delay: 0.6 },
    { label: 'Preparando formulario', delay: 1.2 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 25%, #3B0D0D 50%, #2d1515 75%, #1a0a0a 100%)',
      }}
    >
      <div className="text-center">
        {/* Animated spinner */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="relative mx-auto w-20 h-20 mb-8"
        >
          {/* Outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-maroon-500 border-r-maroon-500/30"
          />
          {/* Inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 rounded-full border-2 border-transparent border-b-maroon-400 border-l-maroon-400/30"
          />
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Database className="w-7 h-7 text-maroon-400/80" />
          </div>
        </motion.div>

        {/* Loading steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay, duration: 0.4 }}
              className="flex items-center justify-center gap-2.5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: step.delay + 0.3, type: 'spring' }}
              >
                {index < 2 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: step.delay + 0.5 }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-400/80" />
                  </motion.div>
                ) : (
                  <Loader2 className="w-4 h-4 text-maroon-400 animate-spin" />
                )}
              </motion.div>
              <span className="text-white/60 text-sm tracking-wide">{step.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 w-64 mx-auto"
        >
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.8, ease: 'easeInOut' }}
              className="h-full bg-gradient-to-r from-maroon-600 to-maroon-400 rounded-full"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default LoadingView
