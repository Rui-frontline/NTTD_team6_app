// アプリ全体で使う型定義。
// 全員が参照するファイルなので、変更するときは必ず Slack で相談すること。

/** 仕事モード / 恋愛モード */
export type Mode = "work" | "romance";

export const MODES: Mode[] = ["work", "romance"];

export const MODE_LABEL: Record<Mode, string> = {
  work: "仕事",
  romance: "恋愛",
};

/**
 * モードごとに変わる部分。
 *
 * work と romance で同じ型を使っている（DB も profiles の1テーブル）。
 * そのため、片方のモードでしか使わない項目も両方に存在する。
 * どちらで入力させるかは lib/profile-fields.ts が決めていて、
 * 使わない側は空文字 / null のままになる。
 */
export type Profile = {
  /** 自己紹介文 */
  bio: string;
  /** タグ（候補から選ぶ。最大5個） */
  tags: string[];
  /** このモードで部署を表示するか */
  showDepartment: boolean;

  // ── 仕事モードで入力する項目 ──
  /** 詳しい仕事の実績 */
  workAchievements: string;
  /** お話しできること */
  canTalkAbout: string;
  /** 相談したい内容 */
  wantToConsult: string;
  /** 資格情報 */
  certifications: string;
  /** 今後興味のある領域 */
  interestedAreas: string;

  // ── 恋愛モードで入力する項目 ──
  /** 身長(cm)。未設定は null */
  heightCm: number | null;
  /** 体型 */
  bodyType: string;
  /** 性格タイプ */
  personalityType: string;
  /** 同居人 */
  livingWith: string;
  /** 休日 */
  holiday: string;
  /** タバコ */
  smoking: string;
  /** お酒 */
  drinking: string;
  /** 出身 */
  hometown: string;
  /** 住んでる場所 */
  residence: string;
  /** 希望する相手の最低年齢。未設定は null */
  preferredAgeMin: number | null;
  /** 希望する相手の最高年齢。未設定は null */
  preferredAgeMax: number | null;
  /** 子供がほしいか */
  wantsChildren: string;
  /** 結婚への意思 */
  marriageIntent: string;
  /** 出会うまでの希望 */
  meetingPreference: string;
};

export type User = {
  id: string; // uuid
  name: string; // 共通
  avatarUrl: string; // 共通
  department: string; // 共通（表示可否はモードごと）。いちばん下の階層の名前だけ
  /** 部署を選んだ経路。「会社 / 区分 / 本部」の形。選び直すときの復元に使う */
  departmentPath: string;
  jobTitle: string; // 共通
  age: number; // 共通
  gender: string; // 共通
  university: string; // 共通（出身大学）
  /** 参加しているモード。含まれていないモードでは一覧に出ない */
  enabledModes: Mode[];
  /** 保有ポイント。増減は repository の awardPoints から行う */
  points: number;
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

/** 募集掲示板の投稿 */
export type Board = {
  id: string;
  userId: string;
  mode: Mode;
  title: string;
  description: string;
  maxParticipants: number | null; // null = 無制限
  deadline: string | null; // null = 無期限
  status: "募集中" | "募集終了";
  createdAt: string;
  updatedAt: string;
};

/** 募集掲示板のグループチャットメッセージ */
export type BoardMessage = {
  id: string;
  boardId: string;
  userId: string;
  body: string;
  createdAt: string;
};
