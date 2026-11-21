export function formatIndianCurrency(lakhs: number): string {
  if (lakhs === 0) return '₹0';
  if (lakhs >= 100) {
    const crores = lakhs / 100;
    // e.g. 1.5 -> ₹1.50 Cr, 14.25 -> ₹14.25 Cr
    return `₹${crores.toFixed(2)} Cr`;
  }
  return `₹${lakhs.toFixed(0)} L`;
}

export function formatIndianCurrencyDetailed(lakhs: number): string {
  const crores = lakhs / 100;
  if (crores >= 1) {
    return `₹${crores.toFixed(2)} Crore (${lakhs} Lakhs)`;
  }
  return `₹${lakhs.toFixed(0)} Lakhs`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const SUPER_ADMIN_EMAIL = 'hariharan12403@gmail.com';

export interface StoredSession {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'ADMIN' | 'USER';
  isAdmin: boolean;
}

const STORAGE_KEY = 'ipl_auction_user_session';

export function getStoredUser(): StoredSession {
  if (typeof window === 'undefined') {
    return {
      userId: '',
      userName: '',
      userEmail: '',
      role: 'USER',
      isAdmin: false,
    };
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const email = parsed.userEmail || '';
      const isAdmin = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      return {
        userId: parsed.userId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userName: parsed.userName || '',
        userEmail: email,
        role: isAdmin ? 'ADMIN' : 'USER',
        isAdmin,
      };
    }
  } catch (err) {
    console.error('Error reading stored user session:', err);
  }

  // Generate new persistent session
  const newSession: StoredSession = {
    userId: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userName: '',
    userEmail: '',
    role: 'USER',
    isAdmin: false,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  } catch (err) {
    console.error('Error saving user session:', err);
  }
  return newSession;
}

export function saveStoredUser(userName: string, userEmail?: string): StoredSession {
  const current = getStoredUser();
  const email = (userEmail !== undefined ? userEmail : current.userEmail || '').trim();
  const isAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const updated: StoredSession = {
    userId: current.userId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userName: userName.trim(),
    userEmail: email,
    role: isAdmin ? 'ADMIN' : 'USER',
    isAdmin,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving user session:', err);
    }
  }
  return updated;
}

export function clearStoredUser(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Error clearing user session:', err);
    }
  }
}
