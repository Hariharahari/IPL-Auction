import { NextRequest, NextResponse } from 'next/server';
import { upsertDbUser, getUserSessions } from '@/server/dbService';
import { isSuperAdminEmail } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const isSuperAdmin = isSuperAdminEmail(cleanEmail);

    const user = await upsertDbUser(cleanName, cleanEmail);
    const sessions = await getUserSessions(cleanEmail, isSuperAdmin);

    return NextResponse.json({
      success: true,
      user: {
        id: user?.id || `usr_${Date.now()}`,
        name: user?.name || cleanName,
        email: cleanEmail,
        role: isSuperAdmin ? 'ADMIN' : user?.role || 'USER',
        isAdmin: isSuperAdmin,
      },
      sessions: sessions || [],
    });
  } catch (error: unknown) {
    console.error('Error syncing user session:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync user' },
      { status: 500 }
    );
  }
}
