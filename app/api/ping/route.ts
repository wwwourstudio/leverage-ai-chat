import { NextResponse } from 'next/server';

/**
 * Simple ping endpoint to keep sandbox alive and verify it's running
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Sandbox is running'
  });
}
