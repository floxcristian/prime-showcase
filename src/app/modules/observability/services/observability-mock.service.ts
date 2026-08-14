import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import { mockLatency } from '../../../shared/utils/mock-latency';
import type {
  AlertDetail,
  AlertSummary,
  InboxItem,
  InboxSummary,
  ServiceDetail,
  ServiceSummary,
} from '../models/observability.interface';
import { buildAlertDetailMock, buildAlertsMock } from '../mocks/alerts-mock';
import { buildInboxMock } from '../mocks/inbox-mock';
import { now } from '../mocks/mock-utils';
import {
  buildServiceDetailMock,
  buildServicesMock,
} from '../mocks/services-mock';

/**
 * Fachada read-only del backend de observabilidad. Devuelve `Observable`
 * con `delay()` para simular latencia de red — al migrar a HTTP real, los
 * shapes ya están consolidados en `models/observability.interface.ts`.
 *
 * **Ancla temporal por instancia (`epoch`):** los mocks se construyen acá
 * (factories puras de `mocks/*`) anclados al instante de creación del
 * service. Con `providedIn: 'root'`:
 *   - **SSR**: cada request crea un `ApplicationRef` nuevo → instancia
 *     fresca del service → timestamps frescos por request. Antes los
 *     mocks eran consts congeladas al import del módulo y en un server de
 *     larga vida los "hace X min" derivaban sin límite desde el boot.
 *   - **Browser**: una instancia por sesión → epoch estable → datos y
 *     caches idénticos durante toda la sesión (mismo comportamiento que
 *     antes del refactor: nada cambia dentro de una sesión).
 *
 * **Detail caches por instancia:** memoizan `getServiceDetail` /
 * `getAlertDetail` por id — navegar away+back muestra los MISMOS deploys/
 * errors. Como campos de instancia (no Maps a nivel módulo) no son estado
 * compartido entre requests SSR.
 *
 * Pattern showcase: data inmutable + reactividad delegada a signals
 * (`toSignal()` o `httpResource()` en consumers).
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityMockService {
  /**
   * Ancla temporal de TODOS los timestamps mock de esta instancia.
   * Público a propósito: las vistas que correlacionan timestamps propios
   * con los de los mocks (ej: segment grid de obs-uptime, historial de
   * notificaciones) DEBEN usar este epoch como ancla — es el mismo
   * instante con que se construyeron los mocks, coherencia garantizada
   * por construcción. Un `now()` capturado por componente deriva respecto
   * de los mocks durante sesiones largas.
   */
  readonly epoch: number = now();

  // Mocks construidos una vez por instancia, todos anclados a `epoch`.
  private readonly servicesMock = buildServicesMock(this.epoch);
  private readonly alertsMock = buildAlertsMock(this.epoch, this.servicesMock);
  private readonly inboxMock = buildInboxMock(this.epoch, this.servicesMock);

  private readonly serviceDetailCache = new Map<string, ServiceDetail>();
  private readonly alertDetailCache = new Map<string, AlertDetail>();

  /**
   * Snapshot sincrónico del catálogo — para vistas que componen mocks
   * DERIVADOS de los servicios (ej: `obs-notifications-history` genera su
   * historial referenciando ids/nombres reales) sin pasar por el
   * Observable con latencia. No es un canal de datos alternativo: para
   * listar servicios usar `getServices()`.
   */
  get servicesSnapshot(): readonly ServiceSummary[] {
    return this.servicesMock;
  }

  // Latencia simulada compartida (rationale del range 800-1800ms en
  // `shared/utils/mock-latency.ts`).

  getServices(): Observable<readonly ServiceSummary[]> {
    return of(this.servicesMock).pipe(delay(mockLatency()));
  }

  getServiceDetail(id: string): Observable<ServiceDetail | undefined> {
    return of(this.serviceDetail(id)).pipe(delay(mockLatency()));
  }

  getAlerts(): Observable<readonly AlertSummary[]> {
    return of(this.alertsMock).pipe(delay(mockLatency()));
  }

  getAlertDetail(id: string): Observable<AlertDetail | undefined> {
    return of(this.alertDetail(id)).pipe(delay(mockLatency()));
  }

  getInbox(): Observable<readonly InboxItem[]> {
    return of(this.inboxMock).pipe(delay(mockLatency()));
  }

  getInboxSummary(): Observable<InboxSummary> {
    return of({
      nowCount: this.inboxMock.filter((i) => i.bucket === 'now').length,
      todayCount: this.inboxMock.filter((i) => i.bucket === 'today').length,
      infoCount: this.inboxMock.filter((i) => i.bucket === 'info').length,
    }).pipe(delay(mockLatency()));
  }

  private serviceDetail(id: string): ServiceDetail | undefined {
    const cached = this.serviceDetailCache.get(id);
    if (cached) return cached;
    const detail = buildServiceDetailMock(this.epoch, this.servicesMock, id);
    if (detail) this.serviceDetailCache.set(id, detail);
    return detail;
  }

  private alertDetail(id: string): AlertDetail | undefined {
    const cached = this.alertDetailCache.get(id);
    if (cached) return cached;
    const detail = buildAlertDetailMock(this.epoch, this.alertsMock, id);
    if (detail) this.alertDetailCache.set(id, detail);
    return detail;
  }
}
