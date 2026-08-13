import { demoAsset } from '../../../shared/constants/demo-assets';

/**
 * Avatares demo usados por las cards del showcase (avatar groups, listas de
 * miembros, perfiles). Centralizados acá en vez de hardcodear las URLs del
 * CDN en el template — la base vive en `shared/constants/demo-assets`.
 */
export const DEMO_AVATARS = {
  main: demoAsset('main-avatar.png'),
  avatar1: demoAsset('avatar1.png'),
  avatar2: demoAsset('avatar2.png'),
  avatar5: demoAsset('avatar5.png'),
  avatar7: demoAsset('avatar7.png'),
  avatar8: demoAsset('avatar8.png'),
  avatar9: demoAsset('avatar9.jpg'),
  avatar10: demoAsset('avatar10.jpg'),
  avatar11: demoAsset('avatar11.jpg'),
  avatar12: demoAsset('avatar12.jpg'),
  avatar13: demoAsset('avatar13.jpg'),
} as const;
