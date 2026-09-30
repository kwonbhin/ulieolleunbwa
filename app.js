(function () {
  const STAR = '<svg class="allstar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 5.3L19.8 4l-2.3 5.6L23 12l-5.5 2.4 2.3 5.6-5.6-2.3L12 23l-2.2-5.3L4.2 20l2.3-5.6L1 12l5.5-2.4L4.2 4l5.6 2.3z"/></svg>';
  const MON = ['JAN','FEB','MAR','APR','MAY','JUNE','JULY','AUG','SEPT','OCT','NOV','DEC'];
  const DOW_KO = ['일','월','화','수','목','금','토'];
  const DEFAULT_EVENT = 'mainmeetup';   // 주소에 ?e= 가 없으면 이 약속을 사용
  const $ = id => document.getElementById(id);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = key(today);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const minView = new Date(view);

  let people = {};        // name_key -> {name, dates}
  let me = null;          // {key, name, saved:Set, draft:Set, editing, isNew}
  let selected = null;
  let saving = false, statusTimer = null;

  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function prettyDate(k) { const [y, m, d] = k.split('-').map(Number); const dt = new Date(y, m - 1, d); return m + '월 ' + d + '일 (' + DOW_KO[dt.getDay()] + ')'; }
  function nameKey(n) { return n.trim().toLowerCase(); }
  function setStatus(msg, err, autoHide) {
    const s = $('status'); clearTimeout(statusTimer);
    s.textContent = msg || ''; s.classList.toggle('err', !!err);
    if (autoHide) statusTimer = setTimeout(() => { s.textContent = ''; }, 2200);
  }

  // ---------- Supabase 연결 ----------
  const cfg = window.MEETUP_CONFIG || {};
  const badCfg = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-') || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR-');
  let sb = null;
  if (!window.supabase) showError('Supabase 라이브러리를 불러오지 못했어요. index.html의 supabase-js 주소를 확인하세요.');
  else if (badCfg) showError('config.js에 Supabase 주소와 anon key를 넣어야 사이트가 작동해요.');
  else sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  function showError(msg) { const b = $('configErr'); b.textContent = msg; b.hidden = false; }

  const params = new URLSearchParams(location.search);
  let EVENT = (params.get('e') || '').toLowerCase();
  if (!/^[a-z0-9]{10}$/.test(EVENT)) EVENT = DEFAULT_EVENT;

  try { const saved = localStorage.getItem('meetup-name'); if (saved) $('name').value = saved; } catch (e) {}

  function allPeople() {
    const map = Object.assign({}, people);
    if (me && (me.editing || !me.isNew)) map[me.key] = { name: me.name, dates: Array.from(shown()) };
    return map;
  }
  function shown() { return me ? (me.editing ? me.draft : me.saved) : new Set(); }
  function changed() {
    if (!me || !me.editing) return false;
    if (me.draft.size !== me.saved.size) return true;
    for (const d of me.draft) if (!me.saved.has(d)) return true;
    return false;
  }
  function tally() {
    const map = allPeople(); const counts = {};
    for (const k in map) for (const d of (map[k].dates || [])) (counts[d] = counts[d] || []).push(map[k].name);
    return { map, counts, total: Object.keys(map).length };
  }

  function render() {
    const { map, counts, total } = tally();
    $('bigMonth').textContent = MON[view.getMonth()];
    const ys = String(view.getFullYear()); $('y1').textContent = ys.slice(0, 2); $('y2').textContent = ys.slice(2);
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
      const mine = me && shown().has(k);
      if (mine) b.classList.add('mine');
      if (selected === k) b.classList.add('sel');
      let html = '<span class="n">' + d + '</span>';
      if (!past && n) html += '<span class="cnt">' + n + '<span class="u">명</span></span>';
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

    $('grid').classList.toggle('locked', !!me && !me.editing);
    renderMe();
  }

  function renderMe() {
    const bar = $('saveBar');
    if (!me) { bar.hidden = true; document.body.classList.remove('has-bar'); return; }
    const n = shown().size, dirty = changed();
    const st = $('meState');
    if (me.editing) {
      st.textContent = me.isNew ? '새로 작성 중' : (dirty ? '수정 중 · 저장 안 됨' : '수정 중');
      st.className = 'badge editing';
      $('meCount').textContent = n + '일 선택됨 · 되는 날짜를 누르고 저장하기를 눌러주세요';
    } else {
      st.textContent = '저장됨'; st.className = 'badge saved';
      $('meCount').textContent = n + '일 선택됨 · 바꾸려면 수정하기를 눌러주세요';
    }
    $('editActions').hidden = !me.editing;
    $('viewActions').hidden = me.editing;
    $('saveBtn').disabled = saving || (!dirty && !me.isNew);
    bar.hidden = !me.editing;
    document.body.classList.toggle('has-bar', !bar.hidden);
    $('saveBarText').textContent = n + '일 선택' + (dirty ? ' · 저장 안 됨' : '');
    $('saveBarBtn').disabled = $('saveBtn').disabled;
    $('saveBarBtn').textContent = saving ? '저장 중…' : '저장하기';
    $('saveBtn').textContent = saving ? '저장 중…' : '저장하기';
  }

  // ---------- 데이터 ----------
  async function loadEvent() {
    const { data, error } = await sb.from('events').select('title').eq('id', EVENT).maybeSingle();
    if (error) { setStatus('약속 정보를 불러오지 못했어요: ' + error.message, true); return false; }
    if (!data) {
      if (EVENT !== DEFAULT_EVENT) { location.replace(location.pathname); return false; }
      const ins = await sb.from('events').insert({ id: DEFAULT_EVENT, title: '우리 언제 만나?' });
      if (ins.error && ins.error.code !== '23505') { setStatus('약속을 준비하지 못했어요: ' + ins.error.message, true); return false; }
      return true;
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
    if (me && next[me.key]) {
      me.saved = new Set(next[me.key].dates); me.isNew = false;
      if (!me.editing) me.draft = new Set(me.saved);
    }
    render();
  }

  // ---------- 조작 ----------
  $('grid').addEventListener('click', e => {
    const b = e.target.closest('.cell'); if (!b || !b.dataset.k || b.disabled) return;
    const k = b.dataset.k; selected = k;
    if (me && me.editing) { if (me.draft.has(k)) me.draft.delete(k); else me.draft.add(k); }
    else if (me) setStatus('날짜를 바꾸려면 수정하기를 눌러주세요', false, true);
    else if (window.matchMedia('(max-width:600px)').matches) setStatus('이름을 먼저 입력하면 날짜를 체크할 수 있어요', false, true);
    render();
  });
  $('prev').onclick = () => { if (view > minView) { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); } };
  $('next').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };

  function join() {
    const name = $('name').value.trim();
    if (!name) { const box = $('joinBox'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); $('name').focus(); return; }
    const k = nameKey(name); const existing = people[k];
    const saved = new Set(existing ? existing.dates : []);
    me = { key: k, name: existing ? existing.name : name, saved, draft: new Set(saved), editing: !existing, isNew: !existing };
    try { localStorage.setItem('meetup-name', name); } catch (e) {}
    $('name').blur();
    $('joinForm').style.display = 'none'; $('meBox').hidden = false; $('meName').textContent = me.name;
    setStatus(existing ? '저장된 응답을 불러왔어요. 바꾸려면 수정하기를 눌러주세요' : '되는 날짜를 누르고 저장하기를 눌러주세요', false, true);
    render();
  }
  $('joinBtn').onclick = join;
  $('name').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  $('switchBtn').onclick = () => {
    me = null; $('meBox').hidden = true; $('joinForm').style.display = 'contents'; $('name').value = ''; $('name').focus(); setStatus(''); render();
  };
  $('leaveBtn').onclick = async () => {
    if (!me || !confirm(me.name + ' 님의 응답을 모두 삭제할까요?')) return;
    const k = me.key; delete people[k]; me = null;
    $('meBox').hidden = true; $('joinForm').style.display = 'contents';
    render();
    if (!sb) return;
    const { error } = await sb.from('responses').delete().eq('event_id', EVENT).eq('name_key', k);
    setStatus(error ? '삭제하지 못했어요: ' + error.message : '응답을 삭제했어요', !!error, !error);
  };

  async function save() {
    if (!me || !me.editing || saving || !sb) return;
    if (!changed() && !me.isNew) return;
    saving = true; renderMe();
    const dates = Array.from(me.draft).sort();
    const row = { event_id: EVENT, name: me.name, name_key: me.key, dates, updated_at: new Date().toISOString() };
    const { error } = await sb.from('responses').upsert(row, { onConflict: 'event_id,name_key' });
    saving = false;
    if (error) { setStatus('저장하지 못했어요: ' + error.message, true); renderMe(); return; }
    me.saved = new Set(dates); me.draft = new Set(dates); me.editing = false; me.isNew = false;
    people[me.key] = { name: me.name, dates };
    setStatus(dates.length + '일 저장했어요. 다른 사람에게도 바로 보여요', false, true);
    render();
  }
  function startEdit() { if (!me) return; me.draft = new Set(me.saved); me.editing = true; render(); }
  function cancelEdit() {
    if (!me) return;
    if (changed() && !confirm('저장하지 않은 변경을 버릴까요?')) return;
    if (me.isNew) { me = null; $('meBox').hidden = true; $('joinForm').style.display = 'contents'; setStatus(''); render(); return; }
    me.draft = new Set(me.saved); me.editing = false; render();
  }
  $('saveBtn').onclick = save;
  $('saveBarBtn').onclick = save;
  $('editBtn').onclick = startEdit;
  $('cancelBtn').onclick = cancelEdit;
  window.addEventListener('beforeunload', e => { if (changed()) { e.preventDefault(); e.returnValue = ''; } });

  let titleTimer = null;
  $('title').addEventListener('input', () => {
    clearTimeout(titleTimer);
    titleTimer = setTimeout(async () => {
      if (!sb) return;
      const title = $('title').value.trim() || '우리 언제 만나?';
      await sb.from('events').update({ title }).eq('id', EVENT);
      document.title = title + ' · 약속 날짜 정하기';
    }, 800);
  });

  $('copyBtn').onclick = async () => {
    const url = location.origin + location.pathname + (EVENT === DEFAULT_EVENT ? '' : '?e=' + EVENT);
    try { await navigator.clipboard.writeText(url); $('copyHint').textContent = '복사했어요. 카톡에 붙여넣으세요.'; }
    catch (e) { prompt('아래 링크를 복사하세요', url); }
  };

  // ---------- 시작 ----------
  render();
  if (!sb) return;
  (async () => {
    if (!(await loadEvent())) return;
    await loadResponses();
    sb.channel('event-' + EVENT)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: 'event_id=eq.' + EVENT }, () => loadResponses())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: 'id=eq.' + EVENT }, () => loadEvent())
      .subscribe();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadResponses(); });
  })();
})();
