import React, { useState } from 'react';
import { useGameStore } from '../lib/store/gameStore';
import styles from './AIAssistant.module.css';

export const AIAssistant: React.FC = () => {
    const { isAIAssistantOpen, setIsAIAssistantOpen, products } = useGameStore();
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
        { role: 'assistant', content: 'Hi! I\'m your AI shopping assistant. How can I help you today?' },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Simple rule-based responses (replace with OpenAI API call in production)
            let response = '';

            const lowerInput = userMessage.toLowerCase();

            if (lowerInput.includes('recommend') || lowerInput.includes('suggest')) {
                const randomProducts = products.sort(() => 0.5 - Math.random()).slice(0, 3);
                response = `I recommend checking out these products:\n${randomProducts.map(p => `• ${p.name} - ₹${p.price}`).join('\n')}`;
            } else if (lowerInput.includes('price') || lowerInput.includes('cost')) {
                response = 'Our products range from ₹24.99 to ₹299.99. What category are you interested in?';
            } else if (lowerInput.includes('electronics')) {
                const electronics = products.filter(p => p.category === 'Electronics');
                response = `We have ${electronics.length} electronics items:\n${electronics.map(p => `• ${p.name} - ₹${p.price}`).join('\n')}`;
            } else if (lowerInput.includes('sports')) {
                const sports = products.filter(p => p.category === 'Sports');
                response = `We have ${sports.length} sports items:\n${sports.map(p => `• ${p.name} - ₹${p.price}`).join('\n')}`;
            } else if (lowerInput.includes('help')) {
                response = 'I can help you:\n• Find products by category\n• Get recommendations\n• Answer questions about prices\n• Suggest matching items\n\nJust ask me anything!';
            } else {
                response = 'I\'m here to help! You can ask me about product recommendations, prices, or specific categories like electronics, sports, home, or accessories.';
            }

            setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isAIAssistantOpen) return null;

    return (
        <div className={styles.overlay} onClick={() => setIsAIAssistantOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>🤖 AI Shopping Assistant</h3>
                    <button className={styles.closeBtn} onClick={() => setIsAIAssistantOpen(false)}>
                        ✕
                    </button>
                </div>

                <div className={styles.messages}>
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {loading && (
                        <div className={styles.assistantMessage}>
                            <div className={styles.typing}>
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.inputForm}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask me anything..."
                        disabled={loading}
                    />
                    <button onClick={handleSend} disabled={!input.trim() || loading}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
