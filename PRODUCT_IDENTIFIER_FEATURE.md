# Product Identification and Smart Routing System

## Feature Overview

Your metaverse shopping app now includes an intelligent **Product Scanner** feature that allows users to:

1. **Capture or Upload Images** - Use the camera to take a photo of any product or upload an existing image
2. **AI-Powered Identification** - OpenAI Vision API identifies the product and determines its category
3. **Smart Routing** - Automatically directs users to the appropriate section or store based on product type
4. **Discover Similar Products** - Shows relevant products in the identified category

## Components Created

### 1. **ProductIdentifier Component** (`src/components/ProductIdentifier.tsx`)
The main UI component that handles the camera interface, image capture, and result presentation.

**Features:**
- Real-time webcam capture with AR-like scan overlay
- File upload as alternative input method
- Loading states during AI analysis
- Confidence levels (High/Medium/Low)
- Product preview and category badge
- Similar products carousel
- Navigation to relevant stores

**Props:**
```typescript
interface ProductIdentifierProps {
    onClose?: () => void;  // Callback when modal is closed
}
```

### 2. **Vision AI Service** (`src/lib/ai/productVision.ts`)
Handles all communication with OpenAI's Vision API for product identification.

**Key Functions:**
```typescript
identifyProductFromImage(imageBase64: string): Promise<ProductIdentification>
```

**Returns:**
```typescript
interface ProductIdentification {
    objectType: string;      // e.g., "Smartphone", "T-shirt", "Laptop"
    confidence: 'high' | 'medium' | 'low';
    description: string;     // Brief description of the product
    category: string;        // Category for routing
}
```

**Supported Categories:**
- 🖥️ **Electronics** - phones, laptops, tablets, headphones, smartwatches, cameras, etc.
- 👗 **Fashion** - clothing, shoes, hats, bags, accessories like scarves/belts
- 🏠 **Home** - furniture, kitchen appliances, home decor, lighting
- ⚽ **Sports** - athletic equipment, workout gear, sports apparel
- ✨ **Accessories** - watches, jewelry, sunglasses, small items
- 🛒 **Hypermarket** - groceries, general supplies, miscellaneous items
- 🛍️ **Other** - products that don't fit other categories

### 3. **Category Mapping Service** (`src/lib/ai/categoryMapping.ts`)
Maps identified product categories to stores and finds relevant products.

**Key Functions:**
```typescript
// Find a store by category
findStoreByCategory(category: string): Promise<{ id: string; name: string } | null>

// Get all available stores
getAllStores(): Promise<Array<{ id: string; name: string }> | null>

// Find products by category across all stores
findProductsByCategory(category: string): Promise<Array<Product> | null>
```

## Integration Points

### MallPage Integration
The "📸 Scan Product" button has been added to the MallPage header, allowing users to:
1. Click the camera button from the main mall page
2. Scan a product
3. Get automatically routed to the relevant store or product section

**File Modified:** `src/pages/MallPage.tsx`

**Changes:**
- Added `ProductIdentifier` import
- Added `showProductIdentifier` state
- Created camera button in header
- Render modal when triggered

## Usage Guide

### For End Users

1. **Access Scanner:**
   - Click the "📸 Scan Product" button in the MallPage header

2. **Capture Product:**
   - Click "📷 Open Camera" to use device camera
   - Or click "🖼️ Upload Image" to select from device
   - Position product in the scan area (optional - shown as visual guide)
   - Click "📸 Capture" to take the photo

3. **Review Results:**
   - The AI will identify the product
   - See the product name, description, and category
   - Check confidence level of identification

4. **Navigate:**
   - Click "🛍️ Visit [Store Name]" to go to that store
   - Click product cards in "Similar Products" section
   - Click "🔄 Scan Another" to identify another product

### For Developers

#### Basic Implementation

The component is ready to use. Just add the camera button to any page:

