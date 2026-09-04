const { createClient } = require('@supabase/supabase-js');

let supabaseInstance = null;

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || 
                        process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_PUBLISHABLE_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    if (!supabaseInstance) {
        try {
            supabaseInstance = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
            console.log('[SUPABASE CONFIG] Initialized Supabase client successfully.');
        } catch (err) {
            console.error('[SUPABASE CONFIG] Failed to initialize Supabase client:', err.message);
            return null;
        }
    }
    return supabaseInstance;
}

module.exports = {
    get supabase() {
        return getSupabaseClient();
    },
    getSupabaseClient
};
