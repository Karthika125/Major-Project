import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Sphere, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../lib/store/gameStore';
import type { Database } from '../lib/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
    stock?: number | null;
    store_id?: string;
};

interface ProductGridConfig {
    shelvesPerRow: number;
    productsPerShelf: number;
    productsPerRow: number;
    productSpacingX: number;
    productSpacingY: number;
    shelfSpacingX: number;
    shelfSpacingZ: number;
    shelfStartX: number;
    shelfStartZ: number;
}

const PRODUCT_GRID_CONFIG: ProductGridConfig = {
    shelvesPerRow: 2,
    productsPerShelf: 12,
    productsPerRow: 4,
    productSpacingX: 1.05,
    productSpacingY: 1,
    shelfSpacingX: 12,
    shelfSpacingZ: 8,
    shelfStartX: -6,
    shelfStartZ: -8,
};

/** Max world-unit distance the centre-gaze ray will detect a product. */
const LOOK_TARGET_MAX_DISTANCE = 5;
/** Player must be within this radius (XZ plane) to illuminate / click a product. */
const PRODUCT_INTERACT_DISTANCE = 2.5;
/** Player must be this close to click the checkout counter. */
const CHECKOUT_INTERACT_DISTANCE = 2.0;

const isTextInputTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName;
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

interface ShelfLayout {
    shelfIndex: number;
    position: [number, number, number];
    products: Product[];
}

interface ProductWorldPosition {
    product: Product;
    position: [number, number, number];
}

interface Store3DProps {
    products: Product[];
    onProductClick: (product: Product) => void;
    onCheckoutCounterClick?: () => void;
    storeTheme: {
        accentColor: string;
        gradient: string;
        name: string;
    };
    avatarCustomization: {
        bodyColor: string;
        skinTone: string;
        style: string;
    };
    presenceManager: any;
    onPlayerSelect?: (player: { user_id: string; username: string }) => void;
    onClosestProductChange?: (product: Product | null) => void;
}


// ── Utility: derive clothing colours per style ──────────────────────────────
const getStyleColors = (style: string, bodyColor: string) => {
    switch (style) {
        case 'formal':  return { shirt: '#1a1a2e', pants: '#0f0f1a', shoes: '#111' };
        case 'sporty':  return { shirt: bodyColor, pants: '#222', shoes: '#e0e0e0' };
        case 'cool':    return { shirt: '#111', pants: bodyColor, shoes: '#333' };
        default:        return { shirt: bodyColor, pants: '#2c3e50', shoes: '#4a4a4a' }; // casual
    }
};

