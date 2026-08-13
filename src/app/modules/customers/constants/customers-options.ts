import type {
  Cartera,
  CreditClassification,
  CustomerLifecycle,
  CustomerSegmento,
  CustomerType,
  PotencialGroup,
} from '../models/customer.interface';

/**
 * Sets cerrados de opciones para los filtros de la vista de clientes.
 * Agrupados en un solo archivo por ser constantes del mismo tipo
 * (mismo criterio que `customers-data.ts`): catálogos estáticos que
 * alimentan multiselects/selects de la tabla y del bottom-sheet mobile.
 */

/** Distintivo B2B / B2C — set cerrado. */
export const TYPE_OPTIONS: CustomerType[] = ['Empresa', 'Persona'];

/** Verticales de negocio — set cerrado. */
export const SEGMENTO_OPTIONS: CustomerSegmento[] = [
  'PASAJEROS',
  'CARGA',
  'INDUSTRIAL',
  'COMERCIO',
  'OTROS',
];

/** Ratings de riesgo crediticio (A1 mejor, D peor). */
export const CLASSIFICATION_OPTIONS: CreditClassification[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'D',
];

/** Grupos de potencial de venta (G1 más alto, G4 más bajo). */
export const POTENCIAL_OPTIONS: PotencialGroup[] = ['G1', 'G2', 'G3', 'G4'];

/**
 * Estados del ciclo de vida comercial — separado de Cartera (estado
 * financiero). Set cerrado del legacy.
 */
export const LIFECYCLE_OPTIONS: CustomerLifecycle[] = [
  'RECURRENTE',
  'INACTIVO',
  'PELIGRO FUGA',
  'FUGADO',
];

/**
 * Carteras lifecycle del cliente. Labels expuestos al filter para que
 * el admin elija "Activa" en lugar del código `CA`.
 */
export const CARTERA_OPTIONS: { label: string; value: Cartera }[] = [
  { label: 'Activa (CA)', value: 'CA' },
  { label: 'Prospecto (CP)', value: 'CP' },
  { label: 'Nueva (CN)', value: 'CN' },
  { label: 'Inactiva (CI)', value: 'CI' },
  { label: 'Morosa (CM)', value: 'CM' },
];
