/**
 * Distingue colaboradores internos (empleados de la empresa) de externos
 * (auditores, integradores, consultores, partners). Concepto crítico
 * para gobernanza/seguridad — los externos suelen tener permisos
 * acotados, MFA obligatorio, y revisión periódica de acceso.
 */
export type UserType = 'Interno' | 'Externo';

export type UserStatus = 'Activo' | 'Inactivo' | 'Pendiente';

/**
 * Roles cerrados por tipo:
 *   - Internos: Admin, Developer, Soporte, Operaciones, Comercial
 *   - Externos: Auditor, Integrador, Consultor, Partner
 *
 * El union type permite que el filter multiselect liste exactamente las
 * opciones del dominio sin huérfanas.
 */
export type UserRole =
  | 'Admin'
  | 'Developer'
  | 'Soporte'
  | 'Operaciones'
  | 'Comercial'
  | 'Auditor'
  | 'Integrador'
  | 'Consultor'
  | 'Partner';

export interface User {
  id: number;
  image?: string;
  /** Iniciales para fallback de avatar cuando no hay imagen. */
  capName?: string;
  /**
   * Nombre completo en formato chileno: 1-2 nombres + apellido paterno
   * + apellido materno. Denormalizado del backend (que también persiste
   * los componentes individuales) para evitar concatenarlo en cada
   * render. Ejemplo: `"Carolina Andrea Vega Soto"`.
   *
   * **Por qué una sola columna y no 4**: la lectura humana de un
   * nombre es UNA unidad de identidad, no cuatro fragmentos. Splitear
   * en columnas separadas (Stripe, Linear, GitHub, Workday no lo
   * hacen) crea disonancia visual al escanear y duplica el ancho
   * horizontal sin ganar señal. Filtros/sort granulares se hacen via
   * los campos individuales abajo, sin tocar el display.
   */
  name: string;
  /**
   * Apellido paterno. Único componente expuesto separadamente porque
   * es el sort default convencional en el contexto enterprise chileno
   * (RUT registry, pagas, audit). Los demás componentes (nombres,
   * apellido materno) viven en `name` y no requieren acceso directo.
   */
  paternalSurname: string;
  email: string;
  type: UserType;
  role: UserRole;
  /**
   * Para internos: department (TI, Operaciones, Comercial, etc.).
   * Para externos: nombre de la empresa partner/consultora.
   */
  organization: string;
  status: UserStatus;
  /** ISO 8601. Renderizado vía RelativeTimePipe en la tabla. */
  lastActive: string;
}
