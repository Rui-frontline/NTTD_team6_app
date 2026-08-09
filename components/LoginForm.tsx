"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { User } from "@/lib/types";

/**
 * ダミーのログイン。一覧から自分役のユーザーを選ぶだけ。
 * 本物の認証（社内SSO・メール認証）は今回のスコープ外。
 * 見た目とコピーの調整は feat/auth で行う。
 */
export function LoginForm({ users }: { users: User[] }) {
  const { login } = useSession();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold">社内マッチング</h1>
      <p className="mt-2 text-sm text-muted">
        会社のメールアドレスを持つ人だけが利用できます。
      </p>
      <p className="mt-6 text-sm font-bold">デモ用：誰としてログインしますか？</p>

      <ul className="mt-3 flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => {
                login(u);
                router.push("/discover");
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-accent"
            >
              {/* ダミー画像なので next/image ではなく img を使う */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full bg-accent-soft"
              />
              <span>
                <span className="block text-sm font-bold">{u.name}</span>
                <span className="block text-xs text-muted">{u.department}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