// ── Full Human-Like Avatar ───────────────────────────────────────────────────
const Avatar: React.FC<{
    position:       [number, number, number];
    rotation?:      [number, number, number];
    username:       string;
    isCurrentUser?: boolean;
    customization?: { bodyColor: string; skinTone: string; style: string };
    animationState?: 'idle' | 'walking' | 'waving' | 'shopping';
    currentAction?:  'idle' | 'walking' | 'viewing_product' | 'shopping';
    movementDirection?: { left: boolean; right: boolean; forward: boolean; backward: boolean };
}> = ({
    position,
    rotation = [0, 0, 0],
    username,
    isCurrentUser = false,
    customization,
    animationState = 'idle',
    currentAction  = 'idle',
    movementDirection = { left: false, right: false, forward: false, backward: false },
}) => {
    const groupRef   = useRef<THREE.Group>(null);
    const headRef    = useRef<THREE.Group>(null);
    const lArmRef    = useRef<THREE.Group>(null);
    const rArmRef    = useRef<THREE.Group>(null);
    const lLegRef    = useRef<THREE.Group>(null);
    const rLegRef    = useRef<THREE.Group>(null);

    const skin  = customization?.skinTone || '#FFD1A3';
    const style = customization?.style    || 'casual';
    const { shirt, pants, shoes } = getStyleColors(style, customization?.bodyColor || '#4A90E2');

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        if (!groupRef.current) return;

        // The avatar mesh group origin sits at the pelvis; feet are ~0.62 units below
        // the visual floor level. Lift baseY by 0.62 so the avatar stands on the floor.
        // Current user: position[1]=0 (from ThirdPersonController).  baseY = 0.62
        // Other players: position[1]=1.6 (camera height from presence). baseY = 0.62
        const baseY = isCurrentUser ? position[1] + 0.62 : position[1] - 0.98;

        // Calculate head rotation based on movement direction (realistic face turn)
        let headYaw = 0;
        if (movementDirection.left) {
            headYaw = 0.35; // Turn head left
        } else if (movementDirection.right) {
            headYaw = -0.35; // Turn head right
        }

        if (animationState === 'walking') {
            const speed = 8;
            const swing = Math.sin(t * speed) * 0.35;

            // Body bob
            groupRef.current.position.y = baseY + Math.abs(Math.sin(t * speed)) * 0.04;

            // Head turns based on movement direction, with subtle walking sway
            if (headRef.current) {
                const walkSway = Math.sin(t * speed * 0.5) * 0.08;
                headRef.current.rotation.y = headYaw + walkSway;
            }

            // Arm swing (opposite to legs)
            if (lArmRef.current)  lArmRef.current.rotation.x  =  swing;
            if (rArmRef.current)  rArmRef.current.rotation.x  = -swing;

            // Leg swing
            if (lLegRef.current)  lLegRef.current.rotation.x  = -swing;
            if (rLegRef.current)  rLegRef.current.rotation.x  =  swing;

        } else if (animationState === 'waving') {
            groupRef.current.position.y = baseY;
            if (rArmRef.current) {
                rArmRef.current.rotation.x = -1.2 + Math.sin(t * 6) * 0.3;
                rArmRef.current.rotation.z = -0.4;
            }
            if (headRef.current) {
                const waveSway = Math.sin(t * 2) * 0.12;
                headRef.current.rotation.y = headYaw + waveSway;
            }

        } else {
            // Idle: breathing + subtle head sway combined with direction
            const breathe = Math.sin(t * 1.8) * 0.012;
            groupRef.current.position.y = baseY + breathe;
            groupRef.current.scale.y    = 1 + breathe * 0.3;

            if (headRef.current) {
                const idleSway = Math.sin(t * 0.7) * 0.05;
                headRef.current.rotation.y = headYaw + idleSway;
            }
            if (lArmRef.current)  lArmRef.current.rotation.x  = 0;
            if (rArmRef.current) { rArmRef.current.rotation.x = 0; rArmRef.current.rotation.z = 0; }
            if (lLegRef.current)  lLegRef.current.rotation.x  = 0;
            if (rLegRef.current)  rLegRef.current.rotation.x  = 0;
        }
    });



    // feetPosition Y is normally overridden each frame by useFrame's baseY,
    // but we set a consistent initial value so the first frame is correct too.
    const feetPosition: [number, number, number] = isCurrentUser
        ? [position[0], position[1] + 0.62, position[2]]
        : [position[0], position[1] - 0.98, position[2]];

    return (
        <group ref={groupRef} position={feetPosition} rotation={rotation}>

            {/* ── Legs (origin at hip, pivot for walk cycle) ── */}
            {/* Left leg */}
            <group ref={lLegRef} position={[-0.085, -0.05, 0]}>
                {/* Upper leg */}
                <mesh position={[0, -0.15, 0]}>
                    <capsuleGeometry args={[0.055, 0.22, 6, 8]} />
                    <meshStandardMaterial color={pants} roughness={0.8} />
                </mesh>
                {/* Lower leg */}
                <mesh position={[0, -0.40, 0]}>
                    <capsuleGeometry args={[0.045, 0.2, 6, 8]} />
                    <meshStandardMaterial color={pants} roughness={0.8} />
                </mesh>
                {/* Shoe */}
                <mesh position={[0, -0.56, 0.03]}>
                    <boxGeometry args={[0.09, 0.05, 0.16]} />
                    <meshStandardMaterial color={shoes} roughness={0.5} metalness={0.2} />
                </mesh>
            </group>

            {/* Right leg */}
            <group ref={rLegRef} position={[0.085, -0.05, 0]}>
                <mesh position={[0, -0.15, 0]}>
                    <capsuleGeometry args={[0.055, 0.22, 6, 8]} />
                    <meshStandardMaterial color={pants} roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.40, 0]}>
                    <capsuleGeometry args={[0.045, 0.2, 6, 8]} />
                    <meshStandardMaterial color={pants} roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.56, 0.03]}>
                    <boxGeometry args={[0.09, 0.05, 0.16]} />
                    <meshStandardMaterial color={shoes} roughness={0.5} metalness={0.2} />
                </mesh>
            </group>

            {/* ── Torso ── */}
            <mesh position={[0, 0.14, 0]}>
                <capsuleGeometry args={[0.115, 0.30, 8, 16]} />
                <meshStandardMaterial color={shirt} roughness={0.75} metalness={0.05} />
            </mesh>

            {/* Belt line */}
            <mesh position={[0, -0.04, 0]}>
                <cylinderGeometry args={[0.118, 0.118, 0.04, 16]} />
                <meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} />
            </mesh>

            {/* ── Left Arm (origin at shoulder) ── */}
            <group ref={lArmRef} position={[-0.175, 0.26, 0]}>
                {/* Upper arm */}
                <mesh position={[0, -0.13, 0]}>
                    <capsuleGeometry args={[0.042, 0.16, 6, 8]} />
                    <meshStandardMaterial color={shirt} roughness={0.75} />
                </mesh>
                {/* Forearm */}
                <mesh position={[0, -0.34, 0]}>
                    <capsuleGeometry args={[0.034, 0.16, 6, 8]} />
                    <meshStandardMaterial color={skin} roughness={0.6} />
                </mesh>
                {/* Hand */}
                <Sphere args={[0.038, 10, 10]} position={[0, -0.50, 0]}>
                    <meshStandardMaterial color={skin} roughness={0.55} />
                </Sphere>
            </group>

            {/* ── Right Arm ── */}
            <group ref={rArmRef} position={[0.175, 0.26, 0]}>
                <mesh position={[0, -0.13, 0]}>
                    <capsuleGeometry args={[0.042, 0.16, 6, 8]} />
                    <meshStandardMaterial color={shirt} roughness={0.75} />
                </mesh>
                <mesh position={[0, -0.34, 0]}>
                    <capsuleGeometry args={[0.034, 0.16, 6, 8]} />
                    <meshStandardMaterial color={skin} roughness={0.6} />
                </mesh>
                <Sphere args={[0.038, 10, 10]} position={[0, -0.50, 0]}>
                    <meshStandardMaterial color={skin} roughness={0.55} />
                </Sphere>
            </group>

            {/* ── Neck ── */}
            <mesh position={[0, 0.36, 0]}>
                <cylinderGeometry args={[0.048, 0.055, 0.1, 12]} />
                <meshStandardMaterial color={skin} roughness={0.6} />
            </mesh>

            {/* ── Head (separate group so it can rotate independently) ── */}
            <group ref={headRef} position={[0, 0.47, 0]}>
                {/* Skull */}
                <Sphere args={[0.115, 20, 20]}>
                    <meshStandardMaterial color={skin} roughness={0.55} metalness={0.05} />
                </Sphere>

                {/* Hair cap (matches body colour for personality) */}
                <Sphere args={[0.117, 16, 16]} position={[0, 0.04, -0.01]}>
                    <meshStandardMaterial
                        color={style === 'formal' ? '#1a1a1a' : style === 'sporty' ? '#222' : '#3a2a1a'}
                        roughness={0.9}
                        side={THREE.FrontSide}
                    />
                </Sphere>

                {/* Eyes */}
                <Sphere args={[0.018, 10, 10]} position={[-0.038, 0.01, 0.1]}>
                    <meshStandardMaterial color="#fff" roughness={0.2} />
                </Sphere>
                <Sphere args={[0.018, 10, 10]} position={[0.038, 0.01, 0.1]}>
                    <meshStandardMaterial color="#fff" roughness={0.2} />
                </Sphere>
                {/* Pupils */}
                <Sphere args={[0.010, 8, 8]} position={[-0.038, 0.01, 0.115]}>
                    <meshStandardMaterial color="#1a1a2e" />
                </Sphere>
                <Sphere args={[0.010, 8, 8]} position={[0.038, 0.01, 0.115]}>
                    <meshStandardMaterial color="#1a1a2e" />
                </Sphere>
                {/* Iris highlights */}
                <Sphere args={[0.004, 6, 6]} position={[-0.035, 0.014, 0.122]}>
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
                </Sphere>
                <Sphere args={[0.004, 6, 6]} position={[0.041, 0.014, 0.122]}>
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
                </Sphere>

                {/* Nose */}
                <Sphere args={[0.018, 8, 8]} position={[0, -0.02, 0.108]}>
                    <meshStandardMaterial color={skin} roughness={0.7} />
                </Sphere>

                {/* Mouth */}
                <mesh position={[0, -0.055, 0.100]} rotation={[0.25, 0, 0]}>
                    <torusGeometry args={[0.025, 0.006, 6, 12, Math.PI]} />
                    <meshStandardMaterial color="#c0706a" roughness={0.6} />
                </mesh>

                {/* Ear L */}
                <Sphere args={[0.022, 8, 8]} position={[-0.113, 0.00, 0.0]}>
                    <meshStandardMaterial color={skin} roughness={0.7} />
                </Sphere>
                {/* Ear R */}
                <Sphere args={[0.022, 8, 8]} position={[0.113, 0.00, 0.0]}>
                    <meshStandardMaterial color={skin} roughness={0.7} />
                </Sphere>

                {/* Style accessories */}
                {style === 'formal' && (
                    // Tie knot visible above collar
                    <mesh position={[0, -0.14, 0.09]} rotation={[0.3, 0, 0]}>
                        <boxGeometry args={[0.03, 0.05, 0.015]} />
                        <meshStandardMaterial color="#8B0000" roughness={0.5} />
                    </mesh>
                )}
                {style === 'cool' && (
                    // Sunglasses
                    <group position={[0, 0.01, 0.112]}>
                        <mesh position={[-0.038, 0, 0]}>
                            <boxGeometry args={[0.044, 0.022, 0.005]} />
                            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0.038, 0, 0]}>
                            <boxGeometry args={[0.044, 0.022, 0.005]} />
                            <meshStandardMaterial color="#111" metalness={0.8} roughness={0.2} />
                        </mesh>
                        {/* Bridge */}
                        <mesh position={[0, 0, 0]}>
                            <boxGeometry args={[0.016, 0.006, 0.005]} />
                            <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
                        </mesh>
                    </group>
                )}
                {style === 'sporty' && (
                    // Cap
                    <group position={[0, 0.10, 0.01]}>
                        <Sphere args={[0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]}>
                            <meshStandardMaterial color={customization?.bodyColor || '#4A90E2'} roughness={0.85} />
                        </Sphere>
                        {/* Brim */}
                        <mesh position={[0, -0.04, 0.085]} rotation={[0.25, 0, 0]}>
                            <boxGeometry args={[0.22, 0.018, 0.11]} />
                            <meshStandardMaterial color={customization?.bodyColor || '#4A90E2'} roughness={0.85} />
                        </mesh>
                    </group>
                )}
            </group>

            {/* ── Username label ── */}
            <group position={[0, 0.75, 0]}>
                <mesh>
                    <planeGeometry args={[Math.max(0.4, username.length * 0.072 + 0.1), 0.14]} />
                    <meshBasicMaterial color="#000" transparent opacity={0.55} />
                </mesh>
                <Text position={[0, 0, 0.01]} fontSize={0.075} color="#fff" anchorX="center" anchorY="middle">
                    {username}
                </Text>
            </group>

            {/* ── Action indicator ── */}
            {currentAction === 'viewing_product' && (
                <group position={[0, 0.95, 0]}>
                    <Text fontSize={0.07} color="#FFD700" anchorX="center" anchorY="middle">🛍️</Text>
                </group>
            )}

            {/* ── Ground ring ── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.60, 0]}>
                <ringGeometry args={[0.18, 0.22, 32]} />
                <meshBasicMaterial
                    color={currentAction === 'viewing_product' ? '#FFD700' : '#64B5F6'}
                    transparent opacity={0.45}
                />
            </mesh>
        </group>
    );
};

// Enhanced Product Display with better visuals
const ProductBox: React.FC<{
    product: Product;
    position: [number, number, number];
    onClick: () => void;
    onMeshMount?: (productId: Product['id'], mesh: THREE.Object3D | null) => void;
    /** True when the player is within PRODUCT_INTERACT_DISTANCE of this product. */
    isNear?: boolean;
    /** True when the centre crosshair is aimed directly at this product. */
    isGazedAt?: boolean;
}> = ({ product, position, onClick, onMeshMount, isNear = false, isGazedAt = false }) => {
    const [_hovered, setHovered] = useState(false);
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);

    // Illuminate only when the player is nearby AND the crosshair is on this product.
    const illuminated = isNear && isGazedAt;

    const handleMeshRef = useCallback((mesh: THREE.Mesh | null) => {
        meshRef.current = mesh;
        onMeshMount?.(product.id, mesh);
    }, [onMeshMount, product.id]);

    const meshUserData = useMemo(
        () => ({
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            productImage: product.image_url || null,
            productStock: product.stock ?? null,
            product,
        }),
        [product]
    );

    useEffect(() => {
        if (product.image_url) {
            const loader = new THREE.TextureLoader();
            loader.load(
                product.image_url,
                (tex) => setTexture(tex),
                undefined,
                () => console.warn('Image load failed for', product.name)
            );
        }
    }, [product.image_url, product.name]);

    useFrame((state) => {
        if (!meshRef.current) return;
        if (illuminated) {
            meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
        } else {
            meshRef.current.rotation.y *= 0.85; // smoothly reset rotation when not illuminated
        }
    });

    return (
        <group position={position}>
            {/* Product box with rounded edges */}
            <RoundedBox
                ref={handleMeshRef}
                args={[0.38, 0.45, 0.22]}
                radius={0.02}
                smoothness={4}
                userData={meshUserData}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isNear) return; // block click when player is too far away
                    onClick();
                }}
                onPointerOver={() => { if (isNear) setHovered(true); }}
                onPointerOut={() => setHovered(false)}
            >
                {texture ? (
                    <meshStandardMaterial
                        map={texture}
                        emissive={illuminated ? '#FFD700' : '#000'}
                        emissiveIntensity={illuminated ? 0.55 : 0}
                        roughness={0.5}
                        metalness={0.1}
                    />
                ) : (
                    <meshStandardMaterial
                        color={illuminated ? '#FFE4B5' : '#FFFFFF'}
                        roughness={0.3}
                        metalness={0.2}
                    />
                )}
            </RoundedBox>

            {/* Glow point-light only when illuminated (near + gazed) */}
            {illuminated && (
                <pointLight position={[0, 0, 0.3]} intensity={0.8} color="#FFD700" distance={1.2} />
            )}

            {/* Product info card */}
            <group position={[0, -0.35, 0.12]}>
                <mesh>
                    <planeGeometry args={[0.42, 0.18]} />
                    <meshBasicMaterial color="#FFFFFF" transparent opacity={0.95} />
                </mesh>
                <Text
                    position={[0, 0.04, 0.01]}
                    fontSize={0.038}
                    color="#333333"
                    anchorX="center"
                    maxWidth={0.38}
                    textAlign="center"
                >
                    {product.name}
                </Text>
                <Text
                    position={[0, -0.04, 0.01]}
                    fontSize={0.055}
                    color="#2E7D32"
                    fontWeight="bold"
                    anchorX="center"
                >
                    ₹{product.price}
                </Text>
            </group>
        </group>
    );
};

