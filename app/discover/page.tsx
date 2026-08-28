"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  getIncomingSuperLikeIds,
  getUserItems,
  getUsers,
  likeUser,
  passUser,
  superLikeUser,
} from "@/lib/repository";
import type { Mode, User } from "@/lib/types";
import type { DiscoverFilter } from "@/lib/repository";
import { TAG_OPTIONS } from "@/lib/types";
import { departmentLeaves } from "@/lib/departments";
import { JOB_TITLE_OPTIONS } from "@/lib/profile-fields";
import { ProfileDetailModal } from "@/components/profile/ProfileDetailModal";
import styles from "./discover.module.css";

/**
 * 部署の選択肢。木をたどるので、描画のたびに作り直さないよう
 * モジュールの読み込み時に1回だけ組み立てる。
 */
const DEPARTMENT_OPTIONS = departmentLeaves();

/** 絞り込みの入力欄の見た目。3つとも同じなのでまとめる */
const filterControlStyle = {
  marginTop: "5px",
  padding: "8px",
  width: "100%",
  boxSizing: "border-box" as const,
};

type ReactionFeedback = {
  id: number;
  reaction: "like" | "pass";
  /** スーパーいいねか。文言と縁の色を変えるために持つ */
  isSuper: boolean;
  message:
    | "いいねを押しました"
    | "スーパーいいねを送りました"
    | "見送るを押しました";
};

type HeartBurst = {
  id: number;
  x: number;
  y: number;
};

/**
 * ハート演出が終わるまでの時間。
 * discover.module.css の float-heart (1.25s) と、いちばん遅いハートの
 * animation-delay (200ms) の合計。片方だけ変えるとズレる。
 */
const HEART_BURST_MS = 1450;

/** トーストとマッチ演出の表示時間。toast-life / match-backdrop-life と対。 */
const FEEDBACK_MS = 3000;

/**
 * スーパーいいねが失敗したときの文言。
 *
 * use_super_like は在庫切れなどを raise exception で返してくるので、
 * その文面をそのまま出す。「失敗しました」だけだと、交換すれば直るのか
 * どうかが分からない。
 *
 * Supabase のエラーは Error のインスタンスではなくただのオブジェクトなので、
 * instanceof では判定できない。
 */
/**
 * スーパーいいねのボタンに入れるハート。
 *
 * ONのときは縁と同じ虹色に光らせる。
 *
 * SVG ではなく文字のハートを使っている。SVG の塗りに CSS のグラデーションを
 * 流し込むには <linearGradient> を書くことになり、縁で使っている
 * --rainbow をそのまま使えない。文字なら background-clip: text で
 * 同じ変数を共有できて、色を変えたいときも1箇所で済む。
 *
 * rainbow-heart は app/globals.css の全体クラス。ポイント画面の交換カードと
 * 同じものを使うため、CSS Modules ではなくあちらに置いている。
 *
 * 炎そのものはボタン側の span が担当する。
 */
function HeartMark({ burning }: { burning: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={burning ? "rainbow-heart" : undefined}
      style={{
        fontSize: "26px",
        lineHeight: 1,
        ...(burning ? {} : { color: "var(--muted)" }),
      }}
    >
      ♥
    </span>
  );
}

/** 絞り込みのアイコン。つまみが3本のスライダー */
function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--surface)" />
      <circle cx="15" cy="12" r="2" fill="var(--surface)" />
      <circle cx="8" cy="17" r="2" fill="var(--surface)" />
    </svg>
  );
}

function superLikeErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  // PGRST202: PostgREST が関数を見つけられない
  // 42883:    PostgreSQL の function does not exist
  if (code === "PGRST202" || code === "42883") {
    return "スーパーいいねの保存先がまだありません。Supabase の SQL Editor で supabase/super_like.sql を実行してください。";
  }

  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : "";

  return message || "スーパーいいねを送れませんでした。";
}

