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
  // Latencia simulada compartida (rationale del range 800-1800ms en
  // `shared/utils/mock-latency.ts`).

  getServices(): Observable<readonly ServiceSummary[]> {
    return of(SERVICES_MOCK).pipe(delay(mockLatency()));
  }

  getServiceDetail(id: string): Observable<ServiceDetail | undefined> {
    return of(SERVICE_DETAIL_MOCK(id)).pipe(delay(mockLatency()));
  }

  getAlerts(): Observable<readonly AlertSummary[]> {
    return of(ALERTS_MOCK).pipe(delay(mockLatency()));
  }

  getAlertDetail(id: string): Observable<AlertDetail | undefined> {
    return of(ALERT_DETAIL_MOCK(id)).pipe(delay(mockLatency()));
  }

  getInbox(): Observable<readonly InboxItem[]> {
    return of(INBOX_MOCK).pipe(delay(mockLatency()));
  }

  getInboxSummary(): Observable<InboxSummary> {
    return of({
      nowCount: INBOX_MOCK.filter((i) => i.bucket === 'now').length,
      todayCount: INBOX_MOCK.filter((i) => i.bucket === 'today').length,
      infoCount: INBOX_MOCK.filter((i) => i.bucket === 'info').length,
    }).pipe(delay(mockLatency()));
  }
}
