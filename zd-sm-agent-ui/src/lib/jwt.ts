import jwt from 'jsonwebtoken';

export function generateWebhookToken(userId: string): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const token = jwt.sign(
    {
      userId,
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + (5 * 60) // Expires in 5 minutes
    },
    process.env.JWT_SECRET
  );

  return token;
}

// Optional: Decode token for debugging (doesn't verify signature)
export function decodeToken(token: string) {
  return jwt.decode(token);
}