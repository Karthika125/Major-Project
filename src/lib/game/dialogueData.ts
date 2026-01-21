export interface DialogueNode {
    id: string;
    speaker: string;
    text: string;
    next?: string;
    action?: string;
}

export interface DialogueTree {
    [key: string]: DialogueNode;
}

export const guardDialogue: DialogueTree = {
    welcome: {
        id: 'welcome',
        speaker: 'Security Guard',
        text: 'Welcome to our virtual store! I\'m here to help you get started.',
        next: 'controls'
    },
    controls: {
        id: 'controls',
        speaker: 'Security Guard',
        text: 'Use WASD or arrow keys to move around, and your mouse to look. Click on products to view their details.',
        next: 'features'
    },
    features: {
        id: 'features',
        speaker: 'Security Guard',
        text: 'You can add items to your cart, chat with other shoppers, and our AI assistant is here to help you find what you need.',
        next: 'directions'
    },
    directions: {
        id: 'directions',
        speaker: 'Security Guard',
        text: 'The store is organized into sections with products on shelves. The checkout area is at the back. Enjoy your shopping!',
        action: 'complete'
    }
};

export function getDialogueNode(nodeId: string): DialogueNode | null {
    return guardDialogue[nodeId] || null;
}

export function getFirstNode(): DialogueNode {
    return guardDialogue.welcome;
}
