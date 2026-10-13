const $ = (s, r = document) => r.querySelector(s);
const LS = 'pitanie.v1';
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

let S = load();
let curDay = 0;

function load() {
  try { return Object.assign({ profile: null, seed: 1, slots: null, weights: [], checked: {} }, JSON.parse(localStorage.getItem(LS))); }
  catch { return { profile: null, seed: 1, slots: null, weights: [], checked: {} }; }
}
function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} }

// ---------- расчёты ----------
function calc(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age - 161; // Миффлин — Сан-Жеор, женщины
  const tdee = bmr * p.activity;
  const warns = [];
  const minGoal = 18.5 * Math.pow(p.height / 100, 2);
  let target = tdee * (1 - p.pace);
  const losing = p.goal < p.weight;
  if (!losing) { target = tdee; warns.push('Желаемый вес не меньше текущего — калорийность рассчитана на поддержание веса.'); }
  if (target < 1200) { target = 1200; warns.push('Калорийность ниже 1200 ккал/день небезопасна без врача, поэтому установлен минимум 1200 ккал.'); }
  let weekly = losing ? (tdee - target) * 7 / 7700 : 0;
  const cap = p.weight * 0.01;
  if (weekly > cap) { weekly = cap; target = tdee - weekly * 7700 / 7; }
  if (p.goal < minGoal) warns.push(`Желаемый вес даёт ИМТ ниже 18,5 (меньше ${minGoal.toFixed(1)} кг при твоём росте). Это недостаточный вес — обсуди цель с врачом.`);
  target = Math.round(target / 10) * 10;
  const weeks = weekly > 0 ? Math.ceil((p.weight - p.goal) / weekly) : 0;
  const protein = Math.round(Math.max(1.4 * p.goal, 1.2 * p.weight * 0.8));
  const fat = Math.round(target * 0.28 / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  const bmi = p.weight / Math.pow(p.height / 100, 2);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, weekly, weeks, protein, fat, carbs, bmi, water: Math.round(p.weight * 30 / 100) / 10, warns };
}

// ---------- меню ----------
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function eligible(type, ex) {
  return DISHES.map((d, i) => ({ d, i })).filter(({ d }) => d.t === type && !d.i.some(([n]) => ex.includes(INGR[n].tag)));
}
function dishBase(d) {
  return d.i.reduce((a, [n, g]) => a + INGR[n].k * g / 100, 0);
}
function buildSlots(p, c, seed) {
  const r = rng(seed), split = MEAL_SPLIT[p.meals];
  const used = {};
  return DAYS.map(() => split.map(([t, , share]) => {
    let pool = eligible(t, p.ex);
    if (!pool.length) pool = DISHES.map((d, i) => ({ d, i })).filter(({ d }) => d.t === t);
    const u = used[t] = used[t] || [];
    let fresh = pool.filter(x => !u.includes(x.i));
    if (!fresh.length) { u.length = 0; fresh = pool; }
    const pick = fresh[Math.floor(r() * fresh.length)];
    u.push(pick.i);
    return pick.i;
  }));
}
function mealView(di, mi) {
  const p = S.profile, c = calc(p), [t, label, share] = MEAL_SPLIT[p.meals][mi];
  const d = DISHES[S.slots[di][mi]];
  const f = Math.min(2, Math.max(0.5, c.target * share / dishBase(d)));
  const items = d.i.map(([n, g]) => {
    const raw = g * f, gr = raw >= 20 ? Math.round(raw / 5) * 5 : Math.max(1, Math.round(raw));
    return { n, g: gr };
  });
  const sum = items.reduce((a, { n, g }) => {
    const x = INGR[n]; a.k += x.k * g / 100; a.p += x.p * g / 100; a.f += x.f * g / 100; a.c += x.c * g / 100; return a;
  }, { k: 0, p: 0, f: 0, c: 0 });
  return { label, name: d.n, items, sum };
}

