#!/bin/bash
# Quick Multiplayer Setup Verification Script
# Run this after completing Supabase configuration

echo "🔍 Multiplayer Setup Verification"
echo "=================================="
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "✅ .env.local file exists"
    
    # Check if required vars are set
    if grep -q "VITE_SUPABASE_URL" .env.local && grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
        echo "✅ Supabase environment variables found"
    else
        echo "❌ Missing Supabase environment variables in .env.local"
        echo "   Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
        exit 1
    fi
else
    echo "❌ .env.local file not found!"
    echo "   Create it with:"
    echo "   VITE_SUPABASE_URL=https://your-project.supabase.co"
    echo "   VITE_SUPABASE_ANON_KEY=your-anon-key"
    exit 1
fi

echo ""
echo "✅ Local environment configured"
echo ""
echo "⚠️  MANUAL SUPABASE STEPS REQUIRED:"
echo "0. DISABLE EMAIL CONFIRMATION (CRITICAL!)"
echo "   - Dashboard → Authentication → Providers → Email"
echo "   - UNCHECK 'Confirm email' → Save"
echo ""
echo "1. Enable Realtime in Dashboard → Database → Replication"
echo "   - Enable for: user_presence"
echo "   - Enable for: chat_messages"
echo ""
echo "2. Enable Presence in Settings → API → Realtime"
echo ""
echo "3. Verify RLS policies exist (see SUPABASE_SETUP_REQUIRED.md)"
echo ""
echo "4. Test connection by running: npm run dev"
echo ""
echo "🚨 If signup fails with 500 error, see: FIX_SIGNUP_ERROR.md"
echo "📖 Full instructions: SUPABASE_SETUP_REQUIRED.md"
echo ""
echo "Ready to test? Open 2 browser tabs after starting the dev server!"
