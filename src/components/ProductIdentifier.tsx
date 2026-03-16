import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    identifyProductFromImage,
    CATEGORY_DESCRIPTIONS,
    type ProductIdentification,
} from '../lib/ai/productVision';
import {
    findStoreByCategory,
    findProductsByCategory,
} from '../lib/ai/categoryMapping';
import styles from './ProductIdentifier.module.css';

interface IdentificationResult {
    identification: ProductIdentification;
    suggestedStore?: { id: string; name: string };
    products?: Array<{
        id: string;
        name: string;
        storeId: string;
        storeName: string;
        price: number;
        image_url: string | null;
    }>;
}

export const ProductIdentifier: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [cameraActive, setCameraActive] = useState(false);
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [result, setResult] = useState<IdentificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const attachStreamToVideo = useCallback((stream: MediaStream) => {
        if (!videoRef.current) return false;

        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            void videoRef.current?.play().catch((err) => {
                console.error('Error playing video:', err);
                setError('Could not start video playback.');
            });
        };

        videoRef.current.onerror = () => {
            setError('Video stream failed to load. Please try again.');
        };

        return true;
    }, []);

    const stopCamera = useCallback((preservePreview = false) => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setCameraActive(false);
        if (!preservePreview) {
            setPreviewImage(null);
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera is not supported in this browser.');
            }

            setError(null);
            setResult(null);
            setPreviewImage(null);
            setCameraActive(true);

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            }

            streamRef.current = stream;
            attachStreamToVideo(stream);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to access camera.';
            setError(msg);
            setCameraActive(false);
        }
    }, [attachStreamToVideo]);

    useEffect(() => {
        if (!cameraActive || !streamRef.current) return;

        const id = requestAnimationFrame(() => {
            if (streamRef.current) {
                attachStreamToVideo(streamRef.current);
            }
        });

        return () => cancelAnimationFrame(id);
    }, [cameraActive, attachStreamToVideo]);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    const identifyProduct = async (base64Data: string) => {
        try {
            setIsIdentifying(true);
            setError(null);

            const identification = await identifyProductFromImage(base64Data);
            const suggestedStore = await findStoreByCategory(identification.category);
            const products = await findProductsByCategory(identification.category);

            setResult({
                identification,
                suggestedStore: suggestedStore || undefined,
                products: products || undefined,
            });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Failed to identify product';
            setError(errMsg);
        } finally {
            setIsIdentifying(false);
        }
    };

    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) {
            setError('Camera is not ready yet.');
            return;
        }

        try {
            if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
                setError('Camera is still loading. Please wait a moment and try again.');
                return;
            }

            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) throw new Error('Could not initialize image capture.');

            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);

            const imageData = canvasRef.current.toDataURL('image/jpeg', 0.9);
            setPreviewImage(imageData);
            stopCamera(true);

            const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');
            await identifyProduct(base64Data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to capture photo';
            setError(msg);
        }
    }, [stopCamera]);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setError(null);
            setIsIdentifying(true);

            const imageData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = () => reject(new Error('Failed to read image file.'));
                reader.readAsDataURL(file);
            });

            setPreviewImage(imageData);
            const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');
            await identifyProduct(base64Data);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Failed to process file';
            setError(errMsg);
        } finally {
            setIsIdentifying(false);
        }
    }, []);

    const navigateToStore = (storeId: string, itemName?: string) => {
        stopCamera();
        onClose?.();
        const params = new URLSearchParams();
        if (itemName) {
            params.set('scanItem', itemName);
        }
        const query = params.toString();
        navigate(query ? `/store/${storeId}?${query}` : `/store/${storeId}`);
    };

    const tryAgain = () => {
        setResult(null);
        setPreviewImage(null);
        setError(null);
        void startCamera();
    };

    return (
        <div className={styles.container}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>📸 Product Scanner</h2>
                    {onClose && (
                        <button
                            className={styles.closeBtn}
                            onClick={() => {
                                stopCamera();
                                onClose();
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className={styles.content}>
                    {error && (
                        <div className={styles.error}>
                            <p>⚠️ {error}</p>
                            <button onClick={() => setError(null)} className={styles.btn}>
                                Dismiss
                            </button>
                        </div>
                    )}

                    {!result && !cameraActive && !previewImage && (
                        <div className={styles.initial}>
                            <div className={styles.intro}>
                                <p>
                                    Show your product to the camera and we will guide you to the right section.
                                </p>
                            </div>

                            <div className={styles.buttons}>
                                <button className={`${styles.btn} ${styles.primary}`} onClick={() => void startCamera()}>
                                    📷 Open Camera
                                </button>
                                <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>
                                    🖼️ Upload Image
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                    {cameraActive && !result && (
                        <div className={styles.cameraSection}>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={styles.video}
                                style={{ transform: 'scaleX(-1)' }}
                            />
                            <div className={styles.cameraOverlay}>
                                <div className={styles.scanArea}>
                                    <div className={styles.corner}></div>
                                    <div className={styles.corner}></div>
                                    <div className={styles.corner}></div>
                                    <div className={styles.corner}></div>
                                </div>
                            </div>
                            <div className={styles.cameraControls}>
                                <button className={`${styles.btn} ${styles.primary}`} onClick={() => void capturePhoto()}>
                                    📸 Capture
                                </button>
                                <button className={styles.btn} onClick={() => stopCamera()}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {previewImage && !result && isIdentifying && (
                        <div className={styles.processing}>
                            <img src={previewImage} alt="Preview" className={styles.preview} />
                            <div className={styles.loader}>
                                <div className={styles.spinner}></div>
                                <p>Analyzing product...</p>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className={styles.results}>
                            {previewImage && (
                                <img src={previewImage} alt="Identified" className={styles.resultImage} />
                            )}

                            <div className={styles.identification}>
                                <h3>🎯 Identified Product</h3>
                                <p className={styles.objectType}>
                                    <strong>{result.identification.objectType}</strong>
                                </p>
                                <p className={styles.description}>{result.identification.description}</p>

                                <div className={styles.confidence}>
                                    <span>Confidence:</span>
                                    <span
                                        className={
                                            styles[`confidence-${result.identification.confidence}`]
                                        }
                                    >
                                        {result.identification.confidence}
                                    </span>
                                </div>

                                <div className={styles.categoryBadge}>
                                    {CATEGORY_DESCRIPTIONS[result.identification.category]}
                                </div>
                            </div>

                            {result.suggestedStore && (
                                <button
                                    className={`${styles.btn} ${styles.primary}`}
                                    onClick={() =>
                                        navigateToStore(
                                            result.suggestedStore!.id,
                                            result.identification.objectType
                                        )
                                    }
                                >
                                    🛍️ Visit {result.suggestedStore.name}
                                </button>
                            )}

                            {!result.suggestedStore && (
                                <div className={styles.noStore}>
                                    <p>No stores found for this category.</p>
                                    <p>Browse all stores or try another product.</p>
                                </div>
                            )}

                            {result.products && result.products.length > 0 && (
                                <div className={styles.similarProducts}>
                                    <h4>📦 Similar Products Found:</h4>
                                    <div className={styles.productsList}>
                                        {result.products.slice(0, 3).map((product) => (
                                            <div
                                                key={product.id}
                                                className={styles.productItem}
                                                onClick={() => navigateToStore(product.storeId, product.name)}
                                            >
                                                {product.image_url && (
                                                    <img src={product.image_url} alt={product.name} />
                                                )}
                                                <p className={styles.name}>{product.name}</p>
                                                <p className={styles.price}>${product.price}</p>
                                                <p className={styles.store}>@{product.storeName}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={styles.resultActions}>
                                <button className={styles.btn} onClick={tryAgain}>
                                    🔄 Scan Another
                                </button>
                                {onClose && (
                                    <button
                                        className={styles.btn}
                                        onClick={() => {
                                            stopCamera();
                                            onClose();
                                        }}
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
};
