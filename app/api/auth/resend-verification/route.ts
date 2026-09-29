import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ message: 'If the account exists, instructions will be sent.' }); }
