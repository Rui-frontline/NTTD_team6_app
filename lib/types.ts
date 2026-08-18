// アプリ全体で使う型定義。
// 全員が参照するファイルなので、変更するときは必ず Slack で相談すること。

/** 仕事モード / 恋愛モード */
export type Mode = "work" | "romance";

export const MODES: Mode[] = ["work", "romance"];

export const MODE_LABEL: Record<Mode, string> = {
  work: "仕事",
  romance: "恋愛",
};

/** モードごとに変わる部分 */
export type Profile = {
  /** 自己紹介文 */
  bio: string;
  /** タグ（候補から選ぶ。最大5個） */
  tags: string[];
  /** このモードで部署を表示するか */
  showDepartment: boolean;
};

export type User = {
  id: string; // uuid
  name: string; // 共通
  avatarUrl: string; // 共通
  department: string; // 共通（表示可否はモードごと）
  jobTitle: string; // 共通
  age: number; // 共通
  /** 参加しているモード。含まれていないモードでは一覧に出ない */
  enabledModes: Mode[];
  work: Profile;
  romance: Profile;
};

/** いいね・見送り。相互に成立するまで相手には通知されない */
export type Reaction = {
  fromUserId: string;
  toUserId: string;
  mode: Mode;
  type: "like" | "pass";
  createdAt: string;
};

/** 相互いいねで成立したマッチ */
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

/** マッチ一覧に出すための、相手＋最新メッセージ */
export type MatchSummary = {
  match: Match;
  partner: User;
  latestMessage: Message | null;
  /**
   * 自分がまだ読んでいない、相手からのメッセージ数。
   * 既読位置（match_reads）より新しいものだけを数えるので、一度開けば 0 に戻る。
   */
  unreadCount: number;
};

/** タグの候補。マイページの選択肢とフィルターで使う */
export const TAG_OPTIONS: Record<Mode, string[]> = {
  work: [
    "フロントエンド",
    "バックエンド",
    "インフラ",
    "データ分析",
    "AI・機械学習",
    "セキュリティ",
    "PM",
    "デザイン",
    "営業",
    "マーケティング",
    "経理・財務",
    "人事",
    "法務",
    "新規事業",
    "業務改善",
  ],
  romance: [
    "映画",
    "音楽",
    "読書",
    "カフェ巡り",
    "料理",
    "お酒",
    "サウナ",
    "筋トレ",
    "ランニング",
    "登山",
    "キャンプ",
    "旅行",
    "写真",
    "ゲーム",
    "アニメ・漫画",
    "スポーツ観戦",
    "猫",
    "犬",
    "ボードゲーム",
    "美術館",
  ],
};

/** タグの上限 */
export const MAX_TAGS = 5;
