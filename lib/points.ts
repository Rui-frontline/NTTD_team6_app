// ポイントの獲得ルールと交換品の定義。
//
// ⚠️ ここの数字は「画面に出すための写し」です。正は SQL 側にあります。
//    ・デイリーミッションのしきい値とポイント … supabase/point_rewards.sql の
//      sync_daily_missions
//    ・アイテムの値段 … 同ファイルの exchange_item
//
//    金額やしきい値を画面から渡すと、押すだけで好きな額を入れたり
//    0ポイントで交換したりできてしまうため、判定は必ず DB 側で行います。
//    片方だけ変えると表示と実際がずれるので、必ず両方を直してください。

export type MissionId = "login" | "reply_1" | "reply_3" | "like_5";

export type DailyMission = {
  id: MissionId;
  label: string;
  /** ラベルの下に小さく出す補足。無いものは undefined */
  note?: string;
  /** 達成でもらえるポイント */
  points: number;
  /** 達成に必要な回数。1 なら進捗のかわりに達成済みだけを出す */
  goal: number;
  /** 進捗の分子をどこから取るか。login は数えるものが無い */
  source: "login" | "replies" | "likes";
};

/** 並べた順に画面へ出る */
export const DAILY_MISSIONS: DailyMission[] = [
  { id: "login", label: "ログイン", points: 5, goal: 1, source: "login" },
  {
    id: "reply_1",
    label: "マッチ相手に1回返信",
    points: 5,
    goal: 1,
    source: "replies",
  },
  {
    id: "reply_3",
    label: "マッチ相手に3回返信",
    points: 10,
    goal: 3,
    source: "replies",
  },
  {
    id: "like_5",
    label: "いいねを5回送る",
    note: "仕事・恋愛モード共通",
    points: 10,
    goal: 5,
    source: "likes",
  },
];

export type ItemId = "super_like" | "coffee_ticket";

export type Item = {
  id: ItemId;
  label: string;
  description: string;
  /** 交換に必要なポイント */
  cost: number;
  /** カードに出す絵文字。線画アイコンを1つずつ描くより差し替えやすい */
  emoji: string;
};

export const ITEMS: Item[] = [
  {
    id: "super_like",
    label: "スーパーいいね",
    description: "特別ないいね。使い道はこれから決まります。",
    cost: 100,
    emoji: "⭐",
  },
  {
    id: "coffee_ticket",
    label: "コーヒーチケット",
    description: "社内カフェテリアで使える1杯ぶんのチケット。",
    cost: 500,
    emoji: "☕",
  },
];

/**
 * 履歴を何件まで読むか。
 *
 * ボタンの文言（「最新50件を見る」）にも使うので、読む件数と表示が
 * ずれないよう1箇所に置いている。
 */
export const POINT_HISTORY_LIMIT = 50;

/** 今日の進捗。sync_daily_missions() が返すものと同じ形 */
export type DailyProgress = {
  /** JST の日付 */
  date: string;
  /** 今日 自分が送ったメッセージの本数 */
  replies: number;
  /** 今日 送ったいいねの数（モード問わず） */
  likes: number;
  /** 達成しているミッション */
  achieved: MissionId[];
};

/**
 * 履歴に出す文言を reason から作る。
 *
 * point_events には文言を保存していない。あとから言い回しを直したときに、
 * 過去の行だけ古い書き方のまま残らないようにするため。
 * 知らない reason はそのまま出す（新しいルールを足したときの保険）。
 */
export function pointEventLabel(reason: string): string {
  const daily = DAILY_MISSIONS.find((m) => reason === `daily_${m.id}`);
  if (daily) return daily.label;

  const item = ITEMS.find((i) => reason === `exchange_${i.id}`);
  if (item) return `${item.label}と交換`;

  // 'profile_50_work' のような形
  const profile = /^profile_(\d+)_(work|romance)$/.exec(reason);
  if (profile) {
    const mode = profile[2] === "work" ? "仕事" : "恋愛";
    return `プロフィール達成（${mode}モード ${profile[1]}%）`;
  }

  // supabase/reviews.sql の submit_review が入れる
  if (reason === "review_submitted") return "口コミを投稿";

  return reason;
}

/** そのミッションの進捗の分子。goal と合わせて「1 / 3」の形にする */
export function missionProgress(
  mission: DailyMission,
  progress: DailyProgress | null,
): number {
  if (!progress) return 0;
  switch (mission.source) {
    case "login":
      // この画面を開けている時点で達成しているので、常に満たす
      return mission.goal;
    case "replies":
      return progress.replies;
    case "likes":
      return progress.likes;
  }
}
