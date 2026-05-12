import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CustomersComponent } from './customers.component';

/**
 * Smoke test del módulo customers. Mantiene la verificación mínima de
 * compilación + bootstrap del componente standalone.
 *
 * **Provider chain explícito**: `CustomersUrlStateService` y el chaos
 * flag del componente inyectan `ActivatedRoute` para leer queryParams.
 * Sin `provideRouter([])` el TestBed no compone el router injector y
 * el bootstrap falla con `NG0201: No provider found for ActivatedRoute`.
 * No usamos `RouterTestingModule` (legacy) — `provideRouter` es el
 * patrón canónico en Angular 21 standalone.
 */
describe('CustomersComponent', () => {
  let component: CustomersComponent;
  let fixture: ComponentFixture<CustomersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
