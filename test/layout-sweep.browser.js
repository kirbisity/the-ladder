// Layout sweep, run in a browser on the served game (paste into the console
// or evaluate it with an automation tool). For every viewport size, it loads
// the game in a same-origin frame of that size, walks every screen, panel
// and dialog, and reports anything that overflows: a page that scrolls, a
// dialog that needs its own scrollbar, or an element wider than the screen.
// Resolves to a list of failures; an empty list is a pass.

(async function layoutSweep() {
  const SIZES = [[375, 667], [390, 844], [430, 932], [667, 375], [844, 390], [768, 1024], [1024, 600], [1280, 720], [1440, 900], [1920, 1080]];
  const failures = [];
  // No timers and no animation frames: a background automation tab throttles
  // chained timers to once a minute and never paints. Reading a size forces
  // layout synchronously, so every measurement is current without waiting.
  const settle = () => Promise.resolve();

  function check(frame, label) {
    const doc = frame.contentDocument;
    const root = doc.documentElement;
    const [width, height] = [frame.clientWidth, frame.clientHeight];
    if (root.scrollHeight > height + 1 || root.scrollWidth > width + 1) failures.push(`${width}×${height} ${label}: page scrolls (${root.scrollWidth}×${root.scrollHeight})`);
    const card = doc.querySelector('#modal:not([hidden]) .modal-card');
    if (card && card.scrollHeight > card.clientHeight + 1) failures.push(`${width}×${height} ${label}: dialog scrolls (${card.scrollHeight} > ${card.clientHeight})`);
    const screen = [...doc.querySelectorAll('.screen')].find((element) => !element.hidden);
    for (const element of screen ? screen.querySelectorAll('*') : []) {
      if (element.closest('.table-wrap, [hidden]')) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > width + 1 || rect.left < -1) {
        failures.push(`${width}×${height} ${label}: ${element.className || element.tagName} spills sideways`);
        break;
      }
    }
    if (screen && screen.dataset.screen === 'game') {
      const stage = doc.querySelector('#stage').getBoundingClientRect();
      if (stage.height < 140) failures.push(`${width}×${height} ${label}: office squeezed to ${Math.round(stage.height)}px`);
      const lastButton = [...doc.querySelectorAll('.side-buttons > *')].pop().getBoundingClientRect();
      if (lastButton.bottom > stage.bottom + 1) failures.push(`${width}×${height} ${label}: side buttons cut off`);
      const controls = doc.querySelector('#controls').getBoundingClientRect();
      if (controls.bottom > height + 1) failures.push(`${width}×${height} ${label}: controls cut off`);
    }
  }

  for (const [width, height] of SIZES) {
    const frame = document.createElement('iframe');
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;z-index:99999;background:#000`;
    frame.src = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}index.html?sweep=${Date.now()}`;
    document.body.append(frame);
    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const style = doc.createElement('style');
    style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    doc.head.append(style);
    const click = (selector) => doc.querySelector(selector)?.click();

    await settle(frame);
    check(frame, 'title');
    click('[data-action="new-career"]');
    await settle(frame);
    check(frame, 'character pick');
    click('[data-character="jennifer"]');
    await settle(frame);
    check(frame, 'character pick with detail');
    click('[data-action="pick-character"]');
    await settle(frame);
    check(frame, 'industry pick');
    click('[data-industry="tech"]');
    await settle(frame);
    check(frame, 'employer pick (five choices)');
    click('[data-action="back-industry"]');
    click('[data-industry="academia"]');
    await settle(frame);
    check(frame, 'employer pick');
    click('[data-employer="stable"]');
    await settle(frame);
    check(frame, 'intro');
    click('[data-action="intro-skip"]');
    await settle(frame);
    for (const tab of ['bandwidth', 'project', 'hours']) {
      click(`[data-tab="${tab}"]`);
      await settle(frame);
      check(frame, `plan · ${tab} tab`);
    }
    const game = win.theLadder.game;
    // Ten years of history, so the career and money charts have data.
    const { playQuarter, POLICIES } = await import(`${location.origin}${location.pathname.replace(/[^/]*$/, '')}src/sim/bots.js`);
    for (let quarter = 0; quarter < 40 && !game.outcome; quarter += 1) playQuarter(game, POLICIES.adaptive);
    if (game.outcome) failures.push(`${width}×${height}: the sample career ended early`);
    game.player.level = 5;
    game.player.burnout.active = true;
    game.player.pip.active = true;
    win.theLadder.app.lastHudUpdate = 0;
    click('#run-button');
    win.theLadder.advanceDays(10);
    await settle(frame);
    check(frame, 'running, burnout and PIP banners, manager slider');
    game.fmla.daysLeft = 30;
    win.theLadder.advanceDays(1);
    check(frame, 'FMLA leave banner');
    game.fmla.daysLeft = 0;
    game.player.burnout.active = false;
    game.player.pip.active = false;
    for (const [action, label] of [['panel-org', 'org chart'], ['panel-performance', 'performance'], ['panel-career', 'skills'], ['panel-timeoff', 'time off'], ['menu', 'menu']]) {
      click(`[data-action="${action}"]`);
      await settle(frame);
      check(frame, label);
      if (action === 'panel-org') {
        click('[data-org-tab="peers"]');
        await settle(frame);
        check(frame, 'peer tracking');
        click('[data-org-tab="ladder"]');
        await settle(frame);
        check(frame, 'career ladder');
        click('[data-org-tab="chart"]');
      }
      if (action === 'panel-org') { /* tabs checked above */ }
      if (action === 'panel-career') {
        for (const tab of ['career', 'money', 'profile']) {
          click(`[data-career-tab="${tab}"]`);
          await settle(frame);
          check(frame, `skills · ${tab}`);
        }
      }
      click('#modal-card [data-action="close-modal"]');
      await settle(frame);
    }
    for (const [action, label, tabs] of [['panel-vitals', 'vitals', ['health', 'motivation', 'events']], ['panel-money', 'money', []]]) {
      win.theLadder.app.modal = null;
      click(`[data-action="${action}"]`);
      for (const tab of tabs.length ? tabs : [null]) {
        if (tab) click(`[data-vitals-tab="${tab}"]`);
        await settle(frame);
        check(frame, `${label}${tab ? ` · ${tab}` : ''}`);
      }
      click('#modal-card [data-action="close-modal"]');
    }
    win.theLadder.app.modal = null;
    click('[data-action="menu"]');
    click('#modal-card [data-action="settings"]');
    doc.querySelector('details.developer').open = true;
    await settle(frame);
    check(frame, 'settings with developer menu open');
    for (const scene of ['death', 'retiredLuxury', 'promoted']) {
      doc.querySelector(`[data-scene="${scene}"]`).click();
      win.theLadder.cutscenes.seek(3);
      check(frame, `cut scene ${scene}`);
      win.theLadder.cutscenes.skip();
    }
    click('#modal-card [data-action="close-modal"]');
    for (let page = 0; page < 7; page += 1) {
      win.theLadder.app.modal = null;
      click('[data-action="menu"]');
      click('#modal-card [data-action="help"]');
      for (let turn = 0; turn < page; turn += 1) click('#modal-card [data-help]:not([disabled]):last-of-type');
      await settle(frame);
      check(frame, `help page ${page + 1}`);
      click('#modal-card [data-action="close-modal"]');
    }
    win.theLadder.advanceDays(60);
    await settle(frame);
    check(frame, 'quarter review');
    while (win.theLadder.app.modal === 'review' || win.theLadder.app.modal === 'event') {
      if (win.theLadder.app.modal === 'event') {
        check(frame, 'event');
        click('[data-choice]');
      } else {
        click('[data-action="review-continue"]');
      }
      await settle(frame);
    }
    click('[data-action="pick-project"]');
    await settle(frame);
    check(frame, 'project picker');
    click('[data-project]');
    game.history = Array.from({ length: 120 }, (_, index) => ({ health: 80, motivation: 60, level: Math.min(7, index >> 4), netWorth: 1e6 }));
    win.theLadder.app.modal = null;
    game.player.health = 0;
    click('#run-button');
    win.theLadder.advanceDays(1);
    await settle(frame);
    check(frame, 'game over');
    for (let page = 0; page < 7; page += 1) {
      const next = page === 0 ? doc.querySelector('[data-story="0"]') : doc.querySelector(`[data-story="${page}"]`);
      if (!next) break;
      next.click();
      await settle(frame);
      check(frame, `story page ${page + 1}`);
    }
    frame.remove();
  }
  return failures;
}());
