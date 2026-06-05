import { SignJWT, jwtVerify } from 'jose';

import { env } from '../../config/env.js';

const accessTokenSecret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);

export async function issueAccessToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, accessTokenSecret);
}
