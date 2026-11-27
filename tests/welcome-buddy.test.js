'use strict';
// node --test tests/welcome-buddy.test.js — welcome buddy (welcome.js, tracker.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { merge } = require('../data-merge.js');

const W = 'buddy101.png';
const root = path.join(__dirname, '..');

function loadTracker() {
    const ctx = { window: {}, console, Math, Date, JSON };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'tracker.js'), 'utf8'), ctx);
    return ctx.window.DPTracker;
}

// Runs welcome.js against a fake page and storage; returns the storage after.
function runWelcome(store, syncState) {
    const ls = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }
    };
    let timers = [];
    const body = { appendChild() {} };
    const ctx = {
        window: { _dpSyncState: syncState }, localStorage: ls, console, JSON, Object, Array,
        document: { readyState: 'complete', body, querySelectorAll: () => [], getElementById: () => null,
                    createElement: () => ({ setAttribute() {}, style: {}, querySelector: () => ({ addEventListener() {}, focus() {} }), addEventListener() {} }),
                    addEventListener() {} },
        getComputedStyle: () => ({}),
        setTimeout: fn => { timers.push(fn); }
    };
    ctx.window.localStorage = ls;
    vm.createContext(ctx);
    vm.runInContext('var window = this.window; ' + fs.readFileSync(path.join(root, 'welcome.js'), 'utf8'), ctx);
    for (let i = 0; i < 200 && timers.length; i++) { const t = timers; timers = []; t.forEach(f => f()); }
    return store;
}

const project = extra => ({ active: true, title: 'NOVEL', total: 12345, xp: 15000, wordsThisWeek: 800,
    currentStreak: 4, inventory: ['buddy3.png', 'buddy17.png'], logs: [{ date: 'x', total: 12345 }], ...extra });

test('the welcome buddy is never picked at random', () => {
    const T = loadTracker();
    const inv = [];
    for (let i = 1; i <= 100; i++) if (i !== 50) inv.push(`buddy${i}.png`);
    for (let n = 0; n < 200; n++) assert.strictEqual(T.rollNewBuddy(inv), 'buddy50.png');
    for (let i = 1; i <= 100; i++) inv.push(`buddy${i}.png`);
    assert.strictEqual(T.rollNewBuddy([...new Set(inv)]), null);
});

test('having the welcome buddy does not stop the next 5,000-word buddy', () => {
    const T = loadTracker();
    const p = project({ total: 4900, xp: 4900, inventory: [W] });
    const ev = T.awardWords(p, 200);
    assert.strictEqual(ev.buddies.length, 1);
    assert.notStrictEqual(ev.buddies[0], W);
    assert.ok(p.inventory.includes(W));
});

test('existing writer: only the buddy list changes, everything else is identical', () => {
    const dp = { activeProjectId: 'p1', projects: { p1: project(), p2: project({ title: 'OTHER' }) } };
    const before = JSON.parse(JSON.stringify(dp));
    const store = runWelcome({ draftPunkData: JSON.stringify(dp), dpUserId: 'u1', writingData: '{"chapters":[{"id":"c1","content":"words"}]}' }, 'synced');
    const after = JSON.parse(store.draftPunkData);
    assert.deepStrictEqual(after.projects.p1.inventory, ['buddy3.png', 'buddy17.png', W]);
    after.projects.p1.inventory = before.projects.p1.inventory;
    assert.deepStrictEqual(after, before);
    assert.strictEqual(store.writingData, '{"chapters":[{"id":"c1","content":"words"}]}');
});

test('given once: not added again, nor to another project', () => {
    const dp = { activeProjectId: 'p2', projects: { p1: project({ inventory: [W] }), p2: project() } };
    const raw = JSON.stringify(dp);
    const store = runWelcome({ draftPunkData: raw, dpUserId: 'u1' }, 'synced');
    assert.strictEqual(store.draftPunkData, raw);
});

test('signed in but not yet in step with the cloud: nothing is changed', () => {
    const raw = JSON.stringify({ activeProjectId: 'p1', projects: { p1: project() } });
    for (const s of [undefined, 'pending', 'error', 'none']) {
        const store = runWelcome({ draftPunkData: raw, dpUserId: 'u1' }, s);
        assert.strictEqual(store.draftPunkData, raw, 'state ' + s);
    }
});

test('not signed in: given on this device', () => {
    const store = runWelcome({ draftPunkData: JSON.stringify({ activeProjectId: 'p1', projects: { p1: project({ inventory: [] }) } }) }, 'none');
    assert.deepStrictEqual(JSON.parse(store.draftPunkData).projects.p1.inventory, [W]);
});

test('odd data is left alone', () => {
    for (const raw of ['not json', '{}', JSON.stringify({ activeProjectId: 'p1', projects: { p1: project({ inventory: 'x' }) } })]) {
        const store = runWelcome({ draftPunkData: raw }, 'none');
        assert.strictEqual(store.draftPunkData, raw);
    }
});

test('two devices both add it: sync keeps one copy and the word counts', () => {
    const base  = { activeProjectId: 'p1', projects: { p1: project() } };
    const a     = JSON.parse(JSON.stringify(base)); a.projects.p1.inventory.push(W);
    const b     = JSON.parse(JSON.stringify(base)); b.projects.p1.inventory.push(W);
    const r = merge('draftPunkData', base, a, b, true);
    assert.deepStrictEqual(r.value.projects.p1.inventory, ['buddy3.png', 'buddy17.png', W]);
    assert.strictEqual(r.value.projects.p1.total, 12345);
    assert.strictEqual(r.recoveries.length, 0);
});

test('added on one device while words were written on another: both kept', () => {
    const base = { activeProjectId: 'p1', projects: { p1: project() } };
    const a = JSON.parse(JSON.stringify(base)); a.projects.p1.inventory.push(W);
    const b = JSON.parse(JSON.stringify(base)); b.projects.p1.total += 500; b.projects.p1.xp += 500;
    const r = merge('draftPunkData', base, a, b, true);
    assert.ok(r.value.projects.p1.inventory.includes(W));
    assert.strictEqual(r.value.projects.p1.total, 12845);
});
