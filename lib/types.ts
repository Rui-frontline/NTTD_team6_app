// アプリ全体で使う型定義。
// ここは全員が参照するので、変更するときは必ずチームに共有すること。

/** 仕事モード / 恋愛モード */
export type Mode = "work" | "romance";

export const MODES: Mode[] = ["work", "romance"];

export const MODE_LABEL: Record<Mode, string> = {
  work: "仕事",
  romance: "恋愛",
};

/** 仕事モードのプロフィール */
export type WorkProfile = {
  /** 担当業務 */
  role: string;
  skills: string[];
  /** フリー欄 */
  bio: string;
};

/** 恋愛モードのプロフィール */
export type RomanceProfile = {
  hobbies: string[];
  /** フリー欄 */
  bio: string;
  /** 恋愛モードで部署を隠すか */
  hideDepartment: boolean;
};

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  department: string;
  age: number;
  /** 参加しているモード。含まれていないモードでは一覧に出ない */
  enabledModes: Mode[];
  work: WorkProfile;
  romance: RomanceProfile;
};

/** ハート。相互に成立するまで相手には通知されない */
export type Like = {
  fromUserId: string;
  toUserId: string;
  mode: Mode;
  createdAt: string;
};

/** 相互ハートで成立したマッチ */
export type Match = {
  id: string;
  userIds: [string, string];
  mode: Mode;
  createdAt: string;
};

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

/** 共通の趣味でつながるグループ */
export type Group = {
  id: string;
  name: string;
  hobby: string;
  memberIds: string[];
};

/** 匿名掲示板の投稿 */
export type Post = {
  id: string;
  boardId: string;
  /** 画面に出す名前。自動生成する */
  displayName: string;
  /** 内部保持のみ。画面には絶対に出さないこと */
  authorId: string;
  body: string;
  createdAt: string;
};
