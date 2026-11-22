// ── Draft Punk visual effects ────────────────────────────────────────────────
// Comic-book pop-ups ("DEFEATED!", "POW!") and number count-ups, shared by the
// dashboard and the Write page. Display only: nothing here reads or writes
// any saved data.
(function (root) {
    'use strict';

    function reduced() {
        try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    // Jagged starburst behind the lettering, in the same spirit as the "VS"
    // badge on the stage-map boss art. Points alternate long/short with a
    // little irregularity so it looks hand-cut rather than geometric.
    function burstPath(points) {
        const out = [];
        for (let i = 0; i < points * 2; i++) {
            const a = (Math.PI * i) / points - Math.PI / 2;
            const r = i % 2 === 0 ? 48 - (i % 4 === 0 ? 0 : 4) : 31 + (i % 3) * 2;
            out.push((50 + Math.cos(a) * r).toFixed(1) + ',' + (50 + Math.sin(a) * r * 0.78).toFixed(1));
        }
        return out.join(' ');
    }
    const BURST_BIG   = burstPath(14);
    const BURST_SMALL = burstPath(10);

    // One pop-up at a time per layer, so a burst of events reads as a sequence
    let bigQueue = [], bigBusy = false;

    // text:  the word(s) to show
    // opts.tone: 'red' (bosses), 'green' (minions), 'ink' (level ups etc.)
    // opts.at:   an element to pop over (small pop-up); omit for a big
    //            pop-up in the middle of the screen
    function comic(text, opts) {
        opts = opts || {};
        if (opts.at) return place(text, opts);
        bigQueue.push([text, opts]);
        if (bigBusy) return;
        bigBusy = true;
        (function next() {
            const item = bigQueue.shift();
            if (!item) { bigBusy = false; return; }
            place(item[0], item[1]);
            setTimeout(next, reduced() ? 900 : 1100);
        })();
    }

    function place(text, opts) {
        const tone  = opts.tone || 'red';
        const small = !!opts.at;
        const el = document.createElement('div');
        el.className = 'dp-comic dp-comic-' + tone + (small ? ' dp-comic-small' : '') + (reduced() ? ' dp-comic-still' : '');
        el.setAttribute('aria-hidden', 'true');
        // A slight random tilt so repeated pop-ups don't look stamped out
        const tilt = (small ? -10 : -7) + Math.round(Math.random() * 6);
        el.style.setProperty('--tilt', tilt + 'deg');
        el.innerHTML =
            '<svg class="dp-comic-burst" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="' +
            (small ? BURST_SMALL : BURST_BIG) + '"/></svg>' +
            '<span class="dp-comic-text"></span>';
        el.querySelector('.dp-comic-text').textContent = text;

        if (small) {
            const r = opts.at.getBoundingClientRect();
            el.style.left = (r.left + r.width / 2) + 'px';
            el.style.top  = (r.top - 6) + 'px';
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), small ? 1100 : 1500);
    }

    // Counts an element's number up from `from` to `to`
    function countUp(el, from, to, ms, format) {
        if (!el) return;
        const fmt = format || (n => n.toLocaleString());
        if (reduced() || from === to) { el.textContent = fmt(to); return; }
        const t0 = performance.now();
        (function step(now) {
            const k = Math.min(1, (now - t0) / ms);
            const e = 1 - Math.pow(1 - k, 3);   // ease out
            el.textContent = fmt(Math.round(from + (to - from) * e));
            if (k < 1) requestAnimationFrame(step);
        })(t0);
    }

    // Word lists for the pop-ups, kept together so they're easy to change
    const WORDS = {
        boss:    'DEFEATED!',
        victory: 'VICTORY!',
        levelUp: 'LEVEL UP!',
        buddy:   'NEW BUDDY!',
        minion:  ['POW!', 'WHAM!', 'KAPOW!', 'SPLAT!', 'BOOM!']
    };
    function minionWord(i) { return WORDS.minion[Math.abs(i | 0) % WORDS.minion.length]; }

    root.DPFx = { comic: comic, countUp: countUp, reduced: reduced, WORDS: WORDS, minionWord: minionWord };
})(window);
