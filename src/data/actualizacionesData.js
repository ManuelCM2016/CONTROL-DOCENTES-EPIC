export const ACTUALIZACIONES_CONFIG = {
  version: 'v2.5',
  fecha: 'Octubre 2026',
  semestre: 'Semestre 2026-II',
  titulo: 'Novedades del Sistema EPIC',
  subtitulo: 'Facultad de Ingeniería • Escuela de Ingeniería Civil'
}

export const LISTA_ACTUALIZACIONES = [
  {
    id: 'soporte_aula',
    titulo: 'Soporte Técnico en Aula (SOS)',
    tag: 'NUEVO',
    tagColor: 'rose', // rose / red
    icon: 'Siren',
    color: 'rose',
    descripcion: 'Botón flotante con sirena en el panel docente para auxilio técnico inmediato (PC, proyector HDMI, red, luz) o reporte de mantenimiento.'
  },
  {
    id: 'reserva_ambientes',
    titulo: 'Reserva de Salones y Laboratorios',
    tag: 'ACTUALIZADO',
    tagColor: 'emerald',
    icon: 'DoorOpen',
    color: 'emerald',
    descripcion: 'Separación anticipada de ambientes con cronograma semanal interactivo, verificación en vivo y prevención de cruce de horarios.'
  },

  {
    id: 'offline_sync',
    titulo: 'Sincronización Inteligente & Offline',
    tag: 'OPTIMIZACIÓN',
    tagColor: 'amber',
    icon: 'Zap',
    color: 'amber',
    descripcion: 'Carga instantánea (0 ms) con respaldo local continuo en el navegador y sincronización segura con la base de datos de Google Sheets.'
  }
]

