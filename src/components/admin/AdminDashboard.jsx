import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart3,
  FileSpreadsheet,
  GraduationCap,
  LogOut,
  Shield,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building2,
  Calendar,
  Radio
} from 'lucide-react'
import MonitoreoView from './MonitoreoView'
import DashboardView from './DashboardView'
import HistorialGlobalView from './HistorialGlobalView'
import DocentesView from './DocentesView'

const NAV_ITEMS = [
  {
    id: 'monitoreo',
    label: 'Aulas Activas en Vivo',
    subtitle: 'Monitoreo en tiempo real',
    icon: Radio,
    badge: 'LIVE',
    color: 'emerald'
  },
  {
    id: 'dashboard',
    label: 'Dashboard & Estadísticas',
    subtitle: 'KPIs y avance silábico',
    icon: BarChart3,
    color: 'indigo'
  },
  {
    id: 'historial',
    label: 'Historial de Sesiones',
    subtitle: 'Auditoría y exportación',
    icon: FileSpreadsheet,
    color: 'blue'
  },
  {
    id: 'docentes',
    label: 'Directorio Docente',
    subtitle: 'Plana oficial y asignaturas',
    icon: GraduationCap,
    color: 'purple'
  }
]

const AdminDashboard = ({
  adminUser,
  onLogout,
  isDarkMode,
  toggleTheme
}) => {
  const [currentSection, setCurrentSection] = useState('monitoreo')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div
      className="min-h-screen flex relative overflow-x-hidden text-slate-100"
      style={{
        background: 'linear-gradient(135deg, #07090e 0%, #0d1117 40%, #111827 80%, #0a0d14 100%)'
      }}
    >
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
        />
        <div
          className="absolute top-1/2 -right-40 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #10b981, transparent)' }}
        />
        <div
          className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
        />
      </div>

      {/* Sidebar Lateral (Desktop) */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 88 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col justify-between border-r border-white/10 bg-black/40 backdrop-blur-2xl z-30 p-4 shrink-0 h-screen sticky top-0"
      >
        {/* Top: Logo & App Title */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 px-2 pt-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center shadow-lg shadow-blue-900/30 text-white shrink-0 ring-2 ring-blue-500/30">
                <Shield className="w-6 h-6 text-blue-200" />
              </div>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <h1 className="font-black text-sm text-white tracking-wider leading-tight">
                    DIRECCIÓN EPIC
                  </h1>
                  <p className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">
                    UPT • Control Silábico
                  </p>
                </motion.div>
              )}
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* User Profile Card */}
          <div
            className={`p-3 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden ${sidebarCollapsed ? 'text-center' : ''
              }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md">
                MD
              </div>
              {!sidebarCollapsed && (
                <div className="overflow-hidden whitespace-nowrap">
                  <p className="text-xs font-black text-white truncate">
                    {adminUser?.nombre || 'DRA. DUARTE LIZARZABURO MARIA ETELVINA'}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold uppercase tracking-wider">
                    Directora
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = currentSection === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer group relative ${isActive
                    ? 'bg-gradient-to-r from-blue-600/30 via-indigo-600/20 to-transparent text-white border border-blue-500/40 shadow-lg shadow-blue-950/40'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isActive
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : 'bg-white/5 text-white/50 group-hover:text-white group-hover:bg-white/10'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {!sidebarCollapsed && (
                    <div className="text-left overflow-hidden whitespace-nowrap flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-black animate-pulse">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 font-normal font-sans">
                        {item.subtitle}
                      </p>
                    </div>
                  )}

                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom: Logout */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-xs text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
            title={sidebarCollapsed ? 'Cerrar Sesión' : undefined}
          >
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-xs">Cerrar Sesión</span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Header & Drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-xs text-white">DIRECCIÓN EPIC</h1>
            <p className="text-[9px] font-bold text-blue-400 uppercase">Panel Administrativo</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed inset-x-0 top-16 z-30 bg-[#0d1117]/95 backdrop-blur-2xl border-b border-white/10 p-5 space-y-3"
          >
            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = currentSection === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentSection(item.id)
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all ${isActive
                      ? 'bg-blue-600/30 text-white border border-blue-500/40'
                      : 'text-white/60 hover:text-white bg-white/5'
                      }`}
                  >
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-300 font-bold text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 z-10 pt-16 md:pt-0">
        {/* Top Navbar */}
        <header className="p-5 md:px-8 border-b border-white/10 bg-white/[0.01] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-black text-white tracking-wide uppercase">
                Universidad Privada de Tacna • Facultad de Ingeniería
              </h2>
            </div>
            <p className="text-xs text-white/40 font-medium capitalize mt-0.5">
              📅 {fechaHoy}
            </p>
          </div>

          {/* Quick status badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Directora: DUARTE LIZARZABURO MARIA ETELVINA
            </span>
          </div>
        </header>

        {/* Dynamic View Container */}
        <div className="p-4 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {currentSection === 'monitoreo' && (
                <MonitoreoView isDarkMode={isDarkMode} />
              )}
              {currentSection === 'dashboard' && (
                <DashboardView isDarkMode={isDarkMode} />
              )}
              {currentSection === 'historial' && (
                <HistorialGlobalView isDarkMode={isDarkMode} />
              )}
              {currentSection === 'docentes' && (
                <DocentesView isDarkMode={isDarkMode} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
