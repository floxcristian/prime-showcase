/**
 * `Empresa` (B2B): persona jurídica — RUT generalmente 50M-99M, nombre
 * incluye razón social con suffix legal (Ltda., S.A., SpA).
 *
 * `Persona` (B2C): persona natural — RUT generalmente <25M, nombre con
 * formato chileno completo (1-2 nombres + apellido paterno + apellido
 * materno).
 */
export type CustomerType = 'Empresa' | 'Persona';

/**
 * Segmento de negocio del cliente — vertical/industria a la que
 * pertenece. Set abierto pero acotado al dominio de transporte +
 * comercio típico del legacy.
 */
export type CustomerSegmento = 'PASAJEROS' | 'CARGA' | 'INDUSTRIAL' | 'COMERCIO' | 'OTROS';

/**
 * Clasificación de riesgo crediticio. Letras + número, donde A es
 * el rating más alto y D el más bajo. EF (Excelente Financiero) es
 * el alias del legacy para A1 — mapeado al modelo letter+number en
 * la migración.
 */
export type CreditClassification = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'D';

/**
 * Grupo de potencial de venta — proyección de revenue futuro.
 * G1 es el potencial más alto (cuentas estratégicas), G4 el más bajo.
 */
export type PotencialGroup = 'G1' | 'G2' | 'G3' | 'G4';

/**
 * Cartera (lifecycle del cliente):
 *   - CA Activa: cuenta corriente operativa, paga al día.
 *   - CP Prospecto: en etapa comercial, sin venta confirmada.
 *   - CN Nueva: alta reciente, primer ciclo de facturación.
 *   - CI Inactiva: sin movimiento +N meses, no morosa.
 *   - CM Morosa: cuenta con deuda vencida, requiere cobranza.
 *
 * Reemplaza el campo `status` legacy (Activo/Inactivo/Prospecto) con
 * más granularidad — el negocio distingue claramente "inactiva por
 * inacción" vs "morosa por deuda" para asignar a equipos diferentes.
 */
export type Cartera = 'CA' | 'CP' | 'CN' | 'CI' | 'CM';

/**
 * Ciclo de vida del cliente — métrica de salud comercial separada de
 * `Cartera` (que es el estado financiero/operativo). Mientras `Cartera`
 * mira la cuenta (al día / morosa / inactiva), `CustomerLifecycle` mira
 * el comportamiento de compra:
 *   - RECURRENTE: compras consistentes en el período de medición.
 *   - INACTIVO: sin compras recientes, churn parcial.
 *   - PELIGRO FUGA: cliente con frecuencia decreciente, alerta proactiva.
 *   - FUGADO: cliente perdido, churn confirmado.
 *
 * Útil para campañas de retención y priorización del equipo comercial —
 * un cliente puede estar "Activa" (Cartera) y simultáneamente "PELIGRO
 * FUGA" (Lifecycle) si paga al día pero compra menos.
 */
export type CustomerLifecycle = 'RECURRENTE' | 'INACTIVO' | 'PELIGRO FUGA' | 'FUGADO';

export interface Customer {
  id: number;
  type: CustomerType;
  /**
   * Display name. Razón social para Empresa B2B; nombre completo
   * natural ("Juan Pablo González Pérez") para Persona B2C.
   */
  name: string;
  /**
   * Sort key — apellido paterno (Persona) o razón social (Empresa).
   * Sortar por este campo da un orden coherente cross-tipo (apellido
   * paterno es la convención CL enterprise para personas).
   */
  sortKey: string;
  /** RUT chileno con formato canónico `XX.XXX.XXX-Y`. */
  rut: string;
  /** Email de contacto principal. */
  email: string;
  /**
   * Vendedores asignados. La UI muestra primero + count si hay más;
   * el filter hace intersección via custom matchmode 'arrayIntersect'.
   */
  assignedSellers: string[];
  /**
   * Triplete de crédito en CLP entero. Invariante:
   *   `assignedCredit = availableCredit + usedCredit`
   *
   * - `availableCredit`: saldo aún disponible para nuevas compras.
   * - `usedCredit`: saldo ya consumido (deuda corriente).
   * - `assignedCredit`: cupo total aprobado (límite máximo).
   */
  availableCredit: number;
  usedCredit: number;
  assignedCredit: number;
  segmento: CustomerSegmento;
  creditClassification: CreditClassification;
  potencial: PotencialGroup;
  /** Tier de descuento — 0 sin descuento, 5 descuento máximo. */
  discountGroup: number;
  cartera: Cartera;
  lifecycle: CustomerLifecycle;
  /**
   * Región chilena del cliente (16 regiones DPA). Usamos `string` en
   * lugar de union cerrado por la cardinalidad — el filter multiselect
   * se hidrata dinámicamente desde los valores presentes en la data.
   */
  region: string;
  /** Ciudad/comuna. Open string — cardinalidad alta, filter text. */
  city: string;
}
