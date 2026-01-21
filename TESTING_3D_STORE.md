# Testing the 3D Store Experience

## How to Test

1. **Start the Development Server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Navigate to a Store**:
   - Go to http://localhost:5173 (or your dev server URL)
   - Login if needed
   - Click on any store from the mall (e.g., H&M, ZARA, Nike)

3. **Experience the Entrance**:
   - You'll see a 3D entrance gate with a security guard
   - The guard will automatically start talking
   - Read through the dialogue (or click "Skip" to bypass)
   - Click "Continue →" to proceed through the dialogue

4. **Enter the Store**:
   - After completing the dialogue, you'll transition to the 3D store
   - You'll see the message "Entering store..."

5. **Navigate in 3D**:
   - **W** - Move forward
   - **S** - Move backward
   - **A** - Strafe left
   - **D** - Strafe right
   - **Mouse** - Look around (click to enable pointer lock if needed)
   - **ESC** - Release mouse pointer

6. **Interact with Products**:
   - Move close to a shelf
   - Hover over products (they'll glow gold)
   - Click on a product to view details
   - The product modal will open just like before

7. **Test Existing Features**:
   - Click the cart icon to view your cart
   - Use the chat panel to send messages
   - Click the AI assistant icon for help
   - Try the camera style advisor (📸 button)
   - Customize your avatar (🎨 button)

8. **Return to Mall**:
   - Click "← Back to Mall" button in top-left

## What to Look For

### ✅ Entrance Scene
- [ ] 3D entrance gate visible
- [ ] Security guard NPC at gate
- [ ] Dialogue box appears at bottom
- [ ] Typing animation works
- [ ] Can skip dialogue
- [ ] Smooth transition to store

### ✅ 3D Store
- [ ] Can move with WASD
- [ ] Mouse look works smoothly
- [ ] Products visible on shelves
- [ ] Products glow when hovered
- [ ] Click opens product modal
- [ ] Instructions overlay visible at bottom

### ✅ UI Overlays
- [ ] HUD shows at top
- [ ] Cart panel accessible
- [ ] Chat panel works
- [ ] Quick action buttons visible
- [ ] All modals still function

### ✅ Performance
- [ ] Smooth 60fps movement
- [ ] No lag when looking around
- [ ] Products load quickly
- [ ] Transitions are smooth

## Troubleshooting

### If you see errors:
1. Make sure all dependencies installed: `npm install`
2. Clear browser cache and reload
3. Check console for errors (F12)

### If pointer lock doesn't work:
- Click anywhere in the 3D store view
- Browser will request pointer lock permission
- Press ESC to release pointer

### If products don't appear:
- Check that products are loaded in database
- Look at browser console for errors
- Verify Supabase connection

### If entrance doesn't show:
- Check that `currentScene` state is 'entrance'
- Look for console errors
- Try refreshing the page

## Expected Behavior

1. **First Visit**: Entrance → Dialogue → Store
2. **Subsequent Visits**: Entrance → Dialogue → Store (same flow every time)
3. **Product Interaction**: Hover → Glow → Click → Modal
4. **Movement**: Smooth, bounded within store walls
5. **All Features**: Cart, chat, AI assistant all work as before

## Demo Flow

```
Login → Mall → Select Store → 
  ↓
Entrance Scene (3D gate + guard) →
  ↓
Dialogue (welcome + instructions) →
  ↓
Transition →
  ↓
3D Store (WASD + mouse navigation) →
  ↓
Browse Products (click to view) →
  ↓
Add to Cart → Checkout
```

## Screenshots to Take

1. Entrance gate with security guard
2. Dialogue system in action
3. 3D store interior view
4. Product hover effect
5. Product modal open
6. Full UI with all overlays

Enjoy the immersive 3D shopping experience! 🎮🛍️