// ---------- отделы Перекрёстка ----------
const DEPT = {};
const setDept = (dept, names) => names.forEach(n => DEPT[n] = dept);
setDept('🥦 Овощи, фрукты, зелень', ['Брокколи', 'Цветная капуста', 'Кабачок', 'Огурец', 'Помидор', 'Болгарский перец', 'Морковь', 'Шпинат', 'Салатные листья', 'Грибы (шампиньоны)', 'Лук', 'Тыква', 'Картофель', 'Батат', 'Авокадо', 'Яблоко', 'Банан', 'Апельсин']);
setDept('🍗 Мясо и птица', ['Куриная грудка', 'Индейка (филе)', 'Говядина постная']);
setDept('🐟 Рыба и морепродукты', ['Лосось', 'Треска', 'Креветки', 'Тунец консервированный (в собств. соку)']);
setDept('🥛 Молочные продукты, яйца, тофу', ['Яйцо', 'Творог 5%', 'Йогурт натуральный 2%', 'Кефир 1%', 'Сыр твёрдый 30%', 'Фета', 'Молоко 1.5%', 'Тофу', 'Хумус', 'Горький шоколад 70%']);
setDept('🌾 Крупы, макароны, бакалея', ['Овсяные хлопья', 'Гречка (сухая)', 'Рис бурый (сухой)', 'Киноа (сухая)', 'Макароны из твёрдых сортов (сухие)', 'Чечевица (сухая)', 'Нут консервированный', 'Фасоль консервированная', 'Мёд', 'Оливковое масло', 'Соевый соус', 'Кокосовое молоко лёгкое', 'Миндальное молоко без сахара', 'Арахисовая паста']);
setDept('🥜 Орехи и семена', ['Миндаль', 'Грецкий орех', 'Семена чиа']);
setDept('🍞 Хлеб и хлебцы', ['Хлеб цельнозерновой', 'Лаваш тонкий', 'Рисовые хлебцы']);
setDept('❄️ Заморозка', ['Ягоды (замороженные)']);
const DEPT_ORDER = ['🥦 Овощи, фрукты, зелень', '🍗 Мясо и птица', '🐟 Рыба и морепродукты', '🥛 Молочные продукты, яйца, тофу', '🌾 Крупы, макароны, бакалея', '🍞 Хлеб и хлебцы', '🥜 Орехи и семена', '❄️ Заморозка'];
const HINT = {
  'Куриная грудка': 'охлаждённое филе грудки', 'Индейка (филе)': 'охлаждённое филе индейки', 'Говядина постная': 'вырезка или тазобедренная часть, без жира',
  'Творог 5%': 'именно «творог», не «творожный продукт»', 'Йогурт натуральный 2%': 'без сахара и добавок, состав: молоко + закваска', 'Кефир 1%': '1% жирности',
  'Сыр твёрдый 30%': 'полутвёрдый сыр до 30% жирности', 'Фета': 'рассольный сыр, до 18% жирности', 'Тофу': 'у холодильников с готовой едой или в азиатском отделе',
  'Хумус': 'у холодильников с готовой едой', 'Горький шоколад 70%': 'от 70% какао', 'Хлеб цельнозерновой': 'в составе цельнозерновая мука, без сахара',
  'Ягоды (замороженные)': 'смесь ягод без сахара', 'Тунец консервированный (в собств. соку)': 'банка «в собственном соку», не в масле',
  'Овсяные хлопья': 'хлопья, требующие варки, не быстрорастворимые', 'Гречка (сухая)': 'ядрица', 'Рис бурый (сухой)': 'коричневый нешлифованный',
  'Макароны из твёрдых сортов (сухие)': 'группа А, из твёрдой пшеницы', 'Нут консервированный': 'банка', 'Фасоль консервированная': 'банка, в собственном соку',
  'Кокосовое молоко лёгкое': 'пониженной жирности (5–9%)', 'Миндальное молоко без сахара': 'без сахара', 'Арахисовая паста': 'без сахара и пальмового масла',
  'Оливковое масло': 'Extra Virgin', 'Рисовые хлебцы': 'без сахара', 'Лаваш тонкий': 'тонкий армянский'
};

