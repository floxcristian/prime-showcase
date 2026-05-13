/**
 * Modelos del dashboard de observabilidad. Son una fachada SHOWCASE — la
 * forma final dependerá del adaptador a Sentry/Grafana/GCP/etc. Tipos
 * inmutables para favorecer signal/computed performance.
 */

export type HealthState = 'ok' | 'warn' | 'critical' | 'unknown';

export type AlertSeverity = 'critical' | 'warn' | 'info';

export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'silenced';

export type InboxBucket = 'now' | 'today' | 'info';

export type InboxItemType = 'error' | 'alert' | 'uptime' | 'deploy' | 'trend';

export interface ServiceOwner {
  readonly id: string;
  readonly name: string;
  readonly role: 'primary' | 'secondary';
  readonly avatarUrl?: string;
}

export interface ServiceMetric {
  readonly value: number;
  readonly unit: string;
  /** Variación porcentual vs período anterior (signo indica dirección). */
  readonly delta?: number;
  /** Serie corta para sparkline (últimos 30 puntos). */
  readonly sparkline?: readonly number[];
}

export interface ServiceSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly team: string;
  readonly health: HealthState;
  readonly errorRate24h: ServiceMetric;
  readonly p99Latency: ServiceMetric;
  readonly uptime30d: ServiceMetric;
  readonly activeAlertsCount: number;
  readonly lastDeployAt: string;
  readonly lastAlertAt?: string;
  readonly tags: readonly string[];
}

export interface ServiceDeploy {
  readonly id: string;
  readonly version: string;
  readonly author: string;
  readonly commitSha: string;
  readonly commitMessage: string;
  readonly status: 'success' | 'failed' | 'rolled-back';
  readonly deployedAt: string;
  readonly durationSeconds: number;
}

export interface ServiceError {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly count: number;
  readonly affectedUsers: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly sparkline: readonly number[];
  readonly externalUrl: string;
}

export interface ServiceDependency {
  readonly id: string;
  readonly name: string;
  readonly health: HealthState;
}

export interface ServiceDetail extends ServiceSummary {
  readonly repoUrl: string;
  readonly runbookUrl: string;
  readonly externalDashboardUrl?: string;
  readonly endpoints: readonly string[];
  readonly owners: readonly ServiceOwner[];
  readonly dependencies: readonly ServiceDependency[];
  readonly deploys: readonly ServiceDeploy[];
  readonly errors: readonly ServiceError[];
  readonly slos: {
    readonly errorRateTarget: number;
    readonly latencyP99TargetMs: number;
    readonly uptimeTarget: number;
  };
}

export interface AlertHistoryEntry {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly action: 'fired' | 'acknowledged' | 'resolved' | 'silenced' | 'commented';
  readonly note?: string;
}

export interface AlertSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly firedAt: string;
  readonly acknowledgedBy?: ServiceOwner;
  readonly acknowledgedAt?: string;
  readonly currentValue?: number;
  readonly threshold?: number;
  readonly unit?: string;
}

export interface AlertDetail extends AlertSummary {
  readonly rule: string;
  readonly runbookMarkdown?: string;
  readonly externalUrl: string;
  readonly metricSeries: readonly { readonly t: string; readonly v: number }[];
  readonly history: readonly AlertHistoryEntry[];
  readonly relatedLogs: readonly {
    readonly at: string;
    readonly level: 'error' | 'warn' | 'info';
    readonly message: string;
  }[];
}

export interface InboxItem {
  readonly id: string;
  readonly bucket: InboxBucket;
  readonly type: InboxItemType;
  readonly severity: AlertSeverity;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly title: string;
  readonly detail?: string;
  readonly occurredAt: string;
  readonly ackable: boolean;
  readonly acknowledged: boolean;
  readonly sourceUrl?: string;
}

export interface InboxSummary {
  readonly nowCount: number;
  readonly todayCount: number;
  readonly infoCount: number;
}
