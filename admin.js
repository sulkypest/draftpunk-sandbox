// Admin area. Everything here is also enforced by the database rules: a
// non-admin who opens this page sees nothing and can do nothing.
(function () {
    const REASONS = {
        'child-safety': 'May be a risk to children', sexual: 'Sexual content or unwanted advances',
        harassment: 'Bullying or harassment', hate: 'Hate or abuse', underage: 'May be under 16',
        spam: 'Spam or scams', other: 'Something else'
    };
    const TYPES = { message: 'Message', groupMessage: 'Group message', friendRequest: 'Friend request', share: 'Shared chapter', writer: 'Writer' };
    const URGENT = ['child-safety', 'sexual'];
    let reports = [], suspended = [], view = 'open';
    const names = {};
    const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const when = t => t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const $ = id => document.getElementById(id);

    async function waitForUser() {
        for (let i = 0; i < 100; i++) {
            const u = window.getCurrentUser && window.getCurrentUser();
            if (u !== undefined && window.dpAdmin) return u;
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    async function start() {
        const user = await waitForUser();
        if (!user) { $('admStatus').textContent = 'Sign in first, then come back to this page.'; return; }
        if (!(await window.dpAdmin.check())) { $('admStatus').textContent = 'This page is for the Draft Punk admin only.'; return; }
        $('admStatus').style.display = 'none';
        $('admContent').style.display = '';
        await loadAll();
        wireNotices();
        await loadNotices();
        wireCompetitions();
        await loadCompetitions();
    }

    async function loadAll() {
        try {
            [reports, suspended] = await Promise.all([window.dpAdmin.reports(), window.dpAdmin.suspended()]);
        } catch (e) {
            $('admReports').innerHTML = `<p class="adm-err">Couldn't load: ${esc(e.message)}</p>`;
            return;
        }
        const uids = new Set();
        reports.forEach(r => { uids.add(r.from); });
        await Promise.all([...uids].filter(u => u && !(u in names)).map(async u => { names[u] = await window.dpAdmin.username(u); }));
        renderReports();
        renderSuspended();
        const w = await window.dpAdmin.weekly();
        $('admWeekly').textContent = w ? `${w.body} (${when(w.at)})` : 'Nothing yet. This fills in every Monday morning.';
    }

    // ── Notices ──────────────────────────────────────────────────────
    let notices = [];
    const toLocalInput = t => { const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
    async function loadNotices() {
        try { notices = await window.dpAdmin.notices(); } catch (e) { $('admNotices').innerHTML = `<p class="adm-err">Couldn't load notices: ${esc(e.message)}</p>`; return; }
        const now = Date.now();
        const state = n => n.startAt > now ? 'SCHEDULED' : (n.endAt && n.endAt <= now ? 'ENDED' : 'SHOWING');
        $('admNotices').innerHTML = notices.length ? notices.map(n => `<div class="adm-row">
            <span><span class="adm-tag">${state(n)}</span> <strong>${esc(n.title)}</strong>
            <span class="adm-dim"> · ${esc(n.type)} · from ${when(n.startAt)}${n.endAt ? ' to ' + when(n.endAt) : ''}</span></span>
            <button type="button" class="btn-secondary" data-delnotice="${esc(n.id)}">DELETE</button></div>`).join('')
            : '<p class="adm-dim">No notices yet.</p>';
    }
    function formNotice() {
        const f = $('admNoticeForm');
        return {
            type: f.type.value, title: f.title.value.trim(), body: f.body.value.trim(),
            buttonText: f.buttonText.value.trim(), buttonUrl: f.buttonUrl.value.trim(),
            startAt: f.startAt.value ? new Date(f.startAt.value).getTime() : Date.now(),
            endAt: f.endAt.value ? new Date(f.endAt.value).getTime() : 0,
            compId: f.compId.value || ''
        };
    }
    function wireNotices() {
        const f = $('admNoticeForm');
        f.startAt.value = toLocalInput(Date.now());
        f.onsubmit = async e => {
            e.preventDefault();
            const n = formNotice(), err = $('admNoticeErr');
            err.textContent = '';
            if (n.buttonText && !n.buttonUrl) { err.textContent = 'Add a link for the button, or remove the button text.'; return; }
            if (n.endAt && n.endAt <= n.startAt) { err.textContent = 'The end has to be after the start.'; return; }
            try { await window.dpAdmin.saveNotice(n); $('admNoticeInfo').textContent = ''; f.reset(); f.compId.value = ''; f.startAt.value = toLocalInput(Date.now()); await loadNotices(); }
            catch (ex) { err.textContent = 'Couldn\'t save: ' + ex.message; }
        };
        $('admNoticePreview').onclick = () => {
            const n = formNotice();
            if (!n.title) { $('admNoticeErr').textContent = 'Add a title to preview.'; return; }
            window.dpShowNotice(n, () => {});
        };
        document.addEventListener('click', async e => {
            const b = e.target.closest('[data-delnotice]');
            if (!b) return;
            if (!confirm('Delete this notice? Writers who haven\'t seen it yet won\'t see it.')) return;
            try { await window.dpAdmin.deleteNotice(b.dataset.delnotice); await loadNotices(); } catch (ex) { alert('Could not delete: ' + ex.message); }
        });
    }

    // ── Competitions ─────────────────────────────────────────────────
    // Times are entered and shown in UK time, whatever the admin's device is set to.
    let comps = [];
    const ukOffset = t => {   // minutes London is ahead of UTC at time t
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
        return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60000) * 60000) / 60000;
    };
    const fromUk = v => {     // "2026-12-01T09:00" as UK wall time -> ms
        if (!v) return NaN;
        const [d, tm] = v.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number);
        const guess = Date.UTC(y, mo - 1, da, h, mi);
        let t = guess - ukOffset(guess) * 60000;
        return guess - ukOffset(t) * 60000;
    };
    const toUk = t => new Date(t + ukOffset(t) * 60000).toISOString().slice(0, 16);
    const ukWhen = t => new Date(t).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const compState = (c, now = Date.now()) => c.status !== 'published' ? 'DRAFT' : now < c.opensAt ? 'SCHEDULED' : now < c.closesAt ? 'OPEN' : 'CLOSED';

    // Notices made from a competition end when it does (closed early,
    // back to draft, deleted) and follow its closing time if that changes.
    async function syncCompNotices(compId, endAt) {
        const linked = notices.filter(n => n.compId === compId && (!n.endAt || n.endAt > Date.now()));
        for (const n of linked) await window.dpAdmin.saveNotice({ ...n, endAt: Math.max(endAt, n.startAt + 1) });
        if (linked.length) await loadNotices();
    }
    async function loadCompetitions() {
        try { comps = await window.dpAdmin.competitions(); }
        catch (e) { $('admComps').innerHTML = `<p class="adm-err">Couldn't load competitions: ${esc(e.message)}</p>`; return; }
        $('admComps').innerHTML = comps.length ? comps.map(c => {
            const st = compState(c);
            const acts = [];
            if (st !== 'CLOSED') acts.push(`<button type="button" class="btn-secondary" data-comp="edit" data-id="${esc(c.id)}">EDIT</button>`);
            if (st !== 'CLOSED') acts.push(`<button type="button" class="btn-secondary" data-comp="notice" data-id="${esc(c.id)}">MAKE A NOTICE</button>`);
            if (st === 'SCHEDULED') acts.push(`<button type="button" class="btn-secondary" data-comp="unpublish" data-id="${esc(c.id)}">BACK TO DRAFT</button>`);
            if (st === 'OPEN') acts.push(`<button type="button" class="btn-secondary" data-comp="end" data-id="${esc(c.id)}">CLOSE IT NOW</button>`);
            if (st === 'DRAFT' || st === 'SCHEDULED') acts.push(`<button type="button" class="btn-secondary" data-comp="delete" data-id="${esc(c.id)}">DELETE</button>`);
            return `<div class="adm-card adm-comp">
                <div class="adm-card-top"><span class="adm-tag${st === 'OPEN' ? ' live' : ''}">${st}</span> <strong>${esc(c.title)}</strong></div>
                <p class="adm-dim">Prize: ${c.prize ? esc(c.prize) : '<span class="adm-err">not set</span>'} · ${c.minWords.toLocaleString()}–${c.maxWords.toLocaleString()} words · opens ${ukWhen(c.opensAt)} · closes ${ukWhen(c.closesAt)} (UK)</p>
                ${c.theme ? `<p class="adm-quote">${esc(c.theme)}</p>` : '<p class="adm-err">No theme yet.</p>'}
                <div class="adm-actions">${acts.join('')}</div>
            </div>`;
        }).join('') : '<p class="adm-dim">No competitions yet.</p>';
    }

    function compBandLine() {
        const f = $('admCompForm'), min = Math.round(+f.minWords.value), max = Math.round(+f.maxWords.value);
        $('admCompBand').textContent = min > 0 && max >= min
            ? `Halfway boss at ${Math.round(min / 2).toLocaleString()} words, final boss at ${min.toLocaleString()}. Entries can be submitted from ${min.toLocaleString()} words; typing stops at ${(max + 50).toLocaleString()} (the maximum plus 50).`
            : '';
    }
    function resetCompForm() {
        const f = $('admCompForm');
        f.reset(); f.id.value = '';
        [...f.elements].forEach(el => { el.disabled = false; });
        $('admCompCancel').hidden = true;
        $('admCompErr').textContent = '';
        compBandLine();
    }
    function editComp(c) {
        const f = $('admCompForm'), st = compState(c);
        resetCompForm();
        f.id.value = c.id; f.title.value = c.title; f.theme.value = c.theme || ''; f.prize.value = c.prize || '';
        f.minWords.value = c.minWords; f.maxWords.value = c.maxWords;
        f.opensAt.value = toUk(c.opensAt); f.closesAt.value = toUk(c.closesAt);
        // Once it's open, only the title and closing time can change: changing
        // the theme, prize, word band or opening time mid-competition isn't fair.
        if (st === 'OPEN') ['theme', 'prize', 'minWords', 'maxWords', 'opensAt'].forEach(n => { f[n].disabled = true; });
        $('admCompCancel').hidden = false;
        compBandLine();
        f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function wireCompetitions() {
        const f = $('admCompForm');
        f.minWords.oninput = f.maxWords.oninput = compBandLine;
        $('admCompCancel').onclick = resetCompForm;
        f.onsubmit = async e => {
            e.preventDefault();
            const publish = e.submitter && e.submitter.name === 'publish', err = $('admCompErr');
            err.textContent = '';
            const old = comps.find(c => c.id === f.id.value);
            const c = {
                id: f.id.value || '', createdAt: old ? old.createdAt : 0,
                title: f.title.value.trim(), theme: f.theme.value.trim(), prize: f.prize.value.trim(),
                minWords: Math.round(+f.minWords.value), maxWords: Math.round(+f.maxWords.value),
                opensAt: fromUk(f.opensAt.value), closesAt: fromUk(f.closesAt.value),
                status: publish ? 'published' : 'draft'
            };
            if (!c.title) { err.textContent = 'Add a title.'; return; }
            if (!(c.minWords >= 50)) { err.textContent = 'The minimum has to be at least 50 words.'; return; }
            if (!(c.maxWords >= c.minWords)) { err.textContent = 'The maximum can\'t be below the minimum.'; return; }
            if (!(c.closesAt > c.opensAt)) { err.textContent = 'Closing has to be after opening.'; return; }
            if (publish) {
                if (!c.theme) { err.textContent = 'Add the theme before publishing.'; return; }
                if (!c.prize) { err.textContent = 'Add the prize before publishing.'; return; }
                const clash = comps.find(o => o.id !== c.id && o.status === 'published' && o.opensAt < c.closesAt && c.opensAt < o.closesAt);
                if (clash) { err.textContent = `This overlaps "${clash.title}". Only one competition can run at a time.`; return; }
                if (c.closesAt <= Date.now()) { err.textContent = 'The closing time has already passed.'; return; }
                if (c.opensAt <= Date.now() && !(old && compState(old) === 'OPEN')
                    && !confirm('The opening time has already passed, so this opens straight away and writers will see the theme. Publish now?')) return;
            } else if (old && compState(old) === 'OPEN') {
                if (!confirm('This competition is open. Saving it as a draft takes it away from writers straight away. Continue?')) return;
            }
            try {
                const id = await window.dpAdmin.saveCompetition(c);
                const isNew = !c.id;
                if (!isNew) await syncCompNotices(id, publish ? c.closesAt : Date.now());
                resetCompForm();
                await loadCompetitions();
                if (publish && isNew) prefillNotice(comps.find(x => x.id === id));
            } catch (ex) { err.textContent = 'Couldn\'t save: ' + ex.message; }
        };
        document.addEventListener('click', async e => {
            const b = e.target.closest('[data-comp]');
            if (!b) return;
            const c = comps.find(x => x.id === b.dataset.id);
            if (!c) return;
            try {
                if (b.dataset.comp === 'edit') editComp(c);
                else if (b.dataset.comp === 'notice') prefillNotice(c);
                else if (b.dataset.comp === 'unpublish') {
                    await window.dpAdmin.saveCompetition({ ...c, status: 'draft' }); await syncCompNotices(c.id, Date.now()); await loadCompetitions();
                } else if (b.dataset.comp === 'end') {
                    if (!confirm(`Close "${c.title}" now? Writers will stop seeing it straight away.`)) return;
                    await window.dpAdmin.saveCompetition({ ...c, closesAt: Date.now() }); await syncCompNotices(c.id, Date.now()); await loadCompetitions();
                } else if (b.dataset.comp === 'delete') {
                    if (!confirm(`Delete "${c.title}"? This can't be undone.`)) return;
                    await window.dpAdmin.deleteCompetition(c.id); await syncCompNotices(c.id, Date.now()); await loadCompetitions();
                }
            } catch (ex) { alert('That didn\'t work: ' + ex.message); }
        });
        compBandLine();
    }
    // Fill in the Notices form for a competition, to check and save there
    function prefillNotice(c) {
        if (!c) return;
        const f = $('admNoticeForm');
        f.compId.value = c.id;
        f.type.value = 'competition';
        f.title.value = `New short story competition: ${c.title}`.slice(0, 120);
        f.body.value = `Open now: ${c.minWords.toLocaleString()}–${c.maxWords.toLocaleString()} words, closing ${ukWhen(c.closesAt)} (UK time). The theme is on the competition page.`;
        f.buttonText.value = 'SEE THE COMPETITION';
        f.buttonUrl.value = 'competition.html';
        f.startAt.value = toLocalInput(Math.max(c.opensAt, Date.now()));
        f.endAt.value = toLocalInput(c.closesAt);
        $('admNoticeInfo').textContent = 'Filled in from the competition. It shows from opening time; check the wording, then press SAVE NOTICE.';
        f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function isOpen(r) { return r.status !== 'done'; }
    function isSuspended(uid) { return suspended.some(s => s.uid === uid); }

    window.admShow = function (v) {
        view = v;
        $('admTabOpen').setAttribute('aria-selected', String(v === 'open'));
        $('admTabDone').setAttribute('aria-selected', String(v === 'done'));
        renderReports();
    };

    function renderReports() {
        const open = reports.filter(isOpen);
        $('admOpenCount').textContent = open.length ? `(${open.length})` : '';
        let list = view === 'open' ? open : reports.filter(r => !isOpen(r));
        if (view === 'open') list = list.slice().sort((a, b) => (URGENT.includes(b.reason) - URGENT.includes(a.reason)) || (b.createdAt - a.createdAt));
        if (!list.length) { $('admReports').innerHTML = `<p class="adm-dim">${view === 'open' ? 'No open reports.' : 'None yet.'}</p>`; return; }
        $('admReports').innerHTML = list.map(r => {
            const urgent = URGENT.includes(r.reason);
            const target = r.targetUid ? `${esc(r.targetUsername || '?')}${isSuspended(r.targetUid) ? ' <span class="adm-tag">SUSPENDED</span>' : ''}` : '—';
            return `<article class="adm-card${urgent ? ' urgent' : ''}" data-id="${esc(r.id)}">
                <div class="adm-card-top">
                    ${urgent ? '<span class="adm-tag urgent">URGENT</span>' : ''}
                    <strong>${esc(REASONS[r.reason] || r.reason)}</strong>
                    <span class="adm-dim">${esc(TYPES[r.type] || r.type)} · ${when(r.createdAt)}</span>
                </div>
                <dl class="adm-dl">
                    <dt>Reported</dt><dd>${target}</dd>
                    <dt>By</dt><dd>${esc(names[r.from] || r.from)}</dd>
                    ${r.excerpt ? `<dt>As they saw it</dt><dd class="adm-quote">${esc(r.excerpt)}</dd>` : ''}
                    ${r.note ? `<dt>Their note</dt><dd>${esc(r.note)}</dd>` : ''}
                    ${r.path ? `<dt>Now</dt><dd><button type="button" class="adm-link" data-act="look">Show what's there now</button><span class="adm-now"></span></dd>` : ''}
                    ${!isOpen(r) ? `<dt>Dealt with</dt><dd>${when(r.handledAt)}${r.adminNote ? ' · ' + esc(r.adminNote) : ''}</dd>` : ''}
                </dl>
                <div class="adm-actions">
                    ${r.path ? '<button type="button" class="btn-secondary" data-act="delete">DELETE IT</button>' : ''}
                    ${r.targetUid && !isSuspended(r.targetUid) ? '<button type="button" class="btn-secondary" data-act="suspend">SUSPEND WRITER</button>' : ''}
                    ${isOpen(r)
                        ? '<input type="text" class="adm-note" maxlength="1000" placeholder="Note (optional)" aria-label="Note"><button type="button" data-act="done">MARK DEALT WITH</button>'
                        : '<button type="button" class="btn-secondary" data-act="reopen">REOPEN</button>'}
                </div>
                <p class="adm-err" aria-live="polite"></p>
            </article>`;
        }).join('');
    }

    function renderSuspended() {
        if (!suspended.length) { $('admSuspended').innerHTML = '<p class="adm-dim">None.</p>'; return; }
        $('admSuspended').innerHTML = suspended.map(s => `<div class="adm-row">
            <span><strong>${esc(s.username || s.uid)}</strong> <span class="adm-dim">since ${when(s.at)}${s.reason ? ' · ' + esc(s.reason) : ''}</span></span>
            <button type="button" class="btn-secondary" data-unsuspend="${esc(s.uid)}" data-name="${esc(s.username || '')}">LIFT</button>
        </div>`).join('');
    }

    document.addEventListener('click', async e => {
        const lift = e.target.closest('[data-unsuspend]');
        if (lift) {
            if (!confirm(`Lift the suspension for ${lift.dataset.name || 'this writer'}? They'll be able to write and use social features again.`)) return;
            lift.disabled = true;
            try { await window.dpAdmin.unsuspend(lift.dataset.unsuspend); await loadAll(); }
            catch (err) { alert('Could not lift it: ' + err.message); lift.disabled = false; }
            return;
        }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const card = btn.closest('.adm-card');
        const r = reports.find(x => x.id === card.dataset.id);
        const err = card.querySelector('.adm-err');
        err.textContent = '';
        try {
            if (btn.dataset.act === 'look') {
                const item = await window.dpAdmin.item(r.path);
                card.querySelector('.adm-now').textContent = item
                    ? (r.path.startsWith('shares/') ? ` "${item.chapterTitle || ''}", ${item.wordCount || 0} words` : ` ${item.body || ''}`)
                    : ' Gone (deleted).';
            } else if (btn.dataset.act === 'delete') {
                if (!confirm(r.path.startsWith('shares/') ? 'Stop this chapter being shared? The writer keeps their chapter.' : 'Delete this message for everyone?')) return;
                await window.dpAdmin.deleteItem(r.path);
                card.querySelector('.adm-now') && (card.querySelector('.adm-now').textContent = ' Deleted.');
                btn.remove();
            } else if (btn.dataset.act === 'suspend') {
                const why = prompt(`Suspend ${r.targetUsername || 'this writer'}? They'll still be able to sign in and export their writing.\n\nReason (kept with the suspension):`, REASONS[r.reason] || '');
                if (why === null) return;
                await window.dpAdmin.suspend(r.targetUid, r.targetUsername, why, r.id);
                await loadAll();
            } else if (btn.dataset.act === 'done') {
                await window.dpAdmin.markReport(r.id, 'done', card.querySelector('.adm-note').value);
                await loadAll();
            } else if (btn.dataset.act === 'reopen') {
                await window.dpAdmin.markReport(r.id, 'open', r.adminNote || '');
                await loadAll();
            }
        } catch (ex) { err.textContent = 'That didn\'t work: ' + ex.message; }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
