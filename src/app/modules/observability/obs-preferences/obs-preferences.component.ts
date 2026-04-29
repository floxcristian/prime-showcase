import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { PillComponent } from '../../../shared/components/pill/pill.component';

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
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Select,
    ToggleSwitch,
    PillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
  template: `
    <!-- Header — patrón compartido con CRM > Clientes -->
    <div class="flex items-start gap-2 justify-between flex-wrap mb-6">
      <div class="min-w-0">
        <h1 class="text-2xl leading-8 text-color font-medium">
          Preferencias
        </h1>
        <div class="mt-1 leading-6 text-muted-color">
          Configurá qué notificaciones recibís, por qué canal y cuándo. Si
          activás on-call, recibís todo sin filtros.
        </div>
      </div>
      <div class="flex gap-2 whitespace-nowrap">
        <p-button
          label="Restablecer"
          severity="secondary"
          [outlined]="true"
          icon="fa-sharp fa-regular fa-rotate-left"
          (onClick)="resetAll()"
        />
        <p-button
          label="Guardar"
          severity="primary"
          icon="fa-sharp fa-regular fa-check"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <!-- Main: canales / severidad / DND -->
      <div class="xl:col-span-8 flex flex-col gap-4">
        <!-- Canales -->
        <section class="border border-surface rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <i
              class="fa-sharp fa-regular fa-paper-plane text-color text-xl"
              aria-hidden="true"
            ></i>
            <h2 class="text-color font-bold leading-6">Canales</h2>
          </div>
          <p class="text-muted-color leading-6 mb-4">
            Habilitá los medios por los que querés recibir alertas y avisos.
          </p>
          <ul class="divide-y divide-surface-200 dark:divide-surface-800">
            @for (ch of channels(); track ch.key) {
              <li class="flex items-center gap-3 py-3">
                <i
                  [class]="ch.icon"
                  class="text-color text-xl"
                  aria-hidden="true"
                ></i>
                <div class="flex-1 min-w-0">
                  <label
                    [for]="'ch-' + ch.key"
                    class="text-color font-semibold leading-6 cursor-pointer hover:text-color-emphasis transition-colors block"
                    >{{ ch.label }}</label
                  >
                  <span class="text-muted-color text-sm leading-5">{{
                    ch.description
                  }}</span>
                </div>
                <p-toggleswitch
                  [ngModel]="ch.enabled"
                  (ngModelChange)="toggleChannel(ch.key, $event)"
                  [inputId]="'ch-' + ch.key"
                />
              </li>
            }
          </ul>
        </section>

        <!-- Severidad mínima -->
        <section class="border border-surface rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <i
              class="fa-sharp fa-regular fa-bell text-color text-xl"
              aria-hidden="true"
            ></i>
            <h2 class="text-color font-bold leading-6">
              Severidad mínima para interrumpir
            </h2>
          </div>
          <p class="text-muted-color leading-6 mb-4">
            Sólo recibís push fuera de horario si la alerta es de esta
            severidad o mayor. Las alertas más bajas se acumulan en tu inbox.
          </p>
          <p-select
            [options]="severityOptions"
            [ngModel]="minSeverity()"
            (ngModelChange)="minSeverity.set($event)"
            optionLabel="label"
            optionValue="value"
            class="w-full sm:w-72"
          />
        </section>

        <!-- DND -->
        <section class="border border-surface rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <i
              class="fa-sharp fa-regular fa-moon text-color text-xl"
              aria-hidden="true"
            ></i>
            <h2 class="text-color font-bold leading-6">No molestar</h2>
          </div>
          <p class="text-muted-color leading-6 mb-4">
            Ventana de silencio para push. Las alertas siguen entrando al
            inbox; sólo se pausa la interrupción del dispositivo.
          </p>
          <div class="flex items-center gap-3 mb-4">
            <p-toggleswitch
              [ngModel]="dndEnabled()"
              (ngModelChange)="dndEnabled.set($event)"
              inputId="dnd-toggle"
            />
            <label
              for="dnd-toggle"
              class="text-color font-semibold leading-6 cursor-pointer hover:text-color-emphasis transition-colors select-none"
              >Activar No molestar</label
            >
          </div>
          @if (dndEnabled()) {
            <div class="flex flex-wrap items-end gap-3">
              <div class="flex flex-col gap-2">
                <label
                  for="dnd-from"
                  class="text-color font-semibold leading-6"
                  >Desde</label
                >
                <input
                  pInputText
                  id="dnd-from"
                  type="time"
                  [ngModel]="dndFrom()"
                  (ngModelChange)="dndFrom.set($event)"
                  class="w-32"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label
                  for="dnd-to"
                  class="text-color font-semibold leading-6"
                  >Hasta</label
                >
                <input
                  pInputText
                  id="dnd-to"
                  type="time"
                  [ngModel]="dndTo()"
                  (ngModelChange)="dndTo.set($event)"
                  class="w-32"
                />
              </div>
            </div>
          }
        </section>
      </div>

      <!-- Side: on-call + devices -->
      <div class="xl:col-span-4 flex flex-col gap-4">
        <!-- On-call -->
        <section class="border border-surface rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <i
              class="fa-sharp fa-regular fa-user-headset text-color text-xl"
              aria-hidden="true"
            ></i>
            <h2 class="text-color font-bold leading-6 flex-1">Modo on-call</h2>
            @if (onCall()) {
              <app-pill icon="fa-sharp fa-regular fa-circle-dot">
                Activo
              </app-pill>
            }
          </div>
          <p class="text-muted-color leading-6 mb-4">
            Mientras esté activo, recibís TODAS las alertas (incluso las que
            normalmente filtrarías por severidad o DND).
          </p>
          <div class="flex items-center gap-3">
            <p-toggleswitch
              [ngModel]="onCall()"
              (ngModelChange)="onCall.set($event)"
              inputId="oncall-toggle"
            />
            <label
              for="oncall-toggle"
              class="text-color font-semibold leading-6 cursor-pointer hover:text-color-emphasis transition-colors select-none"
              >Estoy on-call</label
            >
          </div>
        </section>

        <!-- Devices -->
        <section class="border border-surface rounded-2xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <i
              class="fa-sharp fa-regular fa-mobile text-color text-xl"
              aria-hidden="true"
            ></i>
            <h2 class="text-color font-bold leading-6 flex-1">
              Dispositivos
            </h2>
            <app-pill>{{ devices().length }}</app-pill>
          </div>
          <ul class="flex flex-col gap-2 mb-4">
            @for (d of devices(); track d.id) {
              <li
                class="flex items-center gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-900"
              >
                <i
                  [class]="d.icon"
                  class="text-color"
                  aria-hidden="true"
                ></i>
                <div class="flex-1 min-w-0">
                  <div class="text-color font-medium leading-6 truncate">
                    {{ d.name }}
                  </div>
                  <div class="text-xs text-muted-color leading-4">
                    Vinculado {{ d.linkedAgo }}
                  </div>
                </div>
                @if (d.primary) {
                  <app-pill>Principal</app-pill>
                }
              </li>
            }
          </ul>
          <p-button
            label="Registrar este dispositivo"
            severity="secondary"
            [outlined]="true"
            icon="fa-sharp fa-regular fa-plus"
            styleClass="w-full"
          />
        </section>
      </div>
    </div>
  `,
})
export class ObsPreferencesComponent {
  protected readonly channels = signal<readonly ChannelPref[]>([
    {
      key: 'push',
      label: 'Notificaciones push',
      description: 'En el dispositivo registrado, sin abrir la app.',
      icon: 'fa-sharp fa-regular fa-mobile',
      enabled: true,
    },
    {
      key: 'email',
      label: 'Email',
      description: 'A tu correo corporativo.',
      icon: 'fa-sharp fa-regular fa-envelope',
      enabled: true,
    },
    {
      key: 'in-app',
      label: 'In-app',
      description: 'Banner dentro de la app cuando estás conectado.',
      icon: 'fa-sharp fa-regular fa-bell',
      enabled: true,
    },
  ]);

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

  protected readonly devices = signal<readonly DevicePref[]>([
    {
      id: 'dev-1',
      name: 'iPhone 15 Pro · Brook',
      icon: 'fa-sharp fa-regular fa-mobile-screen',
      linkedAgo: 'hace 12 días',
      primary: true,
    },
    {
      id: 'dev-2',
      name: 'MacBook Pro · Chrome',
      icon: 'fa-sharp fa-regular fa-laptop',
      linkedAgo: 'hace 3 meses',
      primary: false,
    },
  ]);

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

interface ChannelPref {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly enabled: boolean;
}

interface DevicePref {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly linkedAgo: string;
  readonly primary: boolean;
}
