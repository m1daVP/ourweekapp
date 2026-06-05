import { env } from '../../config/env.js';

export async function revenueCatFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.revenuecat.com/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.REVENUECAT_API_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`RevenueCat request failed: ${response.status}`);
  }

  return response;
}
