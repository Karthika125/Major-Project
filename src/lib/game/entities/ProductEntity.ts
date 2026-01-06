import type { Vector2D } from '../types';
import type { Database } from '../../supabase/types';
import { getStoreConfig } from '../Store';

type Product = Database['public']['Tables']['products']['Row'];

export class ProductEntity {
    public product: Product;
    public position: Vector2D;
    public width: number = 60;
    public height: number = 60;
    public isHighlighted: boolean = false;
    public interactionRadius: number = 80;
    private hoverElevation: number = 0;
    private targetElevation: number = 0;
    private image: HTMLImageElement | null = null;
    private imageLoaded: boolean = false;

    constructor(product: Product) {
        this.product = product;
        this.position = {
            x: product.position_x,
            y: product.position_y,
        };

        // Load product image
        if (product.image_url) {
            this.image = new Image();
            this.image.crossOrigin = 'anonymous';
            this.image.onload = () => {
                this.imageLoaded = true;
            };
            this.image.onerror = () => {
                console.error(`Failed to load image for ${product.name}:`, product.image_url);
                this.imageLoaded = false;
            };
            this.image.src = product.image_url;
        }
    }

    private autoPosition(product: Product, storeId: string): Vector2D {
        const storeConfig = getStoreConfig(storeId);
        const shelves = storeConfig.shelves;

        if (shelves.length === 0) {
            return { x: 200, y: 200 };
        }

        // Use product ID hash to determine shelf (distribute evenly)
        const productIdNum = product.id ?
            (typeof product.id === 'string' ?
                product.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) :
                parseInt(product.id.toString()))
            : Math.floor(Math.random() * 1000);

        const shelfIndex = productIdNum % shelves.length;
        const shelf = shelves[shelfIndex];

        // Position within the shelf (3 products per shelf row)
        const positionInShelf = Math.floor(productIdNum / shelves.length) % 3;
        const spacing = (shelf.width - this.width * 3) / 4; // Equal spacing
        const xOffset = spacing + (positionInShelf * (this.width + spacing));
        const yOffset = shelf.height / 2 - this.height / 2;

        const finalPos = {
            x: shelf.x + xOffset,
            y: shelf.y + yOffset
        };

        console.log(`Positioned ${product.name} at shelf ${shelfIndex}, position ${positionInShelf}:`, finalPos);

        return finalPos;
    }

    checkProximity(playerPosition: Vector2D): boolean {
        const dx = playerPosition.x - (this.position.x + this.width / 2);
        const dy = playerPosition.y - (this.position.y + this.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.isHighlighted = distance < this.interactionRadius;

        // Animate elevation on hover
        this.targetElevation = this.isHighlighted ? 8 : 0;
        this.hoverElevation += (this.targetElevation - this.hoverElevation) * 0.2;

        return this.isHighlighted;
    }

    render(ctx: CanvasRenderingContext2D, camera: Vector2D): void {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y - this.hoverElevation;

        // 🎨 3D SHADOW EFFECT
        const shadowOffset = 3 + this.hoverElevation * 0.5;

        ctx.save();

        // Draw shadow (ellipse below product)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            screenX + this.width / 2,
            screenY + this.height + shadowOffset,
            this.width / 2 + shadowOffset,
            8 + this.hoverElevation * 0.3,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // 🖼️ DRAW PRODUCT IMAGE OR FALLBACK BOX
        if (this.imageLoaded && this.image) {
            // Draw the actual product image
            ctx.drawImage(this.image, screenX, screenY, this.width, this.height);

            // Add subtle border around image
            ctx.strokeStyle = this.isHighlighted ? '#FFD700' : 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = this.isHighlighted ? 3 : 2;
            ctx.strokeRect(screenX, screenY, this.width, this.height);
        } else {
            // Fallback: Draw gradient box while image loads or if it fails
            const gradient = ctx.createLinearGradient(
                screenX,
                screenY,
                screenX,
                screenY + this.height
            );

            if (this.isHighlighted) {
                gradient.addColorStop(0, '#FFF8DC');
                gradient.addColorStop(1, '#FFE4B5');
            } else {
                gradient.addColorStop(0, '#FFFFFF');
                gradient.addColorStop(1, '#F0F0F0');
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(screenX, screenY, this.width, this.height);

            // 🎨 3D BORDER EFFECT (creates depth)
            // Top and left edges (lighter - highlight)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + this.height);
            ctx.lineTo(screenX, screenY);
            ctx.lineTo(screenX + this.width, screenY);
            ctx.stroke();

            // Bottom and right edges (darker - shadow)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.moveTo(screenX + this.width, screenY);
            ctx.lineTo(screenX + this.width, screenY + this.height);
            ctx.lineTo(screenX, screenY + this.height);
            ctx.stroke();

            // Main border
            ctx.strokeStyle = this.isHighlighted ? '#FFD700' : '#CCC';
            ctx.lineWidth = this.isHighlighted ? 3 : 1;
            ctx.strokeRect(screenX, screenY, this.width, this.height);

            // Product name (only show if no image)
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 2;

            const words = this.product.name.split(' ');
            words.forEach((word, i) => {
                ctx.fillText(
                    word,
                    screenX + this.width / 2,
                    screenY + 20 + i * 12
                );
            });

            ctx.shadowBlur = 0;
        }

        // Glow effect when highlighted
        if (this.isHighlighted) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX - 2, screenY - 2, this.width + 4, this.height + 4);
            ctx.shadowBlur = 0;
        }

        // Price badge (always show)
        const priceText = `$${this.product.price}`;
        const priceWidth = ctx.measureText(priceText).width + 12;
        const priceHeight = 18;
        const priceX = screenX + this.width - priceWidth - 2;
        const priceY = screenY + this.height - priceHeight - 2;

        // Price background
        ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
        ctx.fillRect(priceX, priceY, priceWidth, priceHeight);

        // Price text
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(
            priceText,
            priceX + priceWidth / 2,
            priceY + 13
        );

        ctx.shadowBlur = 0;

        // Interaction hint
        if (this.isHighlighted) {
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px Arial';
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText('Click to view', screenX + this.width / 2, screenY - 10);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    containsPoint(point: Vector2D, camera: Vector2D): boolean {
        const screenX = this.position.x - camera.x;
        const screenY = this.position.y - camera.y - this.hoverElevation;

        return (
            point.x >= screenX &&
            point.x <= screenX + this.width &&
            point.y >= screenY &&
            point.y <= screenY + this.height
        );
    }
}
