/**
 * Base de datos simulada de docentes
 * En la Parte 3 esto se reemplazará con Google Sheets API
 */
export const MAESTRO_DOCENTES = [
  {
    dni: '70123456',
    codigo: 'D001',
    nombre: 'Ing. Carlos Mendoza Quispe',
    facultad: 'Facultad de Ingeniería',
    escuela: 'Escuela Profesional de Ingeniería Civil',
    carrera: 'Ingeniería Civil',
    cursos: ['Topografía I', 'Mecánica de Suelos', 'Geodesia'],
  },
  {
    dni: '70654321',
    codigo: 'D002',
    nombre: 'Ing. María Elena Flores Ramos',
    facultad: 'Facultad de Ingeniería',
    escuela: 'Escuela Profesional de Ingeniería Civil',
    carrera: 'Ingeniería Civil',
    cursos: ['Resistencia de Materiales', 'Análisis Estructural I'],
  },
  {
    dni: '70987654',
    codigo: 'D003',
    nombre: 'Ing. Roberto Chávez Mamani',
    facultad: 'Facultad de Ingeniería',
    escuela: 'Escuela Profesional de Ingeniería Civil',
    carrera: 'Ingeniería Civil',
    cursos: ['Física I', 'Hidráulica', 'Mecánica de Fluidos', 'Hidrología'],
  },
]

/**
 * Busca un docente por DNI o código
 * @param {string} identifier - DNI o código del docente
 * @returns {object|null} - Docente encontrado o null
 */
export const findDocente = (identifier) => {
  const normalized = identifier.trim().toUpperCase()
  return MAESTRO_DOCENTES.find(
    (d) => d.dni === normalized || d.codigo.toUpperCase() === normalized
  ) || null
}
