import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let model: cocoSsd.ObjectDetection | null = null;
let modelLoading = false;
let backendReady = false;

export interface ProductIdentification {
    objectType: string;
    confidence: 'high' | 'medium' | 'low';
    description: string;
    category: string;
    suggestedStore?: string;
}

// Object name to category mapping
const OBJECT_CATEGORY_MAP: Record<string, string> = {
    // Electronics
    laptop: 'Electronics',
    cell: 'Electronics',
    phone: 'Electronics',
    'mobile phone': 'Electronics',
    keyboard: 'Electronics',
    monitor: 'Electronics',
    mouse: 'Electronics',
    remote: 'Electronics',
    microwave: 'Electronics',
    refrigerator: 'Electronics',
    oven: 'Electronics',
    toaster: 'Electronics',
    book: 'Electronics',
    clock: 'Electronics',

    // Fashion/Clothing
    person: 'Fashion',
    tie: 'Fashion',
    shirt: 'Fashion',
    dress: 'Fashion',
    skirt: 'Fashion',
    pants: 'Fashion',
    coat: 'Fashion',
    jacket: 'Fashion',
    hat: 'Fashion',
    shoe: 'Fashion',
    handbag: 'Fashion',
    bag: 'Fashion',
    suitcase: 'Fashion',
    backpack: 'Fashion',
    umbrella: 'Fashion',

    // Sports
    tennis: 'Sports',
    racket: 'Sports',
    'tennis racket': 'Sports',
    skateboard: 'Sports',
    snowboard: 'Sports',
    surfboard: 'Sports',
    baseball: 'Sports',
    'baseball bat': 'Sports',
    'baseball glove': 'Sports',
    frisbee: 'Sports',
    skis: 'Sports',
    'sports ball': 'Sports',
    kite: 'Sports',

    // Home/Furniture
    sofa: 'Home',
    couch: 'Home',
    chair: 'Home',
    bed: 'Home',
    'dining table': 'Home',
    table: 'Home',
    'potted plant': 'Home',
    plant: 'Home',
    vase: 'Home',
    cup: 'Home',
    'wine glass': 'Home',
    knife: 'Home',
    fork: 'Home',
    spoon: 'Home',
    bowl: 'Home',
    bottle: 'Hypermarket',
    lamp: 'Home',
    picture: 'Home',
    painting: 'Home',
    'teddy bear': 'Home',

    // Accessories
    watch: 'Accessories',
    necklace: 'Accessories',
    ring: 'Accessories',
    bracelet: 'Accessories',
    earring: 'Accessories',
    sunglasses: 'Accessories',
    eyeglasses: 'Accessories',
    glasses: 'Accessories',
    scarf: 'Accessories',
    belt: 'Accessories',
    coin: 'Accessories',

    // Hypermarket/Food
    apple: 'Hypermarket',
    banana: 'Hypermarket',
    orange: 'Hypermarket',
    broccoli: 'Hypermarket',
    carrot: 'Hypermarket',
    'hot dog': 'Hypermarket',
    pizza: 'Hypermarket',
    donut: 'Hypermarket',
    cake: 'Hypermarket',
    sandwich: 'Hypermarket',
    food: 'Hypermarket',
};

/**
 * Load the COCO-SSD model
 */
const ensureTfBackend = async (): Promise<void> => {
    if (backendReady) {
        return;
    }

    try {
        // Prefer WebGL for speed; fallback to CPU when unavailable.
        await tf.setBackend('webgl');
    } catch {
        await tf.setBackend('cpu');
    }

    await tf.ready();
    backendReady = true;
};

const loadModel = async (): Promise<cocoSsd.ObjectDetection> => {
    if (model) return model;

    if (modelLoading) {
        // Wait for model to load if already loading
        let attempts = 0;
        while (!model && attempts < 100) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }
        if (model) return model;
    }

    try {
        modelLoading = true;
        await ensureTfBackend();
        console.log('Loading COCO-SSD model...');
        model = await cocoSsd.load();
        modelLoading = false;
        console.log('✓ COCO-SSD model loaded successfully');
        return model;
    } catch (error) {
        modelLoading = false;
        throw error;
    }
};

/**
 * Identifies a product from an image using TensorFlow COCO-SSD model
 * Works locally without API keys - can detect 80+ object types
 */
