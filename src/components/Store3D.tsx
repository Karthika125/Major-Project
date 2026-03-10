import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Text, Sphere, Cylinder, RoundedBox } from '@react-three/drei';
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

// Enhanced Avatar Component with animations and action indicators
const Avatar: React.FC<{
    position: [number, number, number];
    username: string;
    isCurrentUser?: boolean;
    customization?: { bodyColor: string; skinTone: string; style: string };
    animationState?: 'idle' | 'walking' | 'waving' | 'shopping';
    currentAction?: 'idle' | 'walking' | 'viewing_product' | 'shopping';
}> = ({ position, username, isCurrentUser = false, customization, animationState = 'idle', currentAction = 'idle' }) => {
    const meshRef = useRef<THREE.Group>(null);
    
    const colors = {
        body: customization?.bodyColor || '#4A90E2',
        skin: customization?.skinTone || '#FFD1A3',
    };

    // Animate avatar based on state
    useFrame((state) => {
        if (!meshRef.current) return;
        
        const time = state.clock.elapsedTime;
        
        if (animationState === 'walking') {
            // Bobbing motion while walking
            meshRef.current.position.y = position[1] + Math.sin(time * 8) * 0.05;
        } else if (animationState === 'waving') {
            // Slight rotation for waving
            meshRef.current.rotation.z = Math.sin(time * 4) * 0.1;
        } else {
            // Subtle idle breathing
            meshRef.current.position.y = position[1] + Math.sin(time * 2) * 0.02;
            meshRef.current.rotation.z = 0;
        }
    });

    if (isCurrentUser) {
        return (
            <group position={position}>
                {/* Glowing ground indicator */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.59, 0]}>
                    <ringGeometry args={[0.2, 0.28, 32]} />
                    <meshBasicMaterial color="#00FFD4" transparent opacity={0.6} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.58, 0]}>
                    <circleGeometry args={[0.2, 32]} />
                    <meshBasicMaterial color="#00FFD4" transparent opacity={0.2} />
                </mesh>

                {/* Visible hands at bottom */}
                <group position={[0, -0.8, 0.5]}>
                    <Sphere args={[0.05, 12, 12]} position={[-0.18, 0, 0]}>
                        <meshStandardMaterial color={colors.skin} roughness={0.6} metalness={0.1} />
                    </Sphere>
                    <Sphere args={[0.05, 12, 12]} position={[0.18, 0, 0]}>
                        <meshStandardMaterial color={colors.skin} roughness={0.6} metalness={0.1} />
                    </Sphere>
                </group>
            </group>
        );
    }

    // Enhanced full avatar for other players
    return (
        <group ref={meshRef} position={position}>
            {/* Body with better shape */}
            <mesh position={[0, 0.15, 0]}>
                <capsuleGeometry args={[0.08, 0.25, 8, 16]} />
                <meshStandardMaterial color={colors.body} roughness={0.7} metalness={0.3} />
            </mesh>

            {/* Head with better lighting */}
            <Sphere args={[0.08, 16, 16]} position={[0, 0.4, 0]}>
                <meshStandardMaterial color={colors.skin} roughness={0.5} metalness={0.1} />
            </Sphere>

            {/* Eyes */}
            <Sphere args={[0.012, 8, 8]} position={[-0.025, 0.42, 0.07]}>
                <meshStandardMaterial color="#2C3E50" />
            </Sphere>
            <Sphere args={[0.012, 8, 8]} position={[0.025, 0.42, 0.07]}>
                <meshStandardMaterial color="#2C3E50" />
            </Sphere>

            {/* Username with background */}
            <group position={[0, 0.65, 0]}>
                <mesh>
                    <planeGeometry args={[username.length * 0.08 + 0.1, 0.15]} />
                    <meshBasicMaterial color="#000000" transparent opacity={0.6} />
                </mesh>
                <Text
                    position={[0, 0, 0.01]}
                    fontSize={0.08}
                    color="#FFFFFF"
                    anchorX="center"
                    anchorY="middle"
                >
                    {username}
                </Text>
            </group>

            {/* Action indicator */}
            {currentAction === 'viewing_product' && (
                <group position={[0, 0.85, 0]}>
                    <Text
                        fontSize={0.06}
                        color="#FFD700"
                        anchorX="center"
                        anchorY="middle"
                    >
                        🛍️
                    </Text>
                </group>
            )}

            {/* Animated highlight ring - color based on action */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.14, 0.17, 32]} />
                <meshBasicMaterial 
                    color={currentAction === 'viewing_product' ? '#FFD700' : '#64B5F6'} 
                    transparent 
                    opacity={0.5} 
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
}> = ({ product, position, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const meshRef = useRef<THREE.Mesh>(null);

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
        if (meshRef.current && hovered) {
            meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
        }
    });

    return (
        <group position={position}>
            {/* Product box with rounded edges */}
            <RoundedBox
                ref={meshRef}
                args={[0.38, 0.45, 0.22]}
                radius={0.02}
                smoothness={4}
                userData={meshUserData}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {texture ? (
                    <meshStandardMaterial
                        map={texture}
                        emissive={hovered ? '#FFD700' : '#000'}
                        emissiveIntensity={hovered ? 0.4 : 0}
                        roughness={0.5}
                        metalness={0.1}
                    />
                ) : (
                    <meshStandardMaterial
                        color={hovered ? '#FFE4B5' : '#FFFFFF'}
                        roughness={0.3}
                        metalness={0.2}
                    />
                )}
            </RoundedBox>

            {/* Glow effect when hovered */}
            {hovered && (
                <pointLight position={[0, 0, 0.3]} intensity={0.5} color="#FFD700" distance={1} />
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

// Enhanced Shelf with modern design
const Shelf: React.FC<{
    position: [number, number, number];
    rotation?: [number, number, number];
    products: Product[];
    productsPerRow: number;
    productSpacingX: number;
    productSpacingY: number;
    maxProductsPerShelf: number;
    onProductClick: (product: Product) => void;
}> = ({
    position,
    rotation = [0, 0, 0],
    products,
    productsPerRow,
    productSpacingX,
    productSpacingY,
    maxProductsPerShelf,
    onProductClick,
}) => {
    const visibleProducts = products.slice(0, maxProductsPerShelf);
    const shelfRows = Math.max(1, Math.ceil(maxProductsPerShelf / productsPerRow));
    const shelfWidth = Math.max(2.6, (productsPerRow - 1) * productSpacingX + 1.1);
    const shelfHeight = Math.max(1.8, (shelfRows - 1) * productSpacingY + 0.8);

    return (
        <group position={position} rotation={rotation}>
            {/* Modern shelf design */}
            {Array.from({ length: shelfRows }, (_, idx) => idx * productSpacingY).map((y, idx) => (
                <group key={idx}>
                    <RoundedBox args={[shelfWidth, 0.06, 0.65]} radius={0.02} position={[0, y, 0]}>
                        <meshStandardMaterial color="#6D4C41" roughness={0.6} metalness={0.2} />
                    </RoundedBox>
                </group>
            ))}

            {/* Back panel with gradient effect */}
            <mesh position={[0, shelfHeight / 2, -0.32]}>
                <planeGeometry args={[shelfWidth, shelfHeight + 0.9]} />
                <meshStandardMaterial color="#F5F5DC" roughness={0.8} />
            </mesh>

            {/* Shelf lighting */}
            <pointLight position={[0, shelfHeight + 0.7, 0.3]} intensity={0.3} color="#FFFFFF" distance={3} />

            {/* Products */}
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
                        position={[x, y, 0.25]}
                        onClick={() => onProductClick(product)}
                    />
                );
            })}
        </group>
    );
};

