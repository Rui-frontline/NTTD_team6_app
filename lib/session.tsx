"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { createUser, getUser } from "@/lib/repository";
import type { Mode, User } from "@/lib/types";

// ログイン状態と、選択中のモードを保持する。
// ログインは Supabase Auth、モードはブラウザの localStorage。

const MODE_KEY = "matching-app/mode";

type SignUpInput = {
  email: string;
  password: string;
  name: string;
  department: string;
  jobTitle: string;
  age: number;
};

type SessionValue = {
  /** ログイン中のユーザー。未ログインなら null */
  currentUser: User | null;
  /** 認証済みかどうか */
  isAuthenticated: boolean;
  /** 起動直後の読み込み中は true */
  loading: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** プロフィール更新後に呼ぶと、画面の表示が最新になる */
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>("work");
  const [loading, setLoading] = useState(true);

  // モードを localStorage から復元する
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "romance" || saved === "work") setModeState(saved);
    } catch {
      // 読めない環境では初期値のままにする
    }
  }, []);

  // モードに応じて配色を切り替えるため、html 要素に印をつける
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const loadUser = useCallback(async (userId: string | null) => {
    setAuthUserId(userId);
    if (!userId) {
      setCurrentUser(null);
      return;
    }
    setCurrentUser(await getUser(userId));
  }, []);

  // 起動時にセッションを確認し、以降の変化も監視する
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await loadUser(data.session?.user.id ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void loadUser(session?.user.id ?? null);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUser]);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // 保存できなくても動作には影響しない
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error) throw new Error(translateAuthError(error.message));
    if (!data.user) throw new Error("登録に失敗しました。もう一度お試しください。");

    await createUser({
      id: data.user.id,
      name: input.name,
      department: input.department,
      jobTitle: input.jobTitle,
      age: input.age,
    });
    await loadUser(data.user.id);
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthUserId(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await loadUser(authUserId);
  }, [authUserId, loadUser]);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: authUserId !== null,
      loading,
      mode,
      setMode,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [currentUser, authUserId, loading, mode, setMode, signIn, signUp, signOut, refreshUser],
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

/** Supabase のエラーメッセージを日本語にする */
function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスかパスワードが違います。";
  }
  if (message.includes("already registered")) {
    return "このメールアドレスはすでに登録されています。";
  }
  if (message.includes("Password should be at least")) {
    return "パスワードは6文字以上にしてください。";
  }
  if (message.includes("email rate limit")) {
    return "メールの送信制限に達しました。しばらく待ってからお試しください。";
  }
  return message;
}
