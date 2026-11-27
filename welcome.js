// ── Welcome buddy ────────────────────────────────────────────────────────────
// Every writer is given one buddy (buddy101) once, new and existing alike.
// Runs on the Write page only, which never keeps project data in memory, so
// this read-change-write can't be undone by a later save from the page.
//
// Safety:
//   • waits until this device is fully in step with the cloud (or, for
//     writers who aren't signed in, until the page has settled), so it never
//     works from an out-of-date copy
//   • the only change is adding one file name to the open project's buddy
//     list; word counts, XP, streaks and writing are not touched
//   • skips if any project already has it, so it's given once per account;
//     sync combines buddy lists, so two devices adding it end up with one
//   • if anything looks unexpected it does nothing, and tries again next visit
(function () {
    const FILE = 'buddy101.png';
    let tries = 0, done = false;

    function ready() {
        const s = window._dpSyncState;
        if (s === 'synced') return true;
        // Not signed in: nothing to wait for once the page has had a moment
        return !localStorage.getItem('dpUserId') && tries >= 3;
    }

    function grant() {
        let dp;
        try { dp = JSON.parse(localStorage.getItem('draftPunkData') || 'null'); } catch (e) { return null; }
        if (!dp || !dp.projects || !dp.activeProjectId) return null;
        const projects = Object.values(dp.projects);
        if (projects.some(p => p && Array.isArray(p.inventory) && p.inventory.includes(FILE))) return null;
        const proj = dp.projects[dp.activeProjectId];
        if (!proj || proj.active === false) return null;
        if (proj.inventory === undefined) proj.inventory = [];
        if (!Array.isArray(proj.inventory)) return null;          // unexpected shape: leave alone
        const returning = (proj.total || 0) > 0 || proj.inventory.length > 0 || projects.length > 1;
        proj.inventory.push(FILE);
        localStorage.setItem('draftPunkData', JSON.stringify(dp));
        return { returning };
    }

    function modalOpen() {
        return [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .overlay, #mobSideOverlay.open')]
            .some(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    }

    function show(info, waited) {
        waited = waited || 0;
        if (modalOpen() && waited < 120) { setTimeout(() => show(info, waited + 1), 1000); return; }
        const b = (typeof BUDDY_DATA !== 'undefined' && BUDDY_DATA[100]) || { name: 'New buddy', fact: '' };
        const o = document.createElement('div');
        o.className = 'overlay';
        o.id = 'welcomeBuddyOverlay';
        o.setAttribute('role', 'dialog');
        o.setAttribute('aria-modal', 'true');
        o.setAttribute('aria-labelledby', 'welcomeBuddyHead');
        o.style.display = 'flex';
        o.innerHTML =
            '<div class="congrats-circle poster poster-green" style="max-width:340px;">' +
            '<h2 id="welcomeBuddyHead" class="poster-head">' + (info.returning ? 'A GIFT FOR YOU' : 'WELCOME!') + '</h2>' +
            '<img src="buddies/' + FILE + '" alt="" style="width:120px;height:120px;display:block;margin:8px auto;image-rendering:pixelated;filter:drop-shadow(0 0 15px var(--neon));">' +
            '<div class="wb-name" style="font-weight:bold;letter-spacing:1px;margin-top:4px;"></div>' +
            '<div style="font-size:0.85rem;margin-top:8px;line-height:1.4;">' +
            (info.returning ? 'Every writer gets this buddy. It’s in your binder now.'
                            : 'Your first buddy. Find another every 5,000 words.') + '</div>' +
            '<button type="button" class="btn-primary" style="margin-top:14px;min-height:44px;width:100%;">CONTINUE</button>' +
            '</div>';
        o.querySelector('.wb-name').textContent = b.name.toUpperCase();
        const close = () => { o.remove(); if (window.DPTips) window.DPTips.maybeShow(); };
        o.querySelector('button').addEventListener('click', close);
        o.addEventListener('click', e => { if (e.target === o) close(); });
        document.body.appendChild(o);
        o.querySelector('button').focus();
    }

    function check() {
        if (done) return;
        tries++;
        if (!ready()) { if (tries < 60) setTimeout(check, 1000); return; }
        done = true;
        let info = null;
        try { info = grant(); } catch (e) { console.warn('Welcome buddy skipped:', e); }
        if (info) show(info);
    }

    window.DPWelcome = { busy: () => !!document.getElementById('welcomeBuddyOverlay') || (!done && tries < 60) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(check, 1000));
    else setTimeout(check, 1000);
})();
