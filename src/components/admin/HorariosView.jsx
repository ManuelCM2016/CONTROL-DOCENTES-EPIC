import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Filter,
  Users,
  BookOpen,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  ChevronDown,
  Grid3X3,
  List,
  Sparkles,
  GraduationCap,
  Building2,
  DoorOpen
} from 'lucide-react'
import { obtenerHorarios, cargarHorariosSemestre } from '../../services/adminApi'
import * as XLSX from 'xlsx'

// ── Constantes ──
const COL_MAP = { 2: 'Lunes', 3: 'Martes', 4: 'Miércoles', 5: 'Jueves', 6: 'Viernes', 7: 'Sabado', 8: 'Domingo' }
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado']
const DIAS_CORTOS = { 'Lunes': 'LUN', 'Martes': 'MAR', 'Miércoles': 'MIÉ', 'Jueves': 'JUE', 'Viernes': 'VIE', 'Sabado': 'SÁB' }

// Paleta de colores por ciclo
const CICLO_COLORS = {
  '1':  { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.4)',  text: '#93c5fd', dot: '#3b82f6' },
  '2':  { bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.4)',  text: '#6ee7b7', dot: '#10b981' },
  '3':  { bg: 'rgba(139,92,246,0.18)',  border: 'rgba(139,92,246,0.4)',  text: '#c4b5fd', dot: '#8b5cf6' },
  '4':  { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.4)',  text: '#fcd34d', dot: '#f59e0b' },
  '5':  { bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.4)',   text: '#fca5a5', dot: '#ef4444' },
  '6':  { bg: 'rgba(14,165,233,0.18)',  border: 'rgba(14,165,233,0.4)',  text: '#7dd3fc', dot: '#0ea5e9' },
  '7':  { bg: 'rgba(168,85,247,0.18)',  border: 'rgba(168,85,247,0.4)',  text: '#d8b4fe', dot: '#a855f7' },
  '8':  { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.4)',   text: '#86efac', dot: '#22c55e' },
  '9':  { bg: 'rgba(244,114,182,0.18)', border: 'rgba(244,114,182,0.4)', text: '#f9a8d4', dot: '#f472b6' },
  '10': { bg: 'rgba(251,146,60,0.18)',  border: 'rgba(251,146,60,0.4)',  text: '#fdba74', dot: '#fb923c' },
}

const getColor = (ciclo) => CICLO_COLORS[ciclo] || CICLO_COLORS['1']

// ── Franja horaria: genera bloques de 30 min desde 07:00 hasta 22:00 ──
const HORAS_FRANJAS = []
for (let h = 7; h <= 21; h++) {
  HORAS_FRANJAS.push(`${String(h).padStart(2, '0')}:00`)
  HORAS_FRANJAS.push(`${String(h).padStart(2, '0')}:30`)
}

function horaToMinutos(hora) {
  if (!hora) return 0
  const [h, m] = hora.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Parsea un workbook Excel de Ciclo-Cursos y devuelve un array plano
 */
function parseExcelCiclos(workbook) {
  const results = []
  workbook.SheetNames.forEach(sheetName => {
    const cicloMatch = sheetName.match(/(\d+)/)
    const ciclo = cicloMatch ? cicloMatch[1] : sheetName
    const ws = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    let i = 0
    if (data.length > 0 && String(data[0]?.[0] || '').toLowerCase().includes('codi')) i = 1
    while (i < data.length) {
      const row1 = data[i] || []
      const codigo = String(row1[0] || '').trim()
      if (!codigo || codigo.toLowerCase().includes('codi')) { i++; continue }
      const asignatura = String(row1[1] || '').trim()
      const horariosDia = {}
      for (let col = 2; col <= 8; col++) {
        const val = String(row1[col] || '').trim()
        if (val && val.includes('~')) horariosDia[col] = { rango: val }
      }
      const row2 = data[i + 1] || []
      let docente = ''
      const docenteStr = String(row2[1] || '').trim()
      if (docenteStr.startsWith('Docente:')) docente = docenteStr.replace('Docente:', '').trim()
      for (let col = 2; col <= 8; col++) {
        const val = String(row2[col] || '').trim()
        if (val && horariosDia[col]) horariosDia[col].aula = val
      }
      const row3 = data[i + 2] || []
      let seccion = ''
      const secStr = String(row3[1] || '').trim()
      if (secStr.startsWith('Sección:')) seccion = secStr.replace('Sección:', '').trim()
      for (const [col, info] of Object.entries(horariosDia)) {
        const dia = COL_MAP[col]
        const rangoMatch = info.rango.match(/(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})\s*\((\d+)h?\)/)
        if (rangoMatch) {
          results.push({
            CODIGO: codigo, CURSO: asignatura, DOCENTE: docente, SECCION: seccion,
            DIA: dia, HORA_INICIO: rangoMatch[1], HORA_FIN: rangoMatch[2],
            DURACION_HRS: parseInt(rangoMatch[3]), AULA: info.aula || '', CICLO: ciclo
          })
        }
      }
      i += 3
    }
  })
  return results
}

