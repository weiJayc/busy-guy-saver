// Transcribed from ../task-schedule-method.md. This is the single source of
// truth the UI reads from; the markdown file itself is left untouched as the
// human-readable reference.

const AXIS_LABELS = {
  A: {
    A1: { short: '硬期限', desc: '有外部/他人設定的截止時間，不能協商' },
    A2: { short: '軟期限（自訂）', desc: '自己設定的目標時間，理論上可協商' },
    A3: { short: '無期限', desc: '沒有明確截止時間' },
  },
  B: {
    B1: { short: '累積型', desc: '需要持續投入、分次累積才能完成' },
    B2: { short: '一次性', desc: '一次處理完就結束，不需長期累積' },
  },
  C: {
    C1: { short: '卡住別人', desc: '這件事會卡住別人的下游工作（連鎖依賴）' },
    C2: { short: '不卡別人', desc: '完全不影響其他人的進度' },
  },
  D: {
    D1: { short: '自己主導', desc: '你是這件事的主責人，決定權在你' },
    D2: { short: '共同決策', desc: '需要跟其他人一起討論、拍板' },
    D3: { short: '輕量參與', desc: '你只是配合/協助的角色，不是主責人' },
  },
};

const AXIS_ORDER = {
  A: ['A1', 'A2', 'A3'],
  B: ['B1', 'B2'],
  C: ['C1', 'C2'],
  D: ['D1', 'D2', 'D3'],
};

