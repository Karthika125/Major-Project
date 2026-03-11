import type { Vector2D } from './types';
import { SHELVES } from './Store';

export class StoreRenderer {
    render(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        this.renderFloor(ctx, camera);
        this.renderShelves(ctx, camera);
        this.renderCheckout(ctx, camera);
        this.renderBoundaries(ctx, camera);
    }

    private renderFloor(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        const tileSize = 50;
        const startX = Math.floor(camera.x / tileSize) * tileSize;
        const startY = Math.floor(camera.y / tileSize) * tileSize;
        const endX = camera.x + ctx.canvas.width;
        const endY = camera.y + ctx.canvas.height;

        for (let x = startX; x < endX; x += tileSize) {
            for (let y = startY; y < endY; y += tileSize) {
                const screenX = x - camera.x;
                const screenY = y - camera.y;

                const isLight = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
                ctx.fillStyle = isLight ? '#1a1a2e' : '#16161f';
                ctx.fillRect(screenX, screenY, tileSize, tileSize);

                ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(screenX, screenY, tileSize, tileSize);
            }
        }
    }

    private renderShelves(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        SHELVES.forEach((shelf) => {
            const screenX = shelf.x - camera.x;
            const screenY = shelf.y - camera.y;

            ctx.save();
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const gradient = ctx.createLinearGradient(
                screenX,
                screenY,
                screenX,
                screenY + shelf.height
            );
            gradient.addColorStop(0, '#2d2d44');
            gradient.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = gradient;
            ctx.fillRect(screenX, screenY, shelf.width, shelf.height);

            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, shelf.width, shelf.height);

            ctx.restore();

            ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 3; i++) {
                const y = screenY + (shelf.height / 3) * i;
                ctx.beginPath();
                ctx.moveTo(screenX, y);
                ctx.lineTo(screenX + shelf.width, y);
                ctx.stroke();
            }
        });

        const sections = [
            { x: 175, y: 90, label: 'ELECTRONICS' },
            { x: 175, y: 230, label: 'CLOTHING' },
            { x: 175, y: 370, label: 'BOOKS' },
            { x: 175, y: 510, label: 'HOME GOODS' },

            { x: 550, y: 90, label: 'SPORTS' },
            { x: 550, y: 230, label: 'BEAUTY' },
            { x: 550, y: 370, label: 'TOYS' },
            { x: 550, y: 510, label: 'OFFICE' },

            { x: 925, y: 90, label: 'GAMING' },
            { x: 925, y: 230, label: 'KITCHEN' },
            { x: 925, y: 370, label: 'GARDEN' },
            { x: 925, y: 510, label: 'ACCESSORIES' },
        ];

        ctx.save();
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#a855f7';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;

        for (const section of sections) {
            const screenX = section.x - camera.x;
            const screenY = section.y - camera.y;
            ctx.fillText(section.label, screenX, screenY);
        }

        ctx.restore();
    }

    private renderCheckout(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        const CHECKOUT_AREA = { x: 350, y: 720, width: 500, height: 120 };
        const screenX = CHECKOUT_AREA.x - camera.x;
        const screenY = CHECKOUT_AREA.y - camera.y;

        ctx.save();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const gradient = ctx.createLinearGradient(
            screenX,
            screenY,
            screenX,
            screenY + CHECKOUT_AREA.height
        );
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');
        ctx.fillStyle = gradient;
        ctx.fillRect(screenX, screenY, CHECKOUT_AREA.width, CHECKOUT_AREA.height);

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX, screenY, CHECKOUT_AREA.width, CHECKOUT_AREA.height);

        ctx.restore();

        ctx.save();
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            '🛒 CHECKOUT',
            screenX + CHECKOUT_AREA.width / 2,
            screenY + CHECKOUT_AREA.height / 2 + 8
        );
        ctx.restore();
    }

    private renderBoundaries(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        const STORE_WIDTH = 1200;
        const STORE_HEIGHT = 900;
        const screenX = 0 - camera.x;
        const screenY = 0 - camera.y;

        ctx.save();
        ctx.shadowColor = '#8b5cf6';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 4;
        ctx.strokeRect(screenX, screenY, STORE_WIDTH, STORE_HEIGHT);
        ctx.restore();

        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX + 10, screenY + 10, STORE_WIDTH - 20, STORE_HEIGHT - 20);
    }
}
