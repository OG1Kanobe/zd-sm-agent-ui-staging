import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    // Generate a valid token
    const validToken = jwt.sign(
      {
        userId: 'legitimate-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300
      },
      process.env.JWT_SECRET!
    );

    // Tamper with it - change payload but keep signature
    const parts = validToken.split('.');
    
    // Create fake payload with different userId
    const fakePayload = {
      userId: 'HACKER-MODIFIED-THIS',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300
    };
    
    const tamperedPayload = Buffer.from(JSON.stringify(fakePayload))
      .toString('base64url');
    
    // Combine header + tampered payload + original signature
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    return NextResponse.json({
      validToken,
      tamperedToken,
      message: 'The tampered token has a modified payload but original signature - should fail verification'
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}