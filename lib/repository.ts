import { supabase } from "@/lib/supabase";
import { isDepartmentComplete, splitDepartmentPath } from "@/lib/departments";
import { JOB_TITLE_OPTIONS } from "@/lib/profile-fields";
import type { DailyProgress, ItemId } from "@/lib/points";
import { MODES } from "@/lib/types";
import type {
  Board,
  BoardMessage,
  Match,
  MatchSummary,
  Message,
  Mode,
  Profile,
  Reaction,
  User,
} from "@/lib/types";

// データアクセスの唯一の入口。
//
// 画面から supabase を直接呼んではいけない。必ずこのファイルの関数を使う。
// 新しく必要な取得処理が出たら、Slack で呼びかけてからここに追加する。

// ───────────────────────── 内部：DBの行 → アプリの型 ─────────────────────────

type UserRow = {
  id: string;
  name: string;
  avatar_url: string;
  department: string;
  department_path: string | null;
  job_title: string;
  age: number;
  enabled_modes: string[];
  gender: string | null;
  university: string | null;
  points: number | null;
  profiles?: ProfileRow[] | null;
};

type ProfileRow = {
  user_id: string;
  mode: string;
  bio: string | null;
  tags: string[] | null;
  show_department: boolean | null;

  // 仕事モードで入力する項目
  work_achievements: string | null;
  can_talk_about: string | null;
  want_to_consult: string | null;
  certifications: string | null;
  interested_areas: string | null;

  // 恋愛モードで入力する項目
  height_cm: number | null;
  body_type: string | null;
  personality_type: string | null;
  living_with: string | null;
  holiday: string | null;
  smoking: string | null;
  drinking: string | null;
  hometown: string | null;
  residence: string | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  wants_children: string | null;
  marriage_intent: string | null;
  meeting_preference: string | null;
};

/**
 * アプリのキー → DB の列名。
 *
 * updateProfile がこの表を回して patch を組み立てる。
 * 項目ごとに if を書くと19行並ぶうえ、追加のたびに書き忘れる。
 * ここに1行足せば読み書きの両方に反映される。
 */
const PROFILE_COLUMNS: Record<keyof Profile, string> = {
  bio: "bio",
  tags: "tags",
  showDepartment: "show_department",

  workAchievements: "work_achievements",
  canTalkAbout: "can_talk_about",
  wantToConsult: "want_to_consult",
  certifications: "certifications",
  interestedAreas: "interested_areas",

  heightCm: "height_cm",
  bodyType: "body_type",
  personalityType: "personality_type",
  livingWith: "living_with",
  holiday: "holiday",
  smoking: "smoking",
  drinking: "drinking",
  hometown: "hometown",
  residence: "residence",
  preferredAgeMin: "preferred_age_min",
  preferredAgeMax: "preferred_age_max",
  wantsChildren: "wants_children",
  marriageIntent: "marriage_intent",
  meetingPreference: "meeting_preference",
};

const EMPTY_PROFILE: Profile = {
  bio: "",
  tags: [],
  showDepartment: true,

  workAchievements: "",
  canTalkAbout: "",
  wantToConsult: "",
  certifications: "",
  interestedAreas: "",

  heightCm: null,
  bodyType: "",
  personalityType: "",
  livingWith: "",
  holiday: "",
  smoking: "",
  drinking: "",
  hometown: "",
  residence: "",
  preferredAgeMin: null,
  preferredAgeMax: null,
  wantsChildren: "",
  marriageIntent: "",
  meetingPreference: "",
};

// 未設定の扱いが型で違う。文字列は空文字、数値は null。
// 数値に 0 を使うと「未設定」と「0」を区別できなくなるため。
function toProfile(row: ProfileRow | undefined): Profile {
  if (!row) return EMPTY_PROFILE;
  return {
    bio: row.bio ?? "",
    tags: row.tags ?? [],
    showDepartment: row.show_department ?? true,

    workAchievements: row.work_achievements ?? "",
    canTalkAbout: row.can_talk_about ?? "",
    wantToConsult: row.want_to_consult ?? "",
    certifications: row.certifications ?? "",
    interestedAreas: row.interested_areas ?? "",

    heightCm: row.height_cm ?? null,
    bodyType: row.body_type ?? "",
    personalityType: row.personality_type ?? "",
    livingWith: row.living_with ?? "",
    holiday: row.holiday ?? "",
    smoking: row.smoking ?? "",
    drinking: row.drinking ?? "",
    hometown: row.hometown ?? "",
    residence: row.residence ?? "",
    preferredAgeMin: row.preferred_age_min ?? null,
    preferredAgeMax: row.preferred_age_max ?? null,
    wantsChildren: row.wants_children ?? "",
    marriageIntent: row.marriage_intent ?? "",
    meetingPreference: row.meeting_preference ?? "",
  };
}

