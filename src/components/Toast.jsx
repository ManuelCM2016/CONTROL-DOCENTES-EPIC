import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

const toastConfig = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-800',
  },
  error: {
    icon: AlertTriangle,
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-800',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-800',
  },
}

const Toast = ({ type = 'info', message, onDismiss }) => {
  const config = toastConfig[type] || toastConfig.info
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        fixed top-6 left-1/2 z-[100] 
        flex items-center gap-3 px-5 py-3.5 rounded-xl
        border shadow-lg backdrop-blur-sm
        ${config.bg}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
      <p className={`text-sm font-medium ${config.textColor}`}>{message}</p>
      <button
        onClick={onDismiss}
        className={`ml-2 p-1 rounded-lg hover:bg-black/5 transition-colors ${config.textColor} opacity-60 hover:opacity-100`}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export default Toast
