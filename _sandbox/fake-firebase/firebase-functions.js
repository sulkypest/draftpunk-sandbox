// Sandbox stand-in for the sign-in code functions. Nothing is emailed.
// The code is always 123456. Emails starting "limit" act as if today's
// sending limit has been reached; "busy" acts as if a code was just sent.
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = (code, reason, extra = {}) => { const e = new Error(reason); e.code = 'functions/' + code; e.details = { reason, ...extra }; throw e; };
const tries = {};
export const getFunctions = () => ({});
export const httpsCallable = (fns, name) => async (data) => {
    await wait(400);
    // Admin: sandbox_me is the admin unless localStorage dpSandboxAdmin = '0'
    if (name === 'claimAdmin') return { data: { admin: localStorage.getItem('dpSandboxAdmin') !== '0' } };
    if (name === 'issueWritingRecord') return { data: await issueWritingRecord(data || {}) };
    const email = String((data && data.email) || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('invalid-argument', 'bad-email');
    if (name === 'requestSignInCode') {
        if (/^limit/.test(email)) fail('resource-exhausted', 'quota');
        if (/^busy/.test(email)) fail('resource-exhausted', 'cooldown', { waitSeconds: 42 });
        tries[email] = 0;
        console.info('[sandbox] Sign-in code for ' + email + ' is 123456');
        return { data: { ok: true } };
    }
    if (name === 'verifySignInCode') {
        if (tries[email] === undefined) fail('not-found', 'expired');
        if (tries[email] >= 5) fail('permission-denied', 'locked');
        if (data.code !== '123456') { tries[email]++; const left = 5 - tries[email]; if (left <= 0) fail('permission-denied', 'locked'); fail('invalid-argument', 'wrong', { left }); }
        delete tries[email];
        return { data: { token: 'sandbox-token' } };
    }
    fail('not-found', 'unknown-function');
};

// Writing Record share links: does what the real Cloud Function does
// (firebase/functions/index.js, issueWritingRecord), using the same
// record-core.js, against the sandbox's pretend database.
async function issueWritingRecord({ projectId, shareId, chapterIds }) {
    await import('../../firebase/functions/record-core.js');
    const core = window.DPRecordCore;
    const uid = window.__mockUser && window.__mockUser.uid;
    if (!uid) fail('unauthenticated', 'sign-in');
    if (typeof projectId !== 'string' || !/^[\w-]{1,120}$/.test(projectId)) fail('invalid-argument', 'project');
    if (shareId != null && !/^[a-f0-9]{24}$/.test(String(shareId))) fail('invalid-argument', 'share');
    if (chapterIds != null && (!Array.isArray(chapterIds) || !chapterIds.every(c => typeof c === 'string' && /^[\w-]{1,120}$/.test(c)))) fail('invalid-argument', 'chapters');
    const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
    let owner = null;
    if (shareId) {
        const ex = await window.__dbGet('evidenceShares/' + shareId), own = await window.__dbGet('recordOwners/' + shareId);
        if (!ex || !((own && own.uid === uid) || ex.uid === uid)) fail('permission-denied', 'not-yours');
        owner = own;
    }
    const id = shareId || hex(12);
    const priv = await window.__dbGet('users/' + uid + '/private/data') || {};
    const pub = await window.__dbGet('users/' + uid) || {};
    const project = priv.draftPunkData && priv.draftPunkData.projects && priv.draftPunkData.projects[projectId];
    if (!project) fail('not-found', 'project');
    const list = async c => (await window.__dbList('users/' + uid + '/' + c)).map(([i, d]) => ({ ...d, id: i })).filter(d => d.projectId === projectId);
    const all = await list('writing');
    const chosen = chapterIds ? all.filter(c => chapterIds.includes(c.id)) : all;
    if (!chosen.length) fail('invalid-argument', 'no-chapters');
    const now = Date.now();
    const { snapshot, text } = core.buildSnapshot({ title: project.title, author: pub.username || '', chapters: chosen, evidence: await list('evidence'), now });
    let code = owner && owner.code;
    while (!code) { const c = core.makeCode(crypto.getRandomValues(new Uint8Array(8))); if (!(await window.__dbGet('recordCodes/' + c))) { code = c; await window.__dbSet('recordCodes/' + c, { shareId: id, createdAt: now }, false); } }
    await window.__dbSet('recordOwners/' + id, { uid, code, projectId, chapterIds: chapterIds || null, createdAt: (owner && owner.createdAt) || now, updatedAt: now }, false);
    await window.__dbSet('evidenceShares/' + id, { ...snapshot, code, chapterScope: { included: chosen.length, total: all.length }, createdAt: now, issuedBy: 'draft-punk', issuedAt: now, fingerprint: core.fingerprint(text, hex(6)) }, false);
    const sh = await window.__dbGet('users/' + uid + '/evidence/_shares') || { ids: [] };
    if (!sh.ids.includes(id)) sh.ids.push(id);
    await window.__dbSet('users/' + uid + '/evidence/_shares', sh, false);
    return { id, code, words: snapshot.totals.words, issuedAt: now };
}