function weekShopping() {
  const tot = {};
  DAYS.forEach((_, di) => MEAL_SPLIT[S.profile.meals].forEach((_, mi) =>
    mealView(di, mi).items.forEach(({ n, g }) => tot[n] = (tot[n] || 0) + g)));
  return tot;
}
function fmtQty(n, g) {
  g = g >= 100 ? Math.ceil(g / 50) * 50 : Math.ceil(g / 5) * 5;
  let s = g >= 1000 ? (g / 1000).toFixed(g % 1000 ? 2 : 0).replace(/\.?0+$/, '') + ' кг' : g + ' г';
  const piece = INGR[n].piece;
  if (piece && g >= piece) s += ` (≈ ${Math.ceil(g / piece)} шт)`;
  return s;
}
const searchUrl = n => 'https://www.perekrestok.ru/cat/search?search=' + encodeURIComponent(n.replace(/\s*\(.*?\)/, '').replace(/ \d+(\.\d+)?%/, ''));

// ---------- отрисовка ----------
const r1 = x => Math.round(x * 10) / 10;
function renderPlan() {
  const p = S.profile, el = $('#tab-plan');
  if (!p) { el.innerHTML = '<div class="card">Сначала заполни параметры.</div>'; return; }
  const c = calc(p), kp = c.protein * 4, kf = c.fat * 9, kc = c.carbs * 4, sum = kp + kf + kc || 1;
  const end = new Date(); end.setDate(end.getDate() + c.weeks * 7);
  el.innerHTML = `
    ${c.warns.map(w => `<div class="warn">⚠️ ${w}</div>`).join('')}
    <div class="card"><h2>Твоя норма</h2>
      <div class="stats">
        <div class="stat"><b>${c.target}</b><span>ккал в день для похудения</span></div>
        <div class="stat"><b>${c.tdee}</b><span>ккал — расход за день (поддержание веса)</span></div>
        <div class="stat"><b>${c.bmr}</b><span>ккал — базовый обмен</span></div>
        <div class="stat"><b>${c.bmi.toFixed(1)}</b><span>ИМТ сейчас</span></div>
      </div></div>
    <div class="card"><h2>Белки, жиры, углеводы</h2>
      <div class="bar"><i style="width:${kp / sum * 100}%;background:#e0637f"></i><i style="width:${kf / sum * 100}%;background:#f2b34c"></i><i style="width:${kc / sum * 100}%;background:#4a9d6b"></i></div>
      <div class="legend"><span>🟥 Белки: <b>${c.protein} г</b></span><span>🟨 Жиры: <b>${c.fat} г</b></span><span>🟩 Углеводы: <b>${c.carbs} г</b></span></div>
      <p class="macros">Вода: около ${c.water} л в день. Белок сохраняет мышцы и дольше держит сытость.</p></div>
    ${c.weeks ? `<div class="card"><h2>Прогноз</h2>
      <div class="stats">
        <div class="stat"><b>≈ ${r1(c.weekly)} кг</b><span>в неделю</span></div>
        <div class="stat"><b>${c.weeks} нед.</b><span>до ${p.goal} кг</span></div>
        <div class="stat"><b>${end.toLocaleDateString('ru-RU')}</b><span>примерная дата цели</span></div>
      </div>
      <p class="macros">По мере снижения веса расход уменьшается, поэтому реальный срок может быть на 10–25% дольше. Пересчитывай параметры раз в 4–5 кг.</p></div>` : ''}
    <div class="card"><h2>Правила, которые работают</h2><ul class="tips">
      <li>Белок в каждом приёме пищи: мясо, рыба, яйца, творог или бобовые.</li>
      <li>Половина тарелки на обед и ужин — овощи.</li>
      <li>Пей воду до еды и между приёмами пищи; сладкие напитки заменяй водой или чаем без сахара.</li>
      <li>Взвешивайся раз в неделю утром, в одинаковых условиях: ориентируйся на тренд, а не на отдельные дни.</li>
      <li>Спи 7–8 часов и ходи пешком от 7–8 тысяч шагов: это помогает худеть сильнее диеты.</li>
      <li>Один «свободный» приём пищи в неделю нормален — срывы от жёстких запретов хуже.</li></ul></div>`;
}

