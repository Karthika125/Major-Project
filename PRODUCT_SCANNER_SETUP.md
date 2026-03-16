# Quick Setup Guide - Product Scanner Feature

## ✅ What's Installed

Your metaverse shopping app now has a complete **Product Scanner** system with:
- 📸 Real-time camera capture interface
- 🤖 AI-powered product identification (OpenAI Vision API)
- 🎯 Smart automatic routing to relevant stores
- 📦 Similar product discovery
- ⚡ Full error handling and user feedback

## 🚀 Getting Started (3 Steps)

### Step 1: Set OpenAI API Key

Add your OpenAI API key to `.env.local`:

```env
VITE_OPENAI_API_KEY=sk-your-key-here
```

**Don't have an API key?**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and paste it into `.env.local`

**Pricing:** ~$0.01 per product scan (detailed image resolution)

### Step 2: Restart Dev Server

If your dev server is running, restart it:
```bash
# Terminal: Stop the current server (Ctrl+C)
# Then run:
npm run dev
```

### Step 3: Test the Feature

1. Navigate to the Mall Page
2. Click the **"📸 Scan Product"** button in the top header
3. Choose:
   - **"📷 Open Camera"** to capture with your device camera
   - **"🖼️ Upload Image"** to select from your computer
4. Position a product in view and capture
5. Watch as AI identifies the product and routes you to the appropriate store!

## 📖 How It Works

```
Product Image
    ↓
Webcam Capture or File Upload
    ↓
AI Analysis (OpenAI Vision)
    ↓
Category Detection
    ↓
Store Matching
    ↓
Automatic Navigation
```

### Example Flows

**You scan a smartphone:**
- Identified as: "Smartphone" 
- Category: "Electronics" 
- Routes to: Electronics Store
- Shows: Related electronics products

**You scan a jacket:**
- Identified as: "Winter Jacket"
- Category: "Fashion"
- Routes to: Fashion Store
- Shows: Related clothing products

**You scan a coffee maker:**
- Identified as: "Coffee Maker"
- Category: "Home"
- Routes to: Home Store
- Shows: Related home appliances

## 🎨 UI Components Created

| Component | Location | Purpose |
|-----------|----------|---------|
| ProductIdentifier | `src/components/ProductIdentifier.tsx` | Modal with camera/upload UI |
| Vision Service | `src/lib/ai/productVision.ts` | OpenAI Vision API integration |
| Category Mapper | `src/lib/ai/categoryMapping.ts` | Store/product discovery |

## 🛒 Supported Categories

| Category | Icon | Examples |
|----------|------|----------|
| Electronics | 🖥️ | Phone, Laptop, Tablet, Headphones |
| Fashion | 👗 | Shirt, Jeans, Shoes, Hat, Bag |
| Home | 🏠 | Furniture, Stove, Lights, Decor |
| Sports | ⚽ | Equipment, Shoes, Yoga Mat |
| Accessories | ✨ | Watch, Jewelry, Sunglasses |
| Hypermarket | 🛒 | Food, General Items |
| Other | 🛍️ | Unknown/Misc Items |

## 🔧 Troubleshooting

### Camera not working?
```
✓ Check browser permission for camera access
✓ Make sure you're using HTTPS (or localhost in dev)
✓ Try a different browser
✓ Refresh the page and try again
```

### AI identification seems off?
```
✓ Take a clearer, better-lit photo
✓ Show the entire product clearly
✓ Minimize background clutter
✓ Try photographing from different angle
```

### "No stores found"?
```
✓ Create stores with category-related names
   (e.g., "Electronics & Gadgets", "Fashion Hub")
✓ Or all users will see a generic store list
```

## 💡 Tips for Best Results

1. **Good Lighting** - Better lighting = better AI recognition
2. **Clear View** - Show the product clearly, minimal background
3. **Center Product** - Position product in center of frame
4. **Different Angles** - If one angle doesn't work, try another
5. **Distinctive Items** - AI works best with recognizable products

## 📱 Browser Support

- ✅ Chrome/Edge 60+
- ✅ Firefox 55+
- ✅ Safari 14.1+ (iOS)
- ❌ Internet Explorer (not supported)

## 🎓 For Developers

### Use the Component

```typescript
import { ProductIdentifier } from '@/components/ProductIdentifier';

// In your component:
const [showScanner, setShowScanner] = useState(false);

return (
  <>
    <button onClick={() => setShowScanner(true)}>
      📸 Scan
    </button>
    {showScanner && (
      <ProductIdentifier onClose={() => setShowScanner(false)} />
    )}
  </>
);
```

### Custom Identification

```typescript
import { identifyProductFromImage } from '@/lib/ai/productVision';

const base64 = imageElement.toDataURL('image/jpeg')
  .replace(/^data:image\/jpeg;base64,/, '');

const result = await identifyProductFromImage(base64);
console.log(result.objectType);   // "Smartphone"
console.log(result.category);     // "Electronics"
console.log(result.confidence);   // "high"
```

## 📊 Cost Estimates

- **Per Scan:** $0.01 (detailed resolution)
- **100 Scans:** $1.00
- **1000 Scans:** $10.00
- **10000 Scans:** $100.00

## 🚀 Next Steps

1. ✅ Test with sample products
2. ✅ Create stores in each category
3. ✅ Add stock/inventory to products
4. ✅ Customize store descriptions
5. Consider future enhancements:
   - Barcode scanning
   - AR product preview
   - Voice guidance
   - Scan history

## 📚 Full Documentation

See `PRODUCT_IDENTIFIER_FEATURE.md` for:
- Complete API documentation
- Component API reference
- Service functions
- Error handling details
- Future enhancement ideas

## ✨ Features Summary

- ✅ Real-time camera capture
- ✅ Image file upload
- ✅ AI product identification
- ✅ Automatic category detection
- ✅ Smart store routing
- ✅ Similar products discovery
- ✅ Confidence levels
- ✅ Error handling with retry
- ✅ Mobile responsive
- ✅ Accessibility support

---

**Ready to scan products?** Click the 📸 button on the Mall page!
