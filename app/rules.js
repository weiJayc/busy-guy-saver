// Transcribed from ../task-schedule-method.md (v1.1). This is the single
// source of truth the UI reads from; the markdown file itself is left
// untouched as the human-readable specification.

const AXIS_LABELS = {
  A: {
    A1: { short: '硬期限', desc: '存在外部具體後果的截止日（他人在等待、有金錢/資格損失、無法逆轉的時間點）' },
    A2: { short: '軟期限', desc: '自己設定的目標日期，未達成無外部後果' },
    A3: { short: '無期限', desc: '沒有任何具體日期' },
  },
  B: {
    B1: { short: '累積型', desc: '需要多次、長期投入才能產生效果，單次投入無法完成' },
    B2: { short: '一次性型', desc: '完成一次決策/行動後即結束，不需要持續投入' },
  },
  C: {
    C1: { short: '連鎖依賴', desc: '此任務未完成會阻塞至少一個其他任務的進行' },
    C2: { short: '獨立任務', desc: '此任務的完成與否不影響其他任務' },
  },
  D: {
    D1: { short: '自己主導', desc: '決策與執行完全由自己負責' },
    D2: { short: '共同決策', desc: '需要與他人同步討論才能推進' },
    D3: { short: '輕量參與', desc: '由他人主導，自己僅需知情或偶爾表態' },
  },
};

const AXIS_ORDER = {
  A: ['A1', 'A2', 'A3'],
  B: ['B1', 'B2'],
  C: ['C1', 'C2'],
  D: ['D1', 'D2', 'D3'],
};

// 4.1 緊急層級 U 的推導表。輸入：正規化後的 a'、原始 c。
// (A3, C1) 不會出現在此表中，因為 INV-1 已將其正規化為 (A2, C1) 或 (A1, C1)。
const U_TABLE = {
  A1: { C1: 'U1', C2: 'U2' },
  A2: { C1: 'U2', C2: 'U3' },
  A3: { C2: 'U4' },
};

// 6. 策略矩陣（U × Allocation Type）。D2B1、D3B1 依 INV-3 為結構化雙欄位物件，
// 其餘四欄為單一字串。
const STRATEGY_MATRIX = {
  U1: {
    D1B1: '每日/每週固定大塊深度時段，反向排程，不可延後',
    D1B2: '立即用時間盒本週內集中處理完畢',
    D2B1: { personal: '每週固定深度時段', sync: '每週 ≥2 次會議' },
    D2B2: '24–48 小時內安排同步討論並拍板',
    D3B1: { personal: '（通常無）', watch: '最高頻 check-in（建議每日）' },
    D3B2: '每日關注最新進展',
  },
  U2: {
    D1B1: '每週固定 2–3 次深度時段',
    D1B2: '本週內安排 1–2 個時間盒完成',
    D2B1: { personal: '每週固定時段', sync: '每週 1 次會議' },
    D2B2: '一週內安排一次同步討論拍板',
    D3B1: { personal: '（通常無）', watch: '中頻 check-in（每週 1–2 次）' },
    D3B2: '每週定期關注',
  },
  U3: {
    D1B1: '每週 1–2 次保底時段，可彈性調整',
    D1B2: '找完整零碎時段（如週末半天）處理',
    D2B1: { personal: '隔週時段', sync: '隔週會議' },
    D2B2: '兩週內找機會討論拍板',
    D3B1: { personal: '（通常無）', watch: '低頻 check-in（每兩週）' },
    D3B2: '有需要再關注',
  },
  U4: {
    D1B1: '保底頻率自訂，可低至每週一次或更低',
    D1B2: '放入「有空清單」，填補零碎時間',
    D2B1: { personal: '頻率自訂', sync: '低頻、各自累積' },
    D2B2: '隨緣安排討論',
    D3B1: { personal: '（通常無）', watch: '偶爾關心即可' },
    D3B2: '完全被動，回應即可',
  },
};

const U_LABELS = {
  U1: 'U1 最高',
  U2: 'U2 高',
  U3: 'U3 中',
  U4: 'U4 低',
};

const ALLOCATION_LABELS = {
  D1B1: '深度執行—持續型',
  D1B2: '深度執行—集中型',
  D2B1: '協調對齊—持續型',
  D2B2: '協調對齊—單次型',
  D3B1: '背景關注—持續型',
  D3B2: '背景關注—單次型',
};

const INV2_HINT = 'INV-2：請確認：這件事是否真的不需要你主導？若答案是「需要」，請將 D 改為 D1 或 D2 後重新計算。';

function buildTagCode(a, b, c, d) {
  return `${a}${b}${c}${d}`;
}

/**
 * 執行第 5 節決策演算法。
 * @param {{a:string,b:string,c:string,d:string,downstreamDeadline?:string}} task
 * @returns {object} Output（見 4.3 節）
 */
function evaluateTask(task) {
  const { a, b, c, d, downstreamDeadline } = task;

  // Step 1. 正規化（INV-1）
  const a_original = a;
  let a_normalized = a;
  let deadline_date = null;

  if (c === 'C1' && a === 'A3') {
    if (downstreamDeadline) {
      // MAY：互動追問，使用者回填了下游期限
      a_normalized = 'A1';
      deadline_date = downstreamDeadline;
    } else {
      // MUST：預設降級路徑
      a_normalized = 'A2';
    }
  }
  const normalized = a_normalized !== a_original;

  // Step 2. 計算緊急層級 U
  const U = U_TABLE[a_normalized][c];

  // Step 3. 計算投入型態與策略內容
  const allocation_type = `${d}${b}`;
  const strategy = STRATEGY_MATRIX[U][allocation_type];

  // Step 4. 附加提示（僅 INV-2）
  const hints = [];
  if (c === 'C1' && d === 'D3') {
    hints.push(INV2_HINT);
  }

  return {
    a_original,
    a_normalized,
    normalized,
    deadline_date,
    b,
    c,
    d,
    U,
    allocation_type,
    strategy,
    hints,
  };
}
