import { supabase } from './client';

export const PRODUCT_IMAGES_BUCKET = 'product-images';

interface UploadProductImageResult {
    publicUrl: string;
    imagePath: string;
    productId: string;
}

const extractExtension = (file: File): string => {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName) return fromName;

    const fromType = file.type.split('/').pop()?.toLowerCase();
    return fromType || 'jpg';
};

const sanitizeBaseName = (fileName: string): string => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return nameWithoutExt
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'product-image';
};

const extractImagePathFromInput = (imagePathOrUrl: string): string => {
    if (!imagePathOrUrl) return '';

    if (!imagePathOrUrl.startsWith('http')) {
        return imagePathOrUrl;
    }

    const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
    const index = imagePathOrUrl.indexOf(marker);

    if (index === -1) {
        throw new Error('Invalid product image URL for this storage bucket.');
    }

    return imagePathOrUrl.slice(index + marker.length);
};

const assertStoreOwnership = async (storeId: string): Promise<void> => {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
        throw authError;
    }

    if (!authData.user) {
        throw new Error('You must be signed in to upload product images.');
    }

    const untypedClient = supabase as any;
    const { data: store, error: storeError } = await untypedClient
        .from('stores')
        .select('id, owner_id')
        .eq('id', storeId)
        .eq('owner_id', authData.user.id)
        .maybeSingle();

    if (storeError) {
        throw storeError;
    }

    if (!store) {
        throw new Error('Only the store owner can manage product images for this store.');
    }
};

export const uploadProductImage = async (
    file: File,
    storeId: string,
    existingProductId?: string
): Promise<UploadProductImageResult> => {
    if (!file) {
        throw new Error('No image file provided.');
    }

    if (!storeId) {
        throw new Error('storeId is required for product image upload.');
    }

    await assertStoreOwnership(storeId);

    const productId = existingProductId || crypto.randomUUID();
    const extension = extractExtension(file);
    const baseName = sanitizeBaseName(file.name);
    const fileName = `${Date.now()}-${baseName}.${extension}`;
    const imagePath = `${storeId}/${productId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(imagePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || undefined,
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data: publicData } = supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(imagePath);

    if (!publicData.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded image.');
    }

    return {
        publicUrl: publicData.publicUrl,
        imagePath,
        productId,
    };
};

export const deleteProductImage = async (imagePath: string): Promise<void> => {
    if (!imagePath) return;

    const normalizedPath = extractImagePathFromInput(imagePath);
    if (!normalizedPath) return;

    const storeId = normalizedPath.split('/')[0];
    if (!storeId) {
        throw new Error('Invalid image path format. Expected storeId/productId/filename.');
    }

    await assertStoreOwnership(storeId);

    const { error } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .remove([normalizedPath]);

    if (error) {
        throw error;
    }
};
