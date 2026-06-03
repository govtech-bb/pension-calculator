/* Lightweight in-browser commenting layer.
   Lets a reviewer select text or click a component, attach a named
   comment, and have it persist in the browser via localStorage. */
(function () {
  'use strict';

  var STORE_KEY = 'pension-comments::' + location.pathname;
  var NAME_KEY = 'pension-comments::name';

  var state = {
    mode: false,        // comment-placing mode active
    comments: load(),   // array of comment objects
    hoverEl: null,
    popover: null,
    targetHighlight: null
  };

  // ---- persistence ----------------------------------------------------

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.comments));
    updateCount();
    renderPins();
    if (panel && panel.classList.contains('is-open')) renderPanel();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---- element addressing --------------------------------------------

  function getSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      var tag = el.tagName.toLowerCase();
      var parent = el.parentNode;
      if (parent) {
        var sameTag = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === el.tagName;
        });
        if (sameTag.length > 1) {
          tag += ':nth-of-type(' + (sameTag.indexOf(el) + 1) + ')';
        }
      }
      parts.unshift(tag);
      el = parent;
    }
    return parts.join(' > ');
  }

  function resolveTarget(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function elementFromSelection(sel) {
    var node = sel.getRangeAt(0).commonAncestorContainer;
    return node.nodeType === 1 ? node : node.parentElement;
  }

  // ---- toolbar --------------------------------------------------------

  var toolbar = document.createElement('div');
  toolbar.className = 'cmt-toolbar';

  var addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'cmt-btn';
  addBtn.setAttribute('aria-pressed', 'false');
  addBtn.textContent = 'Add comment';

  var panelBtn = document.createElement('button');
  panelBtn.type = 'button';
  panelBtn.className = 'cmt-btn';
  panelBtn.innerHTML = 'Comments <span class="cmt-btn__count">0</span>';

  toolbar.appendChild(addBtn);
  toolbar.appendChild(panelBtn);
  document.body.appendChild(toolbar);

  var countEl = panelBtn.querySelector('.cmt-btn__count');

  function updateCount() {
    countEl.textContent = state.comments.length;
  }

  addBtn.addEventListener('click', function () {
    setMode(!state.mode);
  });

  // ---- pins overlay ---------------------------------------------------

  var pins = document.createElement('div');
  pins.className = 'cmt-pins';
  document.body.appendChild(pins);

  function groupedBySelector() {
    var groups = {};
    state.comments.forEach(function (c) {
      (groups[c.selector] = groups[c.selector] || []).push(c);
    });
    return groups;
  }

  function renderPins() {
    pins.innerHTML = '';
    var groups = groupedBySelector();
    Object.keys(groups).forEach(function (selector) {
      var el = resolveTarget(selector);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'cmt-pin';
      pin.textContent = groups[selector].length;
      pin.style.left = (rect.right + window.scrollX) + 'px';
      pin.style.top = (rect.top + window.scrollY) + 'px';
      pin.addEventListener('click', function (e) {
        e.stopPropagation();
        openThread(selector, pin);
      });
      pins.appendChild(pin);
    });
  }

  var rafPending = false;
  function scheduleReposition() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      renderPins();
    });
  }
  window.addEventListener('scroll', scheduleReposition, true);
  window.addEventListener('resize', scheduleReposition);

  // ---- comment-placing mode ------------------------------------------

  function setMode(on) {
    state.mode = on;
    addBtn.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('cmt-mode', on);
    clearHover();
    if (on) {
      showHint('Select text or click any element to comment. Press Esc to cancel.');
      document.addEventListener('mousemove', onHoverMove, true);
      document.addEventListener('click', onPlaceClick, true);
    } else {
      hideHint();
      document.removeEventListener('mousemove', onHoverMove, true);
      document.removeEventListener('click', onPlaceClick, true);
    }
  }

  function isOwnUi(el) {
    return el.closest('.cmt-toolbar, .cmt-popover, .cmt-pins, .cmt-panel, .cmt-hint');
  }

  function onHoverMove(e) {
    var el = e.target;
    if (!el || isOwnUi(el)) { clearHover(); return; }
    if (el === state.hoverEl) return;
    clearHover();
    state.hoverEl = el;
    el.classList.add('cmt-hover-outline');
  }

  function clearHover() {
    if (state.hoverEl) {
      state.hoverEl.classList.remove('cmt-hover-outline');
      state.hoverEl = null;
    }
  }

  function onPlaceClick(e) {
    if (isOwnUi(e.target)) return;
    e.preventDefault();
    e.stopPropagation();

    var sel = window.getSelection();
    var quote = '';
    var targetEl;

    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      quote = sel.toString().trim();
      targetEl = elementFromSelection(sel);
    } else {
      targetEl = e.target;
    }
    if (isOwnUi(targetEl)) return;

    var selector = getSelector(targetEl);
    clearHover();
    setMode(false);
    openComposer(selector, quote, e.pageX, e.pageY);
  }

  // global Esc cancels mode / closes popover
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (state.popover) closePopover();
    else if (state.mode) setMode(false);
  });

  // ---- popover plumbing ----------------------------------------------

  function closePopover() {
    if (state.popover) {
      state.popover.remove();
      state.popover = null;
    }
    if (state.targetHighlight) {
      state.targetHighlight.classList.remove('cmt-target-highlight');
      state.targetHighlight = null;
    }
  }

  function placePopover(pop, x, y) {
    document.body.appendChild(pop);
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(x, window.scrollX + document.documentElement.clientWidth - w - 8);
    var top = y + 12;
    if (top + h > window.scrollY + document.documentElement.clientHeight) {
      top = Math.max(window.scrollY + 8, y - h - 12);
    }
    pop.style.left = Math.max(window.scrollX + 8, left) + 'px';
    pop.style.top = top + 'px';
  }

  function highlightTarget(selector) {
    var el = resolveTarget(selector);
    if (el) {
      el.classList.add('cmt-target-highlight');
      state.targetHighlight = el;
    }
    return el;
  }

  // close popover on outside click
  document.addEventListener('mousedown', function (e) {
    if (state.popover && !state.popover.contains(e.target) && !e.target.closest('.cmt-pin')) {
      closePopover();
    }
  });

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    return d.toLocaleString();
  }

  // ---- composer (new comment) ----------------------------------------

  function openComposer(selector, quote, x, y) {
    closePopover();
    var el = highlightTarget(selector);
    if (el && !x) {
      var r = el.getBoundingClientRect();
      x = r.left + window.scrollX;
      y = r.bottom + window.scrollY;
    }

    var savedName = localStorage.getItem(NAME_KEY) || '';
    var pop = document.createElement('div');
    pop.className = 'cmt-popover';
    pop.innerHTML =
      '<div class="cmt-popover__head"><span>Add a comment</span>' +
      '<button type="button" class="cmt-close" aria-label="Close">&times;</button></div>' +
      '<div class="cmt-popover__body">' +
      (quote ? '<div class="cmt-quote">' + esc(quote) + '</div>' : '') +
      '<div class="cmt-field"><label>Your name</label>' +
      '<input type="text" class="cmt-name" value="' + esc(savedName) + '" placeholder="e.g. Jane"></div>' +
      '<div class="cmt-field"><label>Comment</label>' +
      '<textarea class="cmt-text" placeholder="Write your comment"></textarea></div>' +
      '<div class="cmt-actions">' +
      '<button type="button" class="cmt-action cmt-action--secondary cmt-cancel">Cancel</button>' +
      '<button type="button" class="cmt-action cmt-action--primary cmt-save">Save</button>' +
      '</div></div>';

    state.popover = pop;
    placePopover(pop, x, y);

    var nameInput = pop.querySelector('.cmt-name');
    var textInput = pop.querySelector('.cmt-text');
    (savedName ? textInput : nameInput).focus();

    pop.querySelector('.cmt-close').addEventListener('click', closePopover);
    pop.querySelector('.cmt-cancel').addEventListener('click', closePopover);
    pop.querySelector('.cmt-save').addEventListener('click', function () {
      var name = nameInput.value.trim();
      var text = textInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (!text) { textInput.focus(); return; }
      localStorage.setItem(NAME_KEY, name);
      state.comments.push({
        id: uid(),
        selector: selector,
        quote: quote,
        name: name,
        text: text,
        createdAt: Date.now()
      });
      save();
      closePopover();
    });
  }

  // ---- thread (existing comments on an element) ----------------------

  function openThread(selector, anchorEl) {
    closePopover();
    highlightTarget(selector);
    var rect = anchorEl.getBoundingClientRect();
    var pop = document.createElement('div');
    pop.className = 'cmt-popover';
    pop.innerHTML =
      '<div class="cmt-popover__head"><span>Comments</span>' +
      '<button type="button" class="cmt-close" aria-label="Close">&times;</button></div>' +
      '<div class="cmt-popover__body"></div>';
    state.popover = pop;
    renderThreadBody(pop.querySelector('.cmt-popover__body'), selector);
    placePopover(pop, rect.right + window.scrollX, rect.top + window.scrollY);
    pop.querySelector('.cmt-close').addEventListener('click', closePopover);
  }

  function renderThreadBody(body, selector) {
    var items = state.comments.filter(function (c) { return c.selector === selector; });
    var quote = items[0] && items[0].quote;
    body.innerHTML = (quote ? '<div class="cmt-quote">' + esc(quote) + '</div>' : '');

    items.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'cmt-item';
      item.innerHTML =
        '<div class="cmt-item__meta"><span class="cmt-item__author">' + esc(c.name) + '</span>' +
        '<span class="cmt-item__time">' + esc(formatTime(c.createdAt)) + '</span></div>' +
        '<div class="cmt-item__text">' + esc(c.text) + '</div>' +
        '<div style="margin-top:.35rem"><button type="button" class="cmt-action cmt-action--danger">Delete</button></div>';
      item.querySelector('.cmt-action--danger').addEventListener('click', function () {
        state.comments = state.comments.filter(function (x) { return x.id !== c.id; });
        save();
        var remaining = state.comments.filter(function (x) { return x.selector === selector; });
        if (remaining.length) renderThreadBody(body, selector);
        else closePopover();
      });
      body.appendChild(item);
    });

    // reply / add another comment to same element
    var addAnother = document.createElement('button');
    addAnother.type = 'button';
    addAnother.className = 'cmt-action cmt-action--secondary';
    addAnother.style.marginTop = '.6rem';
    addAnother.textContent = 'Add another comment';
    addAnother.addEventListener('click', function () {
      var el = resolveTarget(selector);
      var x, y;
      if (el) { var r = el.getBoundingClientRect(); x = r.left + window.scrollX; y = r.bottom + window.scrollY; }
      openComposer(selector, quote || '', x, y);
    });
    body.appendChild(addAnother);
  }

  // ---- side panel (all comments) -------------------------------------

  var panel = document.createElement('aside');
  panel.className = 'cmt-panel';
  panel.setAttribute('aria-label', 'All comments on this page');
  panel.innerHTML =
    '<div class="cmt-panel__head"><span>Comments on this page</span>' +
    '<button type="button" class="cmt-close" aria-label="Close panel">&times;</button></div>' +
    '<div class="cmt-panel__body"></div>';
  document.body.appendChild(panel);
  panel.querySelector('.cmt-close').addEventListener('click', function () {
    panel.classList.remove('is-open');
  });

  panelBtn.addEventListener('click', function () {
    panel.classList.toggle('is-open');
    if (panel.classList.contains('is-open')) renderPanel();
  });

  function renderPanel() {
    var body = panel.querySelector('.cmt-panel__body');
    body.innerHTML = '';
    if (!state.comments.length) {
      body.innerHTML = '<p class="cmt-empty">No comments yet. Click “Add comment”, then select text or a component.</p>';
      return;
    }
    var groups = groupedBySelector();
    Object.keys(groups).forEach(function (selector) {
      var items = groups[selector];
      var quote = items[0].quote;
      var group = document.createElement('div');
      group.className = 'cmt-panel__group';
      var preview = quote || (resolveTarget(selector) ? (resolveTarget(selector).textContent || '').trim().slice(0, 60) : selector);
      group.innerHTML =
        '<div class="cmt-quote" style="margin-bottom:.4rem">' + esc(preview) + '</div>' +
        items.map(function (c) {
          return '<div class="cmt-item__meta"><span class="cmt-item__author">' + esc(c.name) +
            '</span><span class="cmt-item__time">' + esc(formatTime(c.createdAt)) + '</span></div>' +
            '<div class="cmt-item__text">' + esc(c.text) + '</div>';
        }).join('<hr style="border:none;border-top:1px solid #eee;margin:.4rem 0">');
      group.addEventListener('click', function () {
        var el = resolveTarget(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightTarget(selector);
          setTimeout(function () {
            if (state.targetHighlight === el) {
              el.classList.remove('cmt-target-highlight');
              state.targetHighlight = null;
            }
          }, 1600);
        }
      });
      body.appendChild(group);
    });
  }

  // ---- hint banner ----------------------------------------------------

  var hint = null;
  function showHint(msg) {
    hideHint();
    hint = document.createElement('div');
    hint.className = 'cmt-hint';
    hint.textContent = msg;
    document.body.appendChild(hint);
  }
  function hideHint() {
    if (hint) { hint.remove(); hint = null; }
  }

  // ---- init -----------------------------------------------------------

  updateCount();
  renderPins();
})();
