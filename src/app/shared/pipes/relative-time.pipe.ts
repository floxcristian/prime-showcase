import { inject, Pipe, type PipeTransform } from '@angular/core';

import { TimeService } from '../services/time.service';

/**
 * Renderiza un timestamp ISO/Date como string relativo: "hace 3 min", "hace
 * 2 h", "hace 4 días", etc.
 *
 * **Pure pipe** que se invalida automáticamente cuando `TimeService.now()`
 * cambia (cada 60s + on tab focus). Antes del refactor cada instancia tenía
 * su propio `setInterval` → 70+ timers en una vista densa. Ahora 1 solo
 * service tickea, todos los pipes leen el mismo signal y Angular los
 * recomputa solo cuando el host CD se entera del cambio.
 *
 * SSR-safe: lee `Date.now()` al transformar — corre 1 vez en server con
 * timestamp del request, OK.
 */
@Pipe({
  name: 'relativeTime',
  standalone: true,
  pure: true,
})
export class RelativeTimePipe implements PipeTransform {
  private time = inject(TimeService);

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    // Leer `now()` para subscribirse al signal — Angular invalidará el pipe
    // cuando cambie. La pura comparación de input (`pure: true`) no captura
    // el paso del tiempo; es el `time.now()` quien lo aporta.
    const now = this.time.now();
    return formatRelative(now - date.getTime());
  }
}

function formatRelative(deltaMs: number): string {
  if (deltaMs < 0) return 'en el futuro';
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 30) return 'ahora mismo';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? 'hace 1 min' : `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 h' : `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}
