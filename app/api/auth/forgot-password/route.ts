import { NextResponse } from 'next/server';
export async function POST() {
  // Deliberately generic: do not reveal whether an email exists. Email provider and DB are pending.
  return NextResponse.json({ message: 'If the account exists, instructions will be sent.' });
}