export const identifyProductFromImage = async (
    imageBase64: string
): Promise<ProductIdentification> => {
    try {
        // Load model on first use
        const loadedModel = await loadModel();

        // Convert base64 to image
        const img = new Image();
        img.src = `data:image/jpeg;base64,${imageBase64}`;

        // Wait for image to load
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
        });

        // Detect objects
        const predictions = await loadedModel.detect(img);

        if (predictions.length === 0) {
            return {
                objectType: 'Unknown Object',
                confidence: 'low',
                description: 'No recognizable object detected in image',
                category: 'Other',
            };
        }

        // Get the prediction with highest score
        const bestPrediction = predictions.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        const objectType = bestPrediction.class;
        const score = bestPrediction.score;

        // Determine confidence level
        const confidence: 'high' | 'medium' | 'low' =
            score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';

        // Map object to category
        const category = mapObjectToCategory(objectType);

        return {
            objectType:
                objectType.charAt(0).toUpperCase() + objectType.slice(1),
            confidence,
            description: `Detected: ${objectType} (${(score * 100).toFixed(1)}% confidence)`,
            category,
        };
    } catch (error) {
        console.error('Error identifying product:', error);
        throw new Error(
            `Failed to identify product: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
};

/**
 * Map detected object to category
 */
const mapObjectToCategory = (objectName: string): string => {
    const normalized = objectName.toLowerCase().trim();

    // Explicit routing rules requested for scanner behaviour.
    if (
        normalized.includes('laptop') ||
        normalized.includes('phone') ||
        normalized.includes('cell') ||
        normalized.includes('keyboard') ||
        normalized.includes('mouse') ||
        normalized.includes('monitor') ||
        normalized.includes('remote') ||
        normalized.includes('microwave') ||
        normalized.includes('refrigerator') ||
        normalized.includes('oven') ||
        normalized.includes('toaster')
    ) {
        return 'Electronics';
    }

    if (
        normalized.includes('shirt') ||
        normalized.includes('shoe') ||
        normalized.includes('dress') ||
        normalized.includes('skirt') ||
        normalized.includes('pants') ||
        normalized.includes('coat') ||
        normalized.includes('jacket') ||
        normalized.includes('tie') ||
        normalized.includes('handbag') ||
        normalized.includes('bag') ||
        normalized.includes('suitcase') ||
        normalized.includes('backpack') ||
        normalized.includes('umbrella')
    ) {
        return 'Fashion';
    }

    if (
        normalized.includes('bottle') ||
        normalized.includes('cup') ||
        normalized.includes('bowl') ||
        normalized.includes('spoon') ||
        normalized.includes('fork') ||
        normalized.includes('knife') ||
        normalized.includes('apple') ||
        normalized.includes('banana') ||
        normalized.includes('orange') ||
        normalized.includes('broccoli') ||
        normalized.includes('carrot') ||
        normalized.includes('pizza') ||
        normalized.includes('donut') ||
        normalized.includes('cake') ||
        normalized.includes('sandwich') ||
        normalized.includes('food')
    ) {
        return 'Hypermarket';
    }

    // Direct match in map
    if (OBJECT_CATEGORY_MAP[normalized]) {
        return OBJECT_CATEGORY_MAP[normalized];
    }

    // Partial matches
    for (const [key, category] of Object.entries(OBJECT_CATEGORY_MAP)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return category;
        }
    }

    // Default to Other
    return 'Other';
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    Electronics: '🖥️ Electronics Section',
    Fashion: '👗 Fashion Store',
    Home: '🏠 Home & Living',
    Sports: '⚽ Sports & Outdoors',
    Accessories: '✨ Accessories',
    Hypermarket: '🛒 Hypermarket',
    Other: '🛍️ General Store',
};

/**
 * Get list of detectable objects
 */
export const getDetectableObjects = (): string[] => {
    return [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane',
        'bus', 'train', 'truck', 'boat', 'traffic light',
        'fire hydrant', 'stop sign', 'parking meter', 'bench', 'cat',
        'dog', 'horse', 'sheep', 'cow', 'elephant',
        'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
        'handbag', 'tie', 'suitcase', 'frisbee', 'skis',
        'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
        'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass',
        'cup', 'fork', 'knife', 'spoon', 'bowl',
        'banana', 'apple', 'sandwich', 'orange', 'broccoli',
        'carrot', 'hot dog', 'pizza', 'donut', 'cake',
        'chair', 'couch', 'potted plant', 'bed', 'dining table',
        'toilet', 'tv', 'laptop', 'mouse', 'remote',
        'keyboard', 'microwave', 'oven', 'toaster', 'sink',
        'refrigerator', 'book', 'clock', 'vase', 'scissors',
        'teddy bear', 'hair drier', 'toothbrush',
    ];
};

