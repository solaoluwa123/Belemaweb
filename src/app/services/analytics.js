/**
 * Analytics and Monitoring Service
 */

class AnalyticsService {
  constructor() {
    this.isEnabled = import.meta.env.MODE === 'production';
  }

  trackEvent(event) {
    if (!this.isEnabled) {
      console.log('[Analytics]', event);
      return;
    }
  }

  trackPageView(path, title) {
    if (!this.isEnabled) {
      console.log('[Analytics] Page View:', path, title);
      return;
    }
  }

  trackLogin(userId, method) {
    this.trackEvent({
      category: 'Authentication',
      action: 'Login',
      label: method,
      metadata: { userId },
    });
  }

  trackTransaction(action, transactionId, amount) {
    this.trackEvent({
      category: 'Transactions',
      action,
      label: transactionId,
      value: amount,
    });
  }

  trackDispute(action, disputeId) {
    this.trackEvent({
      category: 'Disputes',
      action,
      label: disputeId,
    });
  }

  trackError(error, context) {
    this.trackEvent({
      category: 'Error',
      action: error.name,
      label: error.message,
      metadata: { ...context, stack: error.stack },
    });
  }

  trackPerformance(metric) {
    if (!this.isEnabled) {
      console.log('[Performance]', metric);
      return;
    }
  }

  setUserProperties(userId, properties) {
    if (!this.isEnabled) {
      console.log('[Analytics] User Properties:', userId, properties);
      return;
    }
  }
}

export const analytics = new AnalyticsService();

export class PerformanceMonitor {
  constructor() {
    this.startTimes = new Map();
  }

  start(label) {
    this.startTimes.set(label, performance.now());
  }

  end(label, metadata) {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      console.warn(`No start time found for: ${label}`);
      return;
    }
    const duration = performance.now() - startTime;
    this.startTimes.delete(label);
    analytics.trackPerformance({ name: label, duration, metadata });
  }

  async measure(label, fn, metadata) {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label, metadata);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
