/**
 * 課表（二、9月課表）— 資料驅動的日曆渲染 + 編輯功能
 * 修改會透過 Apps Script 存到 Google Sheet 的「課表」分頁，
 * 讀取時會用 Sheet 裡的內容覆蓋預設值，所以換裝置也看得到最新版本。
 */

const CATEGORY_LABELS = {
  required: '必修／常態課',
  compete: '練比賽',
  training: '培訓課',
  eval: '培訓個人考核',
  rest: '休息日（復健修復日）',
  match: '比賽',
};

// 9 月的預設課表內容（尚未連上 Apps Script，或該日期在 Sheet 裡還沒有紀錄時使用）
const DEFAULT_SCHEDULE = [
  { date: '2026-08-31', label: '8/31', tags: [{ type: 'required', text: '①Street Jazz-茶葉' }, { type: 'required', text: '②LyricalJazz-伊娜' }] },
  { date: '2026-09-01', label: '9/1', tags: [{ type: 'required', text: 'Street Jazz-林彤' }] },
  { date: '2026-09-02', label: '9/2', tags: [{ type: 'required', text: 'Heels-浩琳' }] },
  { date: '2026-09-03', label: '9/3', tags: [{ type: 'rest', text: '休息／復健修復' }] },
  { date: '2026-09-04', label: '9/4', tags: [{ type: 'training', text: '培訓課' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-05', label: '9/5', tags: [{ type: 'rest', text: '休息／復健修復' }] },
  { date: '2026-09-06', label: '9/6', tags: [{ type: 'rest', text: '休息／復健修復' }] },

  { date: '2026-09-07', label: '9/7', tags: [{ type: 'required', text: '①Street Jazz-茶葉' }, { type: 'required', text: '②LyricalJazz-伊娜' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-08', label: '9/8', tags: [] },
  { date: '2026-09-09', label: '9/9', tags: [] },
  { date: '2026-09-10', label: '9/10', tags: [{ type: 'required', text: '極簡質感Jazz-伊娜' }] },
  { date: '2026-09-11', label: '9/11', tags: [{ type: 'training', text: '培訓課' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-12', label: '9/12', tags: [{ type: 'match', text: '桃園盃盃導師指導' }] },
  { date: '2026-09-13', label: '9/13', tags: [{ type: 'rest', text: '休息／復健修復' }] },

  { date: '2026-09-14', label: '9/14', tags: [{ type: 'required', text: '①Street Jazz-茶葉' }, { type: 'required', text: '②LyricalJazz-伊娜' }] },
  { date: '2026-09-15', label: '9/15', tags: [{ type: 'rest', text: '休息／復健修復' }] },
  { date: '2026-09-16', label: '9/16', tags: [{ type: 'compete', text: '練比賽' }] },
  { date: '2026-09-17', label: '9/17', tags: [{ type: 'required', text: '極簡質感Jazz-伊娜' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-18', label: '9/18', tags: [{ type: 'eval', text: '培訓個人考核' }] },
  { date: '2026-09-19', label: '9/19', tags: [] },
  { date: '2026-09-20', label: '9/20', tags: [{ type: 'rest', text: '休息／復健修復' }] },

  { date: '2026-09-21', label: '9/21', tags: [{ type: 'required', text: '①Jazz-Emma' }, { type: 'required', text: '②LyricalJazz-伊娜' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-22', label: '9/22', tags: [{ type: 'rest', text: '休息／復健修復' }] },
  { date: '2026-09-23', label: '9/23', tags: [] },
  { date: '2026-09-24', label: '9/24', tags: [{ type: 'compete', text: '練比賽' }] },
  { date: '2026-09-25', label: '9/25', tags: [] },
  { date: '2026-09-26', label: '9/26', tags: [] },
  { date: '2026-09-27', label: '9/27', tags: [{ type: 'rest', text: '休息／復健修復' }] },

  { date: '2026-09-28', label: '9/28', tags: [{ type: 'required', text: '①Street Jazz-茶葉' }, { type: 'required', text: '②LyricalJazz-琬芳' }, { type: 'compete', text: '練比賽' }] },
  { date: '2026-09-29', label: '9/29', tags: [{ type: 'rest', text: '休息／復健修復' }] },
  { date: '2026-09-30', label: '9/30', tags: [] },
  { date: '2026-10-01', label: '10/1', tags: [{ type: 'compete', text: '練比賽' }], nextMonth: true },
  { date: '2026-10-02', label: '10/2', tags: [], nextMonth: true },
  { date: '2026-10-03', label: '10/3', tags: [{ type: 'match', text: '桃園盃盃決賽' }], nextMonth: true },
  { date: '2026-10-04', label: '10/4', tags: [{ type: 'match', text: '連舞比賽' }], nextMonth: true },
];

let scheduleState = DEFAULT_SCHEDULE.map(d => ({ ...d, tags: d.tags.map(t => ({ ...t })) }));
let editing = false;
let openAddForm = null;

const calendarEl = document.getElementById('calendar');
const editToggleBtn = document.getElementById('edit-toggle');
const syncStatusEl = document.getElementById('sync-status');

function isConfigured() {
  return typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.startsWith('http');
}

function setSyncStatus(text, isError) {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = text || '';
  syncStatusEl.className = 'sync-status' + (isError ? ' error' : '');
}

async function loadSchedule() {
  if (!isConfigured()) {
    setSyncStatus('尚未設定 Apps Script 網址，目前顯示預設課表（唯讀）。', true);
    renderCalendar();
    return;
  }
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=schedule`);
    const data = await res.json();
    const overrides = {};
    (data.days || []).forEach(d => { overrides[d.date] = d.tags; });
    scheduleState = DEFAULT_SCHEDULE.map(d => ({
      ...d,
      tags: Object.prototype.hasOwnProperty.call(overrides, d.date)
        ? overrides[d.date]
        : d.tags.map(t => ({ ...t })),
    }));
    setSyncStatus('');
  } catch (err) {
    setSyncStatus('讀取課表失敗，暫時顯示預設課表。', true);
  }
  renderCalendar();
}

async function saveDay(day) {
  if (!isConfigured()) return;
  setSyncStatus('儲存中…');
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveDay', record: { date: day.date, tags: day.tags } }),
    });
    setSyncStatus('已儲存');
  } catch (err) {
    setSyncStatus('儲存失敗，請確認網路連線。', true);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
}

function renderDay(day) {
  const classes = ['day'];
  
  // 檢查這一天是否包含休息日（rest）標籤，如果有就加上 has-rest 讓整格變暗
  const hasRest = day.tags && day.tags.some(t => t.type === 'rest');
  if (hasRest) classes.push('has-rest');

  if