// ── Realistic metal gondola shelf unit (retail standard) ────────────────────
const Shelf: React.FC<{
    position: [number, number, number];
    rotation?: [number, number, number];
    products: Product[];
    productsPerRow: number;
    productSpacingX: number;
    productSpacingY: number;
    maxProductsPerShelf: number;
    onProductClick: (product: Product) => void;
    onProductMeshMount?: (productId: Product['id'], mesh: THREE.Object3D | null) => void;
    nearbyProductIds?: Set<string>;
    gazedProductId?: string | null;
}> = ({
    position,
    rotation = [0, 0, 0],
    products,
    productsPerRow,
    productSpacingX,
    productSpacingY,
    maxProductsPerShelf,
    onProductClick,
    onProductMeshMount,
    nearbyProductIds,
    gazedProductId,
}) => {
    const visibleProducts = products.slice(0, maxProductsPerShelf);
    const shelfRows = Math.max(1, Math.ceil(maxProductsPerShelf / productsPerRow));
    const shelfWidth = Math.max(2.6, (productsPerRow - 1) * productSpacingX + 1.1);
    const totalHeight = shelfRows * productSpacingY + 0.25;
    const shelfDepth = 0.62;
    const uprightW = 0.055;

    return (
        <group position={position} rotation={rotation}>
            {/* ── Vertical steel upright posts (left & right) ── */}
            {([-shelfWidth / 2 - uprightW / 2, shelfWidth / 2 + uprightW / 2] as number[]).map((xPos, i) => (
                <mesh key={i} position={[xPos, totalHeight / 2, 0]} castShadow>
                    <boxGeometry args={[uprightW, totalHeight + 0.08, uprightW * 1.3]} />
                    <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.85} />
                </mesh>
            ))}

            {/* ── Solid steel back panel ── */}
            <mesh position={[0, totalHeight / 2, -shelfDepth / 2 + 0.01]} receiveShadow>
                <boxGeometry args={[shelfWidth, totalHeight, 0.022]} />
                <meshStandardMaterial color="#B0B0B0" roughness={0.55} metalness={0.65} />
            </mesh>

            {/* ── Shelf boards + front price-rail strips ── */}
            {Array.from({ length: shelfRows + 1 }, (_, i) => {
                const yPos = i * productSpacingY;
                return (
                    <group key={i}>
                        {/* Powder-coated steel shelf board */}
                        <mesh position={[0, yPos, 0]} castShadow receiveShadow>
                            <boxGeometry args={[shelfWidth + uprightW * 2, 0.038, shelfDepth]} />
                            <meshStandardMaterial color="#C8C8C8" roughness={0.18} metalness={0.78} />
                        </mesh>
                        {/* Front lip / price-label channel */}
                        <mesh position={[0, yPos + 0.048, shelfDepth / 2 - 0.004]}>
                            <boxGeometry args={[shelfWidth + uprightW * 2, 0.072, 0.007]} />
                            <meshStandardMaterial color="#E8E8E8" roughness={0.08} metalness={0.95} />
                        </mesh>
                        {/* White price-tag card in the rail */}
                        <mesh position={[0, yPos + 0.046, shelfDepth / 2 + 0.002]}>
                            <boxGeometry args={[shelfWidth - 0.1, 0.055, 0.001]} />
                            <meshStandardMaterial color="#FAFAFA" roughness={0.9} metalness={0} />
                        </mesh>
                    </group>
                );
            })}

            {/* ── Top cap rail ── */}
            <mesh position={[0, totalHeight + 0.04, 0]}>
                <boxGeometry args={[shelfWidth + uprightW * 4, 0.052, shelfDepth + 0.02]} />
                <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.85} />
            </mesh>

            {/* ── Aisle number sign clipped to top ── */}
            <group position={[0, totalHeight + 0.22, 0]}>
                <mesh>
                    <boxGeometry args={[1.1, 0.32, 0.04]} />
                    <meshStandardMaterial color="#1A237E" roughness={0.4} metalness={0.3} />
                </mesh>
            </group>

            {/* ── Under-shelf warm LED strips ── */}
            {Array.from({ length: shelfRows }, (_, i) => (
                <pointLight
                    key={`ul-${i}`}
                    position={[0, (i + 1) * productSpacingY - 0.12, 0.2]}
                    intensity={0.18}
                    color="#FFF5E0"
                    distance={2.8}
                    decay={2}
                />
            ))}

            {/* ── Products ── */}
            {visibleProducts.map((product, idx) => {
                const row = Math.floor(idx / productsPerRow);
                const col = idx % productsPerRow;
                const startX = -((productsPerRow - 1) * productSpacingX) / 2;
                const x = startX + col * productSpacingX;
                const y = row * productSpacingY + 0.5;
                return (
                    <ProductBox
                        key={product.id}
                        product={product}
                        position={[x, y, 0.08]}
                        onClick={() => onProductClick(product)}
                        onMeshMount={onProductMeshMount}
                        isNear={nearbyProductIds?.has(String(product.id)) ?? false}
                        isGazedAt={gazedProductId === String(product.id)}
                    />
                );
            })}
        </group>
    );
};

