import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Users,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Filter,
  RefreshCw,
  Award,
  Layers,
  Sparkles,
  BarChart3,
  PieChart,
  Activity,
  ChevronDown,
  X,
  FileCheck2
} from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { obtenerEstadisticas, obtenerListaDocentes } from '../../services/adminApi'

// Registrar módulos necesarios de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const DashboardView = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    kpis: {
      totalSesiones: 0,
      sesionesRegulares: 0,
      recuperaciones: 0,
      docentesActivos: 0,
      totalDocentes: 0,
      sesionesValidadas: 0,
      sesionesPendientes: 0,
      cumplimiento: 0
    },
    graficos: {
      topDocentes: [],
      porCurso: [],
      porSemana: [],
      porFecha: []
    }
  })

  // Lista de docentes para el selector de filtros
  const [listaDocentes, setListaDocentes] = useState([])

  // Estado de Filtros
  const [filtros, setFiltros] = useState({
    semana: '',
    docente: '',
    curso: '',
    unidad: '',
    tipo: '',
    fechaDesde: '',
    fechaHasta: ''
  })
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // Cargar estadísticas desde el backend
  const fetchStats = useCallback(async (filtrosActuales = filtros, isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await obtenerEstadisticas(filtrosActuales)
      if (res.success && res.data) {
        setStats(res.data)
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filtros])

  // Cargar lista de docentes al montar
  useEffect(() => {
    fetchStats()
    obtenerListaDocentes().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setListaDocentes(res.data)
      }
    })
  }, [])

  // Manejar cambio en filtros
  const handleFiltroChange = (key, value) => {
    const nuevosFiltros = { ...filtros, [key]: value }
    setFiltros(nuevosFiltros)
    fetchStats(nuevosFiltros, true)
  }

  // Limpiar todos los filtros
  const handleLimpiarFiltros = () => {
    const filtrosVacios = {
      semana: '',
      docente: '',
      curso: '',
      unidad: '',
      tipo: '',
      fechaDesde: '',
      fechaHasta: ''
    }
    setFiltros(filtrosVacios)
    fetchStats(filtrosVacios, true)
  }

  // Contar filtros activos
  const totalFiltrosActivos = Object.values(filtros).filter(Boolean).length

  // Configuración de Gráfico de Líneas (Sesiones por Semana)
  const lineChartData = {
    labels: (stats.graficos?.porSemana || []).map((s) => `Semana ${s.semana}`),
    datasets: [
      {
        label: 'Sesiones Dictadas',
        data: (stats.graficos?.porSemana || []).map((s) => s.sesiones),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.35,
        fill: true
      }
    ]
  }

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#10b981',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 11 }, precision: 0 }
      }
    }
  }

  // Configuración de Gráfico de Barras (Top Docentes)
  const barChartData = {
    labels: (stats.graficos?.topDocentes || []).slice(0, 7).map((d) => {
      const parts = d.nombre.split(' ')
      return parts.slice(0, 2).join(' ')
    }),
    datasets: [
      {
        label: 'Sesiones',
        data: (stats.graficos?.topDocentes || []).slice(0, 7).map((d) => d.sesiones),
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)',
          'rgba(99, 102, 241, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(239, 68, 68, 0.85)',
          'rgba(14, 165, 233, 0.85)'
        ],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#fff',
        bodyColor: '#60a5fa',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 }, precision: 0 }
      }
    }
  }

  // Configuración de Gráfico Circular (Por Curso)
  const doughnutData = {
    labels: (stats.graficos?.porCurso || []).slice(0, 5).map((c) => {
      const name = c.curso.replace(/CI-\d+\s*/i, '').trim()
      return name.length > 20 ? name.substring(0, 20) + '...' : name
    }),
    datasets: [
      {
        data: (stats.graficos?.porCurso || []).slice(0, 5).map((c) => c.sesiones),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#8b5cf6',
          '#ec4899'
        ],
        borderColor: '#0d1117',
        borderWidth: 2
      }
    ]
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: { size: 10 },
          boxWidth: 10,
          padding: 10
        }
      }
    },
    cutout: '70%'
  }

  return (
    <div className="space-y-6">
      {/* Header Superior & Controles de Filtro */}
      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Dashboard de Estadísticas & Avance Silábico
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Semestre 2026-II
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium">
                Métricas globales, cumplimiento de la plana docente y distribución académica
              </p>
            </div>
          </div>

          {/* Botones de Control */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showFilterPanel || totalFiltrosActivos > 0
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Filtros Avanzados</span>
              {totalFiltrosActivos > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {totalFiltrosActivos}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`} />
            </button>

            {totalFiltrosActivos > 0 && (
              <button
                onClick={handleLimpiarFiltros}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all text-xs font-bold cursor-pointer"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}

            <button
              onClick={() => fetchStats(filtros, true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Panel de Filtros Desplegable */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden pt-4 mt-4 border-t border-white/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {/* Filtro Semana */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">
                    Semana Académica
                  </label>
                  <select
                    value={filtros.semana}
                    onChange={(e) => handleFiltroChange('semana', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Todas las Semanas</option>
                    {[...Array(18)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        Semana {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Docente */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">
                    Docente
                  </label>
                  <select
                    value={filtros.docente}
                    onChange={(e) => handleFiltroChange('docente', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Todos los Docentes</option>
                    {listaDocentes.map((d) => (
                      <option key={d.dni} value={d.dni}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Unidad */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">
                    Unidad Académica
                  </label>
                  <select
                    value={filtros.unidad}
                    onChange={(e) => handleFiltroChange('unidad', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Todas las Unidades</option>
                    <option value="I">Unidad I</option>
                    <option value="II">Unidad II</option>
                    <option value="III">Unidad III</option>
                  </select>
                </div>

                {/* Filtro Tipo de Sesión */}
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">
                    Tipo de Sesión
                  </label>
                  <select
                    value={filtros.tipo}
                    onChange={(e) => handleFiltroChange('tipo', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Todos los Tipos</option>
                    <option value="Clase Regular">Clase Regular</option>
                    <option value="Recuperación">Recuperación de Clase</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tarjetas de KPIs Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Sesiones */}
        <motion.div
          whileHover={{ y: -3 }}
          className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Total Sesiones
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {stats.kpis?.totalSesiones || 0}
          </div>
          <div className="text-[11px] text-blue-400/80 font-semibold mt-1">
            {stats.kpis?.sesionesRegulares || 0} regulares
          </div>
        </motion.div>

        {/* Docentes Activos */}
        <motion.div
          whileHover={{ y: -3 }}
          className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Docentes Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {stats.kpis?.docentesActivos || 0}{' '}
            <span className="text-xs text-white/40 font-normal">/ {stats.kpis?.totalDocentes || 0}</span>
          </div>
          <div className="text-[11px] text-emerald-400/80 font-semibold mt-1">
            {stats.kpis?.cumplimiento || 0}% de la plana
          </div>
        </motion.div>

        {/* Cumplimiento Silábico */}
        <motion.div
          whileHover={{ y: -3 }}
          className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Avance Silábico
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {stats.kpis?.cumplimiento || 0}%
          </div>
          {/* Mini progress bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
              style={{ width: `${Math.min(stats.kpis?.cumplimiento || 0, 100)}%` }}
            />
          </div>
        </motion.div>

        {/* Recuperaciones */}
        <motion.div
          whileHover={{ y: -3 }}
          className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Recuperaciones
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {stats.kpis?.recuperaciones || 0}
          </div>
          <div className="text-[11px] text-amber-400/80 font-semibold mt-1">
            Clases de recuperación
          </div>
        </motion.div>

        {/* Sesiones Validadas */}
        <motion.div
          whileHover={{ y: -3 }}
          className="col-span-2 lg:col-span-1 p-4 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              Validadas
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            {stats.kpis?.sesionesValidadas || 0}
          </div>
          <div className="text-[11px] text-teal-400/80 font-semibold mt-1">
            {stats.kpis?.sesionesPendientes || 0} pendientes
          </div>
        </motion.div>
      </div>

      {/* Gráficos Principales (Fila 1: Líneas & Dona) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gráfico de Líneas: Sesiones por Semana */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                Tendencia de Sesiones por Semana Académica
              </h3>
              <p className="text-xs text-white/40">
                Evolución de clases dictadas a lo largo del semestre
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase font-mono">
              Avance Semanal
            </span>
          </div>
          <div className="h-64 w-full">
            {stats.graficos?.porSemana?.length > 0 ? (
              <Line data={lineChartData} options={lineChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-white/40">
                No hay datos suficientes para graficar la tendencia semanal.
              </div>
            )}
          </div>
        </div>

        {/* Gráfico Circular: Distribución por Curso */}
        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Distribución por Asignatura</h3>
              <PieChart className="w-4 h-4 text-white/40" />
            </div>
            <p className="text-xs text-white/40 mb-3">Top cursos con mayor registro</p>
          </div>
          <div className="h-56 w-full relative">
            {stats.graficos?.porCurso?.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-white/40">
                Sin datos de cursos
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos Fila 2: Top Docentes & Tabla Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Docentes Más Activos (Barras) */}
        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                Top Docentes con Mayor Número de Sesiones
              </h3>
              <p className="text-xs text-white/40">Docentes más constantes en el registro</p>
            </div>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="h-60 w-full">
            {stats.graficos?.topDocentes?.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-white/40">
                Sin datos de docentes
              </div>
            )}
          </div>
        </div>

        {/* Tabla Resumen de Docentes */}
        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col justify-between">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-white">Ranking de Registro Docente</h3>
            <p className="text-xs text-white/40">Sesiones acumuladas en el sistema</p>
          </div>

          <div className="divide-y divide-white/5 max-h-56 overflow-y-auto custom-scrollbar">
            {(stats.graficos?.topDocentes || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-white/40">
                No hay registros aún para mostrar en el ranking.
              </div>
            ) : (
              (stats.graficos?.topDocentes || []).map((doc, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : idx === 1
                          ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                          : idx === 2
                          ? 'bg-amber-800/20 text-amber-400 border border-amber-800/40'
                          : 'bg-white/5 text-white/50'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">{doc.nombre}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    {doc.sesiones} sesiones
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardView
