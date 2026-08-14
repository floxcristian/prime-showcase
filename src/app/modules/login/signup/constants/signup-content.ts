export interface SignupBenefit {
  /** Clases FA completas del icono decorativo. Familia `fa-sharp-duotone`
   *  permitida porque el template lo renderiza con `text-2xl` en el mismo
   *  elemento (criterio de `showcase/no-duotone-inline-icon`: el TAMAÑO). */
  icon: string;
  title: string;
  description: string;
}

/**
 * Bullets del aside marketing del signup (RFC-003 D2): los 4 pilares del
 * pitch de la suite social — analítica multi-red, IA de contenido,
 * calendario editorial y API keys propias por cliente.
 */
export const SIGNUP_BENEFITS: readonly SignupBenefit[] = [
  {
    icon: 'fa-sharp-duotone fa-regular fa-chart-mixed',
    title: 'Analítica multi-red',
    description: 'Instagram, Facebook y TikTok en un solo panel.',
  },
  {
    icon: 'fa-sharp-duotone fa-regular fa-wand-magic-sparkles',
    title: 'IA de contenido',
    description: 'Captions, imágenes y video generados con IA.',
  },
  {
    icon: 'fa-sharp-duotone fa-regular fa-calendar-days',
    title: 'Calendario editorial',
    description: 'Programá y publicá todas tus redes desde un solo lugar.',
  },
  {
    icon: 'fa-sharp-duotone fa-regular fa-key',
    title: 'Tus propias API keys',
    description: 'Conectores y proveedores con tus credenciales, aisladas por cuenta.',
  },
];
