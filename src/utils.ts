export function generateUUID(): string {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function calculateRelativeCoordinates(event: MouseEvent, element: HTMLElement): { x: number, y: number } {
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const width = rect.width || 1; // Avoid division by zero
    const height = rect.height || 1;

    const xp = (x / width) * 100;
    const yp = (y / height) * 100;

    return {
        x: parseFloat(xp.toFixed(2)),
        y: parseFloat(yp.toFixed(2))
    };
}
