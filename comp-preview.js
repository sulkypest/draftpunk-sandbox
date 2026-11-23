// Competition pages. The competition itself (title, theme, word band,
// opening and closing times) comes from the database via sync.js and only
// exists for writers while it is open. The story and entry are still a
// preview: kept in this browser only, until entries are built for real.
(function (root) {
    let KEY = 'dpCompPreview';
    const BAND = { min: 800, max: 1000, cap: 1050, half: 400 };
    let COMP = null;
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
    function dates() { return { open: new Date(COMP.opensAt), close: new Date(COMP.closesAt) }; }
    function closesIn() {
        const ms = Math.max(0, COMP.closesAt - Date.now());
        const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        return d ? `${d} day${d === 1 ? '' : 's'} ${h} hour${h === 1 ? '' : 's'}` : h ? `${h} hour${h === 1 ? '' : 's'} ${m} min` : `${m} min`;
    }
    // Resolves with the open competition (and sets the word band), or null.
    async function ready() {
        for (let i = 0; i < 100 && !(root.dpCompetition && root.getCurrentUser && root.getCurrentUser() !== undefined); i++) await new Promise(r => setTimeout(r, 100));
        COMP = root.dpCompetition ? await root.dpCompetition.live() : null;
        if (!COMP) return null;
        Object.assign(BAND, { min: COMP.minWords, max: COMP.maxWords, cap: COMP.capWords || COMP.maxWords + 50, half: COMP.halfway || Math.round(COMP.minWords / 2) });
        KEY = 'dpCompPreview_' + COMP.id;
        return COMP;
    }
    // Shown in place of a competition page when nothing is open
    function closedPage(main) {
        main.innerHTML = `<div class="cp-none"><p class="cp-kicker">SHORT STORY COMPETITION</p>
            <h1 class="cp-title">No competition is running</h1>
            <p class="cp-note">Competitions appear here, on the dashboard and in the Draft Punk menu while they're open.</p>
            <a class="cp-btn" href="index.html?dashboard" style="text-align:center;text-decoration:none;">BACK TO THE DASHBOARD</a></div>`;
    }

    // The two-boss map. container gets the markup once; update(words) moves things.
    function map(container) {
        container.classList.add('cp-map');
        container.innerHTML = `
            <div class="cp-track"></div><div class="cp-fill"></div>
            <div class="cp-node" style="left:0%;"><div class="cp-pip"></div><span class="cp-node-label">START</span></div>
            <div class="cp-node" data-at="${BAND.half}" style="left:50%;"><span class="cp-boss"></span><div class="cp-pip"></div><span class="cp-node-label">${BAND.half.toLocaleString()} · HALFWAY</span></div>
            <div class="cp-node" data-at="${BAND.min}" style="left:100%;"><span class="cp-boss"></span><div class="cp-pip"></div><span class="cp-node-label">${BAND.min.toLocaleString()} · FINAL BOSS</span></div>
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

    root.DPComp = { BAND, BUDDIES, load, save, words, earned, dates, closesIn, map, buddyCard, ready, closedPage,
        get comp() { return COMP; }, reset() { localStorage.removeItem(KEY); } };
})(window);