// ═══════════════════════════════════════════════════════
// CELDA DE CLASE EN LA GRILLA
// ═══════════════════════════════════════════════════════
const ClaseCell = ({ clase, rowSpan, cellHeight, isCompact = false, showAula = true }) => {
  const color = getColor(clase.ciclo)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ scale: 1.04, zIndex: 30 }}
      className="absolute inset-0.5 rounded-xl cursor-pointer overflow-hidden group shadow-md"
      style={{
        background: color.bg,
        border: `1.5px solid ${color.border}`,
        height: `${cellHeight}px`,
      }}
      title={`${clase.curso}\nDocente: ${clase.docente}\nAula: ${clase.aula} | Sec: ${clase.seccion || 'A'}\nHorario: ${clase.horaInicio} – ${clase.horaFin} (${clase.duracionHrs}h)\nCiclo: ${clase.ciclo}`}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${color.bg}, transparent 70%)` }}
      />

      <div className={`relative ${isCompact ? 'p-1.5' : 'p-2'} h-full flex flex-col justify-between text-left`}>
        {/* Hora */}
        <div className="flex items-center justify-between gap-1">
          <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} font-black tracking-wide truncate`} style={{ color: color.text }}>
            {clase.horaInicio} ~ {clase.horaFin}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: color.border, color: '#fff' }}>
            {clase.duracionHrs}h
          </span>
        </div>

        {/* Curso */}
        <p className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-black text-white leading-tight mt-1 line-clamp-2`}>
          {clase.curso}
        </p>

        {/* Docente */}
        <p className="text-[9px] text-white/60 font-medium leading-tight mt-0.5 line-clamp-1">
          {clase.docente}
        </p>

        {/* Aula / Ciclo + Sección */}
        <div className="flex items-center justify-between mt-auto pt-1 gap-1">
          <span className="text-[9px] font-black truncate" style={{ color: color.text }}>
            {showAula ? clase.aula : `Ciclo ${clase.ciclo}`}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {!showAula && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-400/20 text-amber-300">
                {clase.aula}
              </span>
            )}
            {clase.seccion && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-white/10 text-white/70">
                Sec. {clase.seccion}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════
const HorariosView = ({ isDarkMode }) => {
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [filtroCiclo, setFiltroCiclo] = useState('')
  const [filtroAula, setFiltroAula] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [viewMode, setViewMode] = useState('grid_ciclos') // 'grid_ciclos' | 'grid_ambientes' | 'list'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  // ── Cargar horarios ──
  const cargarHorariosExistentes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await obtenerHorarios()
      if (res.success && res.data) {
        setHorarios(res.data.horarios || [])
        setMensaje(res.data.mensaje || '')
      } else {
        setHorarios([])
        setMensaje(res.message || 'Error al cargar horarios')
      }
    } catch (err) {
      setMensaje('Error de conexión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarHorariosExistentes() }, [cargarHorariosExistentes])

  // ── Manejar archivo ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const parsed = parseExcelCiclos(workbook)
        if (parsed.length === 0) {
          setUploadResult({ success: false, message: 'No se encontraron registros válidos.' })
          return
        }
        const docentes = new Set(parsed.map(r => r.DOCENTE))
        const cursos = new Set(parsed.map(r => r.CODIGO))
        const aulas = new Set(parsed.map(r => r.AULA))
        const ciclos = new Set(parsed.map(r => r.CICLO))
        setParsedData({
          registros: parsed,
          stats: { totalRegistros: parsed.length, docentes: docentes.size, cursos: cursos.size, aulas: aulas.size, ciclos: [...ciclos].sort((a, b) => Number(a) - Number(b)) }
        })
        setUploadResult(null)
      } catch (err) {
        setUploadResult({ success: false, message: 'Error al leer: ' + err.message })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleConfirmUpload = async () => {
    if (!parsedData) return
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await cargarHorariosSemestre(parsedData.registros)
      if (res.success) {
        setUploadResult({ success: true, message: res.message || `${parsedData.stats.totalRegistros} horarios cargados.` })
        setParsedData(null)
        setTimeout(() => cargarHorariosExistentes(), 1000)
      } else {
        setUploadResult({ success: false, message: res.message || 'Error al cargar.' })
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Error: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  // ── Filtrar horarios ──
  const horariosFiltrados = useMemo(() => {
    return horarios.filter(h => {
      // Filtrar por ciclo en modo ciclos o lista
      if ((viewMode === 'grid_ciclos' || viewMode === 'list') && filtroCiclo && h.ciclo !== filtroCiclo) return false
      // Filtrar por aula en modo ambientes o lista
      if ((viewMode === 'grid_ambientes' || viewMode === 'list') && filtroAula && (h.aula || '').toUpperCase() !== filtroAula.toUpperCase()) return false

      if (filtroBusqueda) {
        const q = filtroBusqueda.toLowerCase()
        return (h.curso || '').toLowerCase().includes(q) ||
               (h.docente || '').toLowerCase().includes(q) ||
               (h.aula || '').toLowerCase().includes(q) ||
               (h.codigo || '').toLowerCase().includes(q) ||
               `ciclo ${h.ciclo}`.includes(q)
      }
      return true
    })
  }, [horarios, viewMode, filtroCiclo, filtroAula, filtroBusqueda])

  // ── Stats ──
  const stats = useMemo(() => {
    const listaAulas = [...new Set(horarios.map(h => (h.aula || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )
    return {
      total: horarios.length,
      docentes: new Set(horarios.map(h => h.docente)).size,
      cursos: new Set(horarios.map(h => h.codigo)).size,
      aulas: new Set(horarios.map(h => h.aula)).size,
      ciclos: [...new Set(horarios.map(h => h.ciclo))].sort((a, b) => Number(a) - Number(b)),
      listaAulas,
    }
  }, [horarios])

  // ═══ GRILLA: agrupar por día y hora ═══
  const gridData = useMemo(() => {
    // Encontrar rango de horas reales
    let minHora = 24 * 60, maxHora = 0
    horariosFiltrados.forEach(h => {
      const ini = horaToMinutos(h.horaInicio)
      const fin = horaToMinutos(h.horaFin)
      if (ini < minHora) minHora = ini
      if (fin > maxHora) maxHora = fin
    })
    // Redondear a horas completas
    minHora = Math.floor(minHora / 60) * 60
    maxHora = Math.ceil(maxHora / 60) * 60
    if (minHora >= maxHora) { minHora = 7 * 60; maxHora = 22 * 60 }

    // Generar franjas de 30 min
    const franjas = []
    for (let m = minHora; m < maxHora; m += 30) {
      const h = Math.floor(m / 60)
      const min = m % 60
      franjas.push({ label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, minutos: m })
    }

    // Agrupar clases por día
    const porDia = {}
    DIAS_SEMANA.forEach(d => { porDia[d] = [] })
    horariosFiltrados.forEach(h => {
      const diaNorm = h.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const diaKey = DIAS_SEMANA.find(d => d.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === diaNorm)
      if (diaKey) porDia[diaKey].push(h)
    })

    return { franjas, porDia, minHora, maxHora }
  }, [horariosFiltrados])

  // ── Hoy ──
  const diaHoy = DIAS_SEMANA[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || ''

  const ROW_HEIGHT = 38 // px per 30-min slot

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            Horarios del Semestre
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Gestión de horarios académicos • {horarios.length > 0 ? `${horarios.length} registros` : 'Sin horarios'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode selector con 3 modos: Por Ciclos | Por Ambientes | Lista */}
          {horarios.length > 0 && (
            <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5">
              <button
                onClick={() => { setViewMode('grid_ciclos'); setFiltroAula('') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid_ciclos' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                title="Horario organizado por ciclos académicos (Ciclo 1 al 10)"
              >
                <GraduationCap className="w-3.5 h-3.5" /> Por Ciclos
              </button>
              <button
                onClick={() => { setViewMode('grid_ambientes'); setFiltroCiclo('') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid_ambientes' 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                title="Horario organizado por aulas y laboratorios"
              >
                <Building2 className="w-3.5 h-3.5" /> Por Ambientes
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                title="Listado en tabla detallada"
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
            </div>
          )}
          <button onClick={cargarHorariosExistentes}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button onClick={() => { setShowUploadModal(true); setParsedData(null); setUploadResult(null) }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-lg shadow-amber-900/30 transition-all cursor-pointer">
            <Upload className="w-4 h-4" /> Cargar Horarios
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {horarios.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Registros', value: stats.total, icon: FileSpreadsheet, gradient: 'from-blue-600/20 to-blue-800/10', iconColor: 'text-blue-400' },
            { label: 'Docentes', value: stats.docentes, icon: Users, gradient: 'from-emerald-600/20 to-emerald-800/10', iconColor: 'text-emerald-400' },
            { label: 'Cursos', value: stats.cursos, icon: BookOpen, gradient: 'from-purple-600/20 to-purple-800/10', iconColor: 'text-purple-400' },
            { label: 'Aulas', value: stats.aulas, icon: MapPin, gradient: 'from-amber-600/20 to-amber-800/10', iconColor: 'text-amber-400' },
          ].map((kpi, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
              className={`p-4 rounded-2xl bg-gradient-to-br ${kpi.gradient} border border-white/10 backdrop-blur-sm`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-white">{kpi.value}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{kpi.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Filtros */}
      {horarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <Filter className="w-4 h-4 text-white/40" />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={filtroBusqueda} onChange={e => setFiltroBusqueda(e.target.value)}
              placeholder={viewMode === 'grid_ambientes' ? "Buscar por aula, curso, docente..." : "Buscar curso, docente, aula..."}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500/50" />
          </div>

          {viewMode === 'grid_ciclos' && (
            <select value={filtroCiclo} onChange={e => setFiltroCiclo(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none">
              <option value="">Todos los ciclos</option>
              {stats.ciclos.map(c => <option key={c} value={c}>Ciclo {c}</option>)}
            </select>
          )}

          {viewMode === 'grid_ambientes' && (
            <select value={filtroAula} onChange={e => setFiltroAula(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none">
              <option value="">Todos los ambientes ({stats.listaAulas.length})</option>
              {stats.listaAulas.map(a => <option key={a} value={a}>Aula / Lab {a}</option>)}
            </select>
          )}

          {viewMode === 'list' && (
            <>
              <select value={filtroCiclo} onChange={e => setFiltroCiclo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none">
                <option value="">Todos los ciclos</option>
                {stats.ciclos.map(c => <option key={c} value={c}>Ciclo {c}</option>)}
              </select>
              <select value={filtroAula} onChange={e => setFiltroAula(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none">
                <option value="">Todos los ambientes ({stats.listaAulas.length})</option>
                {stats.listaAulas.map(a => <option key={a} value={a}>Aula / Lab {a}</option>)}
              </select>
            </>
          )}

          {(filtroCiclo || filtroAula || filtroBusqueda) && (
            <button onClick={() => { setFiltroCiclo(''); setFiltroAula(''); setFiltroBusqueda('') }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold cursor-pointer hover:bg-red-500/20 transition-all">
              Limpiar
            </button>
          )}
          <span className="text-[10px] text-white/30 font-mono ml-auto">{horariosFiltrados.length} de {horarios.length}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="ml-3 text-white/50 text-sm">Cargando horarios...</span>
        </div>
      ) : horarios.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar className="w-16 h-16 text-white/10 mb-4" />
          <h3 className="text-lg font-black text-white/30">No hay horarios cargados</h3>
          <p className="text-xs text-white/20 mt-2 max-w-md">
            {mensaje || 'Usa el botón "Cargar Horarios" para importar los horarios del Intranet UPT.'}
          </p>
        </motion.div>
      ) : (viewMode === 'grid_ciclos' || viewMode === 'grid_ambientes') ? (
        /* ═══════════ VISTA GRILLA (Por Ciclos o Por Ambientes) ═══════════ */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
          
          {/* MODO 1: Franja de Ciclos interactiva (en la parte superior del horario) */}
          {viewMode === 'grid_ciclos' && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                Ciclos:
              </span>
              {stats.ciclos.map(c => {
                const color = getColor(c)
                const isSelected = filtroCiclo === c
                return (
                  <button key={c}
                    onClick={() => setFiltroCiclo(isSelected ? '' : c)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-white/60 scale-105 shadow-lg shadow-black/40'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: color.dot }} />
                    Ciclo {c}
                  </button>
                )
              })}
              {filtroCiclo && (
                <button
                  onClick={() => setFiltroCiclo('')}
                  className="ml-auto text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer transition-colors"
                >
                  ✕ Ver todos los ciclos
                </button>
              )}
            </div>
          )}

          {/* MODO 2: Franja de Salones y Laboratorios (Ambientes) */}
          {viewMode === 'grid_ambientes' && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
              <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
                Ambientes:
              </span>
              <button
                onClick={() => setFiltroAula('')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                  !filtroAula 
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-md ring-2 ring-white/30' 
                    : 'bg-white/5 text-white/50 border border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                🏛️ Todos ({stats.listaAulas.length})
              </button>
              {stats.listaAulas.map(aula => {
                const isSelected = filtroAula.toUpperCase() === aula.toUpperCase()
                const isLab = aula.toLowerCase().includes('lab') || aula.startsWith('S-')
                return (
                  <button key={aula}
                    onClick={() => setFiltroAula(isSelected ? '' : aula)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60 shadow-lg shadow-amber-900/30 ring-2 ring-white/40 scale-105'
                        : isLab
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 hover:scale-105'
                          : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 hover:scale-105'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-400' : isLab ? 'bg-cyan-400' : 'bg-indigo-400'}`} />
                    {aula}
                  </button>
                )
              })}
              {filtroAula && (
                <button
                  onClick={() => setFiltroAula('')}
                  className="ml-auto text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer transition-colors"
                >
                  ✕ Ver todos los ambientes
                </button>
              )}
            </div>
          )}

          {/* Subheader informativo en modo Ambientes */}
          {viewMode === 'grid_ambientes' && (
            <div className="px-4 py-2 bg-white/[0.015] border-b border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white/70">
                  {filtroAula 
                    ? <>Cronograma de Ocupación: <span className="text-amber-300 font-bold">Aula / Lab {filtroAula}</span></>
                    : 'Cronograma Global de Ambientes (Selecciona un aula o laboratorio arriba para ver su horario exclusivo)'
                  }
                </span>
              </div>
              <span className="text-[11px] text-white/40 font-mono font-medium">
                {horariosFiltrados.length} {horariosFiltrados.length === 1 ? 'clase semanal' : 'clases semanales'}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header de días */}
              <div className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-white/10 bg-white/[0.04]">
                <div className="p-3 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white/30" />
                </div>
                {DIAS_SEMANA.map(dia => (
                  <div key={dia}
                    className={`p-3 text-center border-l border-white/5 transition-colors ${dia === diaHoy ? 'bg-amber-500/10' : ''}`}>
                    <p className={`text-xs font-black uppercase tracking-widest ${dia === diaHoy ? 'text-amber-300' : 'text-white/50'}`}>
                      {DIAS_CORTOS[dia]}
                    </p>
                    {dia === diaHoy && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 mx-auto mt-1 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>

              {/* Body: franjas horarias */}
              <div className="relative">
                {gridData.franjas.map((franja, fIdx) => (
                  <div key={franja.label}
                    className={`grid grid-cols-[80px_repeat(6,1fr)] ${fIdx % 2 === 0 ? 'border-t border-white/5' : ''}`}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    {/* Columna de hora */}
                    <div className="flex items-start justify-end pr-3 pt-1 border-r border-white/5">
                      {franja.label.endsWith(':00') && (
                        <span className="text-[10px] font-mono font-bold text-white/30">{franja.label}</span>
                      )}
                    </div>

                    {/* Columnas de días */}
                    {DIAS_SEMANA.map(dia => {
                      const clasesDelDia = gridData.porDia[dia] || []
                      // Encontrar clases que empiezan en esta franja
                      const clasesEnFranja = clasesDelDia.filter(c => {
                        const iniMin = horaToMinutos(c.horaInicio)
                        return iniMin >= franja.minutos && iniMin < franja.minutos + 30
                      })
                      const totalEnFranja = clasesEnFranja.length

                      return (
                        <div key={dia}
                          className={`relative border-l border-white/5 ${dia === diaHoy ? 'bg-amber-500/[0.03]' : ''}`}
                          style={{ height: `${ROW_HEIGHT}px` }}>
                          {clasesEnFranja.map((clase, cIdx) => {
                            const iniMin = horaToMinutos(clase.horaInicio)
                            const finMin = horaToMinutos(clase.horaFin)
                            const duracion = finMin - iniMin
                            const offsetTop = ((iniMin - franja.minutos) / 30) * ROW_HEIGHT
                            const cellHeight = (duracion / 30) * ROW_HEIGHT - 2

                            // Distribuir en columnas cuando coinciden varias clases en la misma franja
                            const widthPercent = totalEnFranja > 1 ? 100 / totalEnFranja : 100
                            const leftPercent = totalEnFranja > 1 ? cIdx * widthPercent : 0

                            return (
                              <div key={cIdx} className="absolute z-10 transition-all duration-200 hover:z-30"
                                style={{
                                  top: `${offsetTop}px`,
                                  height: `${cellHeight}px`,
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`
                                }}>
                                <ClaseCell 
                                  clase={clase} 
                                  cellHeight={cellHeight} 
                                  isCompact={totalEnFranja > 1}
                                  showAula={viewMode !== 'grid_ambientes' || !filtroAula}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        /* ═══════════ VISTA LISTA ═══════════ */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.05] sticky top-0 z-10">
                <tr>
                  {['Ciclo', 'Código', 'Curso', 'Docente', 'Sec', 'Día', 'Horario', 'Hrs', 'Aula'].map(col => (
                    <th key={col} className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {horariosFiltrados.slice(0, 200).map((h, idx) => {
                  const color = getColor(h.ciclo)
                  return (
                    <motion.tr key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.5) }}
                      className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}>
                          {h.ciclo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/70 font-mono">{h.codigo}</td>
                      <td className="px-3 py-2.5 text-white font-bold">{h.curso}</td>
                      <td className="px-3 py-2.5 text-white/80">{h.docente}</td>
                      <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-bold">{h.seccion}</span></td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: color.bg, color: color.text }}>
                          {DIAS_CORTOS[h.dia] || h.dia}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/70 font-mono">{h.horaInicio} – {h.horaFin}</td>
                      <td className="px-3 py-2.5"><span style={{ color: color.text }} className="font-bold">{h.duracionHrs}h</span></td>
                      <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold text-[10px]">{h.aula}</span></td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ═══ MODAL DE CARGA ═══ */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUploadModal(false) }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-[#0d1117] border border-white/15 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Cargar Horarios del Semestre</h3>
                    <p className="text-xs text-white/40">Sube el Excel exportado del Intranet UPT</p>
                  </div>
                </div>
                {!uploading && (
                  <button onClick={() => setShowUploadModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {!parsedData && !uploadResult?.success && (
                  <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center hover:border-amber-500/40 transition-all cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="w-12 h-12 text-white/20 group-hover:text-amber-400/60 mx-auto mb-3 transition-colors" />
                    <p className="text-sm font-bold text-white/60 group-hover:text-white/80 transition-colors">Selecciona el archivo Excel</p>
                    <p className="text-[10px] text-white/30 mt-2">.xlsx (Horario Ciclo-Cursos del Intranet UPT)</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                  </div>
                )}

                {parsedData && !uploadResult?.success && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-bold">Archivo procesado exitosamente</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { v: parsedData.stats.totalRegistros, l: 'Registros', c: 'blue' },
                        { v: parsedData.stats.docentes, l: 'Docentes', c: 'emerald' },
                        { v: parsedData.stats.cursos, l: 'Cursos', c: 'purple' },
                        { v: parsedData.stats.aulas, l: 'Aulas', c: 'amber' }
                      ].map((s, i) => (
                        <div key={i} className={`p-3 rounded-xl bg-${s.c}-500/10 border border-${s.c}-500/20 text-center`}>
                          <p className={`text-xl font-black text-${s.c}-300`}>{s.v}</p>
                          <p className={`text-[9px] text-${s.c}-400/60 font-bold uppercase`}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200/80">
                        <p className="font-bold">⚠️ Esto reemplazará TODOS los horarios existentes</p>
                        <p className="mt-1 text-amber-200/50">Los horarios anteriores serán eliminados y reemplazados por los {parsedData.stats.totalRegistros} nuevos registros.</p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${uploadResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    {uploadResult.success ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />}
                    <div>
                      <p className={`text-sm font-bold ${uploadResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                        {uploadResult.success ? '¡Horarios cargados!' : 'Error al cargar'}
                      </p>
                      <p className={`text-xs mt-1 ${uploadResult.success ? 'text-emerald-200/50' : 'text-red-200/50'}`}>{uploadResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                {!uploading && !uploadResult?.success && (
                  <button onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-bold transition-all cursor-pointer">
                    Cancelar
                  </button>
                )}
                {parsedData && !uploading && !uploadResult?.success && (
                  <button onClick={handleConfirmUpload}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Confirmar y Cargar {parsedData.stats.totalRegistros} Registros
                  </button>
                )}
                {uploading && (
                  <div className="flex items-center gap-3 text-amber-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold">Cargando... (30-60 segundos)</span>
                  </div>
                )}
                {uploadResult?.success && (
                  <button onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all cursor-pointer">
                    Cerrar
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HorariosView