function renderMenu() {
  const p = S.profile, el = $('#tab-menu');
  if (!p) { el.innerHTML = '<div class="card">Сначала заполни параметры.</div>'; return; }
  const c = calc(p), n = MEAL_SPLIT[p.meals].length;
  let tot = { k: 0, p: 0, f: 0, c: 0 };
  const meals = [...Array(n).keys()].map(mi => {
    const m = mealView(curDay, mi);
    for (const k in tot) tot[k] += m.sum[k];
    return `<div class="meal"><div class="meal-head"><span><small>${m.label}</small><br><span class="meal-title">${m.name}</span></span>
      <button class="ghost" data-swap="${mi}">🔄 заменить</button></div>
      <ul>${m.items.map(({ n, g }) => `<li>${n} — ${INGR[n].piece && g >= INGR[n].piece ? `${g} г (≈ ${Math.round(g / INGR[n].piece)} шт)` : g + ' г'}</li>`).join('')}</ul>
      <div class="macros">${Math.round(m.sum.k)} ккал · Б ${Math.round(m.sum.p)} · Ж ${Math.round(m.sum.f)} · У ${Math.round(m.sum.c)}</div></div>`;
  }).join('');
  el.innerHTML = `
    <div class="days">${DAYS.map((d, i) => `<button data-day="${i}" class="${i === curDay ? 'active' : ''}">${d}</button>`).join('')}</div>
    <div class="card">${meals}
      <div class="total">Итого за день: ${Math.round(tot.k)} ккал (норма ${c.target}) · Б ${Math.round(tot.p)} · Ж ${Math.round(tot.f)} · У ${Math.round(tot.c)} г</div></div>
    <button class="primary" id="regen">🎲 Составить другое меню на неделю</button>`;
  el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { curDay = +b.dataset.day; renderMenu(); });
  el.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => swap(+b.dataset.swap));
  $('#regen').onclick = () => { S.seed = Math.floor(Math.random() * 1e9); S.slots = buildSlots(p, c, S.seed); S.checked = {}; save(); renderAll(); };
}
function swap(mi) {
  const p = S.profile, t = MEAL_SPLIT[p.meals][mi][0], cur = S.slots[curDay][mi];
  const pool = eligible(t, p.ex).filter(x => x.i !== cur);
  if (!pool.length) return;
  S.slots[curDay][mi] = pool[Math.floor(Math.random() * pool.length)].i;
  S.checked = {}; save(); renderMenu(); renderShop();
}

function renderShop() {
  const el = $('#tab-shop');
  if (!S.profile) { el.innerHTML = '<div class="card">Сначала заполни параметры.</div>'; return; }
  const tot = weekShopping();
  const groups = {};
  Object.keys(tot).forEach(n => (groups[DEPT[n] || 'Прочее'] = groups[DEPT[n] || 'Прочее'] || []).push(n));
  const order = DEPT_ORDER.concat(Object.keys(groups).filter(g => !DEPT_ORDER.includes(g)));
  el.innerHTML = `<div class="card shop"><h2>Список покупок на неделю</h2>
    <p class="macros">Сгруппирован по отделам Перекрёстка. Количество — на 7 дней по текущему меню, с небольшим запасом округления. Название ведёт на поиск по сайту магазина; наличие и цены проверяй там.</p>
    ${order.filter(g => groups[g]).map(g => `<h3>${g}</h3><ul>${groups[g].sort().map(n => `
      <li class="${S.checked[n] ? 'done' : ''}"><label style="display:inline;color:inherit;font-size:inherit"><input type="checkbox" data-n="${n}" ${S.checked[n] ? 'checked' : ''}>
      <a href="${searchUrl(n)}" target="_blank" rel="noopener">${n.replace(/ \(.*?\)/, '')}</a> — <b>${fmtQty(n, tot[n])}</b></label>
      ${HINT[n] ? `<div class="macros" style="margin-left:26px">${HINT[n]}</div>` : ''}</li>`).join('')}</ul>`).join('')}
    <p><button class="small" onclick="window.print()">🖨 Распечатать</button></p></div>`;
  el.querySelectorAll('[data-n]').forEach(cb => cb.onchange = () => { S.checked[cb.dataset.n] = cb.checked; save(); renderShop(); });
}

