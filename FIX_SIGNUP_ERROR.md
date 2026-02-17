# 🚨 FIXING SIGNUP 500 ERROR

## Problem
```
POST https://ptcehwsycfwfomxnxmcr.supabase.co/auth/v1/signup
Status: 500
x-sb-error-code: unexpected_failure
```

## Root Cause
Supabase Auth requires email confirmation by default, but your project doesn't have SMTP configured.

---

## ✅ SOLUTION 1: Disable Email Confirmation (RECOMMENDED for Development)

### Steps:

1. **Go to Supabase Dashboard**
   - https://app.supabase.com

2. **Navigate to Authentication → Providers**
   - Click on **"Email"** provider

3. **Disable Email Confirmation**
   - Find **"Confirm email"** setting
   - **UNCHECK** "Enable email confirmations"
   - Click **Save**

4. **Test Signup Again**
   - Refresh your app
   - Try signing up
   - Should work immediately!

---

## ✅ SOLUTION 2: Configure SMTP (For Production)

### If you want email confirmations:

1. **Go to Authentication → Settings → SMTP Settings**

2. **Configure your email provider:**

   **Using Gmail:**
   - SMTP Host: `smtp.gmail.com`
   - Port: `587`
   - Username: `your-email@gmail.com`
   - Password: `your-app-password` (not your Gmail password!)
   - [Get App Password](https://support.google.com/accounts/answer/185833)

   **Using SendGrid:**
   - SMTP Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: `your-sendgrid-api-key`

   **Using AWS SES:**
   - SMTP Host: `email-smtp.us-east-1.amazonaws.com`
   - Port: `587`
   - Username: `your-ses-username`
   - Password: `your-ses-password`

3. **Customize Email Templates** (optional)
   - Authentication → Email Templates
   - Customize confirmation email

4. **Test**
   - Sign up with your email
   - Check inbox for confirmation email
   - Click confirmation link

---

## ✅ SOLUTION 3: Auto-Confirm Users (Code-Based Fix)

### Update your signup function:

**Edit:** `src/lib/supabase/client.ts`

Replace the `signUp` function with:

```typescript
export const signUp = async (
    email: string,
    password: string,
    username: string
) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin,
            data: {
                username: username,
            }
        }
    });

    if (error) {
        console.error('Signup error:', error);
        throw error;
    }
    
    if (!data.user) {
        throw new Error("User not returned from signup");
    }

    // Only insert if user is confirmed or confirmation is disabled
    if (data.user.confirmed_at || !data.user.email_confirmed_at) {
        const { error: profileError } = await supabase.from("users").insert({
            id: data.user.id,
            username,
            avatar_type: "default",
        });

        if (profileError) {
            console.error('Profile creation error:', profileError);
            throw profileError;
        }
    } else {
        console.log('⏳ User needs to confirm email before profile is created');
    }

    return data;
};
```

**Then create a trigger in Supabase to auto-create profile on email confirmation:**

Go to **SQL Editor** and run:

```sql
-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, avatar_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'default'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile after signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 🧪 QUICK TEST

After applying **Solution 1** (disabling email confirmation):

1. **Refresh your app**
2. **Try signup again**
3. **Expected:** 
   - ✅ Signup succeeds
   - ✅ Redirects to store/mall
   - ✅ No 500 error

---

## 🐛 Still Not Working?

### Check These:

#### 1. Verify RLS Policies
```sql
-- Run in SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'users';
```

**Expected policies:**
- `Users can insert own profile` - INSERT with `auth.uid() = id`

**If missing, create it:**
```sql
CREATE POLICY "Users can insert own profile" 
ON public.users FOR INSERT 
WITH CHECK (auth.uid() = id);
```

#### 2. Check if `users` table exists
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'users';
```

**If missing:**
- Run the full schema from `supabase/schema.sql`

#### 3. Check Auth settings
- Dashboard → Authentication → Settings
- Ensure "Enable signup" is **ON**

#### 4. Check Logs
- Dashboard → Logs → Auth Logs
- Look for specific error details

---

## 📊 Verification Steps

### After Fix:

1. **Clear browser cache/cookies**
2. **Try signup with new email**
3. **Check browser console** for any errors
4. **Check Supabase Dashboard → Authentication → Users**
   - Your new user should appear
5. **Check Database → users table**
   - Profile should be created

---

## 🎯 RECOMMENDED FLOW

**For Development (now):**
```
✅ Solution 1: Disable email confirmation
```

**For Production (later):**
```
✅ Solution 2: Configure SMTP
✅ Solution 3: Add auto-confirm trigger
```

---

## 🆘 Emergency Workaround

If you need to test multiplayer RIGHT NOW:

1. **Go to Dashboard → Authentication → Users**
2. **Click "Invite User"**
3. **Enter email addresses manually**
4. **Set temporary passwords**
5. **Test with those accounts**

Then fix the signup flow later.

---

## 📝 Summary

**FASTEST FIX (2 minutes):**
1. Dashboard → Authentication → Providers → Email
2. Uncheck "Enable email confirmations"
3. Save
4. Try signup again ✅

**This will fix your 500 error immediately!**

---

## Next Steps After Fix

Once signup works:
1. Test with 2 different accounts
2. Both enter the store
3. See each other in multiplayer! 🎉

Need help? Check the error logs in Dashboard → Logs → Auth Logs for specific details.
