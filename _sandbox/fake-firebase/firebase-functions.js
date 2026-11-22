// Sandbox stand-in for the sign-in code functions. Nothing is emailed.
// The code is always 123456. Emails starting "limit" act as if today's
// sending limit has been reached; "busy" acts as if a code was just sent.
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = (code, reason, extra = {}) => { const e = new Error(reason); e.code = 'functions/' + code; e.details = { reason, ...extra }; throw e; };
const tries = {};
export const getFunctions = () => ({});
export const httpsCallable = (fns, name) => async (data) => {
    await wait(400);
    // Admin: sandbox_me is the admin when localStorage dpSandboxAdmin = '1'
    if (name === 'claimAdmin') return { data: { admin: localStorage.getItem('dpSandboxAdmin') === '1' } };
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
