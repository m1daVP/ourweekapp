import fp from 'fastify-plugin';

import { env } from '../config/env.js';
import { createServiceRoleSupabaseClient } from '../shared/supabase/create-service-client.js';

export default fp(async (app) => {
  const supabase = createServiceRoleSupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  app.decorate('supabase', supabase);
});
