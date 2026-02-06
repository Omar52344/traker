import { TrackerEvent, Settings } from './types';

export class Batcher {
    private queue: TrackerEvent[] = [];
    private settings: Settings;
    private flushTimer: any;

    constructor(settings: Settings) {
        this.settings = settings;
        this.startFlushTimer();
        this.setupPageHideListener();
    }

    public push(event: TrackerEvent): void {
        try {
            this.queue.push(event);
            if (this.queue.length >= 50) {
                this.flush();
            }
        } catch (e) {
            this.logError('Push to batcher failed', e);
        }
    }

    private logError(message: string, error: any): void {
        if (this.settings.debug) {
            console.error(`[Traker Batcher] ${message}:`, error);
        }
    }

    private startFlushTimer(): void {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.settings.flushInterval);
    }

    private flush(): void {
        try {
            if (this.queue.length === 0) return;

            const payload = [...this.queue];
            this.queue = []; // Clear queue immediately to avoid duplicates if flush takes time

            this.send(payload);
        } catch (e) {
            this.logError('Flush failed', e);
        }
    }

    private send(events: TrackerEvent[], useBeaconForce: boolean = false): void {
        try {
            if (this.settings.debug) {
                console.log('[Traker] Sending events:', events);
            }

            const data = JSON.stringify(events);

            // Use Beacon if requested or forced (page hide), provided it's supported
            if ((this.settings.useBeacon || useBeaconForce) && navigator.sendBeacon) {
                const blob = new Blob([data], { type: 'application/json' });
                const success = navigator.sendBeacon(this.settings.endpoint, blob);
                if (!success && this.settings.debug) {
                    console.warn('[Traker] sendBeacon returned false');
                }
            } else {
                // Fallback to fetch
                fetch(this.settings.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: data,
                    keepalive: true
                }).catch(err => this.logError('Fetch failed', err));
            }
        } catch (e) {
            this.logError('Send failed', e);
        }
    }

    private setupPageHideListener(): void {
        try {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flushWithBeacon();
                }
            });

            window.addEventListener('beforeunload', () => {
                this.flushWithBeacon();
            });
        } catch (e) {
            this.logError('Setup page hide listener failed', e);
        }
    }

    private flushWithBeacon(): void {
        try {
            if (this.queue.length === 0) return;
            const payload = [...this.queue];
            this.queue = [];
            this.send(payload, true);
        } catch (e) {
            this.logError('Flush with beacon failed', e);
        }
    }
}
