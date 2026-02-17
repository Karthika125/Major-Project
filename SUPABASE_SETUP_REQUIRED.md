# 🔧 Supabase Manual Setup for Multiplayer

## ⚠️ IMPORTANT: You MUST do these steps in Supabase Dashboard!

Your database schema is ready, but Supabase Realtime features must be **manually enabled** in the dashboard. Follow these steps carefully.

---

## 📋 Pre-Flight Checklist

Before starting, ensure you have:
- ✅ A Supabase project created
- ✅ Environment variables in `.env.local`:
  ```env
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```
- ✅ **Email confirmation DISABLED** (see Step 0 below)

---

## 🚨 STEP 0: Disable Email Confirmation (CRITICAL!)

**Must do this FIRST or signup will fail with 500 error!**

1. Go to **Authentication** → **Providers**
2. Click on **"Email"** provider
3. **UNCHECK** "Confirm email"
4. Click **Save**

**Why:** Without SMTP configured, email confirmation causes signup to fail.

**Alternative:** Configure SMTP (see [FIX_SIGNUP_ERROR.md](FIX_SIGNUP_ERROR.md)) or run `supabase/auto_create_user_profile.sql`

---

## 🚀 Step-by-Step Setup

### 1. **Enable Realtime (CRITICAL!)** ⚡

This is **required** for multiplayer to work.

