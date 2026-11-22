// Competition PREVIEW (sandbox only). Keeps the preview journey's state in
// this browser so the pages can be clicked through end to end:
// competition page -> write the story -> submit -> confirmation.
// Nothing here talks to the database; the real build will.
(function (root) {
    const KEY = 'dpCompPreview';
    const BAND = { min: 800, max: 1000, cap: 1050, half: 400 };
    const BUDDIES = {
        finisher: { tier: 'FINISHER', name: 'Tiny Draft', fact: 'Believes every story should be under fifty words. Has never once managed it.', img: 'duckling', frames: 6, how: 'Beat the final boss' },
        entrant:  { tier: 'ENTRANT', name: 'Deadline Hopkins', fact: "Starts every story the night before it's due, and finishes it anyway.", img: 'hare', frames: 4, how: 'Submit a valid entry' },
        shortlisted: { tier: 'SHORTLISTED', name: 'Doe Dénouement', fact: 'Freezes at every blank page, then bolts to the ending.', img: 'deer', frames: 4, how: 'Make the shortlist' },
        champion: { tier: 'CHAMPION', name: 'Reynard Redraft', fact: 'Has never once kept a first draft, out of principle.', img: 'fox', frames: 4, how: 'Win. Only one will ever exist' }
    };
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
    function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
    function words(text) { const t = String(text || '').trim(); return t ? t.split(/\s+/).length : 0; }
    function earned(s) {
        return {
            finisher: (s.defeated || []).includes(BAND.min),
            entrant: !!s.submittedAt,
            shortlisted: false,
            champion: false
        };
    }
    // Dates for the preview: opened yesterday at 09:00, closes in two weeks
    function dates() {
        const open = new Date(); open.setDate(open.getDate() - 1); open.setHours(9, 0, 0, 0);
        const close = new Date(open); close.setDate(close.getDate() + 14); close.setHours(23, 59, 0, 0);
        return { open, close };
    }
    function closesIn() {
        const ms = dates().close - Date.now();
        return `${Math.floor(ms / 864e5)} days ${Math.floor(ms % 864e5 / 36e5)} hours`;
    }

    // The two-boss map. container gets the markup once; update(words) moves things.
    function map(container) {
        container.classList.add('cp-map');
        container.innerHTML = `
            <div class="cp-track"></div><div class="cp-fill"></div>
            <div class="cp-node" style="left:0%;"><div class="cp-pip"></div><span class="cp-node-label">START</span></div>
            <div class="cp-node" data-at="${BAND.half}" style="left:50%;"><span class="cp-boss"></span><div class="cp-pip"></div><span class="cp-node-label">${BAND.half} · HALFWAY</span></div>
            <div class="cp-node" data-at="${BAND.min}" style="left:100%;"><span class="cp-boss"></span><div class="cp-pip"></div><span class="cp-node-label">${BAND.min} · FINAL BOSS</span></div>
            <div class="cp-you"></div>`;
        const bosses = [...container.querySelectorAll('.cp-boss')];
        const ctl = bosses.map((el, i) => root.DPBossSprite ? root.DPBossSprite.attach(el, 16 + i) : null);
        const s = load();
        // Bosses already beaten stay down
        [BAND.half, BAND.min].forEach((at, i) => {
            if ((s.defeated || []).includes(at)) { bosses[i].parentNode.classList.add('down'); }
        });
        let last = null;
        return {
            update(w, animate) {
                const pct = Math.min(100, w / BAND.min * 100);
                container.querySelector('.cp-fill').style.width = pct + '%';
                container.querySelector('.cp-you').style.left = pct + '%';
                const st = load(); st.defeated = st.defeated || [];
                [BAND.half, BAND.min].forEach((at, i) => {
                    if (w >= at && !st.defeated.includes(at)) {
                        st.defeated.push(at); save(st);
                        if (animate && ctl[i]) {
                            ctl[i].die(() => bosses[i].parentNode.classList.add('down'));
                            if (root.DPFx) root.DPFx.comic(at === BAND.min ? 'VICTORY!' : 'DEFEATED!', { tone: at === BAND.min ? 'green' : 'red' });
                        } else bosses[i].parentNode.classList.add('down');
                        if (at === BAND.min && animate && root.onFinisher) root.onFinisher();
                    } else if (animate && last !== null && w > last && w < at && ctl[i] && i === (w < BAND.half ? 0 : 1) && w % 25 === 0) {
                        ctl[i].hurt();
                    }
                });
                last = w;
            }
        };
    }

    function buddyCard(key, has) {
        const b = BUDDIES[key];
        if (!has) return `<div class="cp-buddy${key === 'champion' ? ' champion' : ''}"><div class="cp-mystery" aria-hidden="true">?</div><p class="cp-tier">${b.tier}</p><p class="cp-how">${b.how}</p></div>`;
        return `<div class="cp-buddy${key === 'champion' ? ' champion' : ''}"><div class="cp-sprite${b.frames === 6 ? ' f6' : ''}" style="background-image:url(competition-buddies/${b.img}.png)"></div><p class="cp-tier">${b.tier}</p><p class="cp-bname">${b.name}</p><p class="cp-how">${b.fact}</p></div>`;
    }

    root.DPComp = { KEY, BAND, BUDDIES, load, save, words, earned, dates, closesIn, map, buddyCard,
        reset() { localStorage.removeItem(KEY); } };
})(window);
