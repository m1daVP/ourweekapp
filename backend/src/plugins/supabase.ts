import { createClient } from '@supabase/supabase-js';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';

export default fp(async (app) => {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  app.decorate('supabase', supabase);
});
