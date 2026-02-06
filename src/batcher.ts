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
        this.queue.push(event);
        if (this.queue.length >= 50) {
            this.flush();
        }
    }

    private startFlushTimer(): void {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.settings.flushInterval);
    }

    private flush(): void {
        if (this.queue.length === 0) return;

        const payload = [...this.queue];
        this.queue = []; // Clear queue immediately to avoid duplicates if flush takes time

        this.send(payload);
    }

    private send(events: TrackerEvent[], useBeaconForce: boolean = false): void {
        const data = JSON.stringify(events);

        // Use Beacon if requested or forced (page hide), provided it's supported
        if ((this.settings.useBeacon || useBeaconForce) && navigator.sendBeacon) {
            // navigator.sendBeacon sends a POST with the data.
            // We might need to send a Blob to ensure headers are roughly correct, 
            // though sendBeacon interface is simple.
            // Usually standard JSON payload is fine.
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(this.settings.endpoint, blob);
        } else {
            // Fallback to fetch
            fetch(this.settings.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: data,
                keepalive: true // Important for background/closing tabs
            }).catch(err => console.error('Traker: Failed to send events', err));
        }
    }

    private setupPageHideListener(): void {
        // Listen for visibilitychange to hidden
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flushWithBeacon();
            }
        });

        // Also beforeunload just in case, though visibilitychange is preferred in modern browsers
        window.addEventListener('beforeunload', () => {
            this.flushWithBeacon();
        });
    }

    private flushWithBeacon(): void {
        if (this.queue.length === 0) return;
        const payload = [...this.queue];
        this.queue = [];
        this.send(payload, true);
    }
}
