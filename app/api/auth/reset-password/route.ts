import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ error: 'database_not_configured' }, { status: 503 }); }
