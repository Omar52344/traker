import { TrakerConfig, TrackerEvent, TrackingPlan, ComponentTrackingOptions } from './types';
import { Batcher } from './batcher';
import { generateUUID, calculateRelativeCoordinates } from './utils';

export class Traker {
    private config: TrakerConfig;
    private batcher: Batcher | null = null;
    private sessionId: string;
    private observer: IntersectionObserver | null = null;
    private hoverTimers: Map<Element, any> = new Map();
    private visibilityTimers: Map<Element, any> = new Map();
    private isSampled: boolean = false;

    constructor(config: TrakerConfig) {
        this.config = config;
        this.sessionId = this.getSessionId();

        // Check sample rate
        if (Math.random() <= this.config.settings.sampleRate) {
            this.isSampled = true;
            this.batcher = new Batcher(this.config.settings);
        }
    }

    private getSessionId(): string {
        let sid = sessionStorage.getItem('traker_sid');
        if (!sid) {
            sid = generateUUID();
            sessionStorage.setItem('traker_sid', sid);
        }
        return sid;
    }

    public init(): void {
        if (!this.isSampled) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.scan());
        } else {
            this.scan();
        }
    }

    /**
     * Rescans the DOM for new elements (SPA support).
     */
    public refresh(): void {
        if (this.isSampled) {
            this.scan();
        }
    }

    private scan(): void {
        const elements = document.querySelectorAll('[data-track-id]');

        elements.forEach((el) => {
            const id = el.getAttribute('data-track-id');
            if (id && this.config.trackingPlan[id]) {
                this.attachListeners(el as HTMLElement, id, this.config.trackingPlan[id]);
            }
        });
    }

    private attachListeners(el: HTMLElement, id: string, options: ComponentTrackingOptions): void {
        // Click
        if (options.click) {
            el.addEventListener('click', (e) => {
                const coords = calculateRelativeCoordinates(e, el);
                this.track(id, 'click', { x: coords.x, y: coords.y });
            });
        }

        // Hover (Intent)
        if (options.hover) {
            el.addEventListener('mouseenter', () => {
                const timer = setTimeout(() => {
                    this.track(id, 'hover', { dwell: 400 }); // Intent detected
                    this.hoverTimers.delete(el);
                }, 400);
                this.hoverTimers.set(el, timer);
            });

            el.addEventListener('mouseleave', () => {
                const timer = this.hoverTimers.get(el);
                if (timer) {
                    clearTimeout(timer);
                    this.hoverTimers.delete(el);
                }
            });
        }

        // Visibility
        if (options.visibility) {
            this.setupVisibilityObserver();
            this.observer?.observe(el);
        }
    }

    private setupVisibilityObserver(): void {
        if (this.observer) return;

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const el = entry.target;
                const id = el.getAttribute('data-track-id');
                if (!id) return;

                // Requirement: > 50% visibility
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    // If already counting, do nothing? Or restart?
                    // Usually we want to know if it stays for 1s.
                    if (!this.visibilityTimers.has(el)) {
                        const timer = setTimeout(() => {
                            this.track(id, 'visibility', { dwell: 1000 });
                            // Optional: Stop observing after tracked once?
                            // The spec doesn't say "once". But usually visibility impressions are once per view.
                            // For now, allow multiple if it goes out and back in.
                            this.visibilityTimers.delete(el);
                        }, 1000);
                        this.visibilityTimers.set(el, timer);
                    }
                } else {
                    // Less than 50% or not intersecting
                    const timer = this.visibilityTimers.get(el);
                    if (timer) {
                        clearTimeout(timer);
                        this.visibilityTimers.delete(el);
                    }
                }
            });
        }, {
            threshold: [0.5] // Trigger when passing 50%
        });
    }

    private track(cid: string, type: 'click' | 'hover' | 'visibility', meta: any): void {
        if (!this.batcher) return;

        // Add viewport dimensions to meta
        meta.vWidth = window.innerWidth;
        meta.vHeight = window.innerHeight;

        const event: TrackerEvent = {
            sid: this.sessionId,
            cid: cid,
            type: type,
            meta: meta,
            ts: Date.now()
        };

        this.batcher.push(event);
    }
}
