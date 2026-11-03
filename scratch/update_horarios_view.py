# -*- coding: utf-8 -*-
import sys

file_path = r"c:\Users\R-113\Desktop\PROYECTO CONTROL DOCENTES EPIC\CONTROL DOCENTES EPIC\src\components\admin\HorariosView.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
target_import = """import {
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
import { obtenerHorarios, cargarHorariosSemestre, obtenerReservas } from '../../services/adminApi'
import { 
  getDiaSemanaFromDate, 
  getLocalReservas, 
  normalizarReserva, 
  getNombreEstandarAula, 
  coincidenAulas, 
  formatHora 
} from '../../services/reservasService'
import HORARIOS_DEFAULT from '../../data/horarios_procesados.json'
import * as XLSX from 'xlsx'"""

replacement_import = """import {
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
  DoorOpen,
  UserCheck,
  UserPlus,
  IdCard,
  Info,
  CalendarDays,
  Check,
  ChevronRight
} from 'lucide-react'
import { obtenerHorarios, cargarHorariosSemestre, obtenerReservas, obtenerListaDocentes } from '../../services/adminApi'
import { 
  getDiaSemanaFromDate, 
  getLocalReservas, 
  normalizarReserva, 
  getNombreEstandarAula, 
  coincidenAulas, 
  formatHora 
} from '../../services/reservasService'
import { getSemestreConfig, saveSemestreConfig, coincideDocente } from '../../utils/academicCalendar'
import HORARIOS_DEFAULT from '../../data/horarios_procesados.json'
import * as XLSX from 'xlsx'"""

# Normalize CRLF
content_norm = content.replace('\r\n', '\n')
target_import_norm = target_import.replace('\r\n', '\n')
replacement_import_norm = replacement_import.replace('\r\n', '\n')

if target_import_norm in content_norm:
    content_norm = content_norm.replace(target_import_norm, replacement_import_norm, 1)
    print("Part 1 (Imports) replaced successfully.")
else:
    print("ERROR: target_import not found!")

# 2. Update state declarations inside HorariosView
target_state = """  const [showUploadModal, setShowUploadModal] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)"""

replacement_state = """  const [showUploadModal, setShowUploadModal] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  // ── Estados para Configuración de Semestre & Conciliación de Docentes ──
  const [semestreConfig, setSemestreConfig] = useState(getSemestreConfig)
  const [docentesDB, setDocentesDB] = useState([])
  const [docentesVinculados, setDocentesVinculados] = useState([])
  const [docentesNuevos, setDocentesNuevos] = useState([])
  const [nuevosDocentesDnis, setNuevosDocentesDnis] = useState({})
  const [actualizarCursosDocentes, setActualizarCursosDocentes] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [verVinculados, setVerVinculados] = useState(false)"""

target_state_norm = target_state.replace('\r\n', '\n')
replacement_state_norm = replacement_state.replace('\r\n', '\n')

if target_state_norm in content_norm:
    content_norm = content_norm.replace(target_state_norm, replacement_state_norm, 1)
    print("Part 2 (State) replaced successfully.")
else:
    print("ERROR: target_state not found!")

# 3. Update handleFileSelect and handleConfirmUpload
target_handlers = """  // ── Manejar archivo ──
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
        setTimeout(() => cargarHorariosExistentes(true), 1000)
      } else {
        setUploadResult({ success: false, message: res.message || 'Error al cargar.' })
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Error: ' + err.message })
    } finally {
      setUploading(false)
    }
  }"""

