export type EventType = 'click' | 'hover' | 'visibility';

export interface EventMeta {
    x?: number;
    y?: number;
    dwell?: number; // In milliseconds
    vWidth?: number;
    vHeight?: number;
    [key: string]: any;
}

export interface TrackerEvent {
    sid: string;
    cid: string;
    type: EventType;
    meta: EventMeta;
    ts: number;
}

export interface ComponentTrackingOptions {
    click: boolean;
    hover: boolean;
    visibility: boolean;
}

export interface TrackingPlan {
    [componentId: string]: ComponentTrackingOptions;
}

export interface Settings {
    version: string;
    endpoint: string;
    flushInterval: number; // milliseconds
    sampleRate: number; // 0.0 to 1.0
    useBeacon: boolean;
    autoRefresh?: boolean;
    debug?: boolean;
    customMeta?: Record<string, any>;
}

export interface TrakerConfig {
    settings: Settings;
    trackingPlan: TrackingPlan;
}
