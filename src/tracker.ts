import { TrakerConfig, TrackerEvent, TrackingPlan, ComponentTrackingOptions } from './types';
import { Batcher } from './batcher';
import { generateUUID, calculateRelativeCoordinates } from './utils';

export class Traker {
    private config: TrakerConfig;
    private batcher: Batcher | null = null;
    private sessionId: string;
    private observer: IntersectionObserver | null = null;
    private mutationObserver: MutationObserver | null = null;
    private hoverTimers: Map<Element, any> = new Map();
    private visibilityTimers: Map<Element, any> = new Map();
    private trackedElements: WeakSet<Element> = new WeakSet();
    private isSampled: boolean = false;

    constructor(config: TrakerConfig) {
        this.config = config;
        // Initialize safely to satisfy strict property initialization
        this.sessionId = generateUUID();

        try {
            this.sessionId = this.getSessionId();

            // Check sample rate
            if (Math.random() <= this.config.settings.sampleRate) {
                this.isSampled = true;
                this.batcher = new Batcher(this.config.settings);
            }
        } catch (e) {
            this.logError('Initialization failed', e);
        }
    }

    private logError(message: string, error: any): void {
        if (this.config.settings.debug) {
            console.error(`[Traker] ${message}:`, error);
        }
    }

    private getSessionId(): string {
        try {
            let sid = sessionStorage.getItem('traker_sid');
            if (!sid) {
                sid = generateUUID();
                sessionStorage.setItem('traker_sid', sid);
            }
            return sid;
        } catch (e) {
            this.logError('Session ID generation failed', e);
            return generateUUID(); // Fallback in case of storage error
        }
    }

    public init(): void {
        if (!this.isSampled) return;

        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.scan());
            } else {
                this.scan();
            }

            if (this.config.settings.autoRefresh) {
                this.setupMutationObserver();
            }
        } catch (e) {
            this.logError('Init failed', e);
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

    private setupMutationObserver(): void {
        try {
            this.mutationObserver = new MutationObserver((mutations) => {
                // Debounce or just scan? For simplicity, we scan.
                // Could be optimized to only look at addedNodes but scan is robust.
                // To avoid performance hit on every attribute change, we limit to childList/subtree.
                this.scan();
            });

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            this.logError('MutationObserver setup failed', e);
        }
    }

    private scan(): void {
        try {
            const elements = document.querySelectorAll('[data-track-id]');

            elements.forEach((el) => {
                if (this.trackedElements.has(el)) return;

                const id = el.getAttribute('data-track-id');
                if (id && this.config.trackingPlan[id]) {
                    this.attachListeners(el as HTMLElement, id, this.config.trackingPlan[id]);
                    this.trackedElements.add(el);
                }
            });
        } catch (e) {
            this.logError('Scan failed', e);
        }
    }

    private attachListeners(el: HTMLElement, id: string, options: ComponentTrackingOptions): void {
        try {
            // Click
            if (options.click) {
                el.addEventListener('click', (e) => {
                    try {
                        const coords = calculateRelativeCoordinates(e, el);
                        this.track(id, 'click', { x: coords.x, y: coords.y });
                    } catch (e) {
                        this.logError('Click handler failed', e);
                    }
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
        } catch (e) {
            this.logError(`Attach listeners failed for ${id}`, e);
        }
    }

    private setupVisibilityObserver(): void {
        if (this.observer) return;

        try {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const el = entry.target;
                    const id = el.getAttribute('data-track-id');
                    if (!id) return;

                    // Requirement: > 50% visibility
                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        if (!this.visibilityTimers.has(el)) {
                            const timer = setTimeout(() => {
                                this.track(id, 'visibility', { dwell: 1000 });
                                this.visibilityTimers.delete(el);
                            }, 1000);
                            this.visibilityTimers.set(el, timer);
                        }
                    } else {
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
        } catch (e) {
            this.logError('IntersectionObserver setup failed', e);
        }
    }

    private track(cid: string, type: 'click' | 'hover' | 'visibility', meta: any): void {
        if (!this.batcher) return;

        try {
            // Add viewport dimensions to meta
            meta.vWidth = window.innerWidth;
            meta.vHeight = window.innerHeight;

            // Merge custom global metadata (e.g., User ID)
            if (this.config.settings.customMeta) {
                Object.assign(meta, this.config.settings.customMeta);
            }

            const event: TrackerEvent = {
                sid: this.sessionId,
                cid: cid,
                type: type,
                meta: meta,
                ts: Date.now()
            };

            this.batcher.push(event);
        } catch (e) {
            this.logError('Track failed', e);
        }
    }
}