```typescript
const [showIdentifier, setShowIdentifier] = useState(false);

<button onClick={() => setShowIdentifier(true)}>
    📸 Scan Product
</button>

{showIdentifier && (
    <ProductIdentifier onClose={() => setShowIdentifier(false)} />
)}
```

#### Using Vision Service Directly

```typescript
import { identifyProductFromImage } from '@/lib/ai/productVision';

const base64Image = imageElement.toDataURL('image/jpeg')
    .replace(/^data:image\/jpeg;base64,/, '');

const result = await identifyProductFromImage(base64Image);
console.log(result.objectType);    // "Smartphone"
console.log(result.category);      // "Electronics"
```

#### Finding Stores and Products

```typescript
import { findStoreByCategory, findProductsByCategory } from '@/lib/ai/categoryMapping';

// Find a store for a category
const store = await findStoreByCategory('Electronics');
if (store) {
    navigate(`/store/${store.id}`);
}

// Find all products in a category
const products = await findProductsByCategory('Fashion');
```

## How It Works

### Product Identification Flow

```
User Image
    ↓
Capture/Upload
    ↓
Convert to Base64
    ↓
OpenAI Vision API
    ↓
Parse Response
    ↓
Normalize Category
    ↓
Find Matching Store
    ↓
Fetch Similar Products
    ↓
Display Results
```

### Category Detection

The AI analyzes:
- Object type and name
- Product characteristics
- Visual indicators (clothing tags, electronics features, etc.)
- Context clues from the image

Then maps it to one of the 7 supported categories using keyword matching and semantic understanding.

## Environment Variables Required

Add to your `.env.local`:

```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## API Costs

**OpenAI Vision API Pricing:**
- Detailed image resolution: $0.01 per image
- High resolution: $0.03 per image

The component uses detailed resolution (1280x720) for better identification at lower cost.

## Browser Compatibility

- ✅ Chrome/Chromium 60+
- ✅ Firefox 55+
- ✅ Safari 14.1+ (iOS 14.5+)
- ✅ Edge 79+

**Note:** Camera access requires HTTPS in production or localhost in development.

## Error Handling

The component handles:
- Missing camera permission → User-friendly message
- Failed API calls → Displays error with retry option
- Invalid responses → Fallback to generic product type
- Network issues → Automatic error display

## Performance Considerations

1. **Image Size:** Automatically compressed to reasonable size for API
2. **API Caching:** Consider caching for frequently scanned items
3. **Concurrent Requests:** Only one identification at a time
4. **Modal Performance:** Uses CSS animations for smooth transitions

## Future Enhancement Ideas

1. **ML Model on Device** - Use TensorFlow.js for local identification before API
2. **Barcode Scanning** - Add QR/barcode detection for instant product lookup
3. **AR Try-On** - Preview products before purchase
4. **Scan History** - Remember recently scanned products
5. **Brand Recognition** - Identify brands and suggest similar alternatives
6. **Price Comparison** - Show prices across different stores
7. **Voice Integration** - Voice-guided scanning experience

## Troubleshooting

**Camera not working?**
- Check browser permissions
- Ensure HTTPS (or localhost for dev)
- Try refresh and re-grant permissions

**AI not identifying correctly?**
- Take clearer photo with good lighting
- Show entire product clearly
- Check for objects in background
- Try a different angle

**No stores found?**
- Create stores with category-related names
- Check store names contain category keywords
- Fallback to browsing all available stores

## Support Files

- `src/components/ProductIdentifier.tsx` - Main component
- `src/components/ProductIdentifier.module.css` - Component styles
- `src/lib/ai/productVision.ts` - Vision AI service
- `src/lib/ai/categoryMapping.ts` - Category and store mapping
- `src/pages/MallPage.tsx` - Integration (updated)
- `src/pages/MallPage.module.css` - MallPage styles (updated)

---

**Created:** March 2026
**Version:** 1.0.0
**Status:** Ready for production
