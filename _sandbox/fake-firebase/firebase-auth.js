export const getAuth = () => ({});
export class GoogleAuthProvider {}
export const signInWithPopup = async () => ({ user: window.__mockUser });
export const signOut = async () => {};
export const deleteUser = async () => {};
export const onAuthStateChanged = (auth, cb) => { setTimeout(() => cb(window.__mockUser || null), 30); return () => {}; };
