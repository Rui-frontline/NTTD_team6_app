import type { User } from "@/lib/types";

// ダミーデータの雛形。
// 本番用の30人分は feat/dummy-data ブランチで作成する。
// 画面から直接この配列を import しないこと。必ず lib/repository.ts を経由する。

export const users: User[] = [
  {
    id: "u001",
    name: "田中 陽介",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u001",
    department: "第一システム部",
    age: 28,
    enabledModes: ["work", "romance"],
    work: {
      role: "Webアプリのバックエンド開発",
      skills: ["Java", "AWS", "SQL"],
      bio: "金融系の基幹システムを3年。最近チームリーダーになって、マネジメントの相談相手を探しています。",
    },
    romance: {
      hobbies: ["サウナ", "映画", "自転車"],
      bio: "週末はだいたいサウナにいます。映画は年間60本くらい。",
      hideDepartment: false,
    },
  },
  {
    id: "u002",
    name: "佐藤 美咲",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u002",
    department: "デザイン部",
    age: 26,
    enabledModes: ["work", "romance"],
    work: {
      role: "UIデザイン・ユーザーリサーチ",
      skills: ["Figma", "ユーザーインタビュー", "情報設計"],
      bio: "社内システムの使いにくさを直す仕事をしています。現場の話を聞かせてくれる人を探し中。",
    },
    romance: {
      hobbies: ["カフェ巡り", "陶芸", "散歩"],
      bio: "休日は知らない街を歩いています。おすすめの喫茶店があれば教えてください。",
      hideDepartment: true,
    },
  },
  {
    id: "u003",
    name: "鈴木 健一",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u003",
    department: "営業推進部",
    age: 34,
    enabledModes: ["work"],
    work: {
      role: "製造業向けの提案営業",
      skills: ["提案資料", "業界リサーチ", "折衝"],
      bio: "技術のことは分からないので、雑に質問できるエンジニアの知り合いがほしいです。",
    },
    romance: {
      hobbies: [],
      bio: "",
      hideDepartment: false,
    },
  },
  {
    id: "u004",
    name: "山本 千尋",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u004",
    department: "経理部",
    age: 24,
    enabledModes: ["work", "romance"],
    work: {
      role: "月次決算・管理会計",
      skills: ["Excel", "簿記2級", "予実管理"],
      bio: "数字は読めますが、それが現場の何を意味するのかを知りたいです。",
    },
    romance: {
      hobbies: ["料理", "ボードゲーム", "猫"],
      bio: "ボードゲーム会をやりたいけど人数が集まりません。誰か一緒にやりませんか。",
      hideDepartment: false,
    },
  },
  {
    id: "u005",
    name: "伊藤 大輔",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u005",
    department: "第二システム部",
    age: 31,
    enabledModes: ["romance"],
    work: {
      role: "インフラ構築・運用",
      skills: ["Kubernetes", "Terraform", "監視設計"],
      bio: "",
    },
    romance: {
      hobbies: ["登山", "写真", "コーヒー"],
      bio: "月1で山に登っています。低山からでも一緒に行ける人がいたら嬉しいです。",
      hideDepartment: true,
    },
  },
  {
    id: "u006",
    name: "中村 遥",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=u006",
    department: "人事部",
    age: 29,
    enabledModes: ["work", "romance"],
    work: {
      role: "新卒採用・研修企画",
      skills: ["面接設計", "研修運営", "組織サーベイ"],
      bio: "現場が本当に困っていることを知りたいので、部署問わず話を聞かせてください。",
    },
    romance: {
      hobbies: ["ランニング", "読書", "旅行"],
      bio: "朝ランが習慣です。読んだ本の話ができる人を探しています。",
      hideDepartment: false,
    },
  },
];
