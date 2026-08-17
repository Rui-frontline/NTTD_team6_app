import { supabase } from "@/lib/supabase";
import type {
  Match,
  MatchSummary,
  Message,
  Mode,
  Profile,
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
  job_title: string;
  age: number;
  enabled_modes: string[];
  profiles?: ProfileRow[] | null;
};

type ProfileRow = {
  user_id: string;
  mode: string;
  bio: string | null;
  tags: string[] | null;
  show_department: boolean | null;
};

const EMPTY_PROFILE: Profile = { bio: "", tags: [], showDepartment: true };

function toProfile(row: ProfileRow | undefined): Profile {
  if (!row) return EMPTY_PROFILE;
  return {
    bio: row.bio ?? "",
    tags: row.tags ?? [],
    showDepartment: row.show_department ?? true,
  };
}

function toUser(row: UserRow): User {
  const profiles = row.profiles ?? [];
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    department: row.department,
    jobTitle: row.job_title,
    age: row.age,
    enabledModes: (row.enabled_modes ?? []) as Mode[],
    work: toProfile(profiles.find((p) => p.mode === "work")),
    romance: toProfile(profiles.find((p) => p.mode === "romance")),
  };
}

const USER_SELECT = "id,name,avatar_url,department,job_title,age,enabled_modes,profiles(*)";

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
 * - 相手からいいねが来ている人を優先表示（それ以外はランダム順）
 */
export async function getUsers(
  mode: Mode,
  currentUserId: string,
  filter: DiscoverFilter = {},
): Promise<User[]> {
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
  return new Set((data ?? []).map((r: { to_user_id: string }) => r.to_user_id));
}

function matchesFilter(user: User, mode: Mode, f: DiscoverFilter): boolean {
  const profile = mode === "work" ? user.work : user.romance;

  if (f.departments?.length && !f.departments.includes(user.department)) return false;
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
  jobTitle: string;
  age: number;
  avatarUrl?: string;
}): Promise<User> {
  const avatarUrl =
    input.avatarUrl ??
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${input.id}`;

  const { error: userError } = await supabase.from("users").insert({
    id: input.id,
    name: input.name,
    avatar_url: avatarUrl,
    department: input.department,
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
    jobTitle: string;
    age: number;
    avatarUrl: string;
    enabledModes: Mode[];
  }>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.department !== undefined) patch.department = input.department;
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle;
  if (input.age !== undefined) patch.age = input.age;
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
  const patch: Record<string, unknown> = {};
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.showDepartment !== undefined) patch.show_department = input.showDepartment;

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
 * 恋愛モードのみ保存する（仕事モードは保存しないので、リロードすると戻る）。
 */
export async function passUser(
  fromUserId: string,
  toUserId: string,
  mode: Mode,
): Promise<void> {
  if (mode !== "romance") return;
  const { error } = await supabase.from("reactions").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    mode,
    type: "pass",
  });
  if (error && error.code !== "23505") throw error;
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

/** トーク画面のマッチ一覧。相手と最新メッセージをまとめて返す */
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

  const matches = (data as MatchRow[]).map(toMatch);
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

  const latestByMatch = new Map<string, Message>();
  for (const row of messageRows ?? []) {
    const message = toMessage(row);
    if (!latestByMatch.has(message.matchId)) {
      latestByMatch.set(message.matchId, message);
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
      };
    })
    .filter((m): m is MatchSummary => m !== null);
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
