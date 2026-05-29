import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithPopup as firebaseSignInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc as firebaseDoc,
  collection as firebaseCollection,
  getDoc as firebaseGetDoc,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  getDocs as firebaseGetDocs,
  query as firebaseQuery,
  orderBy as firebaseOrderBy,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const realAuth = getAuth(app);
const realDb = getFirestore(app);

// Check if we are in Mock/Local fallback mode
export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('synthara_mock_auth') === 'true';
}

// Enable local mock fallback mode
export function enableMockMode() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('synthara_mock_auth', 'true');
  // Initialize minimal mock database structure if empty
  if (!localStorage.getItem('synthara_mock_db')) {
    localStorage.setItem('synthara_mock_db', JSON.stringify({}));
  }
}

// ─── LocalStorage Mock Database Helpers ─────────────────────────────────────
function getMockDb() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('synthara_mock_db') || '{}');
  } catch {
    return {};
  }
}

function saveMockDb(db: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('synthara_mock_db', JSON.stringify(db));
}

// ─── Unified Auth Interfaces ───────────────────────────────────────────────
export const auth: any = {
  get currentUser() {
    if (isMockMode()) {
      return {
        uid: 'guest-traveler-uid',
        email: 'guest@synthara.local',
        displayName: 'Guest Traveler',
      } as any;
    }
    return realAuth.currentUser;
  }
};

export async function signInWithPopup(authInstance: any, provider: any) {
  try {
    return await firebaseSignInWithPopup(realAuth, provider);
  } catch (err) {
    console.warn('[Firebase Auth] Sign in with popup failed, falling back to local guest session:', err);
    enableMockMode();
    return { user: auth.currentUser };
  }
}

export async function signInAnonymously(authInstance: any) {
  try {
    // Attempt real Firebase sign-in first
    return await firebaseSignInAnonymously(realAuth);
  } catch (err) {
    console.warn('[Firebase Auth] Anonymous sign-in failed, falling back to local guest session:', err);
    enableMockMode();
    return { user: auth.currentUser };
  }
}

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  if (isMockMode()) {
    // Immediately trigger callback with guest user
    setTimeout(() => {
      callback(auth.currentUser);
    }, 50);
    return () => {};
  }
  return firebaseOnAuthStateChanged(realAuth, callback);
}

export async function signOut(authInstance: any) {
  if (isMockMode()) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('synthara_mock_auth');
      // Keep mock database history or wipe it depending on preference — let's keep it but wipe active session
    }
    return;
  }
  return await firebaseSignOut(realAuth);
}

// ─── Unified Firestore Interfaces ──────────────────────────────────────────
export const db = realDb;

export function doc(dbInstance: any, collectionName: string, ...pathSegments: string[]) {
  if (isMockMode()) {
    return {
      type: 'document',
      path: [collectionName, ...pathSegments].join('/'),
    } as any;
  }
  return firebaseDoc(realDb, collectionName, ...pathSegments);
}

export function collection(dbInstance: any, collectionName: string, ...pathSegments: string[]) {
  if (isMockMode()) {
    return {
      type: 'collection',
      path: [collectionName, ...pathSegments].join('/'),
    } as any;
  }
  return firebaseCollection(realDb, collectionName, ...pathSegments);
}

export async function getDoc(docRef: any) {
  if (isMockMode()) {
    const mockDb = getMockDb();
    const data = mockDb[docRef.path] || null;
    return {
      exists: () => data !== null,
      data: () => data,
    } as any;
  }
  return await firebaseGetDoc(docRef);
}

export async function setDoc(docRef: any, data: any) {
  if (isMockMode()) {
    const mockDb = getMockDb();
    mockDb[docRef.path] = data;
    saveMockDb(mockDb);
    return;
  }
  return await firebaseSetDoc(docRef, data);
}

export async function updateDoc(docRef: any, data: any) {
  if (isMockMode()) {
    const mockDb = getMockDb();
    const existing = mockDb[docRef.path] || {};
    mockDb[docRef.path] = { ...existing, ...data };
    saveMockDb(mockDb);
    return;
  }
  return await firebaseUpdateDoc(docRef, data);
}

export async function getDocs(collectionRef: any) {
  if (isMockMode()) {
    const mockDb = getMockDb();
    const docs: any[] = [];
    const prefix = collectionRef.path + '/';
    
    Object.keys(mockDb).forEach((key) => {
      // Direct children match check (e.g. players/uid/quests/id matches players/uid/quests)
      if (key.startsWith(prefix) && key.replace(prefix, '').split('/').length === 1) {
        docs.push({
          id: key.replace(prefix, ''),
          data: () => mockDb[key],
        });
      }
    });
    
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
    } as any;
  }
  return await firebaseGetDocs(collectionRef);
}

/**
 * Mock-safe query() wrapper.
 * In mock mode the collection ref is already a plain object; passing it
 * through real Firestore query() would throw. We return it as-is because
 * the mock getDocs() ignores query constraints anyway.
 */
export function query(collectionRef: any, ...constraints: any[]) {
  if (isMockMode()) return collectionRef;
  // Filter out any undefined constraints (e.g. from a mock orderBy call)
  return firebaseQuery(collectionRef, ...constraints.filter(Boolean));
}

/**
 * Mock-safe orderBy() wrapper.
 * Returns undefined in mock mode so it can be safely filtered out.
 */
export function orderBy(field: string, direction?: 'asc' | 'desc') {
  if (isMockMode()) return undefined as any;
  return firebaseOrderBy(field, direction);
}

export default app;
