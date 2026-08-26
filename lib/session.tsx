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
  /** 部署を選んだ経路。「会社 / 区分 / 本部」の形 */
  departmentPath: string;
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
  /** 再設定のリンクをメールで送る。ログインしていなくても呼べる */
  requestPasswordReset: (email: string) => Promise<void>;
  /** ログイン中にパスワードを変える。現在のパスワードの確認つき */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** メールのリンクから来たときに、新しいパスワードを設定する */
  completePasswordReset: (newPassword: string) => Promise<void>;
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
      departmentPath: input.departmentPath,
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

  /**
   * パスワード再設定のリンクをメールで送る。
   *
   * 送り先が登録されていない場合も Supabase はエラーを返さない。
   * こちらでも成否を出し分けない。出し分けると、入力したメールアドレスが
   * このアプリに登録されているかどうかを、誰でも試せてしまう。
   *
   * redirectTo には「いま開いているサイトの /reset-password」を渡す。
   * localhost でも Vercel でも、踏んだ環境に帰ってくる。
   * ただし、この URL は Supabase の Authentication → URL Configuration に
   * 登録しておく必要がある。未登録だとリンクを踏んでも弾かれる。
   */
  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  /**
   * ログイン中にパスワードを変える。
   *
   * 先に現在のパスワードで signInWithPassword を試す。同じユーザーで
   * 入り直すだけなので、成功してもログイン状態は変わらない。失敗すれば
   * 現在のパスワードが違うと分かる。
   *
   * これが無いと、ログインしたまま席を離れた端末で、他人がパスワードを
   * 変えてアカウントを乗っ取れる。
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("ログインし直してからお試しください。");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error("現在のパスワードが違います。");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [],
  );

  /**
   * メールのリンクから来たときに、新しいパスワードを設定する。
   *
   * リンクを踏んだ時点で supabase-js が URL からセッションを作っているので、
   * 現在のパスワードは要らない（そもそも忘れているから来ている）。
   */
  const completePasswordReset = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(translateAuthError(error.message));
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
      requestPasswordReset,
      changePassword,
      completePasswordReset,
      refreshUser,
    }),
    [
      currentUser,
      authUserId,
      loading,
      mode,
      setMode,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      changePassword,
      completePasswordReset,
      refreshUser,
    ],
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
