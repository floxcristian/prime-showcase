import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { PillComponent } from '../../../shared/components/pill/pill.component';
import {
  CHANNEL_PREFS_MOCK,
  DEVICE_PREFS_MOCK,
} from '../mocks/preferences-data';
import type {
  ChannelPref,
  DevicePref,
} from '../models/preferences.interface';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [ButtonModule, InputTextModule];
const PRIME_STANDALONE = [Select, ToggleSwitch];
const LOCAL_COMPONENTS = [PillComponent];

/**
 * Preferencias del usuario para notificaciones de observability.
 *
 * MVP funcional con estado local (signals). En producción cada toggle
 * se conectaría a `PUT /me/preferences` via httpResource o equivalente —
 * el shape del state está pensado para mapear 1:1 a esa API.
 *
 * Secciones (orden alineado con PagerDuty / Datadog Notifications):
 *   1. Canales      — push / email / in-app: por dónde te llegan los avisos
 *   2. Severidad    — umbral mínimo para interrumpir (DND-friendly)
 *   3. Modo on-call — overrides el DND, recibe TODO mientras esté on
 *   4. No molestar  — ventana horaria de silencio
 *   5. Dispositivos — listado de devices que pueden recibir push
 */
@Component({
  selector: 'app-obs-preferences',
  imports: [NG_MODULES, PRIME_MODULES, PRIME_STANDALONE, LOCAL_COMPONENTS],
  templateUrl: './obs-preferences.component.html',
  styleUrl: './obs-preferences.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsPreferencesComponent {
  protected readonly channels =
    signal<readonly ChannelPref[]>(CHANNEL_PREFS_MOCK);

  protected readonly severityOptions = [
    { label: 'Crítico únicamente', value: 'critical' },
    { label: 'Advertencia y crítico', value: 'warn' },
    { label: 'Todo (incluye info)', value: 'info' },
  ];

  protected readonly minSeverity = signal<'critical' | 'warn' | 'info'>('warn');
  protected readonly dndEnabled = signal<boolean>(true);
  protected readonly dndFrom = signal<string>('22:00');
  protected readonly dndTo = signal<string>('08:00');
  protected readonly onCall = signal<boolean>(false);

  protected readonly devices =
    signal<readonly DevicePref[]>(DEVICE_PREFS_MOCK);

  protected toggleChannel(key: string, value: boolean): void {
    this.channels.update((list) =>
      list.map((c) => (c.key === key ? { ...c, enabled: value } : c)),
    );
  }

  protected resetAll(): void {
    this.channels.update((list) => list.map((c) => ({ ...c, enabled: true })));
    this.minSeverity.set('warn');
    this.dndEnabled.set(true);
    this.dndFrom.set('22:00');
    this.dndTo.set('08:00');
    this.onCall.set(false);
  }
}