1. Go to: [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Navigate to **Database** → **Replication**
4. Find these tables and **enable Realtime**:
   - ✅ `user_presence`
   - ✅ `chat_messages`

**How to enable:**
- Click on each table name
- Toggle **"Enable Realtime"** to ON
- You should see a green checkmark

**Why:** This allows Supabase to broadcast INSERT/UPDATE/DELETE events to connected clients.

---

### 2. **Enable Presence (NEW FEATURE!)** 👥

Supabase Presence is a newer feature that powers real-time player tracking.

1. In your Supabase Dashboard
2. Go to **Settings** → **API**
3. Scroll to **Realtime** section
4. Ensure **"Presence"** is **enabled**

**Note:** This feature might be in beta or require enabling in project settings. If you don't see it:
- Check: **Project Settings** → **Add-ons**
- Or contact Supabase support to enable it

---

### 3. **Verify Database Schema** 📊

Ensure your tables exist with correct structure:

1. Go to **Database** → **Tables**
2. Verify these tables exist:
   - ✅ `users`
   - ✅ `products`
   - ✅ `user_presence`
   - ✅ `chat_messages`

**If tables are missing:**

```bash
# Run this in Supabase SQL Editor
# (Dashboard → SQL Editor → New Query)

# Copy the contents of supabase/schema.sql and execute it
```

**To verify `user_presence` table structure:**

```sql
-- Run this in SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_presence';
```

**Expected columns:**
- `user_id` (uuid)
- `username` (text)
- `position_x` (real/float)
- `position_y` (real/float)
- `direction` (text)
- `is_moving` (boolean)
- `last_seen` (timestamp with time zone)

---

### 4. **Verify RLS Policies** 🔒

Row Level Security must allow read/write for multiplayer.

1. Go to **Authentication** → **Policies**
2. Find table: `user_presence`
3. Verify these policies exist:
   - ✅ **SELECT** - "User presence is viewable by everyone"
   - ✅ **INSERT** - "Users can insert own presence"
   - ✅ **UPDATE** - "Users can update own presence"
   - ✅ **DELETE** - "Users can delete own presence"

**Test RLS:**

```sql
-- Run as authenticated user in SQL Editor
SELECT * FROM user_presence;  -- Should work
```

**If policies are missing, add them:**

```sql
-- User presence SELECT (everyone can see)
CREATE POLICY "User presence is viewable by everyone" 
ON public.user_presence FOR SELECT 
USING (true);

-- User presence INSERT (users can insert their own)
CREATE POLICY "Users can insert own presence" 
ON public.user_presence FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- User presence UPDATE (users can update their own)
CREATE POLICY "Users can update own presence" 
ON public.user_presence FOR UPDATE 
USING (auth.uid() = user_id);

-- User presence DELETE (users can delete their own)
CREATE POLICY "Users can delete own presence" 
ON public.user_presence FOR DELETE 
USING (auth.uid() = user_id);
```

**Same for `chat_messages`:**

```sql
-- Chat messages SELECT (everyone can read)
CREATE POLICY "Chat messages are viewable by everyone" 
ON public.chat_messages FOR SELECT 
USING (true);

-- Chat messages INSERT (authenticated users can insert)
CREATE POLICY "Authenticated users can insert chat messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

---

### 5. **Configure Realtime Channels** 📡

Supabase channels must allow broadcasts for proximity chat.

1. Go to **Settings** → **API** → **Realtime**
2. Check **"Enable Realtime"** is ON (master switch)
3. Verify **Max connections** is reasonable (default: 500)

**For free tier:**
- Max connections: 200 concurrent
- Max channels: Unlimited
- This is enough for testing!

---

### 6. **Test Database Connection** 🧪

Run this query in Supabase SQL Editor:

```sql
-- Test INSERT (as authenticated user)
INSERT INTO user_presence (user_id, username, position_x, position_y, direction, is_moving)
VALUES (
  auth.uid(),  -- Your user ID
  'TestUser',
  0,
  0,
  'down',
  false
)
ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW();

-- Should succeed without errors
```

**Then test SELECT:**

```sql
SELECT * FROM user_presence WHERE user_id = auth.uid();
```

**If you get errors:**
- Check if you're logged in (top-right in SQL Editor)
- Verify RLS policies are correct
- Ensure table exists

---

### 7. **Enable CORS (if needed)** 🌐

For local development, ensure CORS is configured:

1. Go to **Settings** → **API** → **CORS**
2. Add `http://localhost:5173` to allowed origins

**For production:**
- Add your production domain (e.g., `https://yourapp.com`)

---

### 8. **Verify Environment Variables** 🔑

In your project root, ensure `.env.local` exists:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Get these values from:**
- Dashboard → **Settings** → **API**
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon/public key** → `VITE_SUPABASE_ANON_KEY`

**⚠️ Never commit `.env.local` to Git!**

---

## ✅ Verification Steps

Run these checks to ensure everything is ready:

### Check 1: Realtime Connection
```javascript
// Open browser console after starting app
supabase.getChannels()
// Should show channels when you enter the store
```

### Check 2: Presence Working
```javascript
// Browser console
const channel = supabase.channel('store-presence');
channel.on('presence', { event: 'sync' }, () => {
  console.log('Presence synced:', channel.presenceState());
});
channel.subscribe();
```

### Check 3: Database Write
```sql
-- SQL Editor
SELECT COUNT(*) FROM user_presence;
-- Should show 0 or more rows
```

---

## 🐛 Common Issues

### Issue 1: "Channel failed to subscribe"
**Solution:**
- Verify Realtime is enabled globally
- Check table Replication is enabled
- Refresh Supabase dashboard

### Issue 2: "RLS policy violation"
**Solution:**
- Verify you're logged in
- Check policies with `SELECT * FROM pg_policies WHERE tablename = 'user_presence';`
- Run the policy creation SQL above

### Issue 3: "Connection limit exceeded"
**Solution:**
- Free tier limit: 200 concurrent connections
- Close unused browser tabs
- Upgrade plan if needed

### Issue 4: "Presence state not syncing"
**Solution:**
- Ensure Presence feature is enabled in Settings → API
- Check browser console for errors
- Verify Realtime is enabled

---

## 📊 Monitoring Dashboard

Track multiplayer activity in Supabase:

1. **Realtime Inspector**
   - Dashboard → **Database** → **Realtime Inspector**
   - See live connections and message flow

2. **Logs**
   - Dashboard → **Logs** → **Realtime**
   - Debug connection issues

3. **API Logs**
   - Dashboard → **Logs** → **API**
   - Monitor database operations

---

## 🚦 Quick Start After Setup

Once everything is configured:

```bash
# Terminal
npm run dev
```

Open browser console and look for:
```
✅ Presence channel connected
✅ Chat channel connected
👥 X other player(s) online
```

---

## 📞 Need Help?

If you're stuck:

1. **Check Supabase Status**: https://status.supabase.com
2. **Supabase Discord**: https://discord.supabase.com
3. **Review logs**: Dashboard → Logs → Realtime
4. **Check this repo's issues**: [GitHub Issues](https://github.com/Karthika125/Major-Project/issues)

---

## ✨ Summary Checklist

Before testing multiplayer, confirm:

- [ ] Realtime enabled globally (Settings → API)
- [ ] Presence feature enabled
- [ ] `user_presence` table has Realtime enabled (Replication)
- [ ] `chat_messages` table has Realtime enabled (Replication)
- [ ] RLS policies exist and are correct
- [ ] Environment variables set in `.env.local`
- [ ] CORS configured for localhost
- [ ] Database schema applied (tables exist)
- [ ] Test query successful in SQL Editor

**Once all checked, you're ready to test! 🎉**

---

## 🎯 Next: Test It!

After completing setup, follow [MULTIPLAYER_GUIDE.md](MULTIPLAYER_GUIDE.md) to test with multiple browser tabs.

Good luck! 🚀
