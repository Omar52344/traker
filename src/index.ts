import { Traker } from './tracker';
import { TrakerConfig } from './types';

// Extend Traker with a static load method for convenience
export class TrakerManager extends Traker {
    static async load(url: string): Promise<Traker> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load configuration from ${url}`);
        }
        const config: TrakerConfig = await response.json();
        const traker = new Traker(config);
        traker.init();
        return traker;
    }
}

export { Traker } from './tracker';
export * from './types';

// Default export for UMD/ESM compatibility
export default TrakerManager;
