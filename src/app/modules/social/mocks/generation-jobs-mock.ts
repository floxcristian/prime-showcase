import { demoAsset } from '../../../shared/constants/demo-assets';
import { minutesBefore, seededRandom } from '../../../shared/utils/mock-utils';
import type { ProviderId } from '../models/provider.interface';
import type {
  GenerationJob,
  GenerationKind,
  GenerationRequest,
} from '../models/social.interface';
import { clientHash } from './social-mock-utils';

/**
 * Factory PURA del historial de jobs de generación (RFC-002 D2/D7,
 * consumida por `SocialGenerationMockService` al sembrar su signal — D6:
 * solo cuando el cliente ya configuró una key `valid` de un provider de
 * generación — y por el seed de fixtures de Playwright, RFC-001 D7). Sin
 * Angular ni side effects.
 *
 * **Volumen (D7):** 4-6 jobs HISTÓRICOS (estados terminales: succeeded/
 * failed — los estados `queued`/`running` solo existen en vivo vía
 * `createJob`/`watchJob`, D9). Un ciclo curado fijo garantiza que todo
 * count ≥ 4 cubra los tres kinds y ≥1 `failed`. Seed `${clientSeed}:jobs`.
 *
 * **Invariantes del contrato D2/D9:** caption succeeded lleva SIEMPRE
 * exactamente 3 `resultVariants` (curadas es-CL en el ciclo); image
 * succeeded lleva 4 `resultUrls` y video succeeded 1 (thumbnail), todos
 * vía `demoAsset(...)`; `failureReason` sale del pool de D9;
 * `costEstimateUsd` sale de una tabla fija por provider ± jitter seeded
 * (D9 — "esto cuesta plata", el pitch de keys por cliente).
 *
 * **Determinismo:** orden de extracción del PRNG (contrato): count → por
 * job: step de antigüedad → duración → jitter de costo → (failureIdx si
 * failed) → (mediaStart si lleva resultUrls). Timestamps derivados de
 * `epoch` — cero reloj real.
 */

interface JobSeed {
  readonly kind: GenerationKind;
  readonly providerId: ProviderId;
  readonly status: 'succeeded' | 'failed';
  readonly prompt: string;
  readonly options: GenerationRequest['options'];
  /** Solo caption succeeded — SIEMPRE 3 (contrato D2). */
  readonly variants?: readonly [string, string, string];
}

/**
 * Ciclo curado fijo (6 = count máximo). Los índices 0-3 cubren los tres
 * kinds y el caso `failed` → todo count ≥ 4 garantiza la variedad que el
 * historial del studio necesita mostrar (RFC-006 D8).
 */
const JOB_CYCLE: readonly JobSeed[] = [
  {
    kind: 'caption',
    providerId: 'gpt',
    status: 'succeeded',
    prompt:
      'Caption para el lanzamiento de la línea eléctrica, tono cercano, con llamado a comprar online',
    options: { tone: 'cercano', maxLength: 220, language: 'es' },
    variants: [
      'Llegó la línea eléctrica que estabas esperando ⚡ Stock listo para despacho a todo Chile — pedila online y la recibís en 48 horas.',
      '¿Proyecto nuevo? La línea eléctrica ya está disponible en la tienda online. Comprá hoy y aprovechá el despacho a regiones.',
      'Nueva línea eléctrica disponible 🛠️ Calidad para tu próximo proyecto, a un clic. Envíos a todo Chile.',
    ],
  },
  {
    kind: 'image',
    providerId: 'openai-images',
    status: 'succeeded',
    prompt: 'Flat lay de herramientas sobre mesa de madera, luz natural, estilo catálogo',
    options: { aspectRatio: '1:1' },
  },
  {
    kind: 'video',
    providerId: 'veo',
    status: 'succeeded',
    prompt:
      'Video corto mostrando el antes y después de un proyecto con nuestras herramientas, vertical',
    options: { aspectRatio: '9:16', durationSeconds: 15 },
  },
  {
    kind: 'caption',
    providerId: 'gemini',
    status: 'failed',
    prompt: 'Caption para la promo 2x1 del fin de semana en productos seleccionados',
    options: { tone: 'vendedor', maxLength: 180, language: 'es' },
  },
  {
    kind: 'image',
    providerId: 'gemini-imagen',
    status: 'succeeded',
    prompt: 'Foto de producto sobre fondo neutro con iluminación cálida, estilo catálogo',
    options: { aspectRatio: '1:1' },
  },
  {
    kind: 'caption',
    providerId: 'gpt',
    status: 'succeeded',
    prompt: 'Caption de aniversario agradeciendo a los clientes por un año más de la pyme',
    options: { tone: 'profesional', maxLength: 240, language: 'es' },
    variants: [
      'Un año más creciendo juntos 💙 Gracias por confiar en esta pyme chilena — lo que viene es todavía mejor.',
      'Hoy celebramos otro aniversario, y el mérito es de ustedes: gracias por cada compra, cada mensaje y cada recomendación.',
      'Cumplimos un año más gracias a ustedes. Seguimos comprometidos con llevar los mejores productos a todo Chile.',
    ],
  },
];

