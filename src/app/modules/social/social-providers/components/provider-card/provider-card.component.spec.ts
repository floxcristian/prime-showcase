import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PROVIDER_CATALOG } from '../../../mocks/provider-catalog';
import type {
  ApiKeyEntry,
  ConnectorConfig,
  ProviderDescriptor,
  ProviderId,
} from '../../../models/provider.interface';
import { ProviderCardComponent } from './provider-card.component';

/** Descriptor real del catálogo — la card se auto-configura leyéndolo, así
 *  que el test también verifica que el catálogo congelado siga siendo
 *  describible sin `if`-por-provider. */
function descriptorOf(id: ProviderId): ProviderDescriptor {
  const descriptor = PROVIDER_CATALOG.find((entry) => entry.id === id);
  if (!descriptor) {
    throw new Error(`El catálogo no declara el provider ${id}.`);
  }
  return descriptor;
}

function keyFor(
  providerId: ProviderId,
  overrides: Partial<ApiKeyEntry> = {},
): ApiKeyEntry {
  return {
    id: `key-${providerId}-test`,
    providerId,
    maskedKey: 'sk-abcdefghijkl…a4f9',
    status: 'unverified',
    createdAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

function configFor(
  providerId: ProviderId,
  overrides: Partial<ConnectorConfig> = {},
): ConnectorConfig {
  return { providerId, enabled: false, options: {}, ...overrides };
}

/** Monta la card con el set mínimo de inputs y devuelve el fixture ya
 *  renderizado (los inputs restantes usan sus defaults). */
function mount(inputs: {
  descriptor: ProviderDescriptor;
  config?: ConnectorConfig;
  activeKey?: ApiKeyEntry;
  isActiveProvider?: boolean;
}) {
  const fixture = TestBed.createComponent(ProviderCardComponent);
  fixture.componentRef.setInput('descriptor', inputs.descriptor);
  fixture.componentRef.setInput('config', inputs.config);
  fixture.componentRef.setInput('activeKey', inputs.activeKey);
  fixture.componentRef.setInput(
    'isActiveProvider',
    inputs.isActiveProvider ?? false,
  );
  fixture.detectChanges();
  return fixture;
}

function textOf(fixture: { nativeElement: HTMLElement }): string {
  // Colapsa el whitespace del template para poder asertar frases completas.
  return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('ProviderCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderCardComponent],
    }).compileComponents();
  });

  it('describe las capabilities de un video-gen leyendo el descriptor', () => {
    const fixture = mount({ descriptor: descriptorOf('veo') });
    const text = textOf(fixture);
    expect(text).toContain('Google Veo');
    expect(text).toContain('Google DeepMind');
    expect(text).toContain('hasta 8 s · 16:9, 9:16 · 4k');
  });

  it('describe un analytics-connector con su red y su cobertura de métricas', () => {
    const fixture = mount({ descriptor: descriptorOf('instagram-graph') });
    expect(textOf(fixture)).toContain('Instagram · 13 métricas');
  });

  it('sin key: ofrece agregar una y deja el toggle deshabilitado', () => {
    const fixture = mount({
      descriptor: descriptorOf('gpt'),
      config: configFor('gpt'),
    });
    const text = textOf(fixture);
    expect(text).toContain('Sin API key configurada.');
    expect(text).toContain('Agregar key');
    expect(text).not.toContain('Verificar');
    const toggle: HTMLInputElement | null = fixture.nativeElement.querySelector(
      '#provider-enabled-gpt',
    );
    expect(toggle?.disabled).toBe(true);
  });

  it('con key válida: muestra estado, máscara y habilita el toggle', () => {
    const fixture = mount({
      descriptor: descriptorOf('gpt'),
      config: configFor('gpt', { activeKeyId: 'key-gpt-test' }),
      activeKey: keyFor('gpt', {
        status: 'valid',
        lastVerifiedAt: '2026-08-14T12:00:00.000Z',
        label: 'Producción',
      }),
    });
    const text = textOf(fixture);
    expect(text).toContain('Válida');
    expect(text).toContain('sk-abcdefghijkl…a4f9');
    expect(text).toContain('Producción');
    expect(text).toContain('Verificar');
    expect(text).toContain('Revocar');
    const toggle: HTMLInputElement | null = fixture.nativeElement.querySelector(
      '#provider-enabled-gpt',
    );
    expect(toggle?.disabled).toBe(false);
  });

  it('mapea cada estado de key a su label es-CL', () => {
    const cases = [
      { status: 'invalid', label: 'Inválida' },
      { status: 'expired', label: 'Expirada' },
      { status: 'unverified', label: 'Sin verificar' },
    ] as const;
    for (const { status, label } of cases) {
      const fixture = mount({
        descriptor: descriptorOf('gpt'),
        config: configFor('gpt', { activeKeyId: 'key-gpt-test' }),
        activeKey: keyFor('gpt', { status }),
      });
      expect(textOf(fixture)).toContain(label);
    }
  });

  it('"Usar como activo" solo aparece en un provider de generación habilitado que no es el activo', () => {
    const enabledKey = keyFor('veo', { status: 'valid' });
    const enabled = mount({
      descriptor: descriptorOf('veo'),
      config: configFor('veo', { enabled: true, activeKeyId: enabledKey.id }),
      activeKey: enabledKey,
    });
    expect(textOf(enabled)).toContain('Usar como activo');

    const active = mount({
      descriptor: descriptorOf('veo'),
      config: configFor('veo', { enabled: true, activeKeyId: enabledKey.id }),
      activeKey: enabledKey,
      isActiveProvider: true,
    });
    const activeText = textOf(active);
    expect(activeText).toContain('Activo');
    expect(activeText).not.toContain('Usar como activo');

    // Los conectores de analytics nunca participan de `activeByKind`.
    const connectorKey = keyFor('instagram-graph', { status: 'valid' });
    const connector = mount({
      descriptor: descriptorOf('instagram-graph'),
      config: configFor('instagram-graph', {
        enabled: true,
        activeKeyId: connectorKey.id,
      }),
      activeKey: connectorKey,
    });
    expect(textOf(connector)).not.toContain('Usar como activo');
  });
});
