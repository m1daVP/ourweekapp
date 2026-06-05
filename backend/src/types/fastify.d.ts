import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '../shared/auth/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }

  interface FastifyRequest {
    auth?: AuthContext;
  }
}
