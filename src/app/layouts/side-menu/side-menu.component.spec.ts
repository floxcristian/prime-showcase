import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { SideMenuComponent } from './side-menu.component';

describe('SideMenuComponent — browser platform', () => {
  let component: SideMenuComponent;
  let fixture: ComponentFixture<SideMenuComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SideMenuComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SideMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds the stats charts snapshot on bootstrap so the drawer has data on first open', () => {
    // The `charts()` signal is the single source of truth for the four
    // drawer widgets — if it were undefined on first render the panel would
    // flash empty until the next theme tick.
    const snapshot = component.charts();
    expect(snapshot).toBeDefined();
    expect(snapshot?.gauges).toHaveLength(2);
    expect(snapshot?.productUsage).toBeDefined();
    expect(snapshot?.totalPurchases).toBeDefined();
  });

  it('populates gauge metadata end-to-end from the STATS_CHARTS constant', () => {
    const gauges = component.charts()?.gauges ?? [];
    expect(gauges[0].id).toBe('satisfaction');
    expect(gauges[1].id).toBe('churn');
    // pct is passed through clamp — 0..100 integers in the fixture stay intact.
    expect(gauges[0].pct).toBe(56);
    expect(gauges[1].pct).toBe(24);
  });

  it('rebuilds charts when the theme toggles (new object identity, not mutation)', () => {
    // Mutation-in-place would defeat OnPush downstream — the template must
    // see a fresh reference to trigger re-render on every theme tick.
    const before = component.charts();
    TestBed.inject(AppConfigService).setDarkTheme(true);
    // `effect()` queues a microtask; `detectChanges` flushes it.
    fixture.detectChanges();
    const after = component.charts();
    expect(after).not.toBe(before);
    expect(after?.gauges).toHaveLength(2);
  });
});

describe('SideMenuComponent — server platform (SSR)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('skips chart building on the server so no DOM APIs are touched during render', async () => {
    // `initStatsCharts` reads getComputedStyle via DOM probes — calling it
    // under `platformId === 'server'` would crash SSR. The guard must leave
    // `charts()` as undefined; the first browser paint hydrates it.
    await TestBed.configureTestingModule({
      imports: [SideMenuComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SideMenuComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.charts()).toBeUndefined();
  });
});