// ── Third-Person Camera Controller ──────────────────────────────────────────
// Camera orbits behind the player. Click canvas to lock mouse.
// Mouse drag rotates the camera. WASD / Arrow keys move the character.
const ThirdPersonController: React.FC<{
    onTransformUpdate: (
        position: [number, number, number],
        rotation: [number, number, number],
        isMoving: boolean,
        movementDirection?: { left: boolean; right: boolean; forward: boolean; backward: boolean }
    ) => void;
    collisionBoxes: Array<{ x: number; z: number; w: number; d: number }>;
}> = ({ onTransformUpdate, collisionBoxes }) => {
    const { camera, gl } = useThree();

    // Character position tracked independently of the camera (feet on floor, y=0)
    const charPos    = useRef(new THREE.Vector3(0, 0, 12));
    const yaw        = useRef(0);     // horizontal camera orbit angle (radians)
    const pitch      = useRef(0.35);  // vertical camera tilt (radians)
    const isLocked   = useRef(false);
    const wasMoving  = useRef(false);
    const moveState  = useRef({ forward: false, backward: false, left: false, right: false });

    const CAM_DIST   = 3.8;   // distance camera stays behind character
    const CAM_MIN_P  = -0.25; // min pitch (allows looking above)
    const CAM_MAX_P  = 0.72;  // max pitch (looking more downward)
    const LOOK_H     = 1.08;  // avatar head centre is at ~0.62+0.47 = 1.09 above floor
    const SPEED      = 5.5;

    const checkCollision = useCallback((pos: THREE.Vector3) => {
        if (Math.abs(pos.x) > 19 || Math.abs(pos.z) > 19) return true;
        for (const box of collisionBoxes) {
            const hw = box.w / 2, hd = box.d / 2;
            if (pos.x > box.x - hw && pos.x < box.x + hw &&
                pos.z > box.z - hd && pos.z < box.z + hd) return true;
        }
        return false;
    }, [collisionBoxes]);

    useEffect(() => {
        const canvas = gl.domElement;

        const requestLock = () => canvas.requestPointerLock();
        const onLockChange = () => { isLocked.current = document.pointerLockElement === canvas; };

        const onMouseMove = (e: MouseEvent) => {
            if (!isLocked.current) return;
            yaw.current  -= e.movementX * 0.0022;
            pitch.current = Math.max(CAM_MIN_P, Math.min(CAM_MAX_P, pitch.current - e.movementY * 0.0022));
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp')    moveState.current.forward   = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown')  moveState.current.backward  = true;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft')  moveState.current.left      = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.current.right     = true;
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp')    moveState.current.forward   = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown')  moveState.current.backward  = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft')  moveState.current.left      = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.current.right     = false;
        };

        canvas.addEventListener('click', requestLock);
        document.addEventListener('pointerlockchange', onLockChange);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        return () => {
            canvas.removeEventListener('click', requestLock);
            document.removeEventListener('pointerlockchange', onLockChange);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
        };
    }, [gl]);

    useFrame((_, delta) => {
        const ms = moveState.current;
        const moving = ms.forward || ms.backward || ms.left || ms.right;

        if (moving) {
            // Forward = direction the camera faces on the XZ plane
            const fx = -Math.sin(yaw.current);
            const fz = -Math.cos(yaw.current);
            const rx =  Math.cos(yaw.current);   // rightward strafe direction
            const rz = -Math.sin(yaw.current);

            let dx = 0, dz = 0;
            if (ms.forward)  { dx += fx; dz += fz; }
            if (ms.backward) { dx -= fx; dz -= fz; }
            if (ms.right)    { dx += rx; dz += rz; }
            if (ms.left)     { dx -= rx; dz -= rz; }

            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            const next = charPos.current.clone();
            next.x += (dx / len) * SPEED * delta;
            next.z += (dz / len) * SPEED * delta;
            next.y  = 0;
            if (!checkCollision(next)) charPos.current.copy(next);
        }

        // ── Position camera behind + above the character ────────────────────────
        const hDist = Math.cos(pitch.current) * CAM_DIST;  // horizontal distance
        const vDist = Math.sin(pitch.current) * CAM_DIST;  // vertical height offset

        const targetCamX = charPos.current.x + Math.sin(yaw.current) * hDist;
        const targetCamY = charPos.current.y + LOOK_H + vDist;
        const targetCamZ = charPos.current.z + Math.cos(yaw.current) * hDist;

        // Smooth lerp so camera follows without snapping
        camera.position.x += (targetCamX - camera.position.x) * 0.15;
        camera.position.y += (targetCamY - camera.position.y) * 0.15;
        camera.position.z += (targetCamZ - camera.position.z) * 0.15;

        // Camera always looks at avatar's head
        camera.lookAt(charPos.current.x, charPos.current.y + LOOK_H, charPos.current.z);

        // Avatar faces the same direction the camera is looking (away from camera)
        const avatarRotY = yaw.current + Math.PI;

        const pos: [number, number, number] = [
            charPos.current.x,
            charPos.current.y,  // y = 0 (feet on floor)
            charPos.current.z,
        ];
        const rot: [number, number, number] = [0, avatarRotY, 0];

        onTransformUpdate(pos, rot, moving, { ...moveState.current });
        wasMoving.current = moving;
    });

    return null;
};

// ── Realistic polished marble chess-tile floor ──────────────────────────────
const FloorTiles: React.FC = () => {
    const texture = useMemo(() => {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        const tiles = 2; // 2×2 per canvas (one alternating pair per axis)
        const tileSize = size / tiles;
        const grout = 3; // narrow grout line in px

        // Dark charcoal grout
        ctx.fillStyle = '#3A3630';
        ctx.fillRect(0, 0, size, size);

        const drawMarbleVeins = (
            x: number, y: number, w: number, h: number,
            baseColor: string, veinColor: string, count: number
        ) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y, w, h);

            // Marble veining
            for (let v = 0; v < count; v++) {
                ctx.beginPath();
                const sx = x + Math.random() * w;
                const sy = y + Math.random() * h * 0.3;
                ctx.moveTo(sx, sy);
                ctx.bezierCurveTo(
                    sx + (Math.random() - 0.5) * 80, sy + h * 0.25,
                    sx + (Math.random() - 0.5) * 80, sy + h * 0.6,
                    sx + (Math.random() - 0.5) * 50, sy + h
                );
                ctx.strokeStyle = veinColor;
                ctx.lineWidth = 0.5 + Math.random() * 1.2;
                ctx.globalAlpha = 0.12 + Math.random() * 0.18;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        };

        for (let row = 0; row < tiles; row++) {
            for (let col = 0; col < tiles; col++) {
                const x = col * tileSize + grout;
                const y = row * tileSize + grout;
                const w = tileSize - grout * 2;
                const h = tileSize - grout * 2;
                const isWhite = (row + col) % 2 === 0;

                if (isWhite) {
                    // Carrara white marble
                    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
                    grad.addColorStop(0, '#F5F1EB');
                    grad.addColorStop(0.45, '#EDE8E1');
                    grad.addColorStop(1, '#E3DED6');
                    drawMarbleVeins(x, y, w, h, '#EDE8E1', 'rgba(160,150,140,1)', 6);
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 0.5;
                    ctx.fillRect(x, y, w, h);
                    ctx.globalAlpha = 1;
                    // Polished top-left highlight
                    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y + h * 0.6);
                    ctx.lineTo(x, y);
                    ctx.lineTo(x + w * 0.6, y);
                    ctx.stroke();
                } else {
                    // Nero Marquina black marble
                    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
                    grad.addColorStop(0, '#1C1C1C');
                    grad.addColorStop(0.5, '#141414');
                    grad.addColorStop(1, '#0D0D0D');
                    drawMarbleVeins(x, y, w, h, '#141414', 'rgba(200,195,190,1)', 5);
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 0.55;
                    ctx.fillRect(x, y, w, h);
                    ctx.globalAlpha = 1;
                    // Subtle white vein highlights
                    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x, y + h * 0.7);
                    ctx.lineTo(x, y);
                    ctx.lineTo(x + w * 0.5, y);
                    ctx.stroke();
                }
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(10, 10);
        tex.anisotropy = 16;
        return tex;
    }, []);

    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial map={texture} roughness={0.08} metalness={0.15} />
            </mesh>
            {/* Very faint reflection plane to sell the polish */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.04}
                    roughness={0}
                    metalness={1}
                />
            </mesh>
        </>
    );
};

const CEILING_HEIGHT = 7;

