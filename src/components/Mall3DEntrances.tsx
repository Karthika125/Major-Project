import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Box, Cylinder, RoundedBox } from '@react-three/drei';
import styles from './Mall3DEntrances.module.css';

interface MallStoreEntrance {
    id: string;
    name: string;
    description?: string;
}

interface Mall3DEntrancesProps {
    stores: MallStoreEntrance[];
    onEnterStore: (storeId: string) => void;
}

interface EntranceLayout {
    store: MallStoreEntrance;
    position: [number, number, number];
}

const StoreEntrance: React.FC<{
    store: MallStoreEntrance;
    position: [number, number, number];
    isHovered: boolean;
    onHover: (storeId: string | null) => void;
    onEnter: (storeId: string) => void;
}> = ({ store, position, isHovered, onHover, onEnter }) => {
    return (
        <group position={position}>
            <RoundedBox args={[4.4, 0.45, 3.4]} radius={0.08} position={[0, 0.22, 0]}>
                <meshStandardMaterial color="#F8FAFC" />
            </RoundedBox>

            <Box args={[0.4, 3.1, 0.4]} position={[-1.6, 1.8, -0.2]}>
                <meshStandardMaterial color="#94A3B8" metalness={0.2} roughness={0.6} />
            </Box>
            <Box args={[0.4, 3.1, 0.4]} position={[1.6, 1.8, -0.2]}>
                <meshStandardMaterial color="#94A3B8" metalness={0.2} roughness={0.6} />
            </Box>
            <Box args={[3.8, 0.35, 0.4]} position={[0, 3.3, -0.2]}>
                <meshStandardMaterial color="#64748B" metalness={0.25} roughness={0.5} />
            </Box>

            <mesh
                position={[0, 1.8, 0.45]}
                userData={{ storeId: store.id }}
                onPointerOver={() => onHover(store.id)}
                onPointerOut={() => onHover(null)}
                onClick={(event) => {
                    event.stopPropagation();
                    const targetStoreId = String(event.object.userData?.storeId || store.id);
                    onEnter(targetStoreId);
                }}
            >
                <planeGeometry args={[2.4, 2.6]} />
                <meshStandardMaterial
                    color={isHovered ? '#9EC6F3' : '#E2E8F0'}
                    transparent
                    opacity={isHovered ? 0.9 : 0.76}
                    emissive={isHovered ? '#9EC6F3' : '#000000'}
                    emissiveIntensity={isHovered ? 0.2 : 0}
                />
            </mesh>

            <Text
                position={[0, 3.82, 0.02]}
                fontSize={0.28}
                color="#1E293B"
                anchorX="center"
                anchorY="middle"
                maxWidth={3.5}
                textAlign="center"
            >
                {store.name}
            </Text>

            <Text
                position={[0, 1.86, 0.6]}
                fontSize={0.2}
                color="#0F172A"
                anchorX="center"
                anchorY="middle"
            >
                {isHovered ? 'Click to Enter' : 'Store Entrance'}
            </Text>

            {isHovered && <pointLight position={[0, 2.4, 0.7]} intensity={0.8} color="#9EC6F3" distance={4} />}
        </group>
    );
};

export const Mall3DEntrances: React.FC<Mall3DEntrancesProps> = ({ stores, onEnterStore }) => {
    const [hoveredStoreId, setHoveredStoreId] = useState<string | null>(null);

    const layouts = useMemo<EntranceLayout[]>(() => {
        if (stores.length === 0) {
            return [];
        }

        return stores.map((store, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;

            return {
                store,
                position: [
                    (col - 1) * 6.2,
                    0,
                    row * -7,
                ],
            };
        });
    }, [stores]);

    return (
        <div className={styles.wrapper}>
            <Canvas shadows className={styles.canvas}>
                <PerspectiveCamera makeDefault position={[0, 7.4, 13]} fov={55} />

                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[7, 10, 6]}
                    intensity={0.9}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />

                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -5]} receiveShadow>
                    <planeGeometry args={[34, 36]} />
                    <meshStandardMaterial color="#F8FAFC" />
                </mesh>

                <Cylinder args={[0.9, 1.4, 1.2, 32]} position={[0, 0.6, 6]}>
                    <meshStandardMaterial color="#BFDBFE" metalness={0.2} roughness={0.5} />
                </Cylinder>
                <Text
                    position={[0, 1.55, 6]}
                    fontSize={0.35}
                    color="#1E3A8A"
                    anchorX="center"
                    anchorY="middle"
                >
                    3D Mall Entrances
                </Text>

                {layouts.map((layout) => (
                    <StoreEntrance
                        key={layout.store.id}
                        store={layout.store}
                        position={layout.position}
                        isHovered={hoveredStoreId === layout.store.id}
                        onHover={setHoveredStoreId}
                        onEnter={onEnterStore}
                    />
                ))}

                <OrbitControls
                    enablePan={false}
                    enableZoom
                    minDistance={8}
                    maxDistance={19}
                    target={[0, 1.5, -4]}
                    maxPolarAngle={Math.PI / 2.05}
                    minPolarAngle={Math.PI / 4}
                />
            </Canvas>

            <div className={styles.instructions}>
                Click any entrance to load its store.
            </div>
        </div>
    );
};
