# Product Scanner - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          MallPage                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Header with "📸 Scan Product" Button                    │  │
│  │  Opens: ProductIdentifier Component                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ProductIdentifier Modal                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📸 Camera Capture or 🖼️ Image Upload                   │  │
│  │  Features:                                               │  │
│  │  - Real-time video stream from device camera            │  │
│  │  - AR overlay scan area                                 │  │
│  │  - Canvas for image capture                             │  │
│  │  - File input for uploads                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Convert to Base64
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              productVision.ts (Vision Service)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  identifyProductFromImage()                              │  │
│  │  ├─ Send Base64 image to OpenAI Vision API              │  │
│  │  ├─ Receive product identification                       │  │
│  │  ├─ Parse JSON response                                 │  │
│  │  ├─ Normalize category                                  │  │
│  │  └─ Return ProductIdentification object                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
            OpenAI API Response (JSON Format)
            {
              "objectType": "smartphone",
              "confidence": "high",
              "description": "...",
              "category": "Electronics"
            }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           categoryMapping.ts (Category Service)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Parallel Operations:                                    │  │
│  │                                                          │  │
│  │  findStoreByCategory(category)                          │  │
│  │  ├─ Query Supabase: SELECT * FROM stores               │  │
│  │  ├─ Match store name with category keywords             │  │
│  │  └─ Return best matching store                          │  │
│  │                                                          │  │
│  │  findProductsByCategory(category)                       │  │
│  │  ├─ Query Supabase: SELECT * FROM products             │  │
│  │  ├─ Filter by identified category                       │  │
│  │  ├─ JOIN with stores for store names                    │  │
│  │  └─ Return top 20 relevant products                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
             Store Info + Similar Products
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           Back to ProductIdentifier (Result Display)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Results Section:                                        │  │
│  │  ✓ Product image preview                                │  │
│  │  ✓ Identified object name & description                │  │
│  │  ✓ Confidence level (high/medium/low)                  │  │
│  │  ✓ Category badge (color-coded)                        │  │
│  │  ✓ Related store info                                   │  │
│  │  ✓ 3 similar products carousel                          │  │
│  │  ✓ Action buttons: Visit Store / Scan Again / Close    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                      User Navigation
                    navigate(`/store/${id}`)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       StorePage                                  │
│  User is now browsing the relevant store with products          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Relationship Diagram

```
src/
├── components/
│   ├── ProductIdentifier.tsx ──────┐
│   └── ProductIdentifier.module.css │
│                                    │
├── lib/
│   ├── ai/
│   │   ├── productVision.ts ─────────┼─ Uses
│   │   └── categoryMapping.ts ───────┤
│   │                                 │
│   └── supabase/
│       └── client.ts ────────────────┘
│
└── pages/
    └── MallPage.tsx ───── Imports ProductIdentifier
```

## Data Flow

### Phase 1: Capture
```
User Action
    ↓
Camera Permission (Browser)
    ↓
Video Stream (getUserMedia API)
    ↓
Canvas Capture (toDataURL)
    ↓
Base64 String
```

### Phase 2: Identification
```
Base64 Image
    ↓
OpenAI Vision API Call
    ↓
Parse Response JSON
    ↓
Validate Fields
    ↓
Normalize Category
    ↓
ProductIdentification Object
```

### Phase 3: Discovery
```
Product Category
    ↓
↙────────────────────────────────┘
├────────────────────────────────┐
│                                │
Store Query               Product Query
(Supabase)               (Supabase)
│                                │
Keyword Match            Category Filter
│                                │
Find Store               Array of Products
│                                │
└────────────────────────────────┘
↓
Combine Results
↓
IdentificationResult Object
```

### Phase 4: Display
```
IdentificationResult
    ↓
Render Image
    ↓
Render Product Info
    ↓
Render Confidence Badge
    ↓
Render Category
    ↓
Render Store Button
    ↓
Render Products Carousel
```

## State Management

### ProductIdentifier Component States

```
Initial State
├─ cameraActive: false
├─ isIdentifying: false
├─ result: null
├─ error: null
└─ previewImage: null

Camera Active
├─ cameraActive: true
├─ videoRef: active stream
└─ canvasRef: ready to capture

Processing
├─ isIdentifying: true
├─ previewImage: captured image
└─ Loading spinner visible

Result Ready
├─ result: {
│   identification: ProductIdentification,
│   suggestedStore: { id, name },
│   products: Product[]
│ }
└─ Display results
```

## API Integration

### OpenAI Vision API

```typescript
POST https://api.openai.com/v1/chat/completions

Request:
{
  model: "gpt-4-vision",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: "data:image/jpeg;base64,..."
          }
        },
        {
          type: "text",
          text: "Identify this product..."
        }
      ]
    }
  ],
  max_tokens: 500
}

Response:
{
  choices: [
    {
      message: {
        content: '{
          "objectType": "...",
          "confidence": "...",
          "description": "...",
          "category": "..."
        }'
      }
    }
  ]
}
```

### Supabase Database Queries

```sql
-- Find stores by keyword
SELECT id, store_name FROM stores 
WHERE store_name ILIKE '%keyword%'
ORDER BY created_at DESC;

-- Find products by category
SELECT id, name, store_id, price, image_url, 
       stores(store_name)
FROM products 
WHERE category = 'Electronics'
ORDER BY created_at DESC
LIMIT 20;
```

## Error Handling Strategy

```
Camera Permission Denied
    ↓
Display: "Camera access denied"
    ↓
Show: "Try Chrome/Firefox"
    ↓
Allow: Dismiss and try again

API Failure (Network)
    ↓
Display: "Failed to identify product"
    ↓
Show: Error message
    ↓
Allow: Retry button

Invalid Response
    ↓
Fallback: "Unknown product"
    ↓
Show: Generic category
    ↓
Allow: Try again or browse

No Stores Found
    ↓
Display: "No stores for category"
    ↓
Show: Browse all stores option
    ↓
Allow: Manual selection
```

## Performance Optimization

### Image Processing
- Input: Full resolution image from camera
- Compression: JPEG quality 0.8
- Size: ~100-200KB typically
- API Encoding: Base64 (increases size by ~33%)
- Transmission: ~150-250KB over network

### API Calls
- Parallel Processing: Store query + Product query (not sequential)
- Caching: None by default (could add Redis cache)
- Timeouts: 30s for API, 10s for database
- Rate Limiting: OpenAI API key rate limits apply

### UI Rendering
- Modal: CSS animations for smooth appearance
- Video: Hardware-accelerated rendering
- Canvas: GPU-accelerated capture
- Products: Lazy loading for carousel

## Browser APIs Used

```
✓ navigator.mediaDevices.getUserMedia() - Camera access
✓ HTMLCanvasElement.toDataURL() - Image capture
✓ FileReader API - File upload handling
✓ Blob/Base64 conversion - Image encoding
✓ Fetch API - HTTP requests
✓ localStorage - Potential future caching
```

## Security Considerations

1. **Image Data**: Sent to OpenAI over HTTPS
2. **API Keys**: Stored in environment variables
3. **User Permissions**: Explicitly requested for camera
4. **Data Privacy**: Images not stored locally after processing
5. **CORS**: OpenAI handles CORS for browser requests
6. **Validation**: JSON responses validated before use

---

**Last Updated:** March 2026
**Status:** Production Ready
