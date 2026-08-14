import type { ProviderDescriptor } from '../models/provider.interface';

/**
 * Catálogo de providers de la suite social — plataforma-global, estático y
 * tipado (RFC-002 D1/D3). Diez entries: 3 `analytics-connector`,
 * 2 `image-gen`, 3 `video-gen`, 2 `text-gen`. Agregar un provider es un
 * cambio de compilación (los IDs son union types cerrados), no de datos.
 *
 * `keyPattern` es la fuente ÚNICA del shape-check client-side: el dialog de
 * alta de key y `verifyKey` validan con `new RegExp(descriptor.keyPattern)`
 * — sin archivo de regex paralelo, cero drift. Los valores por provider
 * (prefijo + largo mínimo) están CONGELADOS en RFC-003 D5.2; nunca validan
 * autenticidad — eso es `verifyKey` (simulado, RFC-002 D5). El mensaje
 * on-blur cita el `keyFormatHint` («El formato esperado es "sk-…"»).
 *
 * `capabilities` son declarativas: la UI se auto-configura leyéndolas (cero
 * if-por-provider). Para los conectores, `supportedMetrics` refleja el
 * vocabulario real de cada API (JSDoc de `MetricKind`, RFC-002 D2):
 * `saves`/`profile-visits` son de IG, `link-clicks`/`paid-reach` de FB
 * (IG expone `website_taps` como link-clicks), `completion-rate`/
 * `watch-time` de TikTok (que reporta `video-views` en vez de
 * impressions). Icons: `fa-brands` SOLO para logos reales de red; el resto
 * `fa-sharp fa-regular` (regla de DESIGN.md).
 */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  // ── Conectores de analytics (1 por red, orden canónico SOCIAL_NETWORKS) ──
  {
    id: 'instagram-graph',
    kind: 'analytics-connector',
    name: 'Instagram Graph API',
    vendor: 'Meta',
    icon: 'fa-brands fa-instagram',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    keyFormatHint: 'EAA…',
    keyPattern: '^EAA[A-Za-z0-9]{30,}$',
    capabilities: {
      networks: ['instagram'],
      supportedMetrics: [
        'followers',
        'net-follower-growth',
        'reach',
        'impressions',
        'engagement-rate',
        'likes',
        'comments',
        'shares',
        'saves',
        'profile-visits',
        'video-views',
        'watch-time',
        'link-clicks',
      ],
    },
  },
  {
    id: 'facebook-graph',
    kind: 'analytics-connector',
    name: 'Facebook Graph API',
    vendor: 'Meta',
    icon: 'fa-brands fa-facebook',
    docsUrl: 'https://developers.facebook.com/docs/graph-api',
    keyFormatHint: 'EAA…',
    keyPattern: '^EAA[A-Za-z0-9]{30,}$',
    capabilities: {
      networks: ['facebook'],
      supportedMetrics: [
        'followers',
        'net-follower-growth',
        'reach',
        'impressions',
        'engagement-rate',
        'likes',
        'comments',
        'shares',
        'video-views',
        'link-clicks',
        'paid-reach',
      ],
    },
  },
  {
    id: 'tiktok-api',
    kind: 'analytics-connector',
    name: 'TikTok Business API',
    vendor: 'ByteDance',
    icon: 'fa-brands fa-tiktok',
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    keyFormatHint: 'act.…',
    keyPattern: '^act\\.[A-Za-z0-9]{24,}$',
    capabilities: {
      networks: ['tiktok'],
      supportedMetrics: [
        'followers',
        'net-follower-growth',
        'reach',
        'engagement-rate',
        'likes',
        'comments',
        'shares',
        'profile-visits',
        'video-views',
        'watch-time',
        'completion-rate',
      ],
    },
  },

  // ── Generación de imágenes ───────────────────────────────────────────
  {
    id: 'openai-images',
    kind: 'image-gen',
    name: 'OpenAI Images',
    vendor: 'OpenAI',
    icon: 'fa-sharp fa-regular fa-image',
    docsUrl: 'https://platform.openai.com/docs/guides/image-generation',
    keyFormatHint: 'sk-…',
    keyPattern: '^sk-[A-Za-z0-9_-]{20,}$',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16'],
      maxResolution: '1024x1024',
    },
  },
  {
    id: 'gemini-imagen',
    kind: 'image-gen',
    name: 'Google Imagen',
    vendor: 'Google DeepMind',
    icon: 'fa-sharp fa-regular fa-images',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/imagen',
    keyFormatHint: 'AIza…',
    keyPattern: '^AIza[A-Za-z0-9_-]{16,}$',
    capabilities: {
      aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4'],
      maxResolution: '2048x2048',
    },
  },

  // ── Generación de video ──────────────────────────────────────────────
  {
    id: 'veo',
    kind: 'video-gen',
    name: 'Google Veo',
    vendor: 'Google DeepMind',
    icon: 'fa-sharp fa-regular fa-clapperboard',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/video',
    keyFormatHint: 'AIza…',
    keyPattern: '^AIza[A-Za-z0-9_-]{16,}$',
    capabilities: {
      maxVideoSeconds: 8,
      aspectRatios: ['16:9', '9:16'],
      maxResolution: '4k',
    },
  },
  {
    id: 'heygen',
    kind: 'video-gen',
    name: 'HeyGen',
    vendor: 'HeyGen',
    icon: 'fa-sharp fa-regular fa-video',
    docsUrl: 'https://docs.heygen.com',
    keyFormatHint: 'hg_…',
    keyPattern: '^hg_[A-Za-z0-9]{24,}$',
    capabilities: {
      maxVideoSeconds: 60,
      // Único provider con avatares presentadores (RFC-002 D3).
      supportsAvatars: true,
      aspectRatios: ['16:9', '9:16', '1:1'],
      maxResolution: '1080p',
    },
  },
  {
    id: 'higgsfield',
    kind: 'video-gen',
    name: 'Higgsfield',
    vendor: 'Higgsfield AI',
    icon: 'fa-sharp fa-regular fa-film',
    docsUrl: 'https://higgsfield.ai/docs',
    keyFormatHint: 'hf-…',
    keyPattern: '^hf-[A-Za-z0-9]{24,}$',
    capabilities: {
      maxVideoSeconds: 10,
      aspectRatios: ['9:16', '16:9', '1:1'],
      maxResolution: '1080p',
    },
  },

  // ── Generación de texto (captions) ───────────────────────────────────
  {
    id: 'gpt',
    kind: 'text-gen',
    name: 'OpenAI GPT',
    vendor: 'OpenAI',
    icon: 'fa-sharp fa-regular fa-pen-nib',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    keyFormatHint: 'sk-…',
    keyPattern: '^sk-[A-Za-z0-9_-]{20,}$',
    capabilities: {
      // Caption succeeded: SIEMPRE 3 variantes (RFC-002 D2, GenerationJob).
      captionVariants: 3,
    },
  },
  {
    id: 'gemini',
    kind: 'text-gen',
    name: 'Google Gemini',
    vendor: 'Google DeepMind',
    icon: 'fa-sharp fa-regular fa-sparkles',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    keyFormatHint: 'AIza…',
    keyPattern: '^AIza[A-Za-z0-9_-]{16,}$',
    capabilities: {
      captionVariants: 3,
    },
  },
];
