import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Use environment variables for security
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "Missing Supabase environment variables. Please check your .env.local file."
    );
}

console.log("✅ Using environment variables for Supabase");
console.log("URL:", SUPABASE_URL);

export const supabase: SupabaseClient<Database> = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log("✅ Supabase client created successfully!");

/* ---------------- AUTH HELPERS ---------------- */

export const signUp = async (
    email: string,
    password: string,
    username: string
) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
                username: username,
            }
        }
    });

    if (error) {
        console.error('❌ Signup error:', error);
        throw error;
    }
    
    if (!data.user) {
        throw new Error("User not returned from signup");
    }

    // Check if email confirmation is required
    // If session exists, user is auto-confirmed (email confirmation disabled)
    // If no session, user needs to confirm email
    if (data.session) {
        console.log('✅ User auto-confirmed, creating profile...');
        
        const { error: profileError } = await supabase.from("users").insert({
            id: data.user.id,
            username,
            avatar_type: "default",
        });

        if (profileError) {
            console.error('❌ Profile creation error:', profileError);
            // If profile already exists, that's ok (might be from trigger)
            if (profileError.code !== '23505') { // 23505 = unique violation
                throw profileError;
            }
        }
    } else {
        console.log('⏳ Email confirmation required. Check your email inbox.');
        console.log('💡 To disable: Dashboard → Authentication → Providers → Email → Uncheck "Confirm email"');
    }

    return data;
};

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
};

export const getSession = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
};
