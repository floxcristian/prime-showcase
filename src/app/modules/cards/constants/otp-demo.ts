/**
 * Valor demo del OTP pre-populado en la card "Forgot password" del showcase.
 * Vive como constante nominada (vs. literal inline en el component) para que
 * futuros mantenedores vean que es un dato de demo deliberado, no un secreto
 * olvidado en el signal initializer. Si el flow se conecta a un backend real
 * este valor se quita — ningún OTP debe venir pre-populado en producción.
 */
export const FORGOT_PASSWORD_OTP_DEMO_VALUE = '023';
