// ── First-visit tips ─────────────────────────────────────────────────────────
// One short tip the first time a writer opens each main page, with GOT IT and
// NO MORE TIPS. Remembered on this device only (dpTipsSeen / dpTipsOff), so it
// never touches the writer's synced data. Waits until no dialog, pop-up, the
// logo tip or the welcome buddy is showing, so only one thing appears at once.
(function () {
    const TIPS = {
        write:      'This is where you write. SYNC AND SAVE backs up your chapters and adds new words to your tracker.',
        dashboard:  'Every word moves you along the stage map. Beat the bosses, and find a buddy every 5,000 words.',
        wordrunner: 'Pick a timed sprint. Hit the word target before time runs out to rescue a buddy.',
        groups:     'Add friends by username to compare weekly word counts and share chapters for feedback.',
        notes:      'Ideas, research and anything else that isn’t a chapter.',
        beats:      'Plan your story against 15 beats. Fill in what happens at each one.',
        characters: 'Keep a sheet for each character, and export them all when you need them.'
    };
    const PAGES = {
        'write.html': 'write', 'wordrunner.html': 'wordrunner', 'groups.html': 'groups',
        'notes.html': 'notes', 'beat-notes.html': 'beats', 'characters.html': 'characters',
        'index.html': 'dashboard', '': 'dashboard'
    };

    function seen() { try { return JSON.parse(localStorage.getItem('dpTipsSeen') || '{}') || {}; } catch (e) { return {}; } }
    function off()  { try { return localStorage.getItem('dpTipsOff') === '1'; } catch (e) { return false; } }
    function mark(key) {
        try { const s = seen(); s[key] = 1; localStorage.setItem('dpTipsSeen', JSON.stringify(s)); } catch (e) {}
    }

    function pageKey() {
        const key = PAGES[location.pathname.split('/').pop()];
        if (key !== 'dashboard') return key;
        // index.html is also sign-in and project setup: only tip the dashboard itself
        const d = document.getElementById('mainDashboard');
        return d && !d.classList.contains('hidden') ? 'dashboard' : null;
    }

    function hasProject() {
        try {
            const dp = JSON.parse(localStorage.getItem('draftPunkData') || '{}');
            const p = dp.projects && dp.projects[dp.activeProjectId];
            return !!(p && p.active !== false);
        } catch (e) { return false; }
    }

    function busy() {
        if (document.getElementById('navStatsHint') || document.getElementById('dpTip')) return true;
        // On phones the logo tip comes first; wait until it has been dismissed
        let logoSeen = true; try { logoSeen = localStorage.getItem('dpStatsHintSeen') === '1'; } catch (e) {}
        if (!logoSeen && window.matchMedia('(max-width: 899px)').matches && document.querySelector('.app-nav')) return true;
        if (window.DPWelcome && window.DPWelcome.busy()) return true;
        return [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .overlay, #mobSideOverlay.open, #splashScreen')]
            .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    }

    function show(key) {
        const t = document.createElement('div');
        t.id = 'dpTip';
        t.className = 'dp-tip';
        t.setAttribute('role', 'status');
        t.innerHTML =
            '<p class="dp-tip-text"></p>' +
            '<div class="dp-tip-actions">' +
            '<button type="button" class="dp-tip-off">NO MORE TIPS</button>' +
            '<button type="button" class="dp-tip-ok">GOT IT</button>' +
            '</div>';
        t.querySelector('.dp-tip-text').textContent = TIPS[key];
        t.querySelector('.dp-tip-ok').addEventListener('click', () => { mark(key); t.remove(); });
        t.querySelector('.dp-tip-off').addEventListener('click', () => {
            mark(key);
            try { localStorage.setItem('dpTipsOff', '1'); } catch (e) {}
            t.remove();
        });
        document.body.appendChild(t);
    }

    let waiting = false;
    function maybeShow() {
        if (waiting || off() || !hasProject()) return;
        waiting = true;
        let tries = 0;
        setTimeout(function wait() {
            const key = pageKey();
            if (off() || document.getElementById('dpTip')) { waiting = false; return; }
            if (!key) { if (++tries < 120) setTimeout(wait, 1000); else waiting = false; return; }
            if (seen()[key]) { waiting = false; return; }
            if (busy()) { if (++tries < 120) setTimeout(wait, 1000); else waiting = false; return; }
            waiting = false;
            show(key);
        }, 3000);
    }

    window.DPTips = { maybeShow: maybeShow };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeShow);
    else maybeShow();
})();
