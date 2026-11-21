export const getAuth = () => ({});
export class GoogleAuthProvider {}
export const signInWithPopup = async () => ({ user: window.__mockUser });
export const signOut = async () => {};
export const deleteUser = async () => {};
export const onAuthStateChanged = (auth, cb) => { setTimeout(() => cb(window.__mockUser || null), 30); return () => {}; };

// ── Email sign-in stand-ins (sandbox only) ──────────────────────────────────
// Try: any email starting "google" behaves like an existing Google account;
// password "wrong" fails; passwords under 6 characters are refused on create.
const wait = ms => new Promise(r => setTimeout(r, ms));
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const goIn = () => { setTimeout(() => { location.href = 'index.html?dashboard'; }, 200); return { user: window.__mockUser || {} }; };
const checkEmail = email => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) fail('auth/invalid-email'); };
export const signInWithEmailAndPassword = async (auth, email, pw) => {
    await wait(300); checkEmail(email);
    if (!pw) fail('auth/missing-password');
    if (pw === 'wrong' || /^google/i.test(email)) fail('auth/invalid-credential');
    return goIn();
};
export const createUserWithEmailAndPassword = async (auth, email, pw) => {
    await wait(300); checkEmail(email);
    if (/^google/i.test(email)) fail('auth/email-already-in-use');
    if (!pw || pw.length < 6) fail('auth/weak-password');
    return goIn();
};
export const sendPasswordResetEmail = async (auth, email) => { await wait(300); checkEmail(email); };
export const sendEmailVerification = async () => {};
export const sendSignInLinkToEmail = async (auth, email) => { await wait(300); checkEmail(email); };
export const isSignInWithEmailLink = (auth, href) => /[?&]mode=signIn/.test(href);
export const signInWithEmailLink = async (auth, email) => { await wait(300); checkEmail(email); return { user: window.__mockUser || {} }; };