// Optimized Player Controller
const PlayerController: React.FC<{
    onTransformUpdate: (
        position: [number, number, number],
        rotation: [number, number, number],
        isMoving: boolean
    ) => void;
    collisionBoxes: Array<{ x: number; z: number; w: number; d: number }>;
}> = ({ onTransformUpdate, collisionBoxes }) => {
    const { camera } = useThree();
    const wasMoving = useRef(false);
    const moveState = useRef({
        forward: false,
        backward: false,
        left: false,
        right: false,
    });

    const checkCollision = useCallback((pos: THREE.Vector3) => {
        if (Math.abs(pos.x) > 19 || Math.abs(pos.z) > 19) return true;

        for (const box of collisionBoxes) {
            const halfW = box.w / 2;
            const halfD = box.d / 2;
            if (
                pos.x > box.x - halfW && pos.x < box.x + halfW &&
                pos.z > box.z - halfD && pos.z < box.z + halfD
            ) {
                return true;
            }
        }
        return false;
    }, [collisionBoxes]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const state = moveState.current;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') state.forward = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') state.backward = true;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') state.right = true;
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const state = moveState.current;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') state.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') state.backward = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') state.right = false;
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useFrame((_, delta) => {
        const state = moveState.current;
        const speed = 5.5;
        const direction = new THREE.Vector3(
            Number(state.right) - Number(state.left),
            0,
            Number(state.backward) - Number(state.forward)
        );

        const rotation: [number, number, number] = [
            camera.rotation.x,
            camera.rotation.y,
            camera.rotation.z,
        ];

        if (direction.length() > 0) {
            direction.normalize();

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

            const movement = new THREE.Vector3();
            movement.addScaledVector(forward, -direction.z * speed * delta);
            movement.addScaledVector(right, direction.x * speed * delta);

            const nextPos = camera.position.clone().add(movement);
            if (!checkCollision(nextPos)) {
                camera.position.add(movement);
            }

            camera.position.y = 1.6;
            onTransformUpdate([camera.position.x, camera.position.y, camera.position.z], rotation, true);
            wasMoving.current = true;
            return;
        }

        if (wasMoving.current) {
            camera.position.y = 1.6;
            onTransformUpdate([camera.position.x, camera.position.y, camera.position.z], rotation, false);
            wasMoving.current = false;
        }
    });

    return null;
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
    const [currentUserPosition, setCurrentUserPosition] = useState<[number, number, number]>([0, 1.6, 12]);
    const lastUpdateTime = useRef(0);
    
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
        isMoving: boolean
    ) => {
        const now = Date.now();
        // Update at ~60fps
        if (now - lastUpdateTime.current > 16) {
            lastUpdateTime.current = now;
            setCurrentUserPosition(position);

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

            // Find closest product
            let nearest: Product | null = null;
            let minDist = 2.5;

            productWorldPositions.forEach(({ product, position: productPosition }) => {
                const productX = productPosition[0];
                const productZ = productPosition[2];

                const dist = Math.sqrt(
                    Math.pow(position[0] - productX, 2) +
                    Math.pow(position[2] - productZ, 2)
                );

                if (dist < minDist) {
                    nearest = product;
                    minDist = dist;
                }
            });

            onClosestProductChange?.(nearest);
        }
    }, [presenceManager, productWorldPositions, onClosestProductChange]);

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
            {/* Enhanced Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
            <pointLight position={[0, 4, 0]} intensity={0.4} color="#FFF8E1" />
            <hemisphereLight args={['#87CEEB', '#F5F5DC', 0.3]} />

            {/* Premium Floor with pattern */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial 
                    color="#FAFAFA" 
                    roughness={0.8}
                    metalness={0.1}
                />
            </mesh>

            {/* Floor grid pattern */}
            <gridHelper args={[40, 40, '#E0E0E0', '#F5F5F5']} position={[0, 0.01, 0]} />

            {/* Modern Walls */}
            <RoundedBox args={[40, 7, 0.4]} radius={0.1} position={[0, 3.5, -20]}>
                <meshStandardMaterial color="#ECEFF1" roughness={0.7} />
            </RoundedBox>
            <RoundedBox args={[0.4, 7, 40]} radius={0.1} position={[-20, 3.5, 0]}>
                <meshStandardMaterial color="#ECEFF1" roughness={0.7} />
            </RoundedBox>
            <RoundedBox args={[0.4, 7, 40]} radius={0.1} position={[20, 3.5, 0]}>
                <meshStandardMaterial color="#ECEFF1" roughness={0.7} />
            </RoundedBox>

            {/* Store Name Sign */}
            <group position={[0, 5, -19.5]}>
                <mesh>
                    <planeGeometry args={[8, 1.2]} />
                    <meshBasicMaterial color={storeTheme.accentColor} />
                </mesh>
                <Text
                    position={[0, 0, 0.1]}
                    fontSize={0.5}
                    color="#FFFFFF"
                    anchorX="center"
                    anchorY="middle"
                    fontWeight="bold"
                >
                    {storeTheme.name}
                </Text>
            </group>

            {/* Modern Checkout Counter */}
            <group
                position={[0, 0.7, -15]}
                onClick={(event) => {
                    event.stopPropagation();
                    onCheckoutCounterClick?.();
                }}
            >
                <RoundedBox args={[7, 1.4, 2.2]} radius={0.08}>
                    <meshStandardMaterial color={storeTheme.accentColor} roughness={0.4} metalness={0.3} />
                </RoundedBox>
                <Text position={[0, 1.3, 0]} fontSize={0.45} color="#FFFFFF" anchorX="center" fontWeight="bold">
                    CHECKOUT
                </Text>
                <Text position={[0, 0.7, 1.2]} fontSize={0.22} color="#FFFFFF" anchorX="center" fontWeight="bold">
                    Click Counter
                </Text>
                <pointLight position={[0, 1.5, 0.5]} intensity={0.6} color="#FFD700" distance={4} />
            </group>

            {/* Decorative Fountain */}
            <group position={[0, 0, 8]}>
                <Cylinder args={[1.8, 2, 0.6, 32]} position={[0, 0.3, 0]}>
                    <meshStandardMaterial color="#90CAF9" roughness={0.2} metalness={0.5} />
                </Cylinder>
                <Sphere args={[0.3, 16, 16]} position={[0, 0.8, 0]}>
                    <meshStandardMaterial color="#64B5F6" emissive="#2196F3" emissiveIntensity={0.3} />
                </Sphere>
                <pointLight position={[0, 1, 0]} intensity={0.8} color="#64B5F6" distance={5} />
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
                />
            ))}

            {/* Current User */}
            <Avatar 
                position={currentUserPosition} 
                username="You" 
                isCurrentUser 
                customization={avatarCustomization} 
            />

            {/* Other Online Shoppers */}
            {onlineUsers.map((user) => (
                <Avatar
                    key={user.user_id}
                    position={user.position}
                    username={user.username}
                    customization={user.avatar_customization}
                    animationState={user.animation_state}
                    currentAction={user.current_action}
                />
            ))}

            {/* Controls */}
            <PlayerController onTransformUpdate={handleTransformUpdate} collisionBoxes={collisionBoxes} />
            <PointerLockControls />
        </>
    );
};