function renderProgress() {
  const el = $('#tab-progress'), p = S.profile;
  if (!p) { el.innerHTML = '<div class="card">Сначала заполни параметры.</div>'; return; }
  const today = new Date().toISOString().slice(0, 10);
  const w = S.weights.slice().sort((a, b) => a.d.localeCompare(b.d));
  let chart = '';
  if (w.length >= 2) {
    const W = 560, H = 200, pad = 32;
    const t0 = new Date(w[0].d).getTime(), t1 = new Date(w[w.length - 1].d).getTime() || t0 + 1;
    const vs = w.map(x => x.w).concat(p.goal), mn = Math.min(...vs) - 1, mx = Math.max(...vs) + 1;
    const X = d => pad + (new Date(d).getTime() - t0) / ((t1 - t0) || 1) * (W - pad * 2);
    const Y = v => H - pad - (v - mn) / (mx - mn) * (H - pad * 2);
    chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="График веса">
      <line x1="${pad}" x2="${W - pad}" y1="${Y(p.goal)}" y2="${Y(p.goal)}" stroke="#4a9d6b" stroke-dasharray="4 4"/>
      <text x="${W - pad}" y="${Y(p.goal) - 4}" text-anchor="end">цель ${p.goal} кг</text>
      <polyline fill="none" stroke="#e0637f" stroke-width="2.5" points="${w.map(x => X(x.d) + ',' + Y(x.w)).join(' ')}"/>
      ${w.map(x => `<circle cx="${X(x.d)}" cy="${Y(x.w)}" r="3.5" fill="#e0637f"/>`).join('')}
      <text x="${pad}" y="${H - 8}">${new Date(w[0].d).toLocaleDateString('ru-RU')}</text>
      <text x="${W - pad}" y="${H - 8}" text-anchor="end">${new Date(w[w.length - 1].d).toLocaleDateString('ru-RU')}</text>
      <text x="4" y="${Y(mx) + 12}">${r1(mx)}</text><text x="4" y="${Y(mn)}">${r1(mn)}</text></svg>`;
  }
  const lost = w.length ? r1(w[0].w - w[w.length - 1].w) : 0;
  el.innerHTML = `<div class="card"><h2>Дневник веса</h2>
    <form id="wf" class="row"><label>Дата<input type="date" name="d" value="${today}" required></label>
    <label>Вес, кг<input type="number" name="w" step="0.1" min="30" max="250" value="${w.length ? w[w.length - 1].w : p.weight}" required></label>
    <button class="small" type="submit" style="height:42px">Записать</button></form>
    ${w.length ? `<p>Сброшено: <b>${lost} кг</b> · осталось до цели: <b>${r1(Math.max(0, w[w.length - 1].w - p.goal))} кг</b></p>` : '<p class="macros">Записей пока нет.</p>'}
    ${chart}
    ${w.length ? `<table>${w.slice().reverse().map(x => `<tr><td>${new Date(x.d).toLocaleDateString('ru-RU')}</td><td>${x.w} кг</td><td><button class="ghost" data-del="${x.d}">удалить</button></td></tr>`).join('')}</table>` : ''}</div>`;
  $('#wf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), d = f.get('d'), v = parseFloat(f.get('w'));
    S.weights = S.weights.filter(x => x.d !== d).concat({ d, w: v }); save(); renderProgress();
  };
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.weights = S.weights.filter(x => x.d !== b.dataset.del); save(); renderProgress(); });
}

function renderAll() { renderPlan(); renderMenu(); renderShop(); renderProgress(); }

function showTab(t) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

$('#form').onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  S.profile = {
    age: +f.get('age'), height: +f.get('height'), weight: +f.get('weight'), goal: +f.get('goal'),
    activity: +f.get('activity'), pace: +f.get('pace'), meals: +f.get('meals'), ex: f.getAll('ex')
  };
  S.seed = Math.floor(Math.random() * 1e9);
  S.slots = buildSlots(S.profile, calc(S.profile), S.seed);
  S.checked = {};
  if (!S.weights.length) S.weights = [{ d: new Date().toISOString().slice(0, 10), w: S.profile.weight }];
  save(); renderAll(); showTab('plan'); scrollTo(0, 0);
};

if (S.profile) {
  const f = $('#form'), p = S.profile;
  for (const k of ['age', 'height', 'weight', 'goal', 'activity', 'pace', 'meals']) f.elements[k].value = p[k];
  f.querySelectorAll('[name=ex]').forEach(cb => cb.checked = p.ex.includes(cb.value));
  if (!S.slots || S.slots[0].length !== MEAL_SPLIT[p.meals].length) S.slots = buildSlots(p, calc(p), S.seed);
}
renderAll();
