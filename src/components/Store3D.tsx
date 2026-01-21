import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Box, Text, Sphere, Cylinder, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// Mock types for demonstration
type Product = {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    description?: string;
};

interface Store3DProps {
    products: Product[];
    onProductClick: (product: Product) => void;
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

// Enhanced Avatar Component with better visuals
const Avatar: React.FC<{
    position: [number, number, number];
    username: string;
    isCurrentUser?: boolean;
    customization?: { bodyColor: string; skinTone: string; style: string };
}> = ({ position, username, isCurrentUser = false, customization }) => {
    const colors = {
        body: customization?.bodyColor || '#4A90E2',
        skin: customization?.skinTone || '#FFD1A3',
    };

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
        <group position={position}>
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
                    <planeGeometry args={[username.length * 0.08, 0.15]} />
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

            {/* Animated highlight ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[0.14, 0.17, 32]} />
                <meshBasicMaterial color="#64B5F6" transparent opacity={0.5} />
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

    useEffect(() => {
        if (product.image_url) {
            const loader = new THREE.TextureLoader();
            loader.load(
                product.image_url,
                (tex) => setTexture(tex),
                undefined,
                (err) => console.warn('Image load failed for', product.name)
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
                    ${product.price}
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
    onProductClick: (product: Product) => void;
}> = ({ position, rotation = [0, 0, 0], products, onProductClick }) => {
    return (
        <group position={position} rotation={rotation}>
            {/* Modern shelf design */}
            {[0, 1.0, 2.0].map((y, idx) => (
                <group key={idx}>
                    <RoundedBox args={[4.2, 0.06, 0.65]} radius={0.02} position={[0, y, 0]}>
                        <meshStandardMaterial color="#6D4C41" roughness={0.6} metalness={0.2} />
                    </RoundedBox>
                </group>
            ))}

            {/* Back panel with gradient effect */}
            <mesh position={[0, 1.0, -0.32]}>
                <planeGeometry args={[4.2, 2.6]} />
                <meshStandardMaterial color="#F5F5DC" roughness={0.8} />
            </mesh>

            {/* Shelf lighting */}
            <pointLight position={[0, 2.2, 0.3]} intensity={0.3} color="#FFFFFF" distance={3} />

            {/* Products - 4 per row, 3 rows */}
            {products.slice(0, 12).map((product, idx) => {
                const row = Math.floor(idx / 4);
                const col = idx % 4;
                const x = -1.6 + col * 1.05;
                const y = row * 1.0 + 0.5;

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
    onPositionUpdate: (position: [number, number, number]) => void;
}> = ({ onPositionUpdate }) => {
    const { camera } = useThree();
    const moveState = useRef({
        forward: false,
        backward: false,
        left: false,
        right: false,
    });

    const COLLISION_BOXES = useMemo(() => [
        { x: -6, z: -8, w: 4.5, d: 1.2 },
        { x: 6, z: -8, w: 4.5, d: 1.2 },
        { x: -6, z: 0, w: 4.5, d: 1.2 },
        { x: 6, z: 0, w: 4.5, d: 1.2 },
        { x: 0, z: -15, w: 6.8, d: 2.8 },
        { x: 0, z: 8, w: 4, d: 4 },
    ], []);

    const checkCollision = useCallback((pos: THREE.Vector3) => {
        if (Math.abs(pos.x) > 19 || Math.abs(pos.z) > 19) return true;

        for (const box of COLLISION_BOXES) {
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
    }, [COLLISION_BOXES]);

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
            onPositionUpdate([camera.position.x, camera.position.y, camera.position.z]);
        }
    });

    return null;
};

// Main Store Component
export const Store3D: React.FC<Store3DProps> = ({
    products,
    onProductClick,
    storeTheme,
    avatarCustomization,
    presenceManager,
    onClosestProductChange,
}) => {
    const [currentUserPosition, setCurrentUserPosition] = useState<[number, number, number]>([0, 1.6, 12]);
    const lastUpdateTime = useRef(0);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

    // Simulate other players (replace with actual Supabase data)
    useEffect(() => {
        // Mock data - replace with actual Supabase subscription
        const mockUsers = [
            { user_id: '1', username: 'ShopperAlex', position: [-5, 0, -6] as [number, number, number], avatar_customization: { bodyColor: '#E91E63', skinTone: '#D4A574', style: 'casual' } },
            { user_id: '2', username: 'Sarah_M', position: [7, 0, 2] as [number, number, number], avatar_customization: { bodyColor: '#9C27B0', skinTone: '#F1C27D', style: 'casual' } },
        ];
        setOnlineUsers(mockUsers);
    }, []);

    const shelfProducts = useMemo(() => {
        const perShelf = Math.ceil(products.length / 4);
        return [
            products.slice(0, perShelf),
            products.slice(perShelf, perShelf * 2),
            products.slice(perShelf * 2, perShelf * 3),
            products.slice(perShelf * 3),
        ];
    }, [products]);

    const handlePositionUpdate = useCallback((position: [number, number, number]) => {
        const now = Date.now();
        if (now - lastUpdateTime.current > 100) {
            lastUpdateTime.current = now;
            setCurrentUserPosition(position);

            if (presenceManager) {
                const x2d = position[0] * 20 + 400;
                const y2d = position[2] * 20 + 300;
                presenceManager.updatePosition({
                    position_x: x2d,
                    position_y: y2d,
                    direction: 'down',
                    is_moving: true
                }).catch((err: Error) => console.error('Presence update failed', err));
            }

            // Find closest product
            let nearest: Product | null = null;
            let minDist = 2.5;

            products.forEach((product, idx) => {
                const shelfIdx = Math.floor(idx / Math.ceil(products.length / 4));
                const posInShelf = idx % Math.ceil(products.length / 4);
                const col = posInShelf % 4;

                const shelfPositions = [
                    { x: -6, z: -8 },
                    { x: 6, z: -8 },
                    { x: -6, z: 0 },
                    { x: 6, z: 0 }
                ];

                const shelf = shelfPositions[shelfIdx];
                if (!shelf) return;

                const productX = shelf.x + (-1.6 + col * 1.05);
                const productZ = shelf.z + 0.25;

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
    }, [presenceManager, products, onClosestProductChange]);

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
            <group position={[0, 0.7, -15]}>
                <RoundedBox args={[7, 1.4, 2.2]} radius={0.08}>
                    <meshStandardMaterial color={storeTheme.accentColor} roughness={0.4} metalness={0.3} />
                </RoundedBox>
                <Text position={[0, 1.3, 0]} fontSize={0.45} color="#FFFFFF" anchorX="center" fontWeight="bold">
                    CHECKOUT
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
            <Shelf position={[-6, 0, -8]} products={shelfProducts[0]} onProductClick={onProductClick} />
            <Shelf position={[6, 0, -8]} rotation={[0, Math.PI, 0]} products={shelfProducts[1]} onProductClick={onProductClick} />
            <Shelf position={[-6, 0, 0]} products={shelfProducts[2]} onProductClick={onProductClick} />
            <Shelf position={[6, 0, 0]} rotation={[0, Math.PI, 0]} products={shelfProducts[3]} onProductClick={onProductClick} />

            {/* Current User */}
            <Avatar position={currentUserPosition} username="You" isCurrentUser customization={avatarCustomization} />

            {/* Other Online Shoppers */}
            {onlineUsers.map((user) => (
                <Avatar
                    key={user.user_id}
                    position={user.position}
                    username={user.username}
                    customization={user.avatar_customization}
                />
            ))}

            {/* Controls */}
            <PlayerController onPositionUpdate={handlePositionUpdate} />
            <PointerLockControls />
        </>
    );
};