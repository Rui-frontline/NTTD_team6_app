"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
  /**
   * 再設定のリンクから来た直後か。
   *
   * これが true のときだけ、現在のパスワード無しで変更してよい。
   * 通常のログインと区別できないと、ログインしたまま席を離れた端末で
   * 他人がパスワードを変えられてしまう。
   */
  isPasswordRecovery: boolean;
  /** メールのリンクから来たときに、新しいパスワードを設定する */
  completePasswordReset: (newPassword: string) => Promise<void>;
  /** プロフィール更新後に呼ぶと、画面の表示が最新になる */
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>("work");
  const [loading, setLoading] = useState(true);
  /*
    再設定のリンクから来たかどうか。

    セッションの有無では判定できない。通常のログインでもセッションはある
    ので、それを根拠にすると、ログイン済みの端末から /reset-password を
    直接開くだけで、現在のパスワード無しに変更できてしまう。

    覚えておくのはこの Provider。画面の中で拾おうとすると、
    PASSWORD_RECOVERY が飛んだあとに /reset-password へ遷移する作りのため、
    取り逃す。ここは root layout にあり、リンクを踏んだ瞬間から生きている。

    ページを読み込み直すと消える。そのときは「リンクが使えません」になり、
    送り直しになる。取り逃すより安全側に倒している。
  */
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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
      (event, session) => {
        void loadUser(session?.user.id ?? null);

        /*
          再設定リンクから来たら、着いた場所に関わらず設定画面へ送る。

          リンクの行き先は Supabase 側の設定（Site URL / Redirect URLs）に
          左右される。redirectTo が許可リストに載っていないと、その指定は
          黙って捨てられて別の場所に飛ぶ。実際 /forgot-password に着く例が
          あった。

          着いた先がどこでも supabase-js が URL からセッションを作るので、
          再設定の権利自体は手に入っている。あとは設定画面に連れて行けばよい。

          この処理があれば、URL の登録漏れや環境違いで行き先がずれても
          詰まらない。登録自体は別途しておくこと（弾かれない方が素直）。
        */
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
          router.replace("/reset-password");
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUser, router]);

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
    setIsPasswordRecovery(false);
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
  const completePasswordReset = useCallback(
    async (newPassword: string) => {
      // 画面側でも入口を閉じているが、ここでも確かめる。
      // 現在のパスワード無しで変更できる唯一の経路なので、
      // 呼び出し側の作りが変わっても素通りしないようにしておく
      if (!isPasswordRecovery) {
        throw new Error(
          "再設定のリンクからやり直してください。",
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(translateAuthError(error.message));

      // 使い終わったら閉じる。開いたままだと、そのタブでは何度でも
      // 現在のパスワード無しに変更できてしまう
      setIsPasswordRecovery(false);
    },
    [isPasswordRecovery],
  );

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
      isPasswordRecovery,
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
      isPasswordRecovery,
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
