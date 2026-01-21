import React, { useState, useEffect } from 'react';
import { DialogueNode, getFirstNode, getDialogueNode } from '../lib/game/dialogueData';
import styles from './DialogueSystem.module.css';

interface DialogueSystemProps {
    onComplete: () => void;
    onSkip: () => void;
    autoStart?: boolean;
}

export const DialogueSystem: React.FC<DialogueSystemProps> = ({ onComplete, onSkip, autoStart = true }) => {
    const [currentNode, setCurrentNode] = useState<DialogueNode | null>(null);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [canContinue, setCanContinue] = useState(false);

    useEffect(() => {
        if (autoStart) {
            setCurrentNode(getFirstNode());
        }
    }, [autoStart]);

    useEffect(() => {
        if (!currentNode) return;

        setIsTyping(true);
        setCanContinue(false);
        setDisplayedText('');

        const text = currentNode.text;
        let currentIndex = 0;

        const typingInterval = setInterval(() => {
            if (currentIndex < text.length) {
                setDisplayedText(text.slice(0, currentIndex + 1));
                currentIndex++;
            } else {
                setIsTyping(false);
                setCanContinue(true);
                clearInterval(typingInterval);
            }
        }, 30);

        return () => clearInterval(typingInterval);
    }, [currentNode]);

    const handleContinue = () => {
        if (!currentNode) return;

        if (isTyping) {
            // Skip typing animation
            setDisplayedText(currentNode.text);
            setIsTyping(false);
            setCanContinue(true);
            return;
        }

        if (currentNode.action === 'complete') {
            onComplete();
            return;
        }

        if (currentNode.next) {
            const nextNode = getDialogueNode(currentNode.next);
            if (nextNode) {
                setCurrentNode(nextNode);
            } else {
                onComplete();
            }
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onSkip();
    };

    if (!currentNode) return null;

    return (
        <div className={styles.dialogueContainer}>
            <div className={styles.dialogueBox}>
                <div className={styles.speakerSection}>
                    <div className={styles.speakerAvatar}>👮</div>
                    <div className={styles.speakerName}>{currentNode.speaker}</div>
                </div>

                <div className={styles.textSection}>
                    <p className={styles.dialogueText}>{displayedText}</p>
                </div>

                <div className={styles.controlsSection}>
                    <button
                        className={styles.skipButton}
                        onClick={handleSkip}
                        title="Skip introduction"
                    >
                        Skip
                    </button>
                    <button
                        className={`${styles.continueButton} ${canContinue ? styles.active : ''}`}
                        onClick={handleContinue}
                        disabled={!canContinue && !isTyping}
                    >
                        {isTyping ? 'Click to skip typing...' : 'Continue →'}
                    </button>
                </div>
            </div>
        </div>
    );
};