replacement_handlers = """  // ── Manejar archivo y conciliación inteligente de docentes ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsAnalyzing(true)
    setUploadResult(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const parsed = parseExcelCiclos(workbook)
        if (parsed.length === 0) {
          setUploadResult({ success: false, message: 'No se encontraron registros válidos en las hojas de ciclos del archivo.' })
          setIsAnalyzing(false)
          return
        }

        // 1. Agrupar cursos por docente desde el Excel
        const cursosPorDocenteExcel = {}
        parsed.forEach(r => {
          const doc = (r.DOCENTE || '').trim()
          if (!doc) return
          const cursoLabel = r.CODIGO ? `${r.CODIGO} ${r.CURSO}${r.SECCION ? ' - ' + r.SECCION : ''}` : `${r.CURSO}${r.SECCION ? ' - ' + r.SECCION : ''}`
          if (!cursosPorDocenteExcel[doc]) {
            cursosPorDocenteExcel[doc] = new Set()
          }
          cursosPorDocenteExcel[doc].add(cursoLabel)
        })

        // 2. Obtener lista actual de docentes en BD (MAESTRO_DOCENTES)
        let listaDocsBD = docentesDB
        if (!listaDocsBD || listaDocsBD.length === 0) {
          try {
            const resDoc = await obtenerListaDocentes()
            if (resDoc?.success && Array.isArray(resDoc.data)) {
              listaDocsBD = resDoc.data
              setDocentesDB(listaDocsBD)
            }
          } catch (errBD) {
            console.warn('No se pudo obtener lista de docentes para matching:', errBD)
          }
        }

        // 3. Conciliar automáticamente cada docente del Excel con la BD
        const vinculados = []
        const nuevos = []
        const initDnis = {}

        Object.entries(cursosPorDocenteExcel).forEach(([nombreDocExcel, setCursos]) => {
          const cursosArr = Array.from(setCursos)
          const matchBD = (listaDocsBD || []).find(dbDoc => coincideDocente(nombreDocExcel, dbDoc.nombre))
          if (matchBD) {
            vinculados.push({
              nombreExcel: nombreDocExcel,
              nombreBD: matchBD.nombre,
              dni: matchBD.dni,
              cursos: cursosArr
            })
          } else {
            nuevos.push({
              nombre: nombreDocExcel,
              cursos: cursosArr.join(', '),
              cursosArray: cursosArr
            })
            initDnis[nombreDocExcel] = ''
          }
        })

        const docentes = new Set(parsed.map(r => r.DOCENTE).filter(Boolean))
        const cursos = new Set(parsed.map(r => r.CODIGO).filter(Boolean))
        const aulas = new Set(parsed.map(r => r.AULA).filter(Boolean))
        const ciclos = new Set(parsed.map(r => r.CICLO).filter(Boolean))

        setDocentesVinculados(vinculados)
        setDocentesNuevos(nuevos)
        setNuevosDocentesDnis(initDnis)

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
        setUploadResult({ success: false, message: 'Error al procesar el archivo Excel: ' + err.message })
      } finally {
        setIsAnalyzing(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleConfirmUpload = async () => {
    if (!parsedData) return

    // Validar DNI de nuevos docentes (8 dígitos numéricos requeridos)
    if (docentesNuevos.length > 0) {
      for (const n of docentesNuevos) {
        const dni = (nuevosDocentesDnis[n.nombre] || '').trim()
        if (!dni || dni.length !== 8 || !/^\\d{8}$/.test(dni)) {
          alert(`⚠️ Ingrese un DNI válido de 8 dígitos para el nuevo docente:\\n"${n.nombre}"`)
          return
        }
      }
    }

    setUploading(true)
    setUploadResult(null)
    try {
      // Guardar configuración del semestre localmente (reinicia correlativo si cambió el nombre del semestre)
      saveSemestreConfig(semestreConfig)

      const payloadNuevos = docentesNuevos.map(n => ({
        nombre: n.nombre,
        dni: (nuevosDocentesDnis[n.nombre] || '').trim(),
        cursos: n.cursos
      }))

      const res = await cargarHorariosSemestre({
        horarios: parsedData.registros,
        docentesNuevos: payloadNuevos,
        configSemestre: semestreConfig,
        actualizarCursosDocentes: actualizarCursosDocentes
      })

      if (res.success) {
        setUploadResult({
          success: true,
          message: res.message || `${parsedData.stats.totalRegistros} horarios cargados exitosamente.`
        })
        setParsedData(null)
        setDocentesNuevos([])
        setDocentesVinculados([])
        setTimeout(() => cargarHorariosExistentes(true), 1200)
      } else {
        setUploadResult({ success: false, message: res.message || 'Error al cargar horarios en Google Sheets.' })
      }
    } catch (err) {
      setUploadResult({ success: false, message: 'Error: ' + err.message })
    } finally {
      setUploading(false)
    }
  }"""

target_handlers_norm = target_handlers.replace('\r\n', '\n')
replacement_handlers_norm = replacement_handlers.replace('\r\n', '\n')

if target_handlers_norm in content_norm:
    content_norm = content_norm.replace(target_handlers_norm, replacement_handlers_norm, 1)
    print("Part 3 (Handlers) replaced successfully.")
else:
    print("ERROR: target_handlers not found!")

# 4. Update the modal markup (around lines 900 to 1010)
# Let's find the modal section in content_norm
modal_start = "      {/* ═══ MODAL DE CARGA ═══ */}"
modal_end = "      </AnimatePresence>\n    </div>\n  )\n}"

idx_start = content_norm.find(modal_start)
idx_end = content_norm.find(modal_end)

