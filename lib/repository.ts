import { users } from "@/lib/data/users";
import type { Group, Mode, Post, User } from "@/lib/types";

// データアクセスの唯一の入口。
//
// 画面から lib/data/*.ts を直接 import してはいけない。必ずこのファイルを経由する。
// すべて async にしてあるので、あとから本物のDBに差し替えるときは
// このファイルの中身だけを書き換えれば、画面側は1行も変わらない。
//
// 書き込み（ハート・チャット・投稿）はサーバーに保存できないため、
// ブラウザ側の state / localStorage で扱う。各機能ブランチで実装する。

/**
 * 指定モードに参加しているユーザーを返す。
 *
 * 恋愛モードは「そのモードをONにしている人」だけが対象。
 * ONにしていない人は、見ることも見られることもできない（相互オプトイン）。
 */
export async function getUsers(
  mode: Mode,
  options: { excludeUserId?: string } = {},
): Promise<User[]> {
  return users.filter(
    (u) =>
      u.enabledModes.includes(mode) && u.id !== options.excludeUserId,
  );
}

export async function getUser(id: string): Promise<User | null> {
  return users.find((u) => u.id === id) ?? null;
}

/** ログイン画面で選ばせるためだけの一覧。本番の認証に置き換わる想定 */
export async function getAllUsers(): Promise<User[]> {
  return users;
}

export async function getGroups(): Promise<Group[]> {
  // feat/groups で lib/data/groups.ts を作って差し替える
  return [];
}

export async function getPosts(boardId: string): Promise<Post[]> {
  // feat/board で lib/data/posts.ts を作って差し替える
  void boardId;
  return [];
}