/** Pool de fallos de D9 — accionables, sin culpar al usuario. */
const JOB_FAILURE_REASONS: readonly string[] = [
  'Cuota del provider excedida — reintentá en unos minutos.',
  'El prompt infringe la política de contenido del provider.',
];

/** Tabla fija de costo por provider de generación (D9) — el jitter seeded
 *  ±15 % le da realismo sin romper baselines. */
const COST_USD: Readonly<Partial<Record<ProviderId, number>>> = {
  gpt: 0.02,
  gemini: 0.015,
  'openai-images': 0.08,
  'gemini-imagen': 0.07,
  veo: 0.5,
  heygen: 0.65,
  higgsfield: 0.4,
};

/** Assets demo disponibles como resultado (covers del CDN de PrimeTek). */
const MEDIA_FILE_COUNT = 12;

const resultAsset = (n: number): string =>
  demoAsset(`movie-cover${(n % MEDIA_FILE_COUNT) + 1}.png`);

/**
 * Construye el historial determinista de jobs del cliente (4-6, D7). El
 * primer job es el más reciente — la antigüedad se acumula por pasos
 * seeded de 12-36 h, así el historial se reparte sobre los últimos días.
 */
export const buildGenerationJobsMock = (
  epoch: number,
  clientSeed: string,
): readonly GenerationJob[] => {
  const rand = seededRandom(`${clientSeed}:jobs`);
  const count = 4 + Math.floor(rand() * 3); // 4-6 (D7)
  const hash = clientHash(clientSeed);

  const jobs: GenerationJob[] = [];
  let ageMin = 120; // el job más reciente terminó hace ~2 h + primer step

  for (let i = 0; i < count; i++) {
    const seed = JOB_CYCLE[i % JOB_CYCLE.length];
    ageMin += 720 + Math.floor(rand() * 1440); // step 12-36 h hacia atrás
    const durationMin = 1 + Math.floor(rand() * 4); // el job "corrió" 1-4 min
    const jitter = 1 + (rand() * 2 - 1) * 0.15; // ±15 %
    const baseCost = COST_USD[seed.providerId] ?? 0.05;
    const costEstimateUsd = Math.round(baseCost * jitter * 1000) / 1000;

    const request: GenerationRequest = {
      kind: seed.kind,
      providerId: seed.providerId,
      prompt: seed.prompt,
      options: seed.options,
    };

    const job: GenerationJob = {
      id: `job-${hash}-${i + 1}`,
      kind: seed.kind,
      providerId: seed.providerId,
      prompt: seed.prompt,
      request,
      status: seed.status,
      createdAt: minutesBefore(epoch, ageMin),
      completedAt: minutesBefore(epoch, ageMin - durationMin),
      costEstimateUsd,
    };

    if (seed.status === 'failed') {
      jobs.push({
        ...job,
        failureReason: JOB_FAILURE_REASONS[Math.floor(rand() * JOB_FAILURE_REASONS.length)],
      });
      continue;
    }

    if (seed.kind === 'caption') {
      // Contrato D2: caption succeeded lleva SIEMPRE 3 variantes.
      jobs.push({ ...job, resultVariants: seed.variants });
      continue;
    }

    // image succeeded: 4 assets; video succeeded: 1 thumbnail (D9).
    const mediaStart = Math.floor(rand() * MEDIA_FILE_COUNT);
    const resultCount = seed.kind === 'image' ? 4 : 1;
    jobs.push({
      ...job,
      resultUrls: Array.from({ length: resultCount }, (_, k) => resultAsset(mediaStart + k)),
    });
  }

  return jobs;
};
