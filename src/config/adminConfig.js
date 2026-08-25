/**
 * ════════════════════════════════════════════════════════════
 * CONFIGURACIÓN DE ACCESO AL PANEL DE ADMINISTRACIÓN
 * Sistema de Control Docente EPIC — Universidad Privada de Tacna
 * ════════════════════════════════════════════════════════════
 * 
 * Para cambiar la contraseña de la directora:
 *   → Modificar ADMIN_PASSWORD abajo
 * 
 * Para agregar/quitar usuarios autorizados:
 *   → Modificar el array ADMIN_USERS
 * 
 * Para cambiar el código secreto de acceso al panel admin:
 *   → Modificar ADMIN_LOGIN_CODE (lo que se escribe en el campo DNI del login docente)
 */

// ── Código secreto para acceder al login admin ──
// Al escribir este código en el campo DNI del login de docentes,
// se abre la pantalla de login del panel de administración
export const ADMIN_LOGIN_CODE = 'DIRECTOR'

// ── Usuarios autorizados ──
export const ADMIN_USERS = [
  { email: 'mduartel2017@gmail.com', nombre: 'Dra. Martha Duarte L.' },
  { email: 'marduartel@virtual.upt.pe', nombre: 'Dra. Martha Duarte L.' },
]

// ── Contraseña del panel admin ──
// Actualmente: DNI de la directora
export const ADMIN_PASSWORD = '00490661'

// ── Intervalo de polling del monitoreo en vivo (ms) ──
export const MONITOREO_POLL_INTERVAL = 30000 // 30 segundos