function toUser(row: UserRow): User {
  const profiles = row.profiles ?? [];
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    department: row.department,
    departmentPath: row.department_path ?? "",
    jobTitle: row.job_title,
    age: row.age,
    gender: row.gender ?? "",
    university: row.university ?? "",
    enabledModes: (row.enabled_modes ?? []) as Mode[],
    // supabase/points.sql をまだ流していない環境では列が無いので 0 にしておく
    points: row.points ?? 0,
    work: toProfile(profiles.find((p) => p.mode === "work")),
    romance: toProfile(profiles.find((p) => p.mode === "romance")),
  };
}

const USER_SELECT =
  "id,name,avatar_url,department,department_path,job_title,age,gender,university,enabled_modes,points,profiles(*)";

// ───────────────────────── ユーザー ─────────────────────────

export async function getUser(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toUser(data as UserRow) : null;
}

/** 探す画面の絞り込み条件 */
export type DiscoverFilter = {
  departments?: string[];
  jobTitles?: string[];
  tags?: string[];
  minAge?: number;
  maxAge?: number;
};

/**
 * 探す画面に出すユーザーを返す。
 *
 * - そのモードに参加している人だけ
 * - 自分は除く
 * - すでに「いいね」した相手は除く
 * - 恋愛モードでは「見送った」相手も除く（仕事モードは保存しないので除かない）
 * - 恋愛モードは相互オプトイン（自分もONでないと誰も表示されない）
 * - 相手からいいねが来ている人を優先表示（それ以外はランダム順）
 */
export async function getUsers(
  mode: Mode,
  currentUserId: string,
  filter: DiscoverFilter = {},
): Promise<User[]> {
  // 恋愛モードの相互オプトイン：自分もONでないと誰も表示しない
  if (mode === "romance") {
    const { data: currentUserData } = await supabase
      .from("users")
      .select("enabled_modes")
      .eq("id", currentUserId)
      .single();

    if (!currentUserData?.enabled_modes?.includes("romance")) {
      return []; // 自分が恋愛モードONでない場合は空配列を返す
    }
  }

  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .contains("enabled_modes", [mode]);
  if (error) throw error;

  const excluded = await getExcludedUserIds(currentUserId, mode);
  const users = (data as UserRow[]).map(toUser).filter(
    (u) => u.id !== currentUserId && !excluded.has(u.id),
  );

  const filtered = users.filter((u) => matchesFilter(u, mode, filter));

  // 相手からのいいねを取得
  const { data: incomingLikes } = await supabase
    .from("reactions")
    .select("from_user_id")
    .eq("to_user_id", currentUserId)
    .eq("mode", mode)
    .eq("type", "like");

  const likedByIds = new Set(
    (incomingLikes ?? []).map((r: { from_user_id: string }) => r.from_user_id),
  );

  // いいねをくれた人と、それ以外に分ける
  const likedByYou: User[] = [];
  const others: User[] = [];

  for (const user of filtered) {
    if (likedByIds.has(user.id)) {
      likedByYou.push(user);
    } else {
      others.push(user);
    }
  }

  // それぞれをランダムに並び替え
  const shuffled = (arr: User[]) =>
    arr.sort(() => Math.random() - 0.5);

  // いいねをくれた人を前に、それ以外を後ろに
  return [...shuffled(likedByYou), ...shuffled(others)];
}

/** すでに反応済みで、一覧に出したくない相手のID */
async function getExcludedUserIds(
  currentUserId: string,
  mode: Mode,
): Promise<Set<string>> {
  // 仕事モードの「見送る」は保存しないので、除外対象は like のみ
  const types = mode === "romance" ? ["like", "pass"] : ["like"];
  const { data, error } = await supabase
    .from("reactions")
    .select("to_user_id")
    .eq("from_user_id", currentUserId)
    .eq("mode", mode)
    .in("type", types);
  if (error) throw error;

  const excluded = new Set(
    (data ?? []).map((r: { to_user_id: string }) => r.to_user_id),
  );

  // ブロックした相手は、いいね／見送りの有無にかかわらず二度と出さない
  for (const id of await getBlockedUserIds(currentUserId, mode)) {
    excluded.add(id);
  }
  return excluded;
}