if idx_start != -1 and idx_end != -1:
    old_modal = content_norm[idx_start:idx_end + len("      </AnimatePresence>")]
    
    new_modal = """      {/* ═══ MODAL DE CARGA INTELIGENTE DE HORARIOS & SEMESTRE ═══ */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUploadModal(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-3xl rounded-3xl bg-[#0d1117] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-950/40">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      Cargar Horarios del Semestre
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {semestreConfig.nombre || 'Nuevo Semestre'}
                      </span>
                    </h3>
                    <p className="text-xs text-white/50">Sube el archivo Excel <span className="text-amber-400 font-mono">horarios_ciclos.xlsx</span> exportado del sistema UPT</p>
                  </div>
                </div>
                {!uploading && (
                  <button onClick={() => setShowUploadModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* ── PARÁMETROS DEL SEMESTRE (Siempre visibles y editables) ── */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">Parámetros del Semestre Académico</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-medium">18 semanas • 3 unidades</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">Nombre Semestre</label>
                      <input
                        type="text"
                        disabled={uploading}
                        value={semestreConfig.nombre}
                        onChange={(e) => setSemestreConfig(prev => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                        placeholder="Ej. 2026-I, 2026-II"
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">Fecha Inicio (Lunes)</label>
                      <input
                        type="date"
                        disabled={uploading}
                        value={semestreConfig.fechaInicio}
                        onChange={(e) => setSemestreConfig(prev => ({ ...prev, fechaInicio: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/60 uppercase block mb-1">Fecha Fin</label>
                      <input
                        type="date"
                        disabled={uploading}
                        value={semestreConfig.fechaFin}
                        onChange={(e) => setSemestreConfig(prev => ({ ...prev, fechaFin: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* ── ZONA DE ARRASTRE DE ARCHIVO ── */}
                {!parsedData && !uploadResult?.success && (
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group ${
                      isAnalyzing 
                        ? 'border-amber-500/50 bg-amber-500/5' 
                        : 'border-white/15 hover:border-amber-500/40 hover:bg-white/[0.01]'
                    }`}
                    onClick={() => { if (!isAnalyzing) fileInputRef.current?.click() }}>
                    {isAnalyzing ? (
                      <div className="py-4 space-y-3">
                        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                        <p className="text-sm font-bold text-white">Analizando estructura y conciliando docentes...</p>
                        <p className="text-xs text-white/40">Verificando correspondencia con el Maestro de Docentes</p>
                      </div>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-12 h-12 text-white/20 group-hover:text-amber-400/60 mx-auto mb-3 transition-colors" />
                        <p className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">
                          Haz clic para seleccionar el Excel de horarios
                        </p>
                        <p className="text-[11px] text-amber-400/70 mt-1 font-medium">
                          Selecciona <span className="font-mono font-bold">horarios_ciclos.xlsx</span> (contiene las pestañas Ciclo 1 al 10)
                        </p>
                        <p className="text-[10px] text-white/30 mt-2">
                          💡 El sistema derivará automáticamente las vistas Por Ciclos, Por Ambientes y vinculará a los docentes.
                        </p>
                      </>
                    )}
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                  </div>
                )}

                {/* ── VISTA TRAS PROCESAR EXCEL ── */}
                {parsedData && !uploadResult?.success && (
                  <div className="space-y-4">
                    {/* Badge de éxito */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-xs font-bold">Excel analizado correctamente</span>
                      </div>
                      <button
                        onClick={() => { setParsedData(null); setDocentesNuevos([]); setDocentesVinculados([]) }}
                        className="text-[11px] font-bold text-white/40 hover:text-white transition-colors underline cursor-pointer">
                        Cambiar archivo
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { v: parsedData.stats.totalRegistros, l: 'Horarios Registrados', c: 'blue' },
                        { v: parsedData.stats.docentes, l: 'Docentes Detectados', c: 'emerald' },
                        { v: parsedData.stats.cursos, l: 'Cursos', c: 'purple' },
                        { v: parsedData.stats.aulas, l: 'Ambientes / Labs', c: 'amber' }
                      ].map((s, i) => (
                        <div key={i} className={`p-3 rounded-xl bg-white/[0.02] border border-white/10 text-center`}>
                          <p className="text-xl font-black text-white">{s.v}</p>
                          <p className="text-[9px] text-white/40 font-bold uppercase mt-0.5">{s.l}</p>
                        </div>
                      ))}
                    </div>

                    {/* ── CONCILIACIÓN DE DOCENTES EXISTENTES ── */}
                    <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-emerald-400" />
                          <div>
                            <p className="text-xs font-black text-emerald-300">
                              {docentesVinculados.length} Docentes Reconocidos y Vinculados
                            </p>
                            <p className="text-[10px] text-emerald-200/60">
                              Sus datos y DNIs fueron identificados en el Maestro de Docentes.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVerVinculados(!verVinculados)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-bold transition-all cursor-pointer">
                          {verVinculados ? 'Ocultar' : 'Ver lista'}
                        </button>
                      </div>

                      {/* Lista desplegable de docentes reconocidos */}
                      {verVinculados && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20 max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {docentesVinculados.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-black/20">
                              <span className="text-white/80 font-medium truncate max-w-[280px]">{doc.nombreExcel}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-emerald-400 font-bold text-[10px]">DNI: {doc.dni}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{doc.cursos.length} curso(s)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── DETECCIÓN DE NUEVOS DOCENTES (REQUERIDO DNI) ── */}
                    {docentesNuevos.length > 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/30 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <UserPlus className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-amber-300">
                              ⚠️ Se detectaron {docentesNuevos.length} nuevo(s) docente(s) en este semestre
                            </p>
                            <p className="text-[11px] text-amber-200/70 mt-0.5">
                              No se encontraron en la base de datos actual. Ingresa su DNI de 8 dígitos para registrarlos automáticamente y permitir su inicio de sesión:
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          {docentesNuevos.map((nd, idx) => {
                            const dniVal = nuevosDocentesDnis[nd.nombre] || ''
                            const esValido = dniVal.length === 8 && /^\\d{8}$/.test(dniVal)
                            return (
                              <div key={idx} className="p-3 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{nd.nombre}</p>
                                  <p className="text-[10px] text-white/40 truncate mt-0.5">
                                    Cursos: {nd.cursos}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="relative">
                                    <IdCard className="w-4 h-4 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                      type="text"
                                      maxLength={8}
                                      placeholder="DNI (8 dígitos)"
                                      value={dniVal}
                                      onChange={(e) => {
                                        const cleanVal = e.target.value.replace(/\\D/g, '').slice(0, 8)
                                        setNuevosDocentesDnis(prev => ({ ...prev, [nd.nombre]: cleanVal }))
                                      }}
                                      className={`w-36 pl-8 pr-3 py-1.5 rounded-lg bg-white/5 text-xs font-mono font-bold text-white focus:outline-none ${
                                        esValido ? 'border border-emerald-500/50 bg-emerald-500/5' : 'border border-amber-500/50'
                                      }`}
                                    />
                                  </div>
                                  {esValido && <Check className="w-4 h-4 text-emerald-400" />}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-blue-500/[0.08] border border-blue-500/20 flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-200/80 font-medium">
                          ¡Excelente! El 100% de los docentes ya están registrados en el sistema con su DNI.
                        </span>
                      </div>
                    )}

                    {/* Opción de actualización automática de cursos */}
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={actualizarCursosDocentes}
                        onChange={(e) => setActualizarCursosDocentes(e.target.checked)}
                        className="rounded border-white/20 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs text-white/80 font-medium">
                        Actualizar automáticamente la lista de asignaturas asignadas a cada docente en el Maestro de Docentes
                      </span>
                    </label>

                    {/* Advertencia de reemplazo */}
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-200/80">
                        <p className="font-bold">⚠️ Reemplazo de programación académica</p>
                        <p className="mt-0.5 text-amber-200/60 text-[11px]">
                          Los horarios anteriores serán reemplazados por los {parsedData.stats.totalRegistros} nuevos horarios del semestre {semestreConfig.nombre}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── RESULTADO DE CARGA ── */}
                {uploadResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${uploadResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    {uploadResult.success ? <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />}
                    <div>
                      <p className={`text-sm font-bold ${uploadResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                        {uploadResult.success ? '¡Horarios y Docentes Sincronizados!' : 'Error al Cargar'}
                      </p>
                      <p className={`text-xs mt-1 ${uploadResult.success ? 'text-emerald-200/70' : 'text-red-200/70'}`}>{uploadResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 bg-white/[0.02] shrink-0">
                {!uploading && !uploadResult?.success && (
                  <button onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-bold transition-all cursor-pointer">
                    Cancelar
                  </button>
                )}
                {parsedData && !uploading && !uploadResult?.success && (
                  <button onClick={handleConfirmUpload}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-lg shadow-amber-950/40 transition-all cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Confirmar e Iniciar Semestre {semestreConfig.nombre} ({parsedData.stats.totalRegistros} Clases)
                  </button>
                )}
                {uploading && (
                  <div className="flex items-center gap-3 text-amber-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold">Sincronizando horarios y docentes en la nube... (30-60 seg)</span>
                  </div>
                )}
                {uploadResult?.success && (
                  <button onClick={() => { setShowUploadModal(false); setParsedData(null); setUploadResult(null) }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all cursor-pointer">
                    Finalizar
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>"""
    
    content_norm = content_norm[:idx_start] + new_modal + content_norm[idx_end + len("      </AnimatePresence>"):]
    print("Part 4 (Modal) replaced successfully.")
else:
    print(f"ERROR: Modal markers not found! idx_start={idx_start}, idx_end={idx_end}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("Finished updating HorariosView.jsx.")

