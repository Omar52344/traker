# Traker

A framework-agnostic NPM library for capturing user interaction analytics with relative coordinate precision.

## Why Traker?

Most analytics tools are "black boxes". Traker gives you raw, component-relative data so you can build your own heatmaps and algorithms without compromising user privacy or site performance.

- **Relative Coordinates**: Unlike pixel-based tracking, Traker measures percentages ($$X_p$$, $$Y_p$$). This ensures your heatmaps work perfectly across responsive designs and fluid layouts.
- **Privacy First**: Traker is GDPR-friendly by default. It never captures input text or PII, only interaction data on elements you explicitly define.

## Features

- **Component Identification**: Uses `data-track-id` attributes.
- **Dynamic Configuration**: Configurable via JSON object or external file.
- **Privacy & Performance**: Only tracks defined elements. Uses `sendBeacon` and `IntersectionObserver`.
- **Metrics**: 
  - Relative Click Coordinates (%)
  - Hover Intent (400ms threshold)
  - Visibility (>50% visibility for >1s)
- **Zero Dependencies**: Built with Vanilla TypeScript.

## Installation

```bash
npm install traker
```

## Usage

### Basic Initialization

```javascript
import Traker from 'traker';

const config = {
  settings: {
    version: "1.0.0",
    endpoint: "https://api.your-domain.com/collect",
    flushInterval: 5000,
    sampleRate: 1.0,
    useBeacon: true,
    autoRefresh: true,
    debug: false
  },
  trackingPlan: {
    "hero-button": { click: true, hover: true, visibility: true },
    "product-card": { click: true, hover: false, visibility: true }
  }
};

const tracker = new Traker(config);
tracker.init();
```

### SPA Support

Modern frameworks like React, Vue, and Angular dynamically add/remove elements. Traker includes a `refresh()` method to rescan the DOM:

```javascript
// React Example (useEffect)
useEffect(() => {
  tracker.refresh();
}, [location.pathname]); // Call on route change
```

### Loading Configuration from URL

```javascript
import Traker from 'traker';

Traker.load('/path/to/config.json').then(tracker => {
  console.log('Tracker initialized');
});
```

### HTML Setup

```html
<button data-track-id="hero-button">Click Me</button>
<div data-track-id="product-card">Product Info</div>
```

## Payload Format

Events are batched and sent to the endpoint. We automatically include viewport dimensions for context:

```json
[
  {
    "sid": "session-uuid",
    "cid": "hero-button",
    "type": "click",
    "meta": { 
      "x": 50.5, 
      "y": 25.0,
      "vWidth": 1920,
      "vHeight": 1080
    },
    "ts": 1678900000000
  }
]
```

## License

ISC
