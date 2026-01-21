import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Box, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import { DialogueSystem } from './DialogueSystem';
import styles from './EntranceScene.module.css';

interface EntranceSceneProps {
    storeName: string;
    storeTheme: {
        gradient: string;
        accentColor: string;
    };
    onComplete: () => void;
}

// Security Guard NPC Component
const SecurityGuard: React.FC<{ position: [number, number, number] }> = ({ position }) => {
    const guardRef = useRef<THREE.Group>(null);

    return (
        <group ref={guardRef} position={position}>
            {/* Body */}
            <Cylinder args={[0.3, 0.3, 1.5, 8]} position={[0, 0.75, 0]}>
                <meshStandardMaterial color="#2C3E50" />
            </Cylinder>

            {/* Head */}
            <mesh position={[0, 1.8, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#FFD1A3" />
            </mesh>

            {/* Hat */}
            <Cylinder args={[0.35, 0.35, 0.2, 16]} position={[0, 2.2, 0]}>
                <meshStandardMaterial color="#1A252F" />
            </Cylinder>

            {/* Arms */}
            <Cylinder args={[0.1, 0.1, 0.8, 8]} position={[-0.5, 0.9, 0]} rotation={[0, 0, Math.PI / 6]}>
                <meshStandardMaterial color="#2C3E50" />
            </Cylinder>
            <Cylinder args={[0.1, 0.1, 0.8, 8]} position={[0.5, 0.9, 0]} rotation={[0, 0, -Math.PI / 6]}>
                <meshStandardMaterial color="#2C3E50" />
            </Cylinder>

            {/* Badge */}
            <mesh position={[0, 1.2, 0.31]}>
                <circleGeometry args={[0.1, 16]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
};

// Entrance Gate Component
const EntranceGate: React.FC<{ storeName: string; accentColor: string }> = ({ storeName, accentColor }) => {
    return (
        <group position={[0, 0, -3]}>
            {/* Left pillar */}
            <Box args={[0.5, 4, 0.5]} position={[-3, 2, 0]}>
                <meshStandardMaterial color="#9EC6F3" metalness={0.4} roughness={0.5} />
            </Box>

            {/* Right pillar */}
            <Box args={[0.5, 4, 0.5]} position={[3, 2, 0]}>
                <meshStandardMaterial color="#34495E" metalness={0.6} roughness={0.4} />
            </Box>

            {/* Top arch */}
            <Box args={[7, 0.5, 0.5]} position={[0, 4, 0]}>
                <meshStandardMaterial color="#34495E" metalness={0.6} roughness={0.4} />
            </Box>

            {/* Store name sign */}
            <Text
                position={[0, 4.5, 0]}
                fontSize={0.5}
                color={accentColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#000000"
            >
                {storeName}
            </Text>

            {/* Glowing accent lights */}
            <pointLight position={[-3, 3, 0.5]} color={accentColor} intensity={2} distance={5} />
            <pointLight position={[3, 3, 0.5]} color={accentColor} intensity={2} distance={5} />
        </group>
    );
};

// Floor Component
const Floor: React.FC = () => {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial
                color="#FBFBFB"
                metalness={0.1}
                roughness={0.8}
            />
        </mesh>
    );
};

// Main Entrance Scene Component
export const EntranceScene: React.FC<EntranceSceneProps> = ({ storeName, storeTheme, onComplete }) => {
    const [showDialogue, setShowDialogue] = useState(true);
    const [dialogueComplete, setDialogueComplete] = useState(false);

    const handleDialogueComplete = () => {
        setDialogueComplete(true);
        setShowDialogue(false);
        // Wait a moment then transition to store
        setTimeout(() => {
            onComplete();
        }, 500);
    };

    const handleSkip = () => {
        setShowDialogue(false);
        setTimeout(() => {
            onComplete();
        }, 300);
    };

    return (
        <div className={styles.container}>
            <Canvas shadows className={styles.canvas}>
                <PerspectiveCamera makeDefault position={[0, 1.6, 5]} fov={75} />

                {/* Lighting */}
                <ambientLight intensity={0.4} />
                <directionalLight
                    position={[5, 10, 5]}
                    intensity={1}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <pointLight position={[0, 3, 0]} intensity={0.5} color={storeTheme.accentColor} />

                {/* Scene elements */}
                <Floor />
                <EntranceGate storeName={storeName} accentColor={storeTheme.accentColor} />
                <SecurityGuard position={[0, 0, 0]} />

                {/* Fog for atmosphere */}
                <fog attach="fog" args={['#1a1a2e', 10, 30]} />

                {/* Controls - limited movement for entrance */}
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                    target={[0, 1.5, 0]}
                />
            </Canvas>

            {/* Dialogue overlay */}
            {showDialogue && (
                <DialogueSystem
                    onComplete={handleDialogueComplete}
                    onSkip={handleSkip}
                    autoStart={true}
                />
            )}

            {/* Instructions */}
            {!showDialogue && !dialogueComplete && (
                <div className={styles.instructions}>
                    <p>Click and drag to look around</p>
                    <p className={styles.hint}>Dialogue will start automatically...</p>
                </div>
            )}

            {/* Transition message */}
            {dialogueComplete && (
                <div className={styles.transitionMessage}>
                    <p>Entering store...</p>
                </div>
            )}
        </div>
    );
};
