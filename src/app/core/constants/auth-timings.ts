/**
 * Latencia simulada de los submits de auth (login, forgot-password, resend).
 *
 * Sin backend real, el timer es la única fuente de "loading state visible" —
 * 450 ms es el punto que usan Stripe/Linear en sus demos: suficiente para que
 * el spinner/disabled sea perceptible y el usuario registre el feedback, pero
 * corto para no sentir lag intencional. Fine-tuning del valor debería hacerse
 * en este único sitio; cambiar aquí propaga al login, forgot-password submit
 * y forgot-password resend. Ref: ADR-001 §8.
 */
export const AUTH_SUBMIT_DELAY_MS = 450;
