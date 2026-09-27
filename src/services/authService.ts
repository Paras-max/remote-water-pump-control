import { AuthUser } from '../types/pump';
import { auth, isFirebaseConfigured } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

type AuthListener = (user: AuthUser | null) => void;

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    // Check saved demo user
    const savedDemo = localStorage.getItem('aquaflow_demo_user');
    if (savedDemo) {
      try {
        this.currentUser = JSON.parse(savedDemo);
      } catch (e) {
        // ignore
      }
    }

    if (isFirebaseConfigured && auth) {
      onAuthStateChanged(auth, (fbUser: User | null) => {
        if (fbUser) {
          this.currentUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Operator',
            isDemo: false,
          };
        } else {
          // Check if demo user was active
          const demoUser = localStorage.getItem('aquaflow_demo_user');
          if (demoUser) {
            this.currentUser = JSON.parse(demoUser);
          } else {
            this.currentUser = null;
          }
        }
        this.notify();
      });
    } else {
      // Default to demo operator if in demo mode
      if (!this.currentUser) {
        this.currentUser = {
          uid: 'demo_operator_01',
          email: 'operator@aquaflow.local',
          displayName: 'Demo Station Operator',
          isDemo: true,
        };
        localStorage.setItem('aquaflow_demo_user', JSON.stringify(this.currentUser));
      }
    }
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentUser));
  }

  async login(email: string, pass: string): Promise<AuthUser> {
    if (isFirebaseConfigured && auth) {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const user: AuthUser = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Operator',
        isDemo: false,
      };
      localStorage.removeItem('aquaflow_demo_user');
      this.currentUser = user;
      this.notify();
      return user;
    } else {
      // Demo authentication
      const user: AuthUser = {
        uid: `user_${Date.now()}`,
        email,
        displayName: email.split('@')[0] || 'Local Operator',
        isDemo: true,
      };
      this.currentUser = user;
      localStorage.setItem('aquaflow_demo_user', JSON.stringify(user));
      this.notify();
      return user;
    }
  }

  async signUp(email: string, pass: string): Promise<AuthUser> {
    if (isFirebaseConfigured && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const user: AuthUser = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: email.split('@')[0] || 'New Operator',
        isDemo: false,
      };
      localStorage.removeItem('aquaflow_demo_user');
      this.currentUser = user;
      this.notify();
      return user;
    } else {
      return this.login(email, pass);
    }
  }

  async loginAsDemo(): Promise<AuthUser> {
    const demoUser: AuthUser = {
      uid: 'demo_operator_01',
      email: 'demo@aquaflow.io',
      displayName: 'Field Station Operator',
      isDemo: true,
    };
    this.currentUser = demoUser;
    localStorage.setItem('aquaflow_demo_user', JSON.stringify(demoUser));
    this.notify();
    return demoUser;
  }

  async logout(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
    localStorage.removeItem('aquaflow_demo_user');
    this.currentUser = null;
    this.notify();
  }
}

export const authService = new AuthService();
