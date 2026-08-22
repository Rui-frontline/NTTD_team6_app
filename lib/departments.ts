// 部署の選択肢。
//
// 会社 → 区分 → 本部 → （さらに下の部）と辿って選ぶ。
// 階層の深さは一定ではなく、「財務本部」のようにそこで終わるものと、
// 「グループ経営企画統括本部」のようにもう1段ある枝が混在している。
// そのため配列ではなく木で持ち、children があるあいだ選択を続けさせる。

export type DepartmentNode = {
  label: string;
  children?: DepartmentNode[];
};

/** 保存するときに階層をつなぐ区切り。ラベルに含まれない文字を選んでいる */
export const DEPARTMENT_SEPARATOR = " / ";

/** 各段の見出し。木より深い段はいちばん後ろのラベルを使い回す */
const LEVEL_LABELS = ["会社", "区分", "本部・部", "部門"];

export const DEPARTMENT_TREE: DepartmentNode[] = [
  {
    label: "株式会社NTTデータグループ",
    children: [
      {
        label: "コーポレートスタッフ",
        children: [
          {
            label: "グループ経営企画統括本部",
            children: [
              { label: "コーポレート戦略本部" },
              { label: "サステナビリティ経営推進本部" },
              { label: "グローバルイノベーション本部" },
              { label: "コンサルティング＆ビジネスアクセラレーション本部" },
              { label: "プロキュアメント部" },
            ],
          },
          { label: "財務本部" },
          { label: "人事本部" },
          { label: "グローバルガバナンス本部" },
          { label: "グローバルマーケティング＆コミュニケーション本部" },
          { label: "ITマネジメント室" },
          { label: "監査部" },
        ],
      },
      {
        label: "コストセンタ",
        children: [
          {
            label: "技術革新統括本部",
            children: [
              { label: "技術戦略推進部" },
              { label: "AI技術部" },
              { label: "Innovation技術部" },
              { label: "先進エンジニアリング技術部" },
              { label: "品質保証部" },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "株式会社NTTデータ",
    children: [
      {
        label: "コーポレートスタッフ",
        children: [{ label: "経営企画本部" }, { label: "監査部" }],
      },
      {
        label: "コンサルティングセグメント",
        children: [{ label: "戦略コンサルティング本部" }],
      },
      {
        label: "テクノロジーセグメント",
        children: [
          { label: "テクノロジービジネス事業本部" },
          { label: "AI事業本部" },
          { label: "インフラストラクチャ事業本部" },
        ],
      },
      {
        label: "公共・社会基盤分野",
        children: [
          { label: "社会DXコンサルティング事業本部" },
          { label: "第一公共事業本部" },
          { label: "第二公共事業本部" },
          { label: "第三公共事業本部" },
          { label: "テレコム・ユーティリティ事業本部" },
        ],
      },
      {
        label: "金融分野",
        children: [
          { label: "第一金融事業本部" },
          { label: "第二金融事業本部" },
          { label: "第三金融事業本部" },
          { label: "金融イノベーション本部" },
          { label: "金融高度技術本部" },
        ],
      },
      {
        label: "法人分野",
        children: [
          { label: "インダストリ統括本部" },
          { label: "コンサルティング事業本部" },
          { label: "ペイメント事業本部" },
          { label: "ビジネスエンジニアリング＆イノベーション事業本部" },
          { label: "EAS事業本部" },
        ],
      },
    ],
  },
];

export function splitDepartmentPath(path: string): string[] {
  return path ? path.split(DEPARTMENT_SEPARATOR) : [];
}

export function joinDepartmentPath(parts: string[]): string {
  return parts.filter(Boolean).join(DEPARTMENT_SEPARATOR);
}

/** 表示や絞り込みに使う、いちばん下の階層の名前 */
export function departmentLeaf(parts: string[]): string {
  const filled = parts.filter(Boolean);
  return filled[filled.length - 1] ?? "";
}

/** 1段ぶんの選択肢と、いま選ばれている値 */
export type DepartmentLevel = {
  label: string;
  options: DepartmentNode[];
  value: string;
};

/**
 * いまの選択状態から、画面に出す選択欄を組み立てる。
 *
 * 先頭は必ず会社の1段。選んだ先に children があれば次の段を足し、
 * 無ければそこで止める。これで「最小単位まで選ばせる」が成立する。
 */
export function departmentLevels(parts: string[]): DepartmentLevel[] {
  const levels: DepartmentLevel[] = [];
  let options = DEPARTMENT_TREE;
  let depth = 0;

  while (options.length > 0) {
    const value = parts[depth] ?? "";
    levels.push({
      label: LEVEL_LABELS[depth] ?? LEVEL_LABELS[LEVEL_LABELS.length - 1],
      options,
      value,
    });

    const selected = options.find((node) => node.label === value);
    if (!selected?.children?.length) break;

    options = selected.children;
    depth += 1;
  }

  return levels;
}

/** いちばん下まで選べているか。途中で止まっていると false */
export function isDepartmentComplete(parts: string[]): boolean {
  const levels = departmentLevels(parts);
  const last = levels[levels.length - 1];
  const selected = last.options.find((node) => node.label === last.value);
  return Boolean(selected) && !selected?.children?.length;
}

/**
 * いちばん下の名前から階層を逆引きする。
 *
 * departmentPath を持っていない古いデータを、できる範囲で選択状態に
 * 戻すために使う。「監査部」のように複数の会社にある名前は最初に
 * 見つかったほうを返すので、正確さが要るときは departmentPath を使うこと。
 */
export function findDepartmentPath(leaf: string): string[] | null {
  if (!leaf) return null;

  const walk = (nodes: DepartmentNode[], trail: string[]): string[] | null => {
    for (const node of nodes) {
      const next = [...trail, node.label];
      if (node.label === leaf && !node.children?.length) return next;
      if (node.children?.length) {
        const found = walk(node.children, next);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(DEPARTMENT_TREE, []);
}
