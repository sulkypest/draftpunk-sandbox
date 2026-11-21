export const getFirestore = () => ({});
const P = segs => segs.join('/');
export const doc = (db, ...segs) => {
    if (db && db.coll && !segs.length) { const id = 'auto' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return { path: db.path + '/' + id, id }; }
    return { path: P(segs), id: segs[segs.length - 1] };
};
export const collection = (db, ...segs) => ({ path: P(segs), coll: true });
export const query = (c, ...cons) => ({ ...c, filters: [...(c.filters || []), ...cons.filter(x => x && x.where)], order: (cons.find(x => x && x.order) || c).order, lim: (cons.find(x => x && x.lim) || c).lim });
export const where = (f, op, v) => ({ where: [f, op, v] });
export const orderBy = (f, dir) => ({ order: [f, dir || 'asc'] }), limit = n => ({ lim: n });
const matches = (d, filters) => (filters || []).every(({ where: [f, op, v] }) => op === '==' ? d[f] === v : op === 'array-contains' ? (Array.isArray(d[f]) && d[f].includes(v)) : true);
export const arrayUnion = (...v) => ({ __op: 'union', v });
export const deleteField = () => ({ __op: 'delete' });
export const arrayRemove = (...v) => ({ __op: 'remove', v });
export async function setDoc(ref, data, opts) {
    // Sandbox tool: "Cloud saves: failing" makes chapter saves fail, to test the warning
    if (localStorage.getItem('dpSandboxFailWriting') === '1' && /\/writing\/[^/]+$/.test(ref.path)) throw new Error('Sandbox: simulated cloud save failure');
    await window.__dbSet(ref.path, JSON.parse(JSON.stringify(data)), !!(opts && opts.merge)); }
export async function getDoc(ref) { const d = await window.__dbGet(ref.path); return { id: ref.id, exists: () => d != null, data: () => d }; }
export async function deleteDoc(ref) { await window.__dbDel(ref.path); }
export async function getDocs(c) { let list = (await window.__dbList(c.path)).filter(([id, d]) => matches(d, c.filters)); if (c.order) { const [f, dir] = c.order, m = dir === 'desc' ? -1 : 1; list.sort((a, b) => ((a[1][f] ?? 0) > (b[1][f] ?? 0) ? 1 : (a[1][f] ?? 0) < (b[1][f] ?? 0) ? -1 : 0) * m); } if (c.lim) list = list.slice(0, c.lim); return { docs: list.map(([id, d]) => ({ id, data: () => d, ref: { path: c.path + '/' + id } })), empty: !list.length, size: list.length }; }
export function writeBatch() { const ops = []; return { set: (r, d, o) => ops.push(() => setDoc(r, d, o)), delete: r => ops.push(() => deleteDoc(r)), update: (r, d) => ops.push(() => setDoc(r, d, { merge: true })), commit: async () => { for (const op of ops) await op(); } }; }

export function onSnapshot(q, next, error) {
    let last = null, stopped = false;
    const tick = async () => {
        if (stopped) return;
        try {
            const snap = await getDocs(q);
            const key = JSON.stringify(snap.docs.map(d => [d.id, d.data()]));
            if (key !== last) { last = key; next(snap); }
        } catch (e) { if (error) error(e); }
        if (!stopped) setTimeout(tick, 250);
    };
    tick();
    return () => { stopped = true; };
}
