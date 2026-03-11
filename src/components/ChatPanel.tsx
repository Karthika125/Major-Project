import React, { useState, useRef } from 'react';
import { useGameStore } from '../lib/store/gameStore';
import type { InputManager } from '../lib/game/InputManager';
import styles from './ChatPanel.module.css';

interface StoreChatManager {
    sendMessage: (message: string) => Promise<void>;
}

interface Props {
    chatManager: StoreChatManager | null;
    inputManager?: InputManager | null;
}

export const ChatPanel: React.FC<Props> = ({ chatManager, inputManager }) => {
    const { chatMessages, isChatOpen, setIsChatOpen } = useGameStore();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !chatManager || sending) return;

        setSending(true);
        try {
            await chatManager.sendMessage(message.trim());
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleFocus = () => {
        // Disable game input when chat is focused
        if (inputManager) {
            inputManager.setEnabled(false);
        }
    };

    const handleBlur = () => {
        // Re-enable game input when chat loses focus
        if (inputManager) {
            inputManager.setEnabled(true);
        }
    };

    if (!isChatOpen) {
        return (
            <button className={styles.toggleButton} onClick={() => setIsChatOpen(true)}>
                💬
            </button>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h3>💬 Chat</h3>
                <button className={styles.closeBtn} onClick={() => setIsChatOpen(false)}>
                    −
                </button>
            </div>

            <div className={styles.messages}>
                {chatMessages.length === 0 ? (
                    <div className={styles.empty}>No messages yet. Say hi to other shoppers!</div>
                ) : (
                    chatMessages.map((msg) => (
                        <div key={msg.id} className={styles.message}>
                            <span className={styles.username}>{msg.username}:</span>
                            <span className={styles.text}>{msg.message}</span>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSend} className={styles.inputForm}>
                <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="Type a message..."
                    maxLength={200}
                    disabled={sending}
                />
                <button type="submit" disabled={!message.trim() || sending}>
                    Send
                </button>
            </form>
        </div>
    );
};