// ── Front wall: large storefront windows + glass double-door ────────────────
const FrontWallWithWindows: React.FC<{ accentColor: string; storeName: string }> = ({ accentColor, storeName }) => {
    const z = 19.85;
    const wallColor = '#F4F0EC';
    const frameColor = '#C0C0C0';
    const glassColor = '#A8CEE8';

    return (
        <group>
            {/* ── Fake outdoor sky behind the glass ── */}
            <mesh position={[0, 4.5, 22.8]}>
                <planeGeometry args={[52, 10]} />
                <meshBasicMaterial color="#6EB5E8" />
            </mesh>
            <mesh position={[0, 0.8, 22.8]}>
                <planeGeometry args={[52, 4]} />
                <meshBasicMaterial color="#A8C8D8" />
            </mesh>
            {/* Cityscape silhouette suggestion */}
            {([ [-16,3.2,4,7], [-10,2.5,3,6.5], [8,2.8,5,5.5], [15,2.2,4,6] ] as number[][]).map(([x,y,w,h], i) => (
                <mesh key={i} position={[x, y, 22.4]}>
                    <boxGeometry args={[w, h, 0.1]} />
                    <meshBasicMaterial color="#7A8FA0" />
                </mesh>
            ))}

            {/* ── Solid wall panels assembled around the openings ── */}
            {/* Top band: full width, y=3.3→7 */}
            <mesh position={[0, 5.15, z]} receiveShadow>
                <boxGeometry args={[40, 3.7, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Bottom sill left of door: x=-20 to x=-3 */}
            <mesh position={[-11.5, 0.5, z]}>
                <boxGeometry args={[17, 1.0, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Bottom sill right of door: x=+3 to x=+20 */}
            <mesh position={[11.5, 0.5, z]}>
                <boxGeometry args={[17, 1.0, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Left extreme pillar: x=-20 to x=-14, mid-height */}
            <mesh position={[-17, 2.15, z]}>
                <boxGeometry args={[6, 2.3, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Right extreme pillar: x=+14 to x=+20 */}
            <mesh position={[17, 2.15, z]}>
                <boxGeometry args={[6, 2.3, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Left door-side pillar: x=-6 to x=-3 */}
            <mesh position={[-4.5, 2.15, z]}>
                <boxGeometry args={[3, 2.3, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>
            {/* Right door-side pillar: x=+3 to x=+6 */}
            <mesh position={[4.5, 2.15, z]}>
                <boxGeometry args={[3, 2.3, 0.3]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0} />
            </mesh>

            {/* ── Left large storefront window: x=-14 to x=-6, y=1.0 to y=3.3 ── */}
            <mesh position={[-10, 2.15, z + 0.05]}>
                <boxGeometry args={[8, 2.3, 0.06]} />
                <meshStandardMaterial color={glassColor} transparent opacity={0.3} roughness={0.01} metalness={0.12} />
            </mesh>
            {([
                [[-10, 3.33, z+0.06], [8.2, 0.1, 0.14]],
                [[-10, 1.02, z+0.06], [8.2, 0.1, 0.14]],
                [[-14.12, 2.15, z+0.06], [0.1, 2.42, 0.14]],
                [[-5.88, 2.15, z+0.06], [0.1, 2.42, 0.14]],
                [[-10, 2.15, z+0.06], [0.07, 2.3, 0.1]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color={frameColor} roughness={0.1} metalness={0.9} />
                </mesh>
            ))}

            {/* ── Right large storefront window: x=+6 to x=+14 ── */}
            <mesh position={[10, 2.15, z + 0.05]}>
                <boxGeometry args={[8, 2.3, 0.06]} />
                <meshStandardMaterial color={glassColor} transparent opacity={0.3} roughness={0.01} metalness={0.12} />
            </mesh>
            {([
                [[10, 3.33, z+0.06], [8.2, 0.1, 0.14]],
                [[10, 1.02, z+0.06], [8.2, 0.1, 0.14]],
                [[5.88, 2.15, z+0.06], [0.1, 2.42, 0.14]],
                [[14.12, 2.15, z+0.06], [0.1, 2.42, 0.14]],
                [[10, 2.15, z+0.06], [0.07, 2.3, 0.1]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color={frameColor} roughness={0.1} metalness={0.9} />
                </mesh>
            ))}

            {/* ── Central double glass door: x=-3 to x=+3, y=0 to y=3.1 ── */}
            <mesh position={[-1.48, 1.55, z + 0.08]}>
                <boxGeometry args={[2.86, 3.1, 0.05]} />
                <meshStandardMaterial color={glassColor} transparent opacity={0.22} roughness={0.01} metalness={0.15} />
            </mesh>
            <mesh position={[1.48, 1.55, z + 0.08]}>
                <boxGeometry args={[2.86, 3.1, 0.05]} />
                <meshStandardMaterial color={glassColor} transparent opacity={0.22} roughness={0.01} metalness={0.15} />
            </mesh>
            {/* Door frame */}
            {([
                [[0, 3.18, z+0.06], [6.2, 0.14, 0.14]],
                [[-3.07, 1.55, z+0.06], [0.14, 3.26, 0.14]],
                [[3.07, 1.55, z+0.06], [0.14, 3.26, 0.14]],
                [[0, 1.55, z+0.06], [0.1, 3.1, 0.1]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color={frameColor} roughness={0.1} metalness={0.9} />
                </mesh>
            ))}
            {/* Door handles */}
            <mesh position={[-0.45, 1.55, z + 0.13]}>
                <boxGeometry args={[0.48, 0.04, 0.04]} />
                <meshStandardMaterial color="#888888" roughness={0.06} metalness={0.97} />
            </mesh>
            <mesh position={[0.45, 1.55, z + 0.13]}>
                <boxGeometry args={[0.48, 0.04, 0.04]} />
                <meshStandardMaterial color="#888888" roughness={0.06} metalness={0.97} />
            </mesh>

            {/* ── Welcome mat ── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 18.3]}>
                <planeGeometry args={[5.5, 1.6]} />
                <meshStandardMaterial color="#1A1A1A" roughness={0.96} metalness={0} />
            </mesh>
            <Text position={[0, 0.007, 18.3]} rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.2} color="#BBBBBB" anchorX="center" anchorY="middle" fontWeight="bold">
                WELCOME
            </Text>

            {/* ── Coloured fascia above front wall ── */}
            <mesh position={[0, 6.25, z + 0.18]}>
                <boxGeometry args={[40, 0.9, 0.1]} />
                <meshStandardMaterial color={accentColor} roughness={0.3} metalness={0.45}
                    emissive={accentColor} emissiveIntensity={0.45} />
            </mesh>
            <Text position={[0, 6.25, z + 0.26]} fontSize={0.3} color="#FFFFFF"
                anchorX="center" anchorY="middle" fontWeight="bold">
                {storeName.toUpperCase()}  •  EST. 2024  •  WELCOME
            </Text>

            {/* OPEN sign in window */}
            <mesh position={[-10, 2.1, z + 0.12]}>
                <boxGeometry args={[0.8, 0.4, 0.04]} />
                <meshStandardMaterial color="#E53935" roughness={0.3} emissive="#E53935" emissiveIntensity={0.5} />
            </mesh>
            <Text position={[-10, 2.1, z + 0.15]} fontSize={0.2} color="#FFFFFF" anchorX="center" anchorY="middle" fontWeight="bold">
                OPEN
            </Text>

            {/* Natural light streaming through windows */}
            <pointLight position={[-10, 2.5, 17]} intensity={1.0} color="#D8EDFF" distance={16} decay={2} />
            <pointLight position={[10, 2.5, 17]} intensity={1.0} color="#D8EDFF" distance={16} decay={2} />
            <pointLight position={[0, 3.5, 18]} intensity={0.6} color="#FFF8F2" distance={12} decay={2} />
        </group>
    );
};

// ── Colorful hanging promotional banners ────────────────────────────────────
const HangingBanners: React.FC = () => {
    const banners: { pos: [number,number,number]; color: string; text: string }[] = [
        { pos: [-14, 5.0, -5],  color: '#E53935', text: '🔥 SALE\nUP TO 50% OFF' },
        { pos: [14,  5.0, -5],  color: '#1E88E5', text: '✨ NEW\nARRIVALS'        },
        { pos: [-14, 5.0,  4],  color: '#43A047', text: '🛒 BUY 2\nGET 1 FREE'   },
        { pos: [14,  5.0,  4],  color: '#FB8C00', text: '⭐ TOP\nPICKS'          },
        { pos: [0,   5.0, -10], color: '#8E24AA', text: '💜 MEMBERS\nSPECIAL'    },
        { pos: [0,   5.0,  13], color: '#00897B', text: '🎁 GIFT\nIDEAS'         },
    ];

    return (
        <>
            {banners.map((b, i) => (
                <group key={i} position={b.pos}>
                    {/* Suspension wire */}
                    <mesh position={[0, 1.1, 0]}>
                        <cylinderGeometry args={[0.007, 0.007, 2.2, 6]} />
                        <meshStandardMaterial color="#BBBBBB" roughness={0.15} metalness={0.92} />
                    </mesh>
                    {/* Banner body */}
                    <mesh>
                        <boxGeometry args={[1.5, 1.9, 0.04]} />
                        <meshStandardMaterial color={b.color} roughness={0.45} metalness={0}
                            emissive={b.color} emissiveIntensity={0.12} />
                    </mesh>
                    {/* Bottom dark strip */}
                    <mesh position={[0, -0.98, 0.026]}>
                        <boxGeometry args={[1.5, 0.13, 0.008]} />
                        <meshStandardMaterial color="#00000066" transparent opacity={0.3} />
                    </mesh>
                    <Text position={[0, 0.12, 0.03]} fontSize={0.23} color="#FFFFFF"
                        anchorX="center" anchorY="middle" fontWeight="bold"
                        maxWidth={1.3} textAlign="center" lineHeight={1.35}>
                        {b.text}
                    </Text>
                </group>
            ))}
        </>
    );
};

// ── Beautiful coffered ceiling with LED strips + chandelier ─────────────────
const Ceiling: React.FC<{ accentColor: string }> = ({ accentColor }) => {
    // Beam grid: lines at these positions create coffer cells between them
    const beamX = [-16, -8, 0, 8, 16];
    const beamZ = [-16, -8, 0, 8, 16];
    const beamDrop = 0.32;
    const beamW = 0.32;

    // One spotlight per coffer cell (cells between beams + edges)
    const spotPositions = useMemo<[number,number,number][]>(() => {
        const pts: [number,number,number][] = [];
        for (const x of [-14, -4, 4, 14]) {
            for (const z of [-14, -4, 4, 14]) {
                pts.push([x, CEILING_HEIGHT - 0.07, z]);
            }
        }
        return pts;
    }, []);

    const ledColors = [accentColor, '#FFD700', '#FF7043', '#4FC3F7', '#81C784', '#CE93D8'];

    return (
        <>
            {/* ── Main ceiling plaster surface ── */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_HEIGHT, 0]}>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial color="#F9F7F4" roughness={0.9} metalness={0} />
            </mesh>

            {/* ── Coffer beams spanning the Z depth (positioned along X) ── */}
            {beamX.map((xPos, i) => (
                <group key={`bx-${i}`}>
                    <mesh position={[xPos, CEILING_HEIGHT - beamDrop / 2, 0]}>
                        <boxGeometry args={[beamW, beamDrop, 40]} />
                        <meshStandardMaterial color="#FAFAF8" roughness={0.65} metalness={0} />
                    </mesh>
                    {/* LED strip on underside — one color per beam */}
                    <mesh position={[xPos, CEILING_HEIGHT - beamDrop - 0.01, 0]}>
                        <boxGeometry args={[beamW - 0.05, 0.04, 39.6]} />
                        <meshStandardMaterial
                            color={ledColors[i % ledColors.length]}
                            emissive={ledColors[i % ledColors.length]}
                            emissiveIntensity={1.8} roughness={0} />
                    </mesh>
                    {/* Glow fill lights — 3 spaced along the strip */}
                    {[-13, 0, 13].map((z, j) => (
                        <pointLight key={j} position={[xPos, CEILING_HEIGHT - beamDrop - 0.25, z]}
                            intensity={0.22} color={ledColors[i % ledColors.length]} distance={10} decay={2} />
                    ))}
                </group>
            ))}

            {/* ── Coffer beams spanning the X width (positioned along Z) ── */}
            {beamZ.map((zPos, i) => (
                <group key={`bz-${i}`}>
                    <mesh position={[0, CEILING_HEIGHT - beamDrop / 2, zPos]}>
                        <boxGeometry args={[40, beamDrop, beamW]} />
                        <meshStandardMaterial color="#FAFAF8" roughness={0.65} metalness={0} />
                    </mesh>
                    <mesh position={[0, CEILING_HEIGHT - beamDrop - 0.01, zPos]}>
                        <boxGeometry args={[39.6, 0.04, beamW - 0.05]} />
                        <meshStandardMaterial
                            color={ledColors[(i + 3) % ledColors.length]}
                            emissive={ledColors[(i + 3) % ledColors.length]}
                            emissiveIntensity={1.8} roughness={0} />
                    </mesh>
                    {[-13, 0, 13].map((x, j) => (
                        <pointLight key={j} position={[x, CEILING_HEIGHT - beamDrop - 0.25, zPos]}
                            intensity={0.2} color={ledColors[(i + 3) % ledColors.length]} distance={10} decay={2} />
                    ))}
                </group>
            ))}

            {/* ── Four-wall crown moulding ── */}
            {([
                [[0,  CEILING_HEIGHT-0.15, -20], [40.4, 0.3, 0.3]],
                [[0,  CEILING_HEIGHT-0.15,  20], [40.4, 0.3, 0.3]],
                [[-20,CEILING_HEIGHT-0.15,   0], [0.3,  0.3, 40.4]],
                [[20, CEILING_HEIGHT-0.15,   0], [0.3,  0.3, 40.4]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color="#FFFFFF" roughness={0.3} metalness={0.05} />
                </mesh>
            ))}

            {/* ── Perimeter accent glow strips (all 4 walls, near ceiling) ── */}
            {([
                [[0,  CEILING_HEIGHT-0.045, -19.72], [39,  0.09, 0.2]],
                [[0,  CEILING_HEIGHT-0.045,  19.72], [39,  0.09, 0.2]],
                [[-19.72, CEILING_HEIGHT-0.045, 0],  [0.2, 0.09, 39]],
                [[19.72,  CEILING_HEIGHT-0.045, 0],  [0.2, 0.09, 39]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1.6} roughness={0.05} />
                </mesh>
            ))}

            {/* ── Recessed spotlights (one per coffer) ── */}
            {spotPositions.map(([x,y,z],i) => (
                <group key={i} position={[x, y, z]}>
                    <mesh>
                        <cylinderGeometry args={[0.2, 0.16, 0.1, 16]} />
                        <meshStandardMaterial color="#A0A0A0" roughness={0.18} metalness={0.88} />
                    </mesh>
                    <mesh position={[0, -0.056, 0]}>
                        <cylinderGeometry args={[0.14, 0.14, 0.008, 16]} />
                        <meshStandardMaterial color="#FFFDE0" emissive="#FFFDE0" emissiveIntensity={4} roughness={0} />
                    </mesh>
                    <pointLight position={[0, -0.45, 0]} intensity={0.65} color="#FFF6E0" distance={8} decay={2} />
                </group>
            ))}

            {/* ── Central chandelier / feature medallion ── */}
            <group position={[0, CEILING_HEIGHT - 0.06, 0]}>
                {/* Chrome disc */}
                <mesh>
                    <cylinderGeometry args={[1.5, 1.5, 0.09, 40]} />
                    <meshStandardMaterial color="#D8D0C0" roughness={0.08} metalness={0.85} />
                </mesh>
                {/* Outer warm-white ring */}
                <mesh position={[0, -0.07, 0]}>
                    <torusGeometry args={[1.2, 0.06, 12, 52]} />
                    <meshStandardMaterial color="#FFFDE7" emissive="#FFFDE7" emissiveIntensity={3.5} roughness={0} />
                </mesh>
                {/* Inner accent-color ring */}
                <mesh position={[0, -0.07, 0]}>
                    <torusGeometry args={[0.72, 0.045, 12, 52]} />
                    <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={3.5} roughness={0} />
                </mesh>
                {/* Central strong downlight */}
                <pointLight position={[0, -0.6, 0]} intensity={1.4} color="#FFF8E8" distance={14} decay={1.5} />
                <pointLight position={[0, -0.6, 0]} intensity={0.6} color={accentColor} distance={9} decay={2} />
            </group>
        </>
    );
};

// Main Store Component
export const Store3D: React.FC<Store3DProps> = ({
    products,
    onProductClick,
    onCheckoutCounterClick,
    storeTheme,
    avatarCustomization,
    presenceManager,
    onClosestProductChange,
}) => {
    const { camera } = useThree();
    const [currentUserPosition, setCurrentUserPosition] = useState<[number, number, number]>([0, 1.6, 12]);
    const [currentUserRotationY, setCurrentUserRotationY] = useState<number>(0);
    const [isCurrentUserMoving, setIsCurrentUserMoving] = useState(false);
    const [currentUserMovementDirection, setCurrentUserMovementDirection] = useState({ left: false, right: false, forward: false, backward: false });
    const [gazedProductId, setGazedProductId] = useState<string | null>(null);
    const lastUpdateTime = useRef(0);
    const raycasterRef = useRef(new THREE.Raycaster());
    const productMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const lastGazedIdRef = useRef<string | null>(null);
    const interactionStateRef = useRef<{
        gazedProductId: string | null;
        nearbyProductIds: Set<string>;
        canUseCheckout: boolean;
        products: Product[];
    }>({
        gazedProductId: null,
        nearbyProductIds: new Set<string>(),
        canUseCheckout: false,
        products,
    });
    const onProductClickRef = useRef(onProductClick);
    const onCheckoutCounterClickRef = useRef(onCheckoutCounterClick);
    
    // Subscribe to real player data from game store instead of mock data
    const otherPlayers = useGameStore((state) => state.otherPlayers);

    // Convert room presence positions to renderable 3D coordinates with fallback for legacy records.
    const onlineUsers = useMemo(() => {
        return otherPlayers.map(player => {
            const roomPosition = (player as any).position;
            const hasRoomPosition =
                roomPosition &&
                typeof roomPosition.x === 'number' &&
                typeof roomPosition.y === 'number' &&
                typeof roomPosition.z === 'number';

            const x3d = hasRoomPosition ? roomPosition.x : Number(player.position_x || 0);
            const y3d = hasRoomPosition ? roomPosition.y : 1.6;
            const z3d = hasRoomPosition ? roomPosition.z : Number(player.position_y || 0);
            
            return {
                user_id: player.user_id,
                username: player.username,
                position: [x3d, y3d, z3d] as [number, number, number],
                avatar_customization: (player as any).avatar_customization || {
                    bodyColor: '#4A90E2',
                    skinTone: '#FFD1A3',
                    style: 'casual',
                },
                rotation: (player as any).rotation || { x: 0, y: 0, z: 0 },
                current_action: (player as any).current_action,
                viewing_product_id: (player as any).viewing_product_id,
                animation_state: (player as any).animation_state,
            };
        });
    }, [otherPlayers]);

    useEffect(() => {
        console.log(`👥 ${onlineUsers.length} other player(s) online`);
    }, [onlineUsers.length]);

    const shelfLayouts = useMemo<ShelfLayout[]>(() => {
        if (!products.length) return [];

        const shelfCount = Math.ceil(products.length / PRODUCT_GRID_CONFIG.productsPerShelf);
        return Array.from({ length: shelfCount }, (_, shelfIndex) => {
            const row = Math.floor(shelfIndex / PRODUCT_GRID_CONFIG.shelvesPerRow);
            const col = shelfIndex % PRODUCT_GRID_CONFIG.shelvesPerRow;

            const start = shelfIndex * PRODUCT_GRID_CONFIG.productsPerShelf;
            const end = start + PRODUCT_GRID_CONFIG.productsPerShelf;

            return {
                shelfIndex,
                position: [
                    PRODUCT_GRID_CONFIG.shelfStartX + col * PRODUCT_GRID_CONFIG.shelfSpacingX,
                    0,
                    PRODUCT_GRID_CONFIG.shelfStartZ + row * PRODUCT_GRID_CONFIG.shelfSpacingZ,
                ],
                products: products.slice(start, end),
            };
        });
    }, [products]);

    const productWorldPositions = useMemo<ProductWorldPosition[]>(() => {
        const positions: ProductWorldPosition[] = [];

        shelfLayouts.forEach((shelf) => {
            shelf.products.forEach((product, idx) => {
                const row = Math.floor(idx / PRODUCT_GRID_CONFIG.productsPerRow);
                const col = idx % PRODUCT_GRID_CONFIG.productsPerRow;
                const startX = -((PRODUCT_GRID_CONFIG.productsPerRow - 1) * PRODUCT_GRID_CONFIG.productSpacingX) / 2;

                const localX = startX + col * PRODUCT_GRID_CONFIG.productSpacingX;
                const localY = row * PRODUCT_GRID_CONFIG.productSpacingY + 0.5;

                positions.push({
                    product,
                    position: [
                        shelf.position[0] + localX,
                        localY,
                        shelf.position[2] + 0.25,
                    ],
                });
            });
        });

        return positions;
    }, [shelfLayouts]);

    const registerProductMesh = useCallback((productId: Product['id'], mesh: THREE.Object3D | null) => {
        const key = String(productId);
        if (mesh) productMeshesRef.current.set(key, mesh);
        else productMeshesRef.current.delete(key);
    }, []);

    const resolveProduct = useCallback((obj: THREE.Object3D | null): Product | null => {
        let cur: THREE.Object3D | null = obj;
        while (cur) {
            const p = cur.userData?.product as Product | undefined;
            if (p) return p;
            cur = cur.parent;
        }
        return null;
    }, []);

    // Each frame: cast a ray from the exact screen centre and expose the
    // product under the crosshair via onClosestProductChange.
    useFrame(() => {
        const targets = Array.from(productMeshesRef.current.values());
        if (targets.length === 0) {
            if (lastGazedIdRef.current !== null) {
                lastGazedIdRef.current = null;
                onClosestProductChange?.(null);
            }
            return;
        }
        const rc = raycasterRef.current;
        rc.near = 0.1;  // Fixed: was 0, now uses small positive value for proper raycasting
        rc.far = LOOK_TARGET_MAX_DISTANCE;
        rc.setFromCamera(new THREE.Vector2(0, 0), camera);
        const gazed =
            rc.intersectObjects(targets, false)
               .map((h) => resolveProduct(h.object))
               .find((p): p is Product => p !== null) ?? null;
        const nextId = gazed ? String(gazed.id) : null;
        if (nextId === lastGazedIdRef.current) return;
        lastGazedIdRef.current = nextId;
        setGazedProductId(nextId);
        onClosestProductChange?.(gazed);
    });

    // Products the player is close enough to illuminate and click.
    const nearbyProductIds = useMemo(() => {
        const nearby = new Set<string>();
        const [px, , pz] = currentUserPosition;
        productWorldPositions.forEach(({ product, position: [wx, , wz] }) => {
            const dx = px - wx;
            const dz = pz - wz;
            if (dx * dx + dz * dz <= PRODUCT_INTERACT_DISTANCE * PRODUCT_INTERACT_DISTANCE) {
                nearby.add(String(product.id));
            }
        });
        return nearby;
    }, [currentUserPosition, productWorldPositions]);

    // Whether the player is close enough to use the checkout counter.
    const canUseCheckout = useMemo(() => {
        const [px, , pz] = currentUserPosition;
        const dx = px - 0;   // checkout at x=0
        const dz = pz - (-15); // checkout at z=-15
        return dx * dx + dz * dz <= CHECKOUT_INTERACT_DISTANCE * CHECKOUT_INTERACT_DISTANCE;
    }, [currentUserPosition]);

    useEffect(() => {
        interactionStateRef.current = {
            gazedProductId,
            nearbyProductIds,
            canUseCheckout,
            products,
        };
    }, [gazedProductId, nearbyProductIds, canUseCheckout, products]);

    useEffect(() => {
        onProductClickRef.current = onProductClick;
    }, [onProductClick]);

    useEffect(() => {
        onCheckoutCounterClickRef.current = onCheckoutCounterClick;
    }, [onCheckoutCounterClick]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== 'KeyE' || event.repeat) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (isTextInputTarget(event.target)) return;

            const {
                gazedProductId: activeProductId,
                nearbyProductIds: nearbyIds,
                canUseCheckout: checkoutActive,
                products: currentProducts,
            } = interactionStateRef.current;

            if (activeProductId && nearbyIds.has(activeProductId)) {
                const targetProduct = currentProducts.find((product) => String(product.id) === activeProductId);
                if (targetProduct) {
                    event.preventDefault();
                    onProductClickRef.current(targetProduct);
                    return;
                }
            }

            if (!checkoutActive) return;

            event.preventDefault();
            onCheckoutCounterClickRef.current?.();
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    const collisionBoxes = useMemo(() => {
        const shelfWidth = Math.max(2.6, (PRODUCT_GRID_CONFIG.productsPerRow - 1) * PRODUCT_GRID_CONFIG.productSpacingX + 1.1);

        return [
            ...shelfLayouts.map((shelf) => ({
                x: shelf.position[0],
                z: shelf.position[2],
                w: shelfWidth,
                d: 1.2,
            })),
            { x: 0, z: -15, w: 6.8, d: 2.8 },
            { x: 0, z: 8, w: 4, d: 4 },
        ];
    }, [shelfLayouts]);

    const handleTransformUpdate = useCallback((
        position: [number, number, number],
        rotation: [number, number, number],
        isMoving: boolean,
        movementDirection?: { left: boolean; right: boolean; forward: boolean; backward: boolean }
    ) => {
        const now = Date.now();
        // Update at ~60fps
        if (now - lastUpdateTime.current > 16) {
            lastUpdateTime.current = now;
            setCurrentUserPosition(position);
            setCurrentUserRotationY(rotation[1]);
            setIsCurrentUserMoving(isMoving);
            if (movementDirection) {
                setCurrentUserMovementDirection(movementDirection);
            }

            if (presenceManager) {
                presenceManager.updateState({
                    position: {
                        x: position[0],
                        y: position[1],
                        z: position[2],
                    },
                    rotation: {
                        x: rotation[0],
                        y: rotation[1],
                        z: rotation[2],
                    },
                    direction: 'down',
                    is_moving: isMoving,
                    animation_state: isMoving ? 'walking' : 'idle',
                }).catch((err: Error) => console.error('Presence update failed', err));
            }

        }
    }, [presenceManager]);

    if (!products || products.length === 0) {
        return (
            <>
                <ambientLight intensity={0.8} />
                <Text position={[0, 2, 0]} fontSize={0.5} color="#FF6B6B">
                    Loading your shopping experience...
                </Text>
            </>
        );
    }

    return (
        <>
            {/* ── Warm retail lighting ── */}
            <ambientLight intensity={0.22} />
            <directionalLight position={[4, 10, 5]} intensity={0.18} castShadow />
            <hemisphereLight args={['#D6E8F7', '#F5EFE0', 0.15]} />

            {/* Retail-style tiled floor */}
            <FloorTiles />

            {/* Beautiful coffered ceiling */}
            <Ceiling accentColor={storeTheme.accentColor} />

            {/* Colorful hanging banners */}
            <HangingBanners />

            {/* Front wall with windows and door */}
            <FrontWallWithWindows accentColor={storeTheme.accentColor} storeName={storeTheme.name} />

            {/* ── Walls ── */}
            {/* Back wall — feature wall in deep rich colour */}
            <mesh position={[0, 3.5, -20]} receiveShadow>
                <boxGeometry args={[40, 7, 0.3]} />
                <meshStandardMaterial color="#2C2A28" roughness={0.75} metalness={0.05} />
            </mesh>
            {/* Back wall lower accent panel */}
            <mesh position={[0, 0.85, -19.84]}>
                <boxGeometry args={[40, 1.7, 0.05]} />
                <meshStandardMaterial color={storeTheme.accentColor} roughness={0.45} metalness={0.15}
                    emissive={storeTheme.accentColor} emissiveIntensity={0.08} />
            </mesh>

            {/* Left wall — warm cream with coloured accent strips */}
            <mesh position={[-20, 3.5, 0]} receiveShadow>
                <boxGeometry args={[0.3, 7, 40]} />
                <meshStandardMaterial color="#F0EBE3" roughness={0.88} metalness={0} />
            </mesh>
            {/* Left wall dado */}
            <mesh position={[-19.84, 0.55, 0]}>
                <boxGeometry args={[0.05, 1.1, 40]} />
                <meshStandardMaterial color="#D8D0C4" roughness={0.85} metalness={0} />
            </mesh>
            {/* Left wall colour accent panels at intervals */}
            {[-14, -4, 6, 16].map((z, i) => (
                <mesh key={i} position={[-19.82, 2.8, z]}>
                    <boxGeometry args={[0.04, 2.4, 1.8]} />
                    <meshStandardMaterial
                        color={['#E57373','#FFB74D','#81C784','#64B5F6'][i]}
                        roughness={0.5} metalness={0.1}
                        emissive={['#E57373','#FFB74D','#81C784','#64B5F6'][i]}
                        emissiveIntensity={0.06}
                    />
                </mesh>
            ))}

            {/* Right wall — same warm cream with different accent colours */}
            <mesh position={[20, 3.5, 0]} receiveShadow>
                <boxGeometry args={[0.3, 7, 40]} />
                <meshStandardMaterial color="#F0EBE3" roughness={0.88} metalness={0} />
            </mesh>
            <mesh position={[19.84, 0.55, 0]}>
                <boxGeometry args={[0.05, 1.1, 40]} />
                <meshStandardMaterial color="#D8D0C4" roughness={0.85} metalness={0} />
            </mesh>
            {[-14, -4, 6, 16].map((z, i) => (
                <mesh key={i} position={[19.82, 2.8, z]}>
                    <boxGeometry args={[0.04, 2.4, 1.8]} />
                    <meshStandardMaterial
                        color={['#F48FB1','#CE93D8','#80DEEA','#A5D6A7'][i]}
                        roughness={0.5} metalness={0.1}
                        emissive={['#F48FB1','#CE93D8','#80DEEA','#A5D6A7'][i]}
                        emissiveIntensity={0.06}
                    />
                </mesh>
            ))}

            {/* ── Baseboard skirting all walls ── */}
            {([
                [[0,    0.055, -19.86], [40, 0.11, 0.06]],
                [[0,    0.055,  19.86], [40, 0.11, 0.06]],
                [[-19.86, 0.055, 0],   [0.06, 0.11, 40]],
                [[19.86,  0.055, 0],   [0.06, 0.11, 40]],
            ] as [[number,number,number],[number,number,number]][]).map(([p,s],i) => (
                <mesh key={i} position={p}>
                    <boxGeometry args={s} />
                    <meshStandardMaterial color="#888080" roughness={0.5} metalness={0.15} />
                </mesh>
            ))}

            {/* ── Store Name Sign on back feature wall ── */}
            <group position={[0, 5.5, -19.6]}>
                <mesh>
                    <boxGeometry args={[10, 1.15, 0.14]} />
                    <meshStandardMaterial color="#111111" roughness={0.25} metalness={0.65} />
                </mesh>
                <mesh position={[0, -0.64, 0.05]}>
                    <boxGeometry args={[10, 0.07, 0.09]} />
                    <meshStandardMaterial color={storeTheme.accentColor} emissive={storeTheme.accentColor} emissiveIntensity={2.2} roughness={0.05} />
                </mesh>
                <Text position={[0, 0, 0.09]} fontSize={0.52} color="#FFFFFF"
                    anchorX="center" anchorY="middle" fontWeight="bold">
                    {storeTheme.name}
                </Text>
                <pointLight position={[0, -0.9, 0.6]} intensity={0.8} color={storeTheme.accentColor} distance={7} />
            </group>

            {/* ── Realistic Checkout Counter ── */}
            <group
                position={[0, 0, -15]}
                onClick={(event) => {
                    event.stopPropagation();
                    if (!canUseCheckout) return;
                    onCheckoutCounterClick?.();
                }}
            >
                {/* Main counter body */}
                <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
                    <boxGeometry args={[7.2, 1.04, 1.0]} />
                    <meshStandardMaterial color="#DEDBD8" roughness={0.55} metalness={0.05} />
                </mesh>
                {/* Counter top — dark laminate surface */}
                <mesh position={[0, 1.05, 0]}>
                    <boxGeometry args={[7.2, 0.04, 1.05]} />
                    <meshStandardMaterial color={canUseCheckout ? '#2C2C2C' : '#3C3C3C'}
                        roughness={0.25} metalness={0.4}
                        emissive={canUseCheckout ? storeTheme.accentColor : '#000'}
                        emissiveIntensity={canUseCheckout ? 0.07 : 0}
                    />
                </mesh>
                {/* Conveyor belt surface */}
                <mesh position={[1.8, 1.07, 0]}>
                    <boxGeometry args={[3.0, 0.01, 0.7]} />
                    <meshStandardMaterial color="#222222" roughness={0.85} metalness={0.1} />
                </mesh>
                {/* Belt lane dividers */}
                {[-0.35, 0.35].map((z, i) => (
                    <mesh key={i} position={[1.8, 1.06, z]}>
                        <boxGeometry args={[3.0, 0.02, 0.015]} />
                        <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.8} />
                    </mesh>
                ))}
                {/* Customer side panel */}
                <mesh position={[3.62, 0.52, 0]}>
                    <boxGeometry args={[0.04, 1.04, 1.0]} />
                    <meshStandardMaterial color="#BBBBBB" roughness={0.3} metalness={0.6} />
                </mesh>
                {/* POS monitor stand */}
                <mesh position={[-2.2, 1.35, -0.2]} castShadow>
                    <boxGeometry args={[0.06, 0.55, 0.06]} />
                    <meshStandardMaterial color="#555555" roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Monitor screen */}
                <mesh position={[-2.2, 1.7, -0.28]}>
                    <boxGeometry args={[0.42, 0.3, 0.03]} />
                    <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.5}
                        emissive="#1A3A5C" emissiveIntensity={0.6}
                    />
                </mesh>
                {/* Checkout label */}
                <Text position={[0, 1.35, 0.54]} fontSize={0.3} color={canUseCheckout ? '#FFFFFF' : '#FFCC66'}
                    anchorX="center" fontWeight="bold">
                    {canUseCheckout ? '▶ CHECKOUT' : 'Move Closer'}
                </Text>
                {canUseCheckout && (
                    <pointLight position={[0, 1.8, 0.5]} intensity={0.7} color="#FFE8A0" distance={5} />
                )}
            </group>

            {/* ── End-cap promotional display (replaces fountain) ── */}
            <group position={[0, 0, 8]}>
                {/* Base plinth */}
                <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.8, 0.24, 1.1]} />
                    <meshStandardMaterial color="#C0B8B0" roughness={0.6} metalness={0.1} />
                </mesh>
                {/* Display table top */}
                <mesh position={[0, 0.26, 0]}>
                    <boxGeometry args={[2.8, 0.04, 1.1]} />
                    <meshStandardMaterial color="#2C2422" roughness={0.3} metalness={0.2} />
                </mesh>
                {/* Vertical display panel back */}
                <mesh position={[0, 1.1, -0.52]}>
                    <boxGeometry args={[2.8, 1.7, 0.05]} />
                    <meshStandardMaterial
                        color={storeTheme.accentColor}
                        roughness={0.4} metalness={0.3}
                        emissive={storeTheme.accentColor}
                        emissiveIntensity={0.15}
                    />
                </mesh>
                <Text position={[0, 1.4, -0.47]} fontSize={0.28} color="#FFFFFF"
                    anchorX="center" anchorY="middle" fontWeight="bold" maxWidth={2.4} textAlign="center">
                    SPECIAL OFFERS
                </Text>
                <Text position={[0, 1.05, -0.47]} fontSize={0.18} color="#FFE066"
                    anchorX="center" anchorY="middle" maxWidth={2.4} textAlign="center">
                    Grab a deal today!
                </Text>
                {/* Spotlight on display */}
                <pointLight position={[0, 2.2, 0]} intensity={0.5} color="#FFF5CC" distance={4} />
            </group>

            {/* Shelves with Products */}
            {shelfLayouts.map((shelf) => (
                <Shelf
                    key={`shelf-${shelf.shelfIndex}`}
                    position={shelf.position}
                    products={shelf.products}
                    productsPerRow={PRODUCT_GRID_CONFIG.productsPerRow}
                    productSpacingX={PRODUCT_GRID_CONFIG.productSpacingX}
                    productSpacingY={PRODUCT_GRID_CONFIG.productSpacingY}
                    maxProductsPerShelf={PRODUCT_GRID_CONFIG.productsPerShelf}
                    onProductClick={onProductClick}
                    onProductMeshMount={registerProductMesh}
                    nearbyProductIds={nearbyProductIds}
                    gazedProductId={gazedProductId}
                />
            ))}

            {/* Current User */}
            <Avatar
                position={currentUserPosition}
                rotation={[0, currentUserRotationY, 0]}
                username="You"
                isCurrentUser
                customization={avatarCustomization}
                animationState={isCurrentUserMoving ? 'walking' : 'idle'}
                movementDirection={currentUserMovementDirection}
            />

            {/* Other Online Shoppers */}
            {onlineUsers.map((user) => (
                <Avatar
                    key={user.user_id}
                    position={user.position}
                    rotation={[0, user.rotation.y ?? 0, 0]}
                    username={user.username}
                    customization={user.avatar_customization}
                    animationState={user.animation_state}
                    currentAction={user.current_action}
                />
            ))}

            {/* Third-person camera controller — no PointerLockControls needed */}
            <ThirdPersonController onTransformUpdate={handleTransformUpdate} collisionBoxes={collisionBoxes} />
        </>
    );
};