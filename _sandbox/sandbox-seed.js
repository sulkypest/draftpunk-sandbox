// ── DRAFT PUNK SANDBOX ───────────────────────────────────────────────────────
// Loaded first on every page of the sandbox copy only (never on draft-punk.com).
// 1. Provides a pretend database that lives in this browser's storage, which
//    the sandbox's fake Firebase modules read and write. Nothing leaves the
//    device: there is no connection to the real Firebase project.
// 2. Fills the app with mock users and filler text on first visit.
// 3. Shows a SANDBOX bar with a "reset test data" button.
(function () {
    const DB_KEY = 'dpSandboxDB';
    const SEED_KEY = 'dpSandboxSeeded';
    const SEED_VERSION = '1';
    const rawSet = Storage.prototype.setItem;
    const store = (k, v) => rawSet.call(localStorage, k, v);

    const ME = { uid: 'sandbox-me', displayName: 'Sandbox Writer', photoURL: '' };
    window.__mockUser = ME;

    // ── Pretend database ───────────────────────────────────────────────────────
    const load = () => { try { return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); } catch (e) { return {}; } };
    const save = db => store(DB_KEY, JSON.stringify(db));
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v) && !v.__op;
    function apply(prev, val) {
        if (val && val.__op === 'union') { const a = Array.isArray(prev) ? prev.slice() : []; val.v.forEach(x => { if (!a.includes(x)) a.push(x); }); return a; }
        if (val && val.__op === 'remove') { return (Array.isArray(prev) ? prev : []).filter(x => !val.v.includes(x)); }
        if (isObj(val)) { const out = isObj(prev) ? { ...prev } : {}; for (const k in val) out[k] = apply(out[k], val[k]); return out; }
        return val;
    }
    window.__dbSet = async (path, data, merge) => { const db = load(); db[path] = merge ? apply(db[path], data) : apply(undefined, data); save(db); };
    window.__dbGet = async path => { const d = load()[path]; return d == null ? null : JSON.parse(JSON.stringify(d)); };
    window.__dbDel = async path => { const db = load(); delete db[path]; save(db); };
    window.__dbList = async coll => {
        const db = load(), depth = coll.split('/').length + 1;
        return Object.keys(db).filter(p => p.startsWith(coll + '/') && p.split('/').length === depth)
            .map(p => [p.split('/').pop(), JSON.parse(JSON.stringify(db[p]))]);
    };

    // ── Test data ──────────────────────────────────────────────────────────────
    const FILLER = 'test text filler words for layout and scrolling checks only';
    const para = (n, words) => {
        const w = FILLER.split(' '); let out = [];
        for (let i = 0; out.length < words; i++) out.push(w[i % w.length]);
        return `Test paragraph ${n}. ` + out.join(' ') + '.';
    };
    const chapterHtml = (paras, words) => Array.from({ length: paras }, (_, i) =>
        i === 0 ? para(1, words) : `<div>${para(i + 1, words)}</div>`).join('');
    const count = html => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

    function seed() {
        const now = Date.now(), day = 86400000;
        const chapters = [
            { id: 'sbx-c1', title: 'Test chapter 1 (short)', paras: 6, words: 40 },
            { id: 'sbx-c2', title: 'Test chapter 2 (long, for scrolling)', paras: 60, words: 70 },
            { id: 'sbx-c3', title: 'Test chapter 3 (medium)', paras: 20, words: 55 },
            { id: 'sbx-c4', title: 'Test chapter 4 (empty)', paras: 0, words: 0 }
        ].map((c, i) => { const content = c.paras ? chapterHtml(c.paras, c.words) : ''; return { id: c.id, title: c.title, order: i, content, wordCount: count(content), updatedAt: now - (4 - i) * day }; });
        const total = chapters.reduce((s, c) => s + c.wordCount, 0);

        Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
        store('draftPunkData', JSON.stringify({
            activeProjectId: 'sbx-p1',
            projects: { 'sbx-p1': { active: true, title: 'Sandbox Test Project', goal: 80000, total, xp: 0,
                logs: [{ date: new Date(now - day).toISOString().slice(0, 10), words: 1200 }, { date: new Date(now).toISOString().slice(0, 10), words: 450 }],
                lastLevel: -1, inventory: [] } }
        }));
        store('writingData', JSON.stringify({ projectId: 'sbx-p1', chapters }));
        store('dpUserId', ME.uid);
        store('authDecisionMade', '1');
        store('dpLastUpdated', String(now));

        const friends = [
            { uid: 'sbx-u1', username: 'test_ana', total: 42310, week: 3100, month: 9800, year: 42310 },
            { uid: 'sbx-u2', username: 'test_ben', total: 15870, week: 900, month: 4200, year: 15870 },
            { uid: 'sbx-u3', username: 'test_cal', total: 88025, week: 5400, month: 17600, year: 61000 },
            { uid: 'sbx-u4', username: 'test_dee', total: 3020, week: 0, month: 1100, year: 3020 },
            { uid: 'sbx-u5', username: 'test_eli', total: 27440, week: 2050, month: 6700, year: 27440 }
        ];
        const db = {};
        db['users/' + ME.uid] = { username: 'sandbox_me', displayName: ME.displayName, photoURL: '', totalWords: total, wordsThisWeek: 1650, wordsThisMonth: 5200, wordsThisYear: total, friends: friends.map(f => f.uid) };
        db['usernames/sandbox_me'] = { uid: ME.uid };
        friends.forEach(f => {
            db['users/' + f.uid] = { username: f.username, displayName: f.username, photoURL: '', totalWords: f.total, wordsThisWeek: f.week, wordsThisMonth: f.month, wordsThisYear: f.year, friends: [ME.uid], updatedAt: now - day };
            db['usernames/' + f.username] = { uid: f.uid };
        });
        db['users/sbx-u6'] = { username: 'test_fay', displayName: 'test_fay', photoURL: '', totalWords: 500, friends: [] };
        db['usernames/test_fay'] = { uid: 'sbx-u6' };
        db['friendRequests/sbx-u6_' + ME.uid] = { from: 'sbx-u6', fromUsername: 'test_fay', to: ME.uid, createdAt: now - 3600000 };

        const dm = (id, from, to, fromU, toU, body, mins, read) => { db['messages/' + id] = { from, to, fromUsername: fromU, toUsername: toU, body, read, createdAt: now - mins * 60000 }; };
        dm('sbx-m1', 'sbx-u1', ME.uid, 'test_ana', 'sandbox_me', 'Test message 1 from test_ana.', 300, true);
        dm('sbx-m2', ME.uid, 'sbx-u1', 'sandbox_me', 'test_ana', 'Test reply 1 to test_ana.', 280, true);
        dm('sbx-m3', 'sbx-u1', ME.uid, 'test_ana', 'sandbox_me', 'Test message 2 from test_ana.', 20, false);
        dm('sbx-m4', 'sbx-u2', ME.uid, 'test_ben', 'sandbox_me', 'Test message from test_ben.', 1500, true);

        const members = [ME.uid, 'sbx-u1', 'sbx-u2', 'sbx-u3'];
        const memberNames = { [ME.uid]: 'sandbox_me', 'sbx-u1': 'test_ana', 'sbx-u2': 'test_ben', 'sbx-u3': 'test_cal' };
        db['groups/sbx-g1'] = { name: 'Test Group', ownerId: ME.uid, ownerUsername: 'sandbox_me', members, memberNames, createdAt: now - 7 * day };
        [['sbx-u1', 'test_ana', 'Test group message 1.', 600], ['sbx-u3', 'test_cal', 'Test group message 2.', 400], [ME.uid, 'sandbox_me', 'Test group message 3.', 100], ['sbx-u2', 'test_ben', 'Test group message 4.', 10]]
            .forEach(([from, u, body, mins], i) => { db['groups/sbx-g1/messages/sbx-gm' + i] = { from, fromUsername: u, body, createdAt: now - mins * 60000 }; });

        const shared = chapterHtml(8, 50);
        db['shares/sbx-u1_sbx-x1_' + ME.uid] = { ownerId: 'sbx-u1', ownerUsername: 'test_ana', projectId: 'sbx-xp', projectTitle: 'Test Shared Project', chapterId: 'sbx-x1', chapterTitle: 'Test shared chapter', content: shared, wordCount: count(shared), sharedWith: [ME.uid], sharedWithUsernames: ['sandbox_me'], updatedAt: now - 2 * day };
        save(db);
        store(SEED_KEY, SEED_VERSION);
    }

    if (localStorage.getItem(SEED_KEY) !== SEED_VERSION) seed();

    window.dpSandboxReset = function () {
        if (!confirm('Reset the sandbox? Everything typed here is replaced with fresh test data.')) return;
        seed();
        location.href = 'write.html';
    };

    // ── SANDBOX badge ──────────────────────────────────────────────────────────
    // Small and in a corner, so it doesn't change the layout being tested.
    // Tap it to reveal the reset button.
    function badge() {
        if (document.getElementById('dpSandboxBadge')) return;
        if (!/^\[SANDBOX\]/.test(document.title)) document.title = '[SANDBOX] ' + document.title;
        const b = document.createElement('div');
        b.id = 'dpSandboxBadge';
        b.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:100000;background:#ffd400;color:#000;font:700 10px/1 "Courier New",monospace;letter-spacing:1px;padding:5px 7px;border:1px solid #000;opacity:.85;display:flex;gap:6px;align-items:center;';
        b.innerHTML = '<span>SANDBOX</span><button type="button" style="display:none;font:700 10px \'Courier New\',monospace;background:#000;color:#ffd400;border:0;padding:4px 6px;">RESET TEST DATA</button>';
        const btn = b.querySelector('button');
        b.querySelector('span').addEventListener('click', () => { btn.style.display = btn.style.display === 'none' ? '' : 'none'; });
        btn.addEventListener('click', window.dpSandboxReset);
        document.body.appendChild(b);
    }
    if (document.body) badge(); else document.addEventListener('DOMContentLoaded', badge);
})();
