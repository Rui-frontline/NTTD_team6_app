"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Mode, User } from "@/lib/types";

// ログイン中のユーザーと、選択中のモードを保持する。
// サーバーに保存できないので localStorage に置く。

const STORAGE_KEY = "matching-app/session";

type SessionValue = {
  currentUser: User | null;
  mode: Mode;
  /** localStorage の読み込みが終わるまで true */
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  setMode: (mode: Mode) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

type Stored = { user: User | null; mode: Mode };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mode, setModeState] = useState<Mode>("work");
  const [loading, setLoading] = useState(true);

  // 初回だけ localStorage から復元する
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        setCurrentUser(parsed.user ?? null);
        setModeState(parsed.mode === "romance" ? "romance" : "work");
      }
    } catch {
      // 壊れたデータが入っていたら無視して初期状態で始める
    }
    setLoading(false);
  }, []);

  const persist = useCallback((next: Stored) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // プライベートブラウジングなどで書けない場合は諦める
    }
  }, []);

  const login = useCallback(
    (user: User) => {
      setCurrentUser(user);
      persist({ user, mode });
    },
    [mode, persist],
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    persist({ user: null, mode });
  }, [mode, persist]);

  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next);
      persist({ user: currentUser, mode: next });
    },
    [currentUser, persist],
  );

  // モードに応じて配色を切り替えるため、html 要素に印をつける
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const value = useMemo(
    () => ({ currentUser, mode, loading, login, logout, setMode }),
    [currentUser, mode, loading, login, logout, setMode],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession は SessionProvider の内側で使ってください");
  }
  return ctx;
}
