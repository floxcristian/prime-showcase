import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

import type {
  AlertDetail,
  AlertSummary,
  InboxItem,
  InboxSummary,
  ServiceDetail,
  ServiceSummary,
} from '../models/observability.interface';
import { ALERT_DETAIL_MOCK, ALERTS_MOCK } from '../mocks/alerts-mock';
import { INBOX_MOCK } from '../mocks/inbox-mock';
import { SERVICE_DETAIL_MOCK, SERVICES_MOCK } from '../mocks/services-mock';

/**
 * Fachada read-only del backend de observabilidad. Devuelve `Observable`
 * con `delay()` para simular latencia de red — al migrar a HTTP real, los
 * shapes ya están consolidados en `models/observability.interface.ts`.
 *
 * Pattern showcase: data inmutable + reactividad delegada a signals
 * (`toSignal()` o `httpResource()` en consumers). Sin caché interno acá —
 * cada consumer decide si memoiza vía `computed()`.
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityMockService {
  /**
   * Simulación de latencia: 800-1800ms aleatorio. Range elegido para
   * imitar request HTTP real con server processing + DB query (típico
   * 600-1500ms en producción) en lugar de un response sincrónico que
   * haría imperceptible cualquier loading state. Permite ver el
   * skeleton inicial, el loading mask de p-table durante refresh, y
   * el spinner del refresh button. En producción este service se
   * reemplaza por httpResource real y este método deja de existir.
   */
  private latency = (): number => 800 + Math.floor(Math.random() * 1000);

  getServices(): Observable<readonly ServiceSummary[]> {
    return of(SERVICES_MOCK).pipe(delay(this.latency()));
  }

  getServiceDetail(id: string): Observable<ServiceDetail | undefined> {
    return of(SERVICE_DETAIL_MOCK(id)).pipe(delay(this.latency()));
  }

  getAlerts(): Observable<readonly AlertSummary[]> {
    return of(ALERTS_MOCK).pipe(delay(this.latency()));
  }

  getAlertDetail(id: string): Observable<AlertDetail | undefined> {
    return of(ALERT_DETAIL_MOCK(id)).pipe(delay(this.latency()));
  }

  getInbox(): Observable<readonly InboxItem[]> {
    return of(INBOX_MOCK).pipe(delay(this.latency()));
  }

  getInboxSummary(): Observable<InboxSummary> {
    return of({
      nowCount: INBOX_MOCK.filter((i) => i.bucket === 'now').length,
      todayCount: INBOX_MOCK.filter((i) => i.bucket === 'today').length,
      infoCount: INBOX_MOCK.filter((i) => i.bucket === 'info').length,
    }).pipe(delay(this.latency()));
  }
}
