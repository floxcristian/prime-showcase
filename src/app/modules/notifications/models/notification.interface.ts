export type NotificationCategory =
  | 'finance'
  | 'inventory'
  | 'customer'
  | 'logistics'
  | 'system';

export interface Notification {
  id: string;
  title: string;
  description: string;
  /** ISO datetime string. Se formatea en el componente (hora relativa o absoluta). */
  timestamp: string;
  read: boolean;
  category: NotificationCategory;
  /** FontAwesome sharp icon. Derivado de la categoría por convención. */
  icon: string;
  /** URL del recurso relacionado. Si existe, la notificación es tappeable y
   * navega al detalle (factura, OC, cliente, etc). Si no, se renderiza
   * como read-only (ej: eventos puros del sistema tipo "backup completado"). */
  url?: string;
}

export interface NotificationGroup {
  /** Label del grupo: "Hoy", "Ayer" o fecha formateada (ej. "Lun 21 abr"). */
  label: string;
  notifications: Notification[];
}
