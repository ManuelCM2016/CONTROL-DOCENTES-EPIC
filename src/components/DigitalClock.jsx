import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

const DigitalClock = ({ isDarkMode }) => {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('es-PE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className={`font-mono-clock text-xl font-semibold tracking-wider transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-maroon-800'}`}>
          {formatTime(time)}
        </div>
        <div className={`text-[11px] capitalize leading-none mt-0.5 transition-colors duration-500 ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
          {formatDate(time)}
        </div>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-white/10 text-white/80' : 'bg-maroon-50 text-maroon-600'}`}>
        <Clock className="w-5 h-5" />
      </div>
    </div>
  )
}

export default DigitalClock
