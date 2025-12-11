import { NextRequest, NextResponse } from 'next/server';
import { decryptApiKey } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    const { encryptedValue } = await req.json();
    
    if (!encryptedValue) {
      return NextResponse.json(
        { error: 'Missing encryptedValue' }, 
        { status: 400 }
      );
    }
    
    // Decrypt using your existing encryption utility
    const decrypted = decryptApiKey(encryptedValue);
    
    return NextResponse.json({ 
      success: true,
      decryptedValue: decrypted 
    });
    
  } catch (error) {
    console.error('[Decrypt API] Error:', error);
    return NextResponse.json(
      { error: 'Decryption failed' }, 
      { status: 500 }
    );
  }
}