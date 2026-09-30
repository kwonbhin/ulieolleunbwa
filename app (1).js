(function () {
  const STAR = '<svg class="allstar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 5.3L19.8 4l-2.3 5.6L23 12l-5.5 2.4 2.3 5.6-5.6-2.3L12 23l-2.2-5.3L4.2 20l2.3-5.6L1 12l5.5-2.4L4.2 4l5.6 2.3z"/></svg>';
  const MON = ['JAN','FEB','MAR','APR','MAY','JUNE','JULY','AUG','SEPT','OCT','NOV','DEC'];
  const DOW_KO = ['일','월','화','수','목','금','토'];
  const $ = id => document.getElementById(id);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = key(today);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const minView = new Date(view);

  // ---------- Supabase 연결 ----------
  const cfg = window.MEETUP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-') || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR-')) {
    $('configErr').hidden = false;
    renderHeader();
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const params = new URLSearchParams(location.search);
  const EVENT = (params.get('e') || '').toLowerCase();
  const validEvent = /^[a-z0-9]{10}$/.test(EVENT);

  // ---------- 공통 ----------
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function prettyDate(k) { const [y, m, d] = k.split('-').map(Number); const dt = new Date(y, m - 1, d); return m + '월 ' + d + '일 (' + DOW_KO[dt.getDay()] + ')'; }
  function nameKey(n) { return n.trim().toLowerCase(); }
  function randomId() {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(10); crypto.getRandomValues(buf);
    return Array.from(buf, x => chars[x % chars.length]).join('');
  }
  function setStatus(msg, err) { const s = $('status'); s.textContent = msg || ''; s.classList.toggle('err', !!err); }
  function renderHeader() {
    $('bigMonth').textContent = MON[view.getMonth()];
    const ys = String(view.getFullYear()); $('y1').textContent = ys.slice(0, 2); $('y2').textContent = ys.slice(2);
  }

  // ---------- 약속 만들기 화면 ----------
  if (!validEvent) {
    $('landing').hidden = false;
    renderHeader();
    const create = async () => {
      const title = $('newTitle').value.trim() || '우리 언제 만나?';
      $('createBtn').disabled = true;
      $('landingStatus').textContent = '만드는 중…';
      for (let i = 0; i < 3; i++) {
        const id = randomId();
        const { error } = await sb.from('events').insert({ id, title });
        if (!error) { location.search = '?e=' + id; return; }
        if (error.code !== '23505') { // 23505 = id 중복일 때만 다시 시도
          $('landingStatus').textContent = '약속을 만들지 못했어요: ' + error.message;
          $('landingStatus').classList.add('err');
          $('createBtn').disabled = false;
          return;
        }
      }
    };
    $('createBtn').onclick = create;
    $('newTitle').addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
    return;
  }

  // ---------- 약속 화면 ----------
  $('app').hidden = false;
  let people = {};        // name_key -> {name, dates}
  let me = null;          // {key, name, dates:Set}
  let selected = null;
  let saveTimer = null, saving = false, dirty = false;

  try { const saved = localStorage.getItem('meetup-name'); if (saved) $('name').value = saved; } catch (e) {}

  function allPeople() {
    const map = Object.assign({}, people);
    if (me) map[me.key] = { name: me.name, dates: Array.from(me.dates) };
    return map;
  }
  function tally() {
    const map = allPeople(); const counts = {};
    for (const k in map) for (const d of (map[k].dates || [])) (counts[d] = counts[d] || []).push(map[k].name);
    return { map, counts, total: Object.keys(map).length };
  }

  function render() {
    const { map, counts, total } = tally();
    renderHeader();
    $('monthLabel').textContent = view.getFullYear() + '년 ' + (view.getMonth() + 1) + '월';
    $('prev').disabled = view <= minView;

    const grid = $('grid'); grid.innerHTML = '';
    const first = view.getDay();
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) { const e = document.createElement('div'); e.className = 'cell empty'; grid.appendChild(e); }
    for (let d = 1; d <= days; d++) {
      const dt = new Date(view.getFullYear(), view.getMonth(), d); const k = key(dt);
      const b = document.createElement('button'); b.className = 'cell'; b.dataset.k = k;
      const past = dt < today;
      const names = counts[k] || []; const n = names.length;
      if (past) { b.classList.add('past'); b.disabled = true; }
      if (k === todayKey) b.classList.add('today');
      if (!past && n && total) {
        const pct = Math.round(18 + 82 * (n / total));
        b.style.background = 'color-mix(in srgb, var(--ink) ' + pct + '%, var(--paper))';
        if (pct >= 58) b.classList.add('dark');
      }
      const mine = me && me.dates.has(k);
      if (mine) b.classList.add('mine');
      if (selected === k) b.classList.add('sel');
      let html = '<span class="n">' + d + '</span>';
      if (!past && n) html += '<span class="cnt">' + n + '명</span>';
      if (!past && total >= 2 && n === total) html += STAR;
      b.innerHTML = html;
      b.setAttribute('aria-label', prettyDate(k) + ', ' + n + '명 가능' + (mine ? ', 내가 선택함' : ''));
      b.setAttribute('aria-pressed', mine ? 'true' : 'false');
      grid.appendChild(b);
    }

    const best = $('best'); best.innerHTML = '';
    const ranked = Object.entries(counts).filter(([k]) => k >= todayKey)
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)).slice(0, 5);
    if (!ranked.length) best.innerHTML = '<p class="empty-note">아직 체크된 날짜가 없어요. 이름을 입력하고 첫 번째로 골라보세요.</p>';
    for (const [k, names] of ranked) {
      const li = document.createElement('li'); li.tabIndex = 0;
      li.innerHTML = '<b></b><span class="who"></span>';
      li.querySelector('b').textContent = prettyDate(k);
      li.querySelector('.who').textContent = names.length + '/' + total + '명' + (names.length === total && total > 1 ? ' · 모두 가능' : '');
      const go = () => { const [y, m] = k.split('-').map(Number); view = new Date(y, m - 1, 1); selected = k; render(); };
      li.onclick = go; li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      best.appendChild(li);
    }

    const chips = $('dayChips'); chips.innerHTML = '';
    if (selected) {
      const yes = counts[selected] || [];
      $('dayTitle').textContent = prettyDate(selected) + ' · ' + yes.length + '명 가능';
      const allNames = Object.values(map).map(p => p.name).sort((a, b) => a.localeCompare(b, 'ko'));
      if (!allNames.length) chips.innerHTML = '<p class="empty-note">아직 참여자가 없어요.</p>';
      for (const nm of allNames) { const c = document.createElement('span'); c.className = 'chip ' + (yes.includes(nm) ? 'on' : 'off'); c.textContent = nm; chips.appendChild(c); }
    } else {
      $('dayTitle').textContent = '날짜를 누르면 누가 되는지 보여요';
    }

    const pl = $('people'); pl.innerHTML = '';
    const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    $('peopleTitle').textContent = '참여자 ' + list.length + '명';
    if (!list.length) pl.innerHTML = '<p class="empty-note">이름을 입력하면 여기에 표시돼요.</p>';
    for (const p of list) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = p.name + ' ' + (p.dates || []).length; pl.appendChild(c); }

    if (me) $('meCount').textContent = me.dates.size + '일 선택됨';
  }

  // ---------- 데이터 불러오기 ----------
  async function loadEvent() {
    const { data, error } = await sb.from('events').select('title').eq('id', EVENT).maybeSingle();
    if (error) { setStatus('약속 정보를 불러오지 못했어요: ' + error.message, true); return false; }
    if (!data) {
      $('app').hidden = true; $('landing').hidden = false;
      $('landingStatus').textContent = '이 링크의 약속을 찾을 수 없어요. 새로 만들어 주세요.';
      history.replaceState(null, '', location.pathname);
      return false;
    }
    if (document.activeElement !== $('title')) $('title').value = data.title;
    document.title = data.title + ' · 약속 날짜 정하기';
    return true;
  }
  async function loadResponses() {
    const { data, error } = await sb.from('responses').select('name,name_key,dates').eq('event_id', EVENT);
    if (error) { setStatus('응답을 불러오지 못했어요: ' + error.message, true); return; }
    const next = {};
    for (const r of data) next[r.name_key] = { name: r.name, dates: r.dates || [] };
    people = next;
    if (me && !dirty && !saving && next[me.key]) me.dates = new Set(next[me.key].dates);
    render();
  }

  // ---------- 조작 ----------
  $('grid').addEventListener('click', e => {
    const b = e.target.closest('.cell'); if (!b || !b.dataset.k || b.disabled) return;
    const k = b.dataset.k; selected = k;
    if (me) { if (me.dates.has(k)) me.dates.delete(k); else me.dates.add(k); queueSave(); }
    render();
    const again = $('grid').querySelector('[data-k="' + k + '"]'); if (again) again.focus();
  });
  $('prev').onclick = () => { if (view > minView) { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); } };
  $('next').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };

  function join() {
    const name = $('name').value.trim();
    if (!name) { const box = $('joinBox'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); $('name').focus(); return; }
    const k = nameKey(name); const existing = people[k];
    me = { key: k, name: existing ? existing.name : name, dates: new Set(existing ? existing.dates : []) };
    try { localStorage.setItem('meetup-name', name); } catch (e) {}
    $('joinForm').style.display = 'none'; $('meBox').hidden = false; $('meName').textContent = me.name;
    setStatus(existing ? '저장된 응답을 불러왔어요.' : '');
    render();
  }
  $('joinBtn').onclick = join;
  $('name').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  $('switchBtn').onclick = async () => {
    await flush();
    me = null; $('meBox').hidden = true; $('joinForm').style.display = 'contents'; $('name').value = ''; $('name').focus(); setStatus(''); render();
  };
  $('leaveBtn').onclick = async () => {
    if (!me || !confirm(me.name + ' 님의 응답을 모두 삭제할까요?')) return;
    clearTimeout(saveTimer); dirty = false;
    const k = me.key; delete people[k]; me = null;
    $('meBox').hidden = true; $('joinForm').style.display = 'contents';
    const { error } = await sb.from('responses').delete().eq('event_id', EVENT).eq('name_key', k);
    setStatus(error ? '삭제하지 못했어요: ' + error.message : '응답을 삭제했어요.', !!error);
    render();
  };

  function queueSave() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); setStatus('저장 중…'); }
  async function flush() {
    clearTimeout(saveTimer);
    if (!dirty || !me) return;
    if (saving) { saveTimer = setTimeout(flush, 400); return; }
    saving = true; dirty = false;
    const row = { event_id: EVENT, name: me.name, name_key: me.key, dates: Array.from(me.dates).sort(), updated_at: new Date().toISOString() };
    const { error } = await sb.from('responses').upsert(row, { onConflict: 'event_id,name_key' });
    saving = false;
    if (error) { dirty = true; setStatus('저장하지 못했어요: ' + error.message, true); return; }
    people[me.key] = { name: row.name, dates: row.dates };
    setStatus('저장했어요. 다른 사람에게도 바로 보여요.');
  }
  window.addEventListener('beforeunload', () => { if (dirty) flush(); });

  let titleTimer = null;
  $('title').addEventListener('input', () => {
    clearTimeout(titleTimer);
    titleTimer = setTimeout(async () => {
      const title = $('title').value.trim() || '우리 언제 만나?';
      await sb.from('events').update({ title }).eq('id', EVENT);
      document.title = title + ' · 약속 날짜 정하기';
    }, 800);
  });

  $('copyBtn').onclick = async () => {
    const url = location.origin + location.pathname + '?e=' + EVENT;
    try { await navigator.clipboard.writeText(url); $('copyHint').textContent = '복사했어요. 카톡에 붙여넣으세요.'; }
    catch (e) { prompt('아래 링크를 복사하세요', url); }
  };

  // ---------- 시작 + 실시간 ----------
  render();
  (async () => {
    if (!(await loadEvent())) return;
    await loadResponses();
    sb.channel('event-' + EVENT)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: 'event_id=eq.' + EVENT }, () => loadResponses())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: 'id=eq.' + EVENT }, () => loadEvent())
      .subscribe();
    // 실시간 연결이 끊겨도 앱으로 돌아오면 최신 상태로
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadResponses(); });
  })();
})();
