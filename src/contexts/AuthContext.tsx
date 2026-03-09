import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Wallet } from "quais";
import {
  createWalletFromPrivateKey,
  signLoginMessage,
  verifyMessage,
  isValidAddress,
  isValidPrivateKeyFormat,
} from "@/lib/quai";
import { getProfile, setProfile, type ProfileData } from "@/lib/profile";

const SESSION_KEY = "talken_session";

interface Session {
  address: string;
  /** Short display address (0x1234...5678) */
  shortAddress: string;
}

interface AuthContextValue {
  session: Session | null;
  wallet: Wallet | null;
  /** Profile (display name, avatar) for current session address */
  profile: ProfileData;
  isLoading: boolean;
  loginWithPrivateKey: (privateKey: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loginWithSignedMessage: (address: string, message: string, signature: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  setWallet: (w: Wallet | null) => void;
  updateProfile: (updates: Partial<ProfileData>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWalletState] = useState<Wallet | null>(null);
  const [profile, setProfileState] = useState<ProfileData>({ displayName: "", profileImageUrl: null });
  const [isLoading, setIsLoading] = useState(true);

  const setWallet = useCallback((w: Wallet | null) => {
    setWalletState(w);
  }, []);

  const updateProfile = useCallback((updates: Partial<ProfileData>) => {
    const addr = session?.address;
    if (!addr) return;
    const next = setProfile(addr, updates);
    setProfileState(next);
  }, [session?.address]);

  const logout = useCallback(() => {
    setWalletState(null);
    setSession(null);
    setProfileState({ displayName: "", profileImageUrl: null });
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const loginWithPrivateKey = useCallback(
    async (privateKey: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const trimmed = privateKey.trim();
      if (!trimmed) {
        return { ok: false, error: "Enter your private key" };
      }
      if (!isValidPrivateKeyFormat(trimmed)) {
        return { ok: false, error: "Invalid private key format" };
      }
      try {
        const wallet = createWalletFromPrivateKey(trimmed);
        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        const { message, signature } = await signLoginMessage(wallet, nonce);
        const recovered = verifyMessage(message, signature);
        if (recovered.toLowerCase() !== wallet.address.toLowerCase()) {
          return { ok: false, error: "Signature verification failed" };
        }
        const address = wallet.address;
        const sess: Session = {
          address,
          shortAddress: shortAddress(address),
        };
        setWalletState(wallet);
        setSession(sess);
        setProfileState(getProfile(address));
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ address, shortAddress: sess.shortAddress }));
        } catch {
          // persist only address for reload; wallet must be re-entered
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Connection failed";
        return { ok: false, error: msg };
      }
    },
    []
  );

  const loginWithSignedMessage = useCallback(
    async (
      address: string,
      message: string,
      signature: string
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const addr = address?.trim();
      if (!addr || !isValidAddress(addr)) {
        return { ok: false, error: "Invalid address" };
      }
      if (!message?.trim() || !signature?.trim()) {
        return { ok: false, error: "Message and signature required" };
      }
      try {
        const recovered = verifyMessage(message, signature);
        if (recovered.toLowerCase() !== addr.toLowerCase()) {
          return { ok: false, error: "Invalid signature for this address" };
        }
        const sess: Session = {
          address: addr,
          shortAddress: shortAddress(addr),
        };
        setSession(sess);
        setWalletState(null);
        setProfileState(getProfile(addr));
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ address: addr, shortAddress: sess.shortAddress }));
        } catch {
          // ignore
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Verification failed";
        return { ok: false, error: msg };
      }
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { address?: string; shortAddress?: string };
        const addr = data?.address?.trim();
        if (addr && isValidAddress(addr)) {
          setSession({
            address: addr,
            shortAddress: data.shortAddress && data.shortAddress.length > 0 ? data.shortAddress : shortAddress(addr),
          });
          setProfileState(getProfile(addr));
        }
      }
    } catch {
      // ignore corrupted or invalid session
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    session,
    wallet,
    profile,
    isLoading,
    loginWithPrivateKey,
    loginWithSignedMessage,
    logout,
    setWallet,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
