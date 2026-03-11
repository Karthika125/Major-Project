export class InputManager {
    private keys: Set<string> = new Set();
    private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private mouseClicked: boolean = false;
    private canvas: HTMLCanvasElement;
    private enabled: boolean = true;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            // Only process game keys when input is enabled
            if (!this.enabled) return;

            this.keys.add(e.key.toLowerCase());
            // Prevent default for arrow keys and WASD
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            // Only process game keys when input is enabled
            if (!this.enabled) return;

            this.keys.delete(e.key.toLowerCase());
        });

        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            this.mouseClicked = true;
        });
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        // Clear all keys when disabling to prevent stuck keys
        if (!enabled) {
            this.keys.clear();
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    isKeyPressed(key: string): boolean {
        return this.enabled && this.keys.has(key.toLowerCase());
    }

    isMovingUp(): boolean {
        return this.isKeyPressed('w') || this.isKeyPressed('arrowup');
    }

    isMovingDown(): boolean {
        return this.isKeyPressed('s') || this.isKeyPressed('arrowdown');
    }

    isMovingLeft(): boolean {
        return this.isKeyPressed('a') || this.isKeyPressed('arrowleft');
    }

    isMovingRight(): boolean {
        return this.isKeyPressed('d') || this.isKeyPressed('arrowright');
    }

    /**
     * Returns true while the player holds Shift (sprint / run modifier).
     * Works with both Left Shift and Right Shift.
     */
    isSprinting(): boolean {
        return this.isKeyPressed('shift');
    }

    getMousePosition(): { x: number; y: number } {
        return { ...this.mousePosition };
    }

    wasClicked(): boolean {
        const clicked = this.mouseClicked;
        this.mouseClicked = false;
        return clicked;
    }

    cleanup(): void {
        // Remove event listeners if needed
        this.keys.clear();
    }
}