function matchesFilter(user: User, mode: Mode, f: DiscoverFilter): boolean {
  const profile = mode === "work" ? user.work : user.romance;

  if (f.departments?.length) {
    // 部署を非表示にしている人は、部署フィルターでは絶対にヒットさせない。
    // ヒットする/しないの違いから非表示の部署を推測されるのを防ぐため。
    if (!profile.showDepartment) return false;
    if (!f.departments.includes(user.department)) return false;
  }
  if (f.jobTitles?.length && !f.jobTitles.includes(user.jobTitle)) return false;
  if (f.tags?.length && !f.tags.some((t) => profile.tags.includes(t))) return false;
  if (f.minAge !== undefined && user.age < f.minAge) return false;
  if (f.maxAge !== undefined && user.age > f.maxAge) return false;
  return true;
}

// ───────────────────────── 登録・プロフィール編集 ─────────────────────────

/** 新規登録時に users と profiles（work / romance の2行）を作る */
export async function createUser(input: {
  id: string; // 認証アカウントの uuid
  name: string;
  department: string;
  /** 部署を選んだ経路。「会社 / 区分 / 本部」の形 */
  departmentPath: string;
  jobTitle: string;
  age: number;
  avatarUrl?: string;
}): Promise<User> {
  // 部署と職種は選択肢からしか選べない決まりなので、ここでも確かめる。
  // 画面側の検証だけだと、登録フォームを直し忘れたときに候補外の値が
  // 入り込み、あとからマイページで何も保存できなくなる。
  if (!isDepartmentComplete(splitDepartmentPath(input.departmentPath))) {
    throw new Error("会社・部署はいちばん下の階層まで選んでください。");
  }
  if (!(JOB_TITLE_OPTIONS as readonly string[]).includes(input.jobTitle)) {
    throw new Error("職種を選択してください。");
  }

  const avatarUrl =
    input.avatarUrl ??
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${input.id}`;

  const { error: userError } = await supabase.from("users").insert({
    id: input.id,
    name: input.name,
    avatar_url: avatarUrl,
    department: input.department,
    department_path: input.departmentPath,
    job_title: input.jobTitle,
    age: input.age,
    enabled_modes: ["work"], // 恋愛モードはマイページで自分でONにする
  });
  if (userError) throw userError;

  const { error: profileError } = await supabase.from("profiles").insert([
    { user_id: input.id, mode: "work" },
    { user_id: input.id, mode: "romance" },
  ]);
  if (profileError) throw profileError;

  const created = await getUser(input.id);
  if (!created) throw new Error("ユーザーの作成に失敗しました");
  return created;
}

/** 共通項目（名前・部署・職種・年齢・参加モード）を更新する */
export async function updateUser(
  userId: string,
  input: Partial<{
    name: string;
    department: string;
    departmentPath: string;
    jobTitle: string;
    age: number;
    gender: string;
    university: string;
    avatarUrl: string;
    enabledModes: Mode[];
  }>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.department !== undefined) patch.department = input.department;
  if (input.departmentPath !== undefined)
    patch.department_path = input.departmentPath;
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle;
  if (input.age !== undefined) patch.age = input.age;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.university !== undefined) patch.university = input.university;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  if (input.enabledModes !== undefined) patch.enabled_modes = input.enabledModes;

  const { error } = await supabase.from("users").update(patch).eq("id", userId);
  if (error) throw error;
}

/** モードごとのプロフィール（自己紹介・タグ・部署の表示可否）を更新する */
export async function updateProfile(
  userId: string,
  mode: Mode,
  input: Partial<Profile>,
): Promise<void> {
  // 項目が多いので、列名の対応表（PROFILE_COLUMNS）を回して組み立てる。
  // 項目ごとに if を並べると、追加したときに書き忘れが起きるため。
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    const value = input[key as keyof Profile];
    if (value !== undefined) patch[column] = value;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .eq("mode", mode);
  if (error) throw error;
}

// ───────────────────────── いいね・見送り ─────────────────────────

/**
 * いいねを送る。相手からのいいねが既にあればマッチを作って返す。
 * 成立しなかった場合は null（相手には何も通知されない）。
 */
export async function likeUser(
  fromUserId: string,
  toUserId: string,
  mode: Mode,
): Promise<Match | null> {
  const { error } = await supabase.from("reactions").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    mode,
    type: "like",
  });
  // 同じ相手に二度押した場合は無視する
  if (error && error.code !== "23505") throw error;

  const { data: reverse, error: reverseError } = await supabase
    .from("reactions")
    .select("id")
    .eq("from_user_id", toUserId)
    .eq("to_user_id", fromUserId)
    .eq("mode", mode)
    .eq("type", "like")
    .maybeSingle();
  if (reverseError) throw reverseError;
  if (!reverse) return null;

  const existing = await findMatch(fromUserId, toUserId, mode);
  if (existing) return existing;

  const { data, error: matchError } = await supabase
    .from("matches")
    .insert({ user_a_id: fromUserId, user_b_id: toUserId, mode })
    .select()
    .single();
  if (matchError) throw matchError;
  return toMatch(data);
}

/**
 * 見送る。
 * 履歴機能のため、仕事モード・恋愛モード両方とも保存する。
 */
export async function passUser(
  fromUserId: string,
  toUserId: string,
  mode: Mode,
): Promise<void> {
  // 仕事モードでも見送りを保存するように変更（履歴機能のため）
  const { error } = await supabase.from("reactions").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    mode,
    type: "pass",
  });
  if (error && error.code !== "23505") throw error;
}

/**
 * 自分がした反応（いいね・見送り）の履歴を取得する。
 * 新しい順に返す。
 */
export async function getReactionHistory(
  userId: string,
  mode: Mode,
): Promise<Reaction[]> {
  const { data, error } = await supabase
    .from("reactions")
    .select("from_user_id, to_user_id, mode, type, created_at")
    .eq("from_user_id", userId)
    .eq("mode", mode)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    mode: row.mode as Mode,
    type: row.type as "like" | "pass",
    createdAt: row.created_at,
  }));
}

/**
 * 反応を取り消す（履歴から削除）。
 */
export async function deleteReaction(
  fromUserId: string,
  toUserId: string,
  mode: Mode,
): Promise<void> {
  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("from_user_id", fromUserId)
    .eq("to_user_id", toUserId)
    .eq("mode", mode);

  if (error) throw error;
}

// ───────────────────────── マッチ・メッセージ ─────────────────────────

type MatchRow = {
  id: number;
  user_a_id: string;
  user_b_id: string;
  mode: string;
  created_at: string;
};

function toMatch(row: MatchRow): Match {
  return {
    id: String(row.id),
    userIds: [row.user_a_id, row.user_b_id],
    mode: row.mode as Mode,
    createdAt: row.created_at,
  };
}

async function findMatch(
  userA: string,
  userB: string,
  mode: Mode,
): Promise<Match | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("mode", mode)
    .or(
      `and(user_a_id.eq.${userA},user_b_id.eq.${userB}),and(user_a_id.eq.${userB},user_b_id.eq.${userA})`,
    )
    .maybeSingle();
  if (error) throw error;
  return data ? toMatch(data) : null;
}

type MatchReadRow = {
  match_id: number;
  last_read_at: string;
};

// ───────────────────────── ブロック ─────────────────────────

/**
 * 相手をブロックする。
 *
 * 以後その相手は、自分のトーク一覧にも探す画面にも出てこなくなる。
 * ブロックしたことは相手には伝わらず、相手の画面は変わらない
 * （blocks の select を blocker 本人に限っているため。supabase/blocks.sql 参照）。
 *
 * supabase/blocks.sql を実行していない環境では失敗する。
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  mode: Mode,
): Promise<void> {
  const { error } = await supabase.from("blocks").insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
    mode,
  });
  // すでにブロック済みなら、そのままで目的は達成されている
  if (error && error.code !== "23505") throw error;
}

/**
 * 自分がブロックした相手の ID。
 *
 * supabase/blocks.sql をまだ流していない環境ではここが必ず失敗する。
 * 一覧を丸ごとエラーにすると画面が真っ白になってしまうので、
 * 警告を出して「ブロック無し」として続ける（match_reads と同じ方針）。
 */
async function getBlockedUserIds(
  userId: string,
  mode: Mode,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId)
    .eq("mode", mode);

  if (error) {
    console.warn(
      "ブロックの一覧を取得できませんでした。supabase/blocks.sql を実行してください。",
      error,
    );
    return new Set();
  }
  return new Set(
    (data ?? []).map((r: { blocked_id: string }) => r.blocked_id),
  );
}

/** トーク画面のマッチ一覧。相手・最新メッセージ・未読件数をまとめて返す */
export async function getMatches(
  userId: string,
  mode: Mode,
): Promise<MatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("mode", mode)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const allMatches = (data as MatchRow[]).map(toMatch);
  if (allMatches.length === 0) return [];

  // ブロックした相手との会話は、この先まとめて無かったことにする。
  // ここで絞っておけば、相手・メッセージ・既読位置の取得も減る。
  const blocked = await getBlockedUserIds(userId, mode);
  const matches = allMatches.filter(
    (m) => !blocked.has(m.userIds[0] === userId ? m.userIds[1] : m.userIds[0]),
  );
  if (matches.length === 0) return [];

  const partnerIds = matches.map((m) =>
    m.userIds[0] === userId ? m.userIds[1] : m.userIds[0],
  );

  const { data: userRows, error: userError } = await supabase
    .from("users")
    .select(USER_SELECT)
    .in("id", partnerIds);
  if (userError) throw userError;
  const partners = new Map(
    (userRows as UserRow[]).map((row) => [row.id, toUser(row)]),
  );

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .in(
      "match_id",
      matches.map((m) => Number(m.id)),
    )
    .order("created_at", { ascending: false });
  if (messageError) throw messageError;

  // 自分の既読位置。行が無いマッチは「一度も開いていない」＝全部未読になる
  const { data: readRows, error: readError } = await supabase
    .from("match_reads")
    .select("match_id,last_read_at")
    .eq("user_id", userId)
    .in(
      "match_id",
      matches.map((m) => Number(m.id)),
    );

  // 既読位置が取れなくても、一覧そのものは出せた方がよい（未読数が出ないだけで済む）。
  // supabase/match_reads.sql をまだ流していない環境ではここが必ず失敗するので、
  // 一覧を丸ごとエラーにせず、警告を出して「全部未読」として続ける。
  if (readError) {
    console.warn(
      "既読位置を取得できませんでした。supabase/match_reads.sql を実行してください。",
      readError,
    );
  }

  const lastReadByMatch = new Map<string, number>(
    ((readRows as MatchReadRow[] | null) ?? []).map((row) => [
      String(row.match_id),
      Date.parse(row.last_read_at),
    ]),
  );

  // メッセージは1回の問い合わせで全マッチ分を取ってあるので、
  // 最新メッセージと未読件数はここでまとめて数える（マッチごとに問い合わせない）。
  const latestByMatch = new Map<string, Message>();
  const unreadByMatch = new Map<string, number>();
  for (const row of messageRows ?? []) {
    const message = toMessage(row);
    if (!latestByMatch.has(message.matchId)) {
      latestByMatch.set(message.matchId, message);
    }

    // 自分が送ったものは未読にならない
    if (message.senderId === userId) continue;
    const lastReadAt = lastReadByMatch.get(message.matchId) ?? 0;
    if (Date.parse(message.createdAt) > lastReadAt) {
      unreadByMatch.set(
        message.matchId,
        (unreadByMatch.get(message.matchId) ?? 0) + 1,
      );
    }
  }

  return matches
    .map((match) => {
      const partnerId =
        match.userIds[0] === userId ? match.userIds[1] : match.userIds[0];
      const partner = partners.get(partnerId);
      if (!partner) return null;
      return {
        match,
        partner,
        latestMessage: latestByMatch.get(match.id) ?? null,
        unreadCount: unreadByMatch.get(match.id) ?? 0,
      };
    })
    .filter((m): m is MatchSummary => m !== null);
}

/**
 * 会話を「ここまで読んだ」と記録する。
 *
 * readAt には読んだ最後のメッセージの createdAt を渡す。
 * ブラウザの現在時刻ではなく DB が採番した時刻を使うので、
 * 端末の時計がずれていても未読件数が狂わない。
 *
 * 素の upsert ではなく mark_match_read 関数を呼ぶ。
 * 書き込みが2つ重なったとき、古いほうが後から届いて既読位置が巻き戻るのを
 * 防ぐため、DB 側で greatest() を取って前にしか進まないようにしている。
 * ユーザーの指定も DB 側の auth.uid() に任せている。
 *
 * supabase/match_reads.sql を実行していない環境では失敗する。
 */
export async function markMatchRead(
  matchId: string,
  readAt: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_match_read", {
    p_match_id: Number(matchId),
    p_read_at: readAt,
  });
  if (error) throw error;
}

type MessageRow = {
  id: number;
  match_id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

function toMessage(row: MessageRow): Message {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getMessages(matchId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", Number(matchId))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as MessageRow[]).map(toMessage);
}

export async function sendMessage(
  matchId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: Number(matchId), sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  return toMessage(data);
}

// ───────────────────────── トークに送る写真 ─────────────────────────

/** 写真の置き場所。supabase/message_images.sql で作られる */
export const MESSAGE_IMAGE_BUCKET = "message-images";

/**
 * 写真を Storage に上げて、そのまま messages.body に入れられる URL を返す。
 *
 * 本文に画像そのもの（data URL）を入れると、一覧と会話のポーリングが
 * 数秒ごとに全画像を取り直すことになり、写真が溜まるほど転送量が増え続ける。
 * URL にしておけばブラウザがキャッシュするので、再取得は起きない。
 *
 * supabase/message_images.sql を実行していない環境では失敗する。
 */
export async function uploadMessageImage(
  matchId: string,
  blob: Blob,
): Promise<string> {
  // マッチごとにフォルダを分けておくと、後で不要なぶんをまとめて消せる
  const path = `${matchId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(MESSAGE_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage
    .from(MESSAGE_IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
// ───────────────────────── プロフィールアイコン ─────────────────────────

/** アイコンの置き場所。supabase/avatar_images.sql で設定される */
export const AVATAR_BUCKET = "avatars";

/**
 * アイコンを Storage に上げて、users.avatar_url に入れられる URL を返す。
 *
 * 同じパスに上書きせず毎回ランダムな名前で置くのは、上書きすると
 * ブラウザやCDNが古い画像をキャッシュし続けて変更が反映されないため。
 *
 * supabase/avatar_images.sql を実行していない環境では失敗する。
 */
export async function uploadAvatarImage(
  userId: string,
  blob: Blob,
): Promise<string> {
  // ユーザーごとにフォルダを分ける（ポリシーもこの前提で書かれている）
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
// ───────────────────────── ポイント ─────────────────────────

/**
 * ポイントを増やす。戻り値は増やしたあとの残高。
 *
 * 対象は「いま操作している本人」で固定。誰に足すかは引数で受けず、
 * DB 側で auth.uid() から決めている（他人のポイントを増やせないように）。
 *
 * 履歴（point_events）の追加と残高の更新は関数の中でまとめて行われる。
 * 片方だけ成功して食い違うことはない。
 *
 * reason には 'first_message' のような、何で貯まったかが分かる文字列を渡す。
 * supabase/points.sql を実行していない環境では失敗する。
 */
export async function awardPoints(
  amount: number,
  reason: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("award_points", {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** 受け取り済みの充実度の段。モードごとに分けて返す */
export type ClaimedMilestones = Record<Mode, number[]>;

/**
 * 自分が受け取った充実度の段を読む。バーの目盛りに印を付けるために使う。
 *
 * 他人のぶんは RLS で読めない（supabase/profile_milestones.sql 参照）。
 * SQL をまだ流していない環境では空を返し、画面は印なしで動く。
 * ここで例外にすると、ポイントと関係のないマイページ全体が開かなくなるため。
 */
export async function getClaimedMilestones(
  userId: string,
): Promise<ClaimedMilestones> {
  const claimed: ClaimedMilestones = { work: [], romance: [] };

  const { data, error } = await supabase
    .from("profile_milestones")
    .select("mode, milestone")
    .eq("user_id", userId);
  if (error) {
    console.error(
      "受け取り済みの段を取得できませんでした。supabase/profile_milestones.sql を実行してください。",
      error,
    );
    return claimed;
  }

  for (const row of (data ?? []) as { mode: Mode; milestone: number }[]) {
    claimed[row.mode]?.push(row.milestone);
  }
  for (const mode of MODES) {
    claimed[mode].sort((a, b) => a - b);
  }
  return claimed;
}

export type ClaimResult = {
  /** 今回はじめて届いた段。何も無ければ空 */
  claimed: number[];
  /** 今回 受け取り箱に入れた額。残高はまだ増えない */
  awarded: number;
};

/**
 * 届いている段のうち、まだ箱に入れていないものを受け取り箱へ入れる。
 *
 * ここでは残高は増えない。増えるのはポイント画面で claimPointRewards() を
 * 呼んだとき。
 *
 * 二度目が付かないことは DB 側の主キーが保証している。画面が段を覚えて
 * おく必要はないので、保存のたびに呼んでよい（届いていなければ何も起きない）。
 *
 * percent は lib/profile-completion.ts の profileCompletion() で出した値を、
 * 「保存した内容」から計算して渡すこと。下書きから渡すと、保存していない
 * 内容でポイントが付いてしまう。
 *
 * supabase/profile_milestones.sql を実行していない環境では失敗する。
 */
export async function claimProfileMilestones(
  mode: Mode,
  percent: number,
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_profile_milestones", {
    p_mode: mode,
    p_percent: percent,
  });
  if (error) throw error;

  const result = (data ?? {}) as Partial<ClaimResult>;
  return {
    claimed: result.claimed ?? [],
    awarded: result.awarded ?? 0,
  };
}

// ───────────────────────── 受け取り箱・ミッション・交換 ─────────────────────────

/** ポイントの増減1件。履歴に出す */
export type PointEvent = {
  id: string;
  /** 増減。交換は負数 */
  amount: number;
  /** 'profile_50_work' / 'daily_login' / 'exchange_coffee_ticket' など */
  reason: string;
  createdAt: string;
};

type PointEventRow = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

/**
 * ポイントの履歴を新しい順に読む。
 *
 * 表示名は reason から画面側で作る（lib/points.ts の pointEventLabel）。
 * 履歴に文言を保存していないのは、あとから言い回しを直せるようにするため。
 */
export async function getPointEvents(
  userId: string,
  limit = 50,
): Promise<PointEvent[]> {
  const { data, error } = await supabase
    .from("point_events")
    .select("id, amount, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data as PointEventRow[]).map((row) => ({
    id: String(row.id),
    amount: row.amount,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

/** 受け取り箱に届いている1件 */
export type PointReward = {
  id: string;
  amount: number;
  reason: string;
  /** 受信箱に出す文言。DB が持っている */
  label: string;
  createdAt: string;
};

type PointRewardRow = {
  id: number;
  amount: number;
  reason: string;
  label: string;
  created_at: string;
};

/** 受け取り箱の未受け取りぶんを、届いた順に読む */
export async function getPendingRewards(
  userId: string,
): Promise<PointReward[]> {
  const { data, error } = await supabase
    .from("point_rewards")
    .select("id, amount, reason, label, created_at")
    .eq("user_id", userId)
    .is("claimed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data as PointRewardRow[]).map((row) => ({
    id: String(row.id),
    amount: row.amount,
    reason: row.reason,
    label: row.label,
    createdAt: row.created_at,
  }));
}

export type RewardClaimResult = {
  /** 受け取った件数 */
  claimed: number;
  /** 今回増えたポイント */
  awarded: number;
  /** 増やしたあとの残高 */
  points: number;
};

/**
 * 受け取り箱の中身を受け取る。残高に加算され、履歴にも残る。
 *
 * ids を省略すると未受け取りをすべて受け取る（まとめて受け取る）。
 * 二重に受け取れないことは DB 側が保証しているので、押し過ぎても増えない。
 */
export async function claimPointRewards(
  ids?: string[],
): Promise<RewardClaimResult> {
  const { data, error } = await supabase.rpc("claim_point_rewards", {
    p_ids: ids ? ids.map(Number) : null,
  });
  if (error) throw error;

  const result = (data ?? {}) as Partial<RewardClaimResult>;
  return {
    claimed: result.claimed ?? 0,
    awarded: result.awarded ?? 0,
    points: result.points ?? 0,
  };
}

/**
 * 今日のデイリーミッションの進捗を取り、達成済みのものを受け取り箱へ入れる。
 *
 * 「読むだけ」ではなく箱入れも行うので、ポイント画面を開いたときに呼ぶ。
 * 何度呼んでも、同じ日の同じミッションは一度しか箱に入らない。
 *
 * 日付の境界（JST 0:00）と達成の判定は DB 側が持つ。端末の時計は使わない。
 */
export async function syncDailyMissions(): Promise<DailyProgress> {
  const { data, error } = await supabase.rpc("sync_daily_missions");
  if (error) throw error;

  const result = (data ?? {}) as Partial<DailyProgress>;
  return {
    date: result.date ?? "",
    replies: result.replies ?? 0,
    likes: result.likes ?? 0,
    achieved: result.achieved ?? [],
  };
}

/** 持ち物。交換していない種類は入っていない */
export type UserItems = Partial<Record<ItemId, number>>;

export async function getUserItems(userId: string): Promise<UserItems> {
  const { data, error } = await supabase
    .from("user_items")
    .select("item, quantity")
    .eq("user_id", userId);
  if (error) throw error;

  const items: UserItems = {};
  for (const row of (data ?? []) as { item: ItemId; quantity: number }[]) {
    items[row.item] = row.quantity;
  }
  return items;
}

export type ExchangeResult = {
  item: ItemId;
  label: string;
  cost: number;
  /** 交換したあとの所持数 */
  quantity: number;
  /** 引いたあとの残高 */
  points: number;
};

/**
 * ポイントを使ってアイテムを1つ交換する。
 *
 * 値段は DB 側が持っている（lib/points.ts の ITEMS は表示用の写し）。
 * 残高が足りなければ例外になるので、呼ぶ前に画面でも押せないようにしておく。
 */
export async function exchangeItem(item: ItemId): Promise<ExchangeResult> {
  const { data, error } = await supabase.rpc("exchange_item", {
    p_item: item,
  });
  if (error) throw error;
  return data as ExchangeResult;
}

// ───────────────────────── 募集掲示板 ─────────────────────────

type BoardRow = {
  id: string;
  user_id: string;
  mode: string;
  title: string;
  description: string;
  max_participants: number | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode as Mode,
    title: row.title,
    description: row.description,
    maxParticipants: row.max_participants,
    deadline: row.deadline,
    status: row.status as "募集中" | "募集終了",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 募集一覧を取得する。新しい順に返す。
 */
export async function getBoards(mode: Mode): Promise<Board[]> {
  const { data, error} = await supabase
    .from("boards")
    .select("*")
    .eq("mode", mode)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map(toBoard);
}

/**
 * 募集詳細を取得する。
 */
export async function getBoard(id: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return toBoard(data);
}

/**
 * 募集を作成する。
 */
export async function createBoard(input: {
  userId: string;
  mode: Mode;
  title: string;
  description: string;
  maxParticipants?: number | null;
  deadline?: string | null;
}): Promise<Board> {
  const { data, error } = await supabase
    .from("boards")
    .insert({
      user_id: input.userId,
      mode: input.mode,
      title: input.title,
      description: input.description,
      max_participants: input.maxParticipants ?? null,
      deadline: input.deadline ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toBoard(data);
}

/**
 * 募集を更新する。
 */
export async function updateBoard(
  id: string,
  input: {
    title?: string;
    description?: string;
    maxParticipants?: number | null;
    deadline?: string | null;
    status?: "募集中" | "募集終了";
  },
): Promise<void> {
  const updates: any = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.maxParticipants !== undefined)
    updates.max_participants = input.maxParticipants;
  if (input.deadline !== undefined) updates.deadline = input.deadline;
  if (input.status !== undefined) updates.status = input.status;

  const { error } = await supabase
    .from("boards")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/**
 * 募集を削除する。
 */
export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) throw error;
}

/**
 * 募集に参加する。
 */
export async function joinBoard(boardId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("board_participants").insert({
    board_id: boardId,
    user_id: userId,
  });
  // 既に参加している場合はエラーを無視
  if (error && error.code !== "23505") throw error;
}

/**
 * 募集から退出する。
 */
export async function leaveBoard(
  boardId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("board_participants")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * 募集の参加者IDリストを取得する。
 */
export async function getBoardParticipantIds(
  boardId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("board_participants")
    .select("user_id")
    .eq("board_id", boardId)
    .order("created_at");

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => row.user_id);
}

/**
 * 募集のグループチャットメッセージを取得する。
 */
export async function getBoardMessages(
  boardId: string,
): Promise<BoardMessage[]> {
  const { data, error } = await supabase
    .from("board_messages")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

/**
 * 募集のグループチャットにメッセージを送信する。
 */
export async function sendBoardMessage(
  boardId: string,
  userId: string,
  body: string,
): Promise<BoardMessage> {
  const { data, error } = await supabase
    .from("board_messages")
    .insert({
      board_id: boardId,
      user_id: userId,
      body,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    boardId: data.board_id,
    userId: data.user_id,
    body: data.body,
    createdAt: data.created_at,
  };
}
