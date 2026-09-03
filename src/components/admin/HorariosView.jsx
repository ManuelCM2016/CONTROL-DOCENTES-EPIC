import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  ChevronDown,
  Loader2,
  Download,
  Trash2,
  Eye
} from 'lucide-react'
import { obtenerHorarios, cargarHorariosSemestre } from '../../services/adminApi'
import * as XLSX from 'xlsx'

// ── Constantes de mapeo (mismo parser que el script Node.js) ──
const COL_MAP = { 2: 'Lunes', 3: 'Martes', 4: 'Miércoles', 5: 'Jueves', 6: 'Viernes', 7: 'Sabado', 8: 'Domingo' }
const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
const DIAS_CORTOS = { 'Lunes': 'LUN', 'Martes': 'MAR', 'Miércoles': 'MIE', 'Jueves': 'JUE', 'Viernes': 'VIE', 'Sabado': 'SAB', 'Domingo': 'DOM' }

/**
 * Parsea un workbook Excel de Ciclo-Cursos (formato UPT Intranet)
 * y devuelve un array plano de registros de horarios
 */
function parseExcelCiclos(workbook) {
  const results = []

  workbook.SheetNames.forEach(sheetName => {
    const cicloMatch = sheetName.match(/(\d+)/)
    const ciclo = cicloMatch ? cicloMatch[1] : sheetName
    const ws = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    let i = 0
    // Skip header row
    if (data.length > 0 && String(data[0]?.[0] || '').includes('Código')) i = 1
    if (data.length > 0 && String(data[0]?.[0] || '').toLowerCase().includes('codigo')) i = 1

    while (i < data.length) {
      const row1 = data[i] || []
      const codigo = String(row1[0] || '').trim()

      if (!codigo || codigo.toLowerCase() === 'código' || codigo.toLowerCase() === 'codigo') {
        i++
        continue
      }

      const asignatura = String(row1[1] || '').trim()

      // Collect schedule from row1 (hour ranges)
      const horariosDia = {}
      for (let col = 2; col <= 8; col++) {
        const val = String(row1[col] || '').trim()
        if (val && val.includes('~')) {
          horariosDia[col] = { rango: val }
        }
      }

      // Next row: Docente + Aulas
      const row2 = data[i + 1] || []
      let docente = ''
      const docenteStr = String(row2[1] || '').trim()
      if (docenteStr.startsWith('Docente:')) {
        docente = docenteStr.replace('Docente:', '').trim()
      }
      for (let col = 2; col <= 8; col++) {
        const val = String(row2[col] || '').trim()
        if (val && horariosDia[col]) {
          horariosDia[col].aula = val
        }
      }

      // Next row: Seccion
      const row3 = data[i + 2] || []
      let seccion = ''
      const secStr = String(row3[1] || '').trim()
      if (secStr.startsWith('Sección:')) {
        seccion = secStr.replace('Sección:', '').trim()
      }

      // Generate records for each day
      for (const [col, info] of Object.entries(horariosDia)) {
        const dia = COL_MAP[col]
        const rangoMatch = info.rango.match(/(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})\s*\((\d+)h?\)/)
        if (rangoMatch) {
          results.push({
            CODIGO: codigo,
            CURSO: asignatura,
            DOCENTE: docente,
            SECCION: seccion,
            DIA: dia,
            HORA_INICIO: rangoMatch[1],
            HORA_FIN: rangoMatch[2],
            DURACION_HRS: parseInt(rangoMatch[3]),
            AULA: info.aula || '',
            CICLO: ciclo
          })
        }
      }

      i += 3
    }
  })

  return results
}

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: HorariosView
// ═══════════════════════════════════════════════════════
const HorariosView = ({ isDarkMode }) => {
  const [horarios, setHorarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')

  // Filtros
  const [filtroCiclo, setFiltroCiclo] = useState('')
  const [filtroDia, setFiltroDia] = useState('')
  const [filtroDocente, setFiltroDocente] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')

  // Modal de carga
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  const fileInputRef = useRef(null)

  // ── Cargar horarios existentes ──
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

  useEffect(() => {
    cargarHorariosExistentes()
  }, [cargarHorariosExistentes])

  // ── Manejar selección de archivo ──
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
          setUploadResult({ success: false, message: 'No se encontraron registros válidos en el archivo. Verifica que el formato sea el correcto (Ciclo-Cursos del Intranet UPT).' })
          return
        }

        // Calcular estadísticas
        const docentes = new Set(parsed.map(r => r.DOCENTE))
        const cursos = new Set(parsed.map(r => r.CODIGO))
        const aulas = new Set(parsed.map(r => r.AULA))
        const ciclos = new Set(parsed.map(r => r.CICLO))

        setParsedData({
          registros: parsed,
          stats: {
            totalRegistros: parsed.length,
            docentes: docentes.size,
            cursos: cursos.size,
            aulas: aulas.size,
            ciclos: [...ciclos].sort((a, b) => Number(a) - Number(b))
          }
        })
        setUploadResult(null)
      } catch (err) {
        setUploadResult({ success: false, message: 'Error al leer el archivo: ' + err.message })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Confirmar y enviar al backend ──
  const handleConfirmUpload = async () => {
    if (!parsedData) return
    setUploading(true)
    setUploadResult(null)

    try {
      const res = await cargarHorariosSemestre(parsedData.registros)
      if (res.success) {
        setUploadResult({ success: true, message: res.message || `${parsedData.stats.totalRegistros} horarios cargados exitosamente.` })
        setParsedData(null)
        // Recargar la tabla
        setTimeout(() => {
          cargarHorariosExistentes()
        }, 1000)
      } else {
        setUploadResult({ success: false, message: res.message || 'Error al cargar horarios.' })
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Error: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  // ── Filtrar horarios ──
  const horariosFiltrados = horarios.filter(h => {
    if (filtroCiclo && h.ciclo !== filtroCiclo) return false
    if (filtroDia && h.dia !== filtroDia) return false
    if (filtroDocente && !h.docente.toLowerCase().includes(filtroDocente.toLowerCase())) return false
    if (filtroBusqueda) {
      const q = filtroBusqueda.toLowerCase()
      return (
        h.curso.toLowerCase().includes(q) ||
        h.docente.toLowerCase().includes(q) ||
        h.aula.toLowerCase().includes(q) ||
        h.codigo.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Stats rápidos ──
  const statsActuales = {
    total: horarios.length,
    docentes: new Set(horarios.map(h => h.docente)).size,
    cursos: new Set(horarios.map(h => h.codigo)).size,
    aulas: new Set(horarios.map(h => h.aula)).size,
    ciclos: [...new Set(horarios.map(h => h.ciclo))].sort((a, b) => Number(a) - Number(b))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            Horarios del Semestre
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Gestión de horarios académicos • {horarios.length > 0 ? `${horarios.length} registros cargados` : 'Sin horarios cargados'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cargarHorariosExistentes}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={() => {
              setShowUploadModal(true)
              setParsedData(null)
              setUploadResult(null)
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Cargar Horarios del Semestre
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {horarios.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Registros', value: statsActuales.total, icon: FileSpreadsheet, color: 'blue' },
            { label: 'Docentes', value: statsActuales.docentes, icon: Users, color: 'emerald' },
            { label: 'Cursos', value: statsActuales.cursos, icon: BookOpen, color: 'purple' },
            { label: 'Aulas', value: statsActuales.aulas, icon: MapPin, color: 'amber' },
          ].map((kpi, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${kpi.color}-500/20 flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 text-${kpi.color}-400`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-white">{kpi.value}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{kpi.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {horarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <Filter className="w-4 h-4 text-white/40" />

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filtroBusqueda}
              onChange={e => setFiltroBusqueda(e.target.value)}
              placeholder="Buscar curso, docente, aula..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <select
            value={filtroCiclo}
            onChange={e => setFiltroCiclo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none"
          >
            <option value="">Todos los ciclos</option>
            {statsActuales.ciclos.map(c => (
              <option key={c} value={c}>Ciclo {c}</option>
            ))}
          </select>

          <select
            value={filtroDia}
            onChange={e => setFiltroDia(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs cursor-pointer focus:outline-none"
          >
            <option value="">Todos los días</option>
            {DIAS_ORDEN.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {(filtroCiclo || filtroDia || filtroBusqueda) && (
            <button
              onClick={() => { setFiltroCiclo(''); setFiltroDia(''); setFiltroBusqueda(''); setFiltroDocente('') }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold cursor-pointer hover:bg-red-500/20 transition-all"
            >
              Limpiar filtros
            </button>
          )}

          <span className="text-[10px] text-white/30 font-mono ml-auto">
            {horariosFiltrados.length} de {horarios.length}
          </span>
        </div>
      )}

      {/* Tabla de Horarios */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="ml-3 text-white/50 text-sm">Cargando horarios...</span>
        </div>
      ) : horarios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar className="w-16 h-16 text-white/10 mb-4" />
          <h3 className="text-lg font-black text-white/30">No hay horarios cargados</h3>
          <p className="text-xs text-white/20 mt-2 max-w-md">
            {mensaje || 'Usa el botón "Cargar Horarios del Semestre" para importar los horarios desde el archivo Excel del Intranet UPT.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.05] sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Ciclo</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Código</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider min-w-[200px]">Curso</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider min-w-[180px]">Docente</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Sec</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Día</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Horario</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Hrs</th>
                  <th className="px-3 py-3 text-left text-white/50 font-bold uppercase tracking-wider">Aula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {horariosFiltrados.slice(0, 200).map((h, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black">
                        {h.ciclo}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/70 font-mono">{h.codigo}</td>
                    <td className="px-3 py-2.5 text-white font-bold">{h.curso}</td>
                    <td className="px-3 py-2.5 text-white/80">{h.docente}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-bold">{h.seccion}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        h.dia === 'Lunes' ? 'bg-blue-500/20 text-blue-300' :
                        h.dia === 'Martes' ? 'bg-emerald-500/20 text-emerald-300' :
                        h.dia === 'Miércoles' ? 'bg-purple-500/20 text-purple-300' :
                        h.dia === 'Jueves' ? 'bg-amber-500/20 text-amber-300' :
                        h.dia === 'Viernes' ? 'bg-red-500/20 text-red-300' :
                        h.dia === 'Sabado' ? 'bg-cyan-500/20 text-cyan-300' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {DIAS_CORTOS[h.dia] || h.dia}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/70 font-mono">
                      {h.horaInicio} – {h.horaFin}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-amber-300 font-bold">{h.duracionHrs}h</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold text-[10px]">
                        {h.aula}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {horariosFiltrados.length > 200 && (
              <div className="p-3 text-center text-white/30 text-xs bg-white/[0.02] border-t border-white/5">
                Mostrando 200 de {horariosFiltrados.length} registros. Usa los filtros para refinar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL DE CARGA ═══ */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUploadModal(false) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-[#0d1117] border border-white/15 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Cargar Horarios del Semestre</h3>
                    <p className="text-xs text-white/40">Sube el archivo Excel exportado del Intranet UPT</p>
                  </div>
                </div>
                {!uploading && (
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Zona de arrastrar / seleccionar archivo */}
                {!parsedData && (
                  <div
                    className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center hover:border-amber-500/40 transition-all cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSpreadsheet className="w-12 h-12 text-white/20 group-hover:text-amber-400/60 mx-auto mb-3 transition-colors" />
                    <p className="text-sm font-bold text-white/60 group-hover:text-white/80 transition-colors">
                      Haz clic para seleccionar el archivo Excel
                    </p>
                    <p className="text-[10px] text-white/30 mt-2">
                      Formato aceptado: .xlsx (Horario Ciclo-Cursos del Intranet UPT)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Vista previa de datos procesados */}
                {parsedData && !uploadResult?.success && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-bold">Archivo procesado exitosamente</span>
                    </div>

                    {/* Stats del archivo */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                        <p className="text-xl font-black text-blue-300">{parsedData.stats.totalRegistros}</p>
                        <p className="text-[9px] text-blue-400/60 font-bold uppercase">Registros</p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <p className="text-xl font-black text-emerald-300">{parsedData.stats.docentes}</p>
                        <p className="text-[9px] text-emerald-400/60 font-bold uppercase">Docentes</p>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                        <p className="text-xl font-black text-purple-300">{parsedData.stats.cursos}</p>
                        <p className="text-[9px] text-purple-400/60 font-bold uppercase">Cursos</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                        <p className="text-xl font-black text-amber-300">{parsedData.stats.aulas}</p>
                        <p className="text-[9px] text-amber-400/60 font-bold uppercase">Aulas</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/50">
                      <span className="font-bold text-white/70">Ciclos detectados: </span>
                      {parsedData.stats.ciclos.map(c => (
                        <span key={c} className="inline-block mx-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">
                          {c}
                        </span>
                      ))}
                    </div>

                    {/* Preview primeros 5 registros */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-3 py-2 bg-white/[0.04] text-[10px] text-white/40 font-bold uppercase tracking-wider">
                        Vista previa (primeros 5 registros)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <tbody className="divide-y divide-white/5">
                            {parsedData.registros.slice(0, 5).map((r, i) => (
                              <tr key={i} className="text-white/70">
                                <td className="px-2 py-1.5 font-mono text-indigo-300">{r.CODIGO}</td>
                                <td className="px-2 py-1.5 font-bold text-white">{r.CURSO.substring(0, 30)}...</td>
                                <td className="px-2 py-1.5">{r.DOCENTE.substring(0, 25)}</td>
                                <td className="px-2 py-1.5 text-amber-300">{r.DIA}</td>
                                <td className="px-2 py-1.5 font-mono">{r.HORA_INICIO}-{r.HORA_FIN}</td>
                                <td className="px-2 py-1.5 text-emerald-300">{r.AULA}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Advertencia */}
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200/80">
                        <p className="font-bold">⚠️ Esto reemplazará TODOS los horarios existentes</p>
                        <p className="mt-1 text-amber-200/50">
                          Los horarios anteriores serán eliminados y reemplazados por los {parsedData.stats.totalRegistros} nuevos registros.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resultado de la carga */}
                {uploadResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                    uploadResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    {uploadResult.success ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-bold ${uploadResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                        {uploadResult.success ? '¡Horarios cargados exitosamente!' : 'Error al cargar'}
                      </p>
                      <p className={`text-xs mt-1 ${uploadResult.success ? 'text-emerald-200/50' : 'text-red-200/50'}`}>
                        {uploadResult.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                {!uploading && !uploadResult?.success && (
                  <button
                    onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}

                {parsedData && !uploading && !uploadResult?.success && (
                  <button
                    onClick={handleConfirmUpload}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Confirmar y Cargar {parsedData.stats.totalRegistros} Registros
                  </button>
                )}

                {uploading && (
                  <div className="flex items-center gap-3 text-amber-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold">Cargando horarios al servidor... (puede tomar 30-60 segundos)</span>
                  </div>
                )}

                {uploadResult?.success && (
                  <button
                    onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all cursor-pointer"
                  >
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
