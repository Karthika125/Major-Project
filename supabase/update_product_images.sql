-- Update all products with real image URLs from Unsplash
-- Run this in your Supabase SQL Editor to add images to products

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400' WHERE name = 'Wireless Headphones';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400' WHERE name = 'Smart Watch';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400' WHERE name = 'Running Shoes';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400' WHERE name = 'Yoga Mat';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400' WHERE name = 'Coffee Maker';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400' WHERE name = 'Blender';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400' WHERE name = 'Backpack';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400' WHERE name = 'Sunglasses';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400' WHERE name = 'Laptop Stand';
UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400' WHERE name = 'Water Bottle';
