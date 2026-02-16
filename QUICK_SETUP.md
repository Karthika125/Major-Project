# ⚡ QUICK REFERENCE: Manual Steps Required

## 🚨 DO THIS IN SUPABASE DASHBOARD BEFORE TESTING!

### 0️⃣ Disable Email Confirmation (MUST DO FIRST!)

**Where:** Dashboard → Authentication → Providers → Email

**What:** UNCHECK "Confirm email" → Save

**Why:** Without SMTP, signup fails with 500 error

---

### 1️⃣ Enable Realtime (5 minutes)

**Where:** Dashboard → Database → Replication

**Enable for:**
- ✅ `user_presence` table
- ✅ `chat_messages` table

**How:**
1. Click on table name
2. Toggle "Enable Realtime" to ON
3. Save

---

### 2️⃣ Enable Presence Feature

**Where:** Settings → API → Realtime section

**What:** Toggle "Presence" to **enabled**

*(If you don't see this option, it may already be enabled or contact Supabase support)*

---

### 3️⃣ Verify Environment Variables

**File:** `.env.local` (in project root)

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Get from:** Dashboard → Settings → API

---

### 4️⃣ Test Connection

**Run this in Supabase SQL Editor:**

```sql
SELECT * FROM user_presence;
```

**Expected:** Query runs without errors (may return 0 rows)

---

## ✅ Verification

Run this in terminal:

```bash
./verify-setup.sh
```

**Then test multiplayer:**

1. `npm run dev`
2. Open browser → Login → Enter store
3. Open second tab (incognito) → Login different user → Enter store
4. **You should see each other's avatars!**

---

## 📖 Full Details

See [SUPABASE_SETUP_REQUIRED.md](SUPABASE_SETUP_REQUIRED.md) for complete instructions, troubleshooting, and verification.

---

## 🆘 Quick Troubleshooting

**Problem:** Players don't see each other

**Fix:**
1. Check browser console for "✅ Presence channel connected"
2. Verify Realtime is enabled for `user_presence` table
3. Ensure both users are logged in with different accounts
4. Check Dashboard → Realtime Inspector for active connections

---

**Problem:** "Channel failed to subscribe"

**Fix:**
1. Settings → API → Ensure "Enable Realtime" (master switch) is ON
2. Database → Replication → Enable for `user_presence` and `chat_messages`
3. Refresh Supabase dashboard
4. Restart dev server

---

**Problem:** RLS policy error

**Fix:**
Run in SQL Editor:

```sql
CREATE POLICY "User presence is viewable by everyone" 
ON public.user_presence FOR SELECT 
USING (true);
```

---

## ⏱️ Estimated Setup Time

- **First time:** 10-15 minutes
- **If you know Supabase:** 5 minutes

**Total Steps:** 5 (all in Supabase Dashboard)

---

**That's it! These are the ONLY manual steps needed.** 🎉

Everything else is already implemented in code!
