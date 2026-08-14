/**
 * Paso del checklist de primeros pasos del onboarding social (RFC-003 D3).
 * Los pasos se DERIVAN — nunca se almacenan: `SocialSettingsService.
 * onboardingSteps` los computa desde el estado de configuración del cliente
 * (keys, conectores, cuentas). Lo único persistido del checklist es el
 * descarte (`social:onboarding:v1`, RFC-003 D6.1).
 *
 * Contrato congelado: RFC-003 D3 (docs/rfcs/rfc-003-cliente-registrado-
 * signup-onboarding-y-configuracion-por-cuenta.md).
 */
export interface OnboardingStep {
  readonly id: 'account' | 'connector-key' | 'connect-network' | 'gen-provider';
  readonly title: string;          // es-CL, copy congelado en RFC-003 D3
  readonly done: boolean;
  readonly optional: boolean;      // gen-provider es opcional para analítica
  readonly route: string;          // CTA del paso
}