// 36 combos, transcribed row-by-row from task-schedule-method.md.
// NOTE: the source doc's own summary line says "9 組" flagged with ⚠️, but
// counting the actual ⚠️-marked rows in its tables yields 10 (the C1+A3 rule
// and the C1+D3 rule overlap on A3**C1D3 rows, so 6 + 6 - 2 = 10 unique rows,
// not 9). This is a pre-existing discrepancy in the source markdown itself;
// `isConflict` below mirrors the actual per-row ⚠️ marks, not the summary count.
const COMBOS = {
  A1B1C1D1: { scenario: '硬期限、需累積、卡住別人、自己主導', strategy: '主戰場：優先分配大塊深度時間，從deadline反向排程', isConflict: false },
  A1B1C1D2: { scenario: '硬期限、需累積、卡住別人、需共同決策', strategy: '個人保底累積時段 + 定期同步進度會議，兩者分開排', isConflict: false },
  A1B1C1D3: { scenario: '硬期限、需累積、卡住別人、你是輕量參與者', strategy: '⚠️衝突組合：先確認角色是否誤判；若確實輕量，只需追蹤+必要時提醒主責人', isConflict: true },
  A1B1C2D1: { scenario: '硬期限、需累積、不卡別人、自己主導', strategy: '設定每日/每週保底時段，越近deadline頻率越高', isConflict: false },
  A1B1C2D2: { scenario: '硬期限、需累積、不卡別人、需共同決策', strategy: '個人保底時段 + 定期跟夥伴對齊進度', isConflict: false },
  A1B1C2D3: { scenario: '硬期限、需累積、不卡別人、你是輕量參與者', strategy: '低頻參與即可，不需大塊時間', isConflict: false },

  A1B2C1D1: { scenario: '硬期限、一次性、卡住別人、自己主導', strategy: '立刻用時間盒處理，最高優先，拖延會卡住整條鏈', isConflict: false },
  A1B2C1D2: { scenario: '硬期限、一次性、卡住別人、需共同決策', strategy: '優先安排同步討論時段，盡快拍板（例：決定行程地點）', isConflict: false },
  A1B2C1D3: { scenario: '硬期限、一次性、卡住別人、你是輕量參與者', strategy: '⚠️衝突組合：確認自己是否真的不是瓶頸；保持關注、適時給意見', isConflict: true },
  A1B2C2D1: { scenario: '硬期限、一次性、不卡別人、自己主導', strategy: '盡早啟動，用分散短時段消化，避免deadline前臨時抱佛腳', isConflict: false },
  A1B2C2D2: { scenario: '硬期限、一次性、不卡別人、需共同決策', strategy: '安排一次同步討論拍板即可，不需個人大塊時間', isConflict: false },
  A1B2C2D3: { scenario: '硬期限、一次性、不卡別人、你是輕量參與者', strategy: '低頻check-in，不佔用時間（例：朋友主導的行程）', isConflict: false },

  A2B1C1D1: { scenario: '軟期限、需累積、卡住別人、自己主導', strategy: '次戰場：設定保底頻率，但不可無限延後（因為卡住別人）', isConflict: false },
  A2B1C1D2: { scenario: '軟期限、需累積、卡住別人、需共同決策', strategy: '個人保底時段 + 定期跟依賴方同步狀態，避免對方被蒙在鼓裡', isConflict: false },
  A2B1C1D3: { scenario: '軟期限、需累積、卡住別人、你是輕量參與者', strategy: '⚠️衝突組合：軟期限但卡住別人，代表實際壓力被低估，建議升級為A1看待', isConflict: true },
  A2B1C2D1: { scenario: '軟期限、需累積、不卡別人、自己主導', strategy: '背景常駐任務，設定保底頻率（例：學CNN）', isConflict: false },
  A2B1C2D2: { scenario: '軟期限、需累積、不卡別人、需共同決策', strategy: '各自保底時段 + 定期交流進度', isConflict: false },
  A2B1C2D3: { scenario: '軟期限、需累積、不卡別人、你是輕量參與者', strategy: '低頻參與、跟著打卡即可', isConflict: false },

  A2B2C1D1: { scenario: '軟期限、一次性、卡住別人、自己主導', strategy: '雖是自訂deadline，但因卡住別人，建議當優先處理，用時間盒盡快解決', isConflict: false },
  A2B2C1D2: { scenario: '軟期限、一次性、卡住別人、需共同決策', strategy: '盡快安排討論拍板，避免軟期限被無限拖延', isConflict: false },
  A2B2C1D3: { scenario: '軟期限、一次性、卡住別人、你是輕量參與者', strategy: '⚠️衝突組合：同樣需重新檢視角色是否誤判', isConflict: true },
  A2B2C2D1: { scenario: '軟期限、一次性、不卡別人、自己主導', strategy: '優先度低，有空再做', isConflict: false },
  A2B2C2D2: { scenario: '軟期限、一次性、不卡別人、需共同決策', strategy: '排一次輕量討論即可', isConflict: false },
  A2B2C2D3: { scenario: '軟期限、一次性、不卡別人、你是輕量參與者', strategy: '隨緣回應，不用特別排時間', isConflict: false },

  A3B1C1D1: { scenario: '無期限、需累積、卡住別人、自己主導', strategy: '⚠️衝突組合：「無期限」是假象，實際受下游deadline牽動；建議反推下游時間，重新標記為A1/A2', isConflict: true },
  A3B1C1D2: { scenario: '無期限、需累積、卡住別人、需共同決策', strategy: '⚠️同上，建議重新標記期限後再套用對應策略', isConflict: true },
  A3B1C1D3: { scenario: '無期限、需累積、卡住別人、你是輕量參與者', strategy: '⚠️同上，且應提醒主責人正視隱藏的deadline', isConflict: true },
  A3B1C2D1: { scenario: '無期限、需累積、不卡別人、自己主導', strategy: '典型背景任務，純興趣驅動，保底頻率可以很低', isConflict: false },
  A3B1C2D2: { scenario: '無期限、需累積、不卡別人、需共同決策', strategy: '低頻同步、各自累積即可', isConflict: false },
  A3B1C2D3: { scenario: '無期限、需累積、不卡別人、你是輕量參與者', strategy: '幾乎不用主動安排時間，偶爾關心即可', isConflict: false },

  A3B2C1D1: { scenario: '無期限、一次性、卡住別人、自己主導', strategy: '⚠️衝突組合：主動詢問下游需要時間，把隱性期限問出來後轉為A1/A2處理', isConflict: true },
  A3B2C1D2: { scenario: '無期限、一次性、卡住別人、需共同決策', strategy: '⚠️同上', isConflict: true },
  A3B2C1D3: { scenario: '無期限、一次性、卡住別人、你是輕量參與者', strategy: '⚠️同上，並提醒主責人問清楚下游期待', isConflict: true },
  A3B2C2D1: { scenario: '無期限、一次性、不卡別人、自己主導', strategy: '優先度最低，放入「有空清單」，填補零碎時間即可', isConflict: false },
  A3B2C2D2: { scenario: '無期限、一次性、不卡別人、需共同決策', strategy: '隨緣安排，不需主動排時間', isConflict: false },
  A3B2C2D3: { scenario: '無期限、一次性、不卡別人、你是輕量參與者', strategy: '完全不用主動投入時間，回應即可', isConflict: false },
};

function lookup(code) {
  return COMBOS[code] || null;
}

function buildCode(tags) {
  return `${tags.A}${tags.B}${tags.C}${tags.D}`;
}
