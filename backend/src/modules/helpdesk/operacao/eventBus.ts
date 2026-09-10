import { EventEmitter } from 'events';

export type OperationalEventType =
  | 'presence_changed'
  | 'ticket_assigned'
  | 'ticket_unassigned'
  | 'ticket_stage_changed'
  | 'ticket_message_sent'
  | 'ticket_message_received'
  | 'ticket_created'
  | 'ticket_closed'
  | 'ticket_escalated'
  | 'pause_started'
  | 'pause_ended'
  | 'activity_recorded'
  | 'status_changed';

export interface OperationalEvent {
  type: OperationalEventType;
  userId: string;
  organizationId?: string | null;
  ticketId?: string;
  data?: Record<string, any>;
  timestamp: Date;
}

class OperationalEventBus extends EventEmitter {
  private static instance: OperationalEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): OperationalEventBus {
    if (!OperationalEventBus.instance) {
      OperationalEventBus.instance = new OperationalEventBus();
    }
    return OperationalEventBus.instance;
  }

  emitEvent(event: OperationalEvent) {
    this.emit('operational', event);
    this.emit(event.type, event);
    if (event.organizationId) {
      this.emit(`org:${event.organizationId}`, event);
    }
  }

  subscribeToOrganization(organizationId: string, callback: (event: OperationalEvent) => void) {
    const listener = (event: OperationalEvent) => {
      if (!event.organizationId || event.organizationId === organizationId) {
        callback(event);
      }
    };
    this.on('operational', listener);
    return () => this.off('operational', listener);
  }
}

export const operationalBus = OperationalEventBus.getInstance();