export default function DiscoverPage() {
  const { currentUser, mode } = useSession();
  // 演出の見た目だけモードで変える（仕事は★、恋愛は♥）
  const isWork = mode === "work";
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  // 成立したマッチの id。「トークを見に行く」でこの会話を直接開くために持つ
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);
  /*
    絞り込みはモードごとに分けて持つ。

    1つの state を共有すると、仕事モードで指定した部署が恋愛モードにも
    効いてしまう。恋愛モードに部署の入力欄は無いので、絞り込まれている
    ことに気づけないまま「誰も出てこない」状態になる。

    切り替えて戻ったときに前の指定が残るのは意図した動き。指定し直す
    手間を省くため。
  */
  const [filters, setFilters] = useState<Record<Mode, DiscoverFilter>>({
    work: {},
    romance: {},
  });
  const filter = filters[mode];

  /** いま見ているモードの絞り込みだけを書き換える */
  const setFilter = (update: (prev: DiscoverFilter) => DiscoverFilter) => {
    setFilters((prev) => ({ ...prev, [mode]: update(prev[mode]) }));
  };
  const [showFilter, setShowFilter] = useState(false);
  const [showDetailProfile, setShowDetailProfile] = useState(false);
  const [testMode, setTestMode] = useState(false); // テストモード（初期値OFF、必要時はコードで変更）
  /** 自分にスーパーいいねを送ってきた人。カードのバッジに使う */
  const [superLikedByIds, setSuperLikedByIds] = useState<Set<string>>(
    () => new Set(),
  );
  /** スーパーいいねの所持数。0 のときは切り替えられない */
  const [superLikeStock, setSuperLikeStock] = useState(0);
  /** 「スーパーいいねを使う」がONか。ONの間だけ、いいねがスーパーいいねになる */
  const [useSuperLike, setUseSuperLike] = useState(false);
  const [reactionFeedback, setReactionFeedback] =
    useState<ReactionFeedback | null>(null);
  const [heartBurst, setHeartBurst] = useState<HeartBurst | null>(null);
  // 真偽値ではなく成立ごとに増える id を持つ。true のまま true を入れても
  // 要素は再マウントされず、2件目のマッチで演出が再生されないため。
  // key に渡して、成立のたびに作り直させる（heartBurst と同じ作り）。
  const [matchCelebrationId, setMatchCelebrationId] = useState<number | null>(
    null,
  );
  const likeButtonRef = useRef<HTMLButtonElement | null>(null);
  const reactionFeedbackTimer = useRef<number | null>(null);
  const matchCelebrationTimer = useRef<number | null>(null);
  const heartBurstTimer = useRef<number | null>(null);

  /*
    いま画面に出ているモードの世代。

    likeUser / passUser の応答を待っている間にモードを切り替えると、
    古いモードで始めた操作が新しいモードの state を書き換えてしまう。
    取得し直した一覧の先頭が飛ばされ、マッチしたときには前のモードの相手が
    新しいモードのモーダルに出る。

    操作を始めた時点の世代を控えておき、応答が返った時点でずれていたら
    何もせずに終える。
  */
  const reactionModeVersionRef = useRef(0);
  useLayoutEffect(() => {
    reactionModeVersionRef.current += 1;
  }, [mode]);

  /*
    モードを切り替えたら、出している演出をその場で消す。

    残したままだと、恋愛モードで飛ばした♥が切り替えた瞬間に★へ化ける
    （見た目だけ isWork で分けているため）。マッチ成立の演出は恋愛モード
    でしか出ないので、こちらは残すと切り替えで再生され直す。

    effect で setState するとカスケード描画になるため、描画中に整える。
  */
  const [renderedMode, setRenderedMode] = useState(mode);
  if (renderedMode !== mode) {
    setRenderedMode(mode);
    setHeartBurst(null);
    setReactionFeedback(null);
    setMatchCelebrationId(null);
  }

  // 現在表示中のユーザー
  const currentUser_displayed = users[currentIndex] || null;

  /*
    何番目の問い合わせかを覚えておき、最後に投げたものの結果だけを採用する。

    絞り込みパネルは取得中も操作できるので、続けて条件を変えると getUsers が
    並行して走る。古いほうが後に返ってくると、いま選んでいる条件と中身が
    食い違ったまま表示される。

    loading を戻すのも最新のときだけ。古い応答で下ろすと、まだ取得中なのに
    カードが出てしまう。

    components/TalkScreen.tsx の一覧取得と同じやり方。
  */
  const usersRequestId = useRef(0);

  // ユーザー一覧を取得
  useEffect(() => {
    if (!currentUser) return;
    const id = ++usersRequestId.current;

    setLoading(true);
    setCurrentIndex(0); // モードやフィルター変更時は最初から
    getUsers(mode, currentUser.id, filter)
      .then((data) => {
        if (id !== usersRequestId.current) return;
        setUsers(data);
      })
      .catch((error) => {
        if (id !== usersRequestId.current) return;
        console.error("ユーザー取得エラー:", error);
      })
      .finally(() => {
        if (id !== usersRequestId.current) return;
        setLoading(false);
      });
  }, [currentUser, mode, filter]);

  // 自分に届いているスーパーいいね。カードのバッジに使う
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;

    getIncomingSuperLikeIds(currentUser.id, mode)
      .then((ids) => {
        if (alive) setSuperLikedByIds(ids);
      })
      .catch(() => {
        // supabase/super_like.sql を流していない環境ではここに来る。
        // バッジが出ないだけで探す画面は成立するので、空にして続ける
        if (alive) setSuperLikedByIds(new Set());
      });

    return () => {
      alive = false;
    };
  }, [currentUser, mode]);

  // 自分の在庫。0 ならスーパーいいねに切り替えられない
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;

    getUserItems(currentUser.id)
      .then((items) => {
        if (alive) setSuperLikeStock(items.super_like ?? 0);
      })
      .catch(() => {
        if (alive) setSuperLikeStock(0);
      });

    return () => {
      alive = false;
    };
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (reactionFeedbackTimer.current !== null) {
        window.clearTimeout(reactionFeedbackTimer.current);
      }
      if (matchCelebrationTimer.current !== null) {
        window.clearTimeout(matchCelebrationTimer.current);
      }
      if (heartBurstTimer.current !== null) {
        window.clearTimeout(heartBurstTimer.current);
      }
    };
  }, []);

  /*
    いいね／見送りを押したときの反応。

    以前は mode !== "romance" で打ち切っていて、仕事モードでは押しても
    何も起きなかった。両モードで出すようにしている（見た目だけ変える）。
    マッチ成立の演出（showMatchFeedback）は恋愛モードのままにしてある。
  */
  const showReactionFeedback = (
    reaction: "like" | "pass",
    reactionModeVersion: number,
    isSuper = false,
  ): boolean => {
    // 操作を始めたときからモードが変わっていたら、演出を出さない。
    // 戻り値で呼び出し側にも「この先へ進むな」と伝える
    if (reactionModeVersion !== reactionModeVersionRef.current) {
      return false;
    }

    if (reaction === "like") {
      const buttonRect = likeButtonRef.current?.getBoundingClientRect();
      setHeartBurst((previous) => ({
        id: (previous?.id ?? 0) + 1,
        x: buttonRect
          ? buttonRect.left + buttonRect.width / 2
          : window.innerWidth / 2,
        y: buttonRect
          ? buttonRect.top + buttonRect.height / 2
          : window.innerHeight / 2,
      }));

      // 飛び終わったら消す。残したままだと、見えないだけの div が DOM に
      // 居座り、モードを切り替えたときに再マウントされて飛び直す。
      if (heartBurstTimer.current !== null) {
        window.clearTimeout(heartBurstTimer.current);
      }
      heartBurstTimer.current = window.setTimeout(() => {
        setHeartBurst(null);
        heartBurstTimer.current = null;
      }, HEART_BURST_MS);
    }

    if (reactionFeedbackTimer.current !== null) {
      window.clearTimeout(reactionFeedbackTimer.current);
    }

    setReactionFeedback((previous) => ({
      id: (previous?.id ?? 0) + 1,
      reaction,
      isSuper,
      message:
        reaction === "pass"
          ? "見送るを押しました"
          : isSuper
            ? "スーパーいいねを送りました"
            : "いいねを押しました",
    }));
    reactionFeedbackTimer.current = window.setTimeout(() => {
      setReactionFeedback(null);
      reactionFeedbackTimer.current = null;
    }, FEEDBACK_MS);

    return true;
  };

  const showMatchFeedback = () => {
    if (mode !== "romance") return;

    if (matchCelebrationTimer.current !== null) {
      window.clearTimeout(matchCelebrationTimer.current);
    }

    setMatchCelebrationId((previous) => (previous ?? 0) + 1);
    matchCelebrationTimer.current = window.setTimeout(() => {
      setMatchCelebrationId(null);
      matchCelebrationTimer.current = null;
    }, FEEDBACK_MS);
  };

  // 次のユーザーに進む
  const goToNextUser = () => {
    setCurrentIndex((prev) => {
      // テストモード中は最後まで行ったら最初に戻る
      if (testMode && prev + 1 >= users.length) {
        return 0;
      }
      return prev + 1;
    });
  };

  // いいねボタンの処理
  const handleLike = async (targetUser: User) => {
    if (!currentUser) return;
    const reactionModeVersion = reactionModeVersionRef.current;

    // テストモード：DBに保存せず次に進むだけ
    if (testMode) {
      if (!showReactionFeedback("like", reactionModeVersion)) return;
      goToNextUser();
      return;
    }

    // ONのときだけスーパーいいねになる。在庫が無ければONにできないので、
    // ここに来る時点で1つは持っている
    const asSuper = useSuperLike && superLikeStock > 0;

    try {
      const match = asSuper
        ? await superLikeUser(currentUser.id, targetUser.id, mode)
        : await likeUser(currentUser.id, targetUser.id, mode);

      if (asSuper) {
        // 使ったぶんを手元でも減らす。取り直しを待つと、連続で押したときに
        // 在庫があるように見えたままになる
        setSuperLikeStock((prev) => {
          const left = Math.max(0, prev - 1);
          // 使い切ったら勝手にOFFへ戻す。ONのままだと押すたびに失敗する
          if (left === 0) setUseSuperLike(false);
          return left;
        });
      }

      // 演出は書き込みが成功してから出す。await より前に出すと、
      // 通信や権限のエラーで失敗したときに「いいねを押しました」の
      // トーストとハートが最大3秒残り、その上に失敗アラートが出る。
      //
      // 待っている間にモードが変わっていたら、ここで打ち切る。
      // 演出も、マッチのモーダルも、次の人への送りも、すべて古いモードの
      // 操作に対するものなので、新しい画面に持ち込まない。
      if (!showReactionFeedback("like", reactionModeVersion, asSuper)) return;

      // マッチ成立の確認
      if (match) {
        console.log("マッチ成立！", match);
        showMatchFeedback();
        // モーダルを表示
        setMatchedUser(targetUser);
        setMatchedMatchId(match.id);
      }

      // 次のユーザーに進む
      goToNextUser();
    } catch (error) {
      // 失敗の通知も、もう別の画面を見ているなら出さない
      if (reactionModeVersion !== reactionModeVersionRef.current) return;
      console.error("いいね送信エラー:", error);
      // 在庫切れなど、DB 側が理由を返してくることがあるので拾って出す
      alert(
        asSuper
          ? superLikeErrorMessage(error)
          : "いいねの送信に失敗しました",
      );
    }
  };

  // 見送るボタンの処理
  const handlePass = async (targetUser: User) => {
    if (!currentUser) return;
    const reactionModeVersion = reactionModeVersionRef.current;

    // テストモード：DBに保存せず次に進むだけ
    if (testMode) {
      if (!showReactionFeedback("pass", reactionModeVersion)) return;
      goToNextUser();
      return;
    }

    try {
      // 恋愛モードの場合のみDBに保存
      if (mode === "romance") {
        await passUser(currentUser.id, targetUser.id, mode);
      }
      // 仕事モードの場合は保存しない（リロードで戻る）

      // handleLike と同じ理由で、演出は書き込みが成功してから出す。
      // モードが変わっていたら打ち切るのも同じ
      if (!showReactionFeedback("pass", reactionModeVersion)) return;

      // 次のユーザーに進む
      goToNextUser();
    } catch (error) {
      if (reactionModeVersion !== reactionModeVersionRef.current) return;
      console.error("見送りエラー:", error);
      alert("見送りに失敗しました");
    }
  };

  if (!currentUser) {
    return <div>ログインしてください</div>;
  }

  /*
    読み込み中でも画面ごと差し替えない。

    以前はここで <div>読み込み中...</div> を返していた。絞り込みを変えると
    取り直しが走って loading が立ち、そのあいだ絞り込みパネルごと消えて
    しまう。パネルは作り直されるので、入力していた内容も一緒に消えていた
    （「指定してもクリアされる」の原因）。

    カードの場所だけ差し替える。パネルは開いたまま残る。
  */

  return (
    <>
      {/*
        見出しもフィルターの行も置かない。カードに名前も職種も出ているので、
        その上に「あなたにおすすめ」と重ねても分かることが増えない。
        1枚ずつ見ていく画面なので、そのぶんカードを上に出す。

        フィルターは下の操作の行に入れた。カードの領域に absolute で置くと
        画面幅によって重なるし、専用の行を作るとそのぶんカードが下がる。
      */}
    {/* 背景色は指定しない。モードで切り替わる地の色（globals.css の
        --background）をそのまま使い、他の画面と揃えるため */}
    {/* position: relative は、演出（♥/★）を押した位置に出すための基準 */}
    <div style={{
      display: "flex",
      flexDirection: "column",
      // 上の余白は詰める。見出しを外したので、ここを空けるとカードが
      // 中途半端に下がるだけになる
      // 上は空けない。フィルターの行も見出しも無くなったので、
      // ここを空けるとカードが理由もなく下がる
      padding: "0 0 40px",
      position: "relative",
    }}>
      {loading ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "500px",
          color: "var(--muted)",
        }}>
          読み込み中...
        </div>
      ) : currentUser_displayed ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>
          {/*
            写真とプロフィール。

            幅は決めず「上限」だけ決める（width ではなく maxWidth）。
            画面が狭ければそのぶん縮み、広ければデザイン案の大きさで止まる。
            width で決めると 375px の画面でも 600px のまま描かれ、はみ出す。

            flexWrap で、横に並べきれなくなったら縦に落とす。
            flexShrink: 0 は付けない。付けると「縮むな」という指示になり、
            狭い画面でも幅を守ろうとしてはみ出す。
          */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
          }}>
            {/* 左：写真カード */}
            <div style={{
              // flexBasis で「余裕があれば 300px」を伝える。足りなければ縮む
              flex: "1 1 300px",
              maxWidth: "300px",
              // 高さも上限にしない。狭い画面では横幅に合わせて低くする
              aspectRatio: "3 / 5",
              maxHeight: "500px",
              backgroundColor: "var(--surface)",
              borderRadius: "28px",
              boxShadow: "var(--card-shadow)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <img
                src={currentUser_displayed.avatarUrl}
                alt={currentUser_displayed.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>

            {/* 右：プロフィールカード */}
            <div style={{
              flex: "1 1 600px",
              maxWidth: "600px",
              /*
                高さの上限を置かず、中に閉じたスクロールも作らない。

                以前は maxHeight: 500px と overflowY: auto で写真と高さを
                揃えていたが、いちばん下の「詳細プロフィールを見る」が
                カードの中に隠れ、開くたびにこの中をスクロールする必要があった。

                上限を外せば中身のぶんだけ伸びるので、ボタンは常に見えている。
                写真より少し高くなることがあるが、届かないよりはよい。
                下限だけは残す。中身が少ない人でカードが潰れないようにするため。
              */
              minHeight: "320px",
              backgroundColor: "var(--surface)",
              borderRadius: "28px",
              boxShadow: "var(--card-shadow)",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}>
              {/*
                スーパーいいねが届いていることを、この人のカードで知らせる。
                普通のいいねは相互になるまで伏せたままだが、これは送った側が
                自分で選んで明かしているので出してよい
              */}
              {superLikedByIds.has(currentUser_displayed.id) && (
                <div
                  // 虹は塗りつぶしではなく枠。中を地の色のままにしないと
                  // 文字が読めない
                  className="super-outline"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 16px",
                    borderRadius: "14px",
                    color: "var(--foreground)",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  この人からスーパーいいねが届いています
                </div>
              )}

              {/*
                名前。恋愛モードでは年齢も添える。

                以前は「年齢」という項目を1つ立てていたが、数字ひとつのために
                見出しと1行を使うぶん、下のボタンが押し出されていた。
              */}
              <h1 style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "bold",
                color: "var(--foreground)",
              }}>
                {currentUser_displayed.name}
                {mode === "romance" && `（${currentUser_displayed.age}）`}
              </h1>

              {/* 基本情報 */}
              <p style={{
                margin: 0,
                fontSize: "16px",
                color: "var(--muted)",
              }}>
                {/* 恋愛モードで部署を隠す設定を確認 */}
                {mode === "romance" && !currentUser_displayed.romance.showDepartment
                  ? currentUser_displayed.jobTitle
                  : `${currentUser_displayed.department} / ${currentUser_displayed.jobTitle}`}
              </p>

              {/* 区切り線 */}
              <div style={{ height: "1px", backgroundColor: "var(--line)" }} />

              {/* タグ */}
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold", color: "var(--foreground)" }}>
                  タグ
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {(mode === "work" ? currentUser_displayed.work.tags : currentUser_displayed.romance.tags).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "6px 16px",
                        backgroundColor: "var(--accent-soft)",
                        color: "var(--accent-strong)",
                        borderRadius: "20px",
                        fontSize: "14px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 区切り線 */}
              <div style={{ height: "1px", backgroundColor: "var(--line)" }} />

              {/* 自己紹介 */}
              <div>
                <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "var(--foreground)" }}>
                  自己紹介
                </p>
                <p style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "var(--foreground)",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap",
                }}>
                  {/* 冒頭100文字のみ表示 */}
                  {(mode === "work" ? currentUser_displayed.work.bio : currentUser_displayed.romance.bio).slice(0, 100)}
                  {(mode === "work" ? currentUser_displayed.work.bio : currentUser_displayed.romance.bio).length > 100 && "..."}
                </p>
              </div>

              {/* 詳細プロフィールを見るボタン */}
              <button
                onClick={() => setShowDetailProfile(true)}
                style={{
                  marginTop: "auto",
                  padding: "12px 0",
                  backgroundColor: "transparent",
                  color: "var(--accent-strong)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  textDecoration: "underline",
                }}
              >
                詳細プロフィールを見る →
              </button>
            </div>
          </div>

          {/*
            ボタン。狭い画面では2つで横幅を分け合う。

            width: 200px 固定だと、左右の余白と合わせて 440px 必要になり、
            スマホの幅（375px）に収まらない。flex で分け合わせ、広い画面では
            maxWidth で 200px に留める。
          */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
          }}>
            {/*
              フィルターはこの行の左端。見送る・いいねから離して置く。
              並べて同じ大きさにすると、押し間違えて相手を飛ばしかねない
            */}
            <button
              onClick={() => setShowFilter(true)}
              aria-label="絞り込み"
              title="絞り込み"
              style={{
                flexShrink: 0,
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--line)",
                borderRadius: "50%",
                cursor: "pointer",
                boxShadow: "var(--soft-shadow)",
              }}
            >
              <FilterIcon />
            </button>

            <button
              onClick={() => handlePass(currentUser_displayed)}
              style={{
                flex: "1 1 0",
                maxWidth: "200px",
                height: "56px",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--line)",
                borderRadius: "28px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "500",
                boxShadow: "var(--soft-shadow)",
              }}
            >
              ✕ 見送る
            </button>
            {/* ONのときは見た目もスーパーいいねに変える。押す前に分かるように */}
            <button
              ref={likeButtonRef}
              onClick={() => handleLike(currentUser_displayed)}
              className={useSuperLike ? "super-outline" : undefined}
              style={{
                flex: "1 1 0",
                maxWidth: "200px",
                height: "56px",
                borderRadius: "28px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: useSuperLike ? "bold" : "500",
                // ONのときは背景・枠・影をCSS側に任せる。ここで指定すると
                // インラインが勝ち、特に border: none だと枠が消えて虹が出ない
                ...(useSuperLike
                  ? { color: "var(--foreground)" }
                  : {
                      border: "none",
                      background: "var(--action-gradient)",
                      color: "#FFFFFF",
                      boxShadow: "var(--action-shadow)",
                    }),
              }}
            >
              {useSuperLike ? "スーパーいいね" : "♡ いいね"}
            </button>

            {/*
              スーパーいいねの切り替え。いいねの隣に置く。

              ONにすると縁が虹色に光り（.superOutline）、中のハートから炎が
              立ちのぼる。押した結果が一目で分かるようにするため。
              在庫が無いときは押せないようにして、交換できることを伝える。
            */}
            <button
              type="button"
              onClick={() => setUseSuperLike((prev) => !prev)}
              disabled={superLikeStock === 0}
              aria-pressed={useSuperLike}
              aria-label={`スーパーいいねを使う（残り ${superLikeStock}）`}
              title={
                superLikeStock === 0
                  ? "スーパーいいねがありません。ポイント画面で交換できます"
                  : `スーパーいいねを使う（残り ${superLikeStock}）`
              }
              className={[
                styles.superToggle,
                useSuperLike ? "super-outline" : "",
              ].join(" ")}
              style={{
                flexShrink: 0,
                width: "56px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                cursor: superLikeStock === 0 ? "not-allowed" : "pointer",
                opacity: superLikeStock === 0 ? 0.45 : 1,
                // ONのときは背景と枠をCSS側に任せる。ここで指定すると
                // インラインが勝ち、枠が消えて虹が出ない
                ...(useSuperLike
                  ? {}
                  : {
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--surface)",
                      boxShadow: "var(--soft-shadow)",
                    }),
              }}
            >
              {/*
                炎はONのときだけ。5つの出どころ・大きさ・速さをずらしてある
                （CSS 側の .flame:nth-child で1つずつ指定）。
                数を減らすと、間が空いてチカチカして見える。
              */}
              {useSuperLike ? (
                <>
                  <span className={styles.flame} aria-hidden="true" />
                  <span className={styles.flame} aria-hidden="true" />
                  <span className={styles.flame} aria-hidden="true" />
                  <span className={styles.flame} aria-hidden="true" />
                  <span className={styles.flame} aria-hidden="true" />
                </>
              ) : null}

              <HeartMark burning={useSuperLike} />

              {/* 残り数。丸の中に文字は入らないので、右上に小さく出す */}
              {superLikeStock > 0 ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    backgroundColor: "var(--badge-bg)",
                    color: "var(--badge-fg)",
                    fontSize: "10px",
                    fontWeight: "bold",
                    lineHeight: 1,
                  }}
                >
                  {superLikeStock}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
        }}>
          {/* 恋愛モードがOFFの場合の専用メッセージ */}
          {mode === "romance" && users.length === 0 && currentUser && !currentUser.enabledModes.includes("romance") ? (
            <>
              <p style={{ fontSize: "20px", color: "var(--foreground)", margin: 0 }}>
                恋愛機能はOFFです
              </p>
              <p style={{ fontSize: "16px", color: "var(--muted)", margin: 0 }}>
                恋愛モードを利用するには、マイページで機能をONにしてください
              </p>
              <button
                onClick={() => router.push("/me")}
                style={{
                  padding: "12px 32px",
                  background: "var(--action-gradient)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "28px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "500",
                  boxShadow: "var(--action-shadow)",
                }}
              >
                マイページで設定する
              </button>
            </>
          ) : (
            <p style={{ fontSize: "24px", color: "var(--muted)", margin: 0 }}>
              {users.length === 0 ? "ユーザーが見つかりませんでした" : "全てのユーザーを確認しました"}
            </p>
          )}
        </div>
      )}

      {/* フィルターパネル（右からスライドイン） */}
      {showFilter && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          }}
          onClick={() => setShowFilter(false)}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              // 狭い画面では画面幅いっぱいまで。400px 固定だと、375px の
              // 画面で右にはみ出して閉じるボタンに届かなくなる
              width: "min(400px, 100%)",
              backgroundColor: "var(--surface)",
              color: "var(--foreground)",
              padding: "20px",
              overflowY: "auto",
              boxShadow: "var(--card-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>フィルター</h2>
              <button
                onClick={() => setShowFilter(false)}
                style={{
                  padding: "5px 15px",
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                  border: "none",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
            </div>

            {/* 仕事モードのフィルター */}
            {mode === "work" && (
              <>
                {/*
                  部署と職種は自由入力ではなく選択式にする。登録のときも
                  選択式なので、打ち間違えると絶対に一致しなかった。
                  選択肢は登録画面と同じものを使う（lib/departments.ts /
                  lib/profile-fields.ts）
                */}
                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>部署:</strong>
                    <select
                      value={filter.departments?.[0] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          departments: value ? [value] : undefined,
                        }));
                      }}
                      style={filterControlStyle}
                    >
                      <option value="">すべて</option>
                      {DEPARTMENT_OPTIONS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>職種:</strong>
                    <select
                      value={filter.jobTitles?.[0] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          jobTitles: value ? [value] : undefined,
                        }));
                      }}
                      style={filterControlStyle}
                    >
                      <option value="">すべて</option>
                      {JOB_TITLE_OPTIONS.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>タグ:</strong>
                    <select
                      value={filter.tags?.[0] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          tags: value ? [value] : undefined,
                        }));
                      }}
                      style={filterControlStyle}
                    >
                      <option value="">すべて</option>
                      {TAG_OPTIONS.work.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            {/* 恋愛モードのフィルター */}
            {mode === "romance" && (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>年齢:</strong>
                    <div style={{ marginTop: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="number"
                        placeholder="最小"
                        value={filter.minAge ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFilter((prev) => ({
                            ...prev,
                            minAge: value ? Number(value) : undefined,
                          }));
                        }}
                        style={{ padding: "8px", width: "80px" }}
                      />
                      <span>〜</span>
                      <input
                        type="number"
                        placeholder="最大"
                        value={filter.maxAge ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFilter((prev) => ({
                            ...prev,
                            maxAge: value ? Number(value) : undefined,
                          }));
                        }}
                        style={{ padding: "8px", width: "80px" }}
                      />
                      <span>歳</span>
                    </div>
                  </label>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label>
                    <strong>タグ:</strong>
                    <select
                      value={filter.tags?.[0] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilter((prev) => ({
                          ...prev,
                          tags: value ? [value] : undefined,
                        }));
                      }}
                      style={filterControlStyle}
                    >
                      <option value="">すべて</option>
                      {TAG_OPTIONS.romance.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            <button
              onClick={() => {
                // 消すのは見ているモードのぶんだけ
                setFilter(() => ({}));
                setShowFilter(false);
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent-strong)",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                width: "100%",
              }}
            >
              フィルターをクリア
            </button>
          </div>
        </div>
      )}

      {/*
        詳細プロフィール。トーク・履歴と同じ部品を使う。

        以前はこの画面だけ別実装で、基本情報・タグ・自己紹介しか出していなかった。
        マイページで入れた項目（身長・体型・仕事の実績など）が出ないので、
        同じ相手でも開く場所によって見えるものが変わっていた。
      */}
      {showDetailProfile && currentUser_displayed && (
        <ProfileDetailModal
          user={currentUser_displayed}
          mode={mode}
          onClose={() => setShowDetailProfile(false)}
        />
      )}

      {/*
        3つの演出は同じ親の子として並ぶので、key は互いに重ならない値にする。
        id はそれぞれ独立に 1 から始まるため、種類名を付けずに渡すと最初の
        マッチで3つとも key="1" になり、React が対応付けを誤って要素を作り
        直す（マッチ演出が2回再生されていた原因）。
      */}
      {heartBurst && (
        <div
          key={`heart-${heartBurst.id}`}
          className={styles.heartBurst}
          style={{ left: heartBurst.x, top: heartBurst.y }}
          aria-hidden="true"
        >
          {isWork ? (
            <>
              <span className={styles.floatingWorkStar}>★</span>
              <span className={styles.floatingWorkStar}>★</span>
              <span className={styles.floatingWorkStar}>★</span>
            </>
          ) : (
            <>
              <span className={styles.floatingHeart}>♥</span>
              <span className={styles.floatingHeart}>♥</span>
              <span className={styles.floatingHeart}>♥</span>
            </>
          )}
        </div>
      )}

      {reactionFeedback && (
        <div
          key={`toast-${reactionFeedback.id}`}
          // スーパーいいねのときだけ縁を虹色にする。
          // こちらは流さない（3秒で消えるので、動かすと落ち着かない）
          className={[
            styles.reactionToast,
            reactionFeedback.isSuper ? "super-toast" : "",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <span className={styles.toastHeart} aria-hidden="true">
            {reactionFeedback.reaction === "pass"
              ? "✓"
              : reactionFeedback.isSuper || isWork
                ? "★"
                : "♥"}
          </span>
          {reactionFeedback.message}
        </div>
      )}

      {mode === "romance" && matchCelebrationId !== null && (
        <div
          key={`match-${matchCelebrationId}`}
          className={styles.matchCelebration}
          role="alert"
          aria-live="assertive"
        >
          <div className={styles.matchHalo} aria-hidden="true" />
          <div className={styles.matchSparkles} aria-hidden="true">
            <span>✦</span>
            <span>♥</span>
            <span>✧</span>
            <span>✦</span>
            <span>♥</span>
            <span>✧</span>
          </div>
          <div className={styles.matchCard}>
            <p className={styles.matchKicker}>IT&apos;S A</p>
            <p className={styles.matchTitle}>MATCH!!!</p>
            <p className={styles.matchMessage}>ふたりの想いがつながりました</p>
          </div>
        </div>
      )}

      {/* マッチ成立モーダル */}
      {matchedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "fadeIn 0.3s ease-in-out",
          }}
          onClick={() => {
            setMatchedUser(null);
            setMatchedMatchId(null);
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface)",
              padding: "clamp(24px, 5vw, 40px)",
              borderRadius: "28px",
              // maxWidth だけでは足りない。650px の上限は 375px の画面でも
              // 650px を許すので、画面幅からも抑える
              maxWidth: "min(650px, calc(100% - 32px))",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--card-shadow)",
              animation: "scaleIn 0.3s ease-in-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 見出し */}
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "var(--foreground)",
                }}
              >
                マッチ成立！
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--muted)",
                }}
              >
                相互にいいねが送られました
              </p>
            </div>

            {/* 写真と情報。狭い画面では縦に落とす */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "28px",
              marginBottom: "36px",
              alignItems: "center"
            }}>
              {/* 左：写真 */}
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  flexShrink: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid var(--accent-soft)",
                  boxShadow: "var(--soft-shadow)",
                }}
              >
                <img
                  src={matchedUser.avatarUrl}
                  alt={matchedUser.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* 右：情報 */}
              <div style={{ flex: 1 }}>
                {/* 相手の名前 */}
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "var(--foreground)",
                  }}
                >
                  {matchedUser.name}
                </h3>

                {/* 部署・職種 */}
                <p
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    color: "var(--muted)",
                  }}
                >
                  {matchedUser.department} / {matchedUser.jobTitle}
                </p>

                {/* メッセージ */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "var(--foreground)",
                    lineHeight: "1.6",
                  }}
                >
                  トーク画面でメッセージを送ってみましょう
                </p>
              </div>
            </div>

            {/* ボタン */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => {
                  setMatchedUser(null);
                  setMatchedMatchId(null);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "var(--surface)",
                  color: "var(--foreground)",
                  border: "1px solid var(--line)",
                  borderRadius: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "var(--soft-shadow)",
                }}
              >
                後で
              </button>
              <button
                onClick={() => {
                  // 成立した会話を開いた状態でトーク画面へ。
                  // window.location.href だとページ全体が再読み込みされ、
                  // ログイン状態の復元からやり直しになるので router.push を使う。
                  router.push(
                    matchedMatchId ? `/talk?match=${matchedMatchId}` : "/talk",
                  );
                }}
                style={{
                  padding: "12px 24px",
                  background: "var(--action-gradient)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "var(--action-shadow)",
                }}
              >
                トークを開く
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes scaleIn {
              from {
                opacity: 0;
                transform: scale(0.9);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
    </>
  );
}
