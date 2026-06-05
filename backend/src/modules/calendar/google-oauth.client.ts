import { google } from 'googleapis';

import { env } from '../../config/env.js';

export const googleOAuthClient = new google.auth.OAuth2(
  env.GOOGLE_OAUTH_CLIENT_ID,
  env.GOOGLE_OAUTH_CLIENT_SECRET,
  env.GOOGLE_OAUTH_REDIRECT_URI,
);
