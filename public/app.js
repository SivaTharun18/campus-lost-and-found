const app = document.querySelector('#app');
const tokenKey = 'foundry_token';
const userKey = 'foundry_user';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const user = () => { try { return JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { return null; } };
const token = () => localStorage.getItem(tokenKey);
const loggedIn = () => Boolean(token());

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({ message: `Request failed (${response.status})` }));
  if (!response.ok) { const error = new Error(data.message || `Request failed (${response.status})`); error.status = response.status; throw error; }
  return data;
}
function toast(message, type = '') { const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; document.querySelector('#toast-region').append(el); setTimeout(() => el.remove(), 4200); }
function busy(button, active, label = 'Please wait…') { if (!button.dataset.label) button.dataset.label = button.innerHTML; button.disabled = active; button.innerHTML = active ? `<span class="spinner"></span>${label}` : button.dataset.label; }
function dateLabel(value) { if (!value) return 'Date not provided'; const date = new Date(value); return Number.isNaN(+date) ? esc(value) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }
function updateNav() { document.querySelectorAll('.auth-link').forEach(el => el.classList.toggle('hidden', !loggedIn())); document.querySelectorAll('.guest-link').forEach(el => el.classList.toggle('hidden', loggedIn())); document.querySelector('.admin-link')?.classList.toggle('hidden', user()?.role !== 'admin'); }
function renderPage(html) { app.innerHTML = html; app.focus({ preventScroll: true }); updateNav(); document.querySelector('#main-nav').classList.remove('open'); }
function shell(title, subtitle, body) { return `<div class="page-wrap"><div class="page-heading"><div class="section-kicker">Foundry community</div><h1>${title}</h1><p>${subtitle}</p></div>${body}</div>`; }
function empty(title, copy) { return `<div class="empty-state"><strong>${title}</strong>${copy}</div>`; }
function itemCard(item) {
  const image = item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy" onerror="this.remove()">` : '<div class="item-image-placeholder" aria-hidden="true">✳</div>';
  return `<a class="item-card" href="#/item/${encodeURIComponent(item.item_id)}"><div class="item-image">${image}<span class="item-type ${esc(item.item_type)}">${esc(item.item_type)} item</span></div><div class="item-info"><h3>${esc(item.title)}</h3><div class="item-meta"><span>⌖ ${esc(item.location || 'Location not listed')}</span><span>◷ ${dateLabel(item.item_date || item.created_at)}</span></div><div class="item-byline"><span>${esc(item.category || 'Uncategorized')}</span><span>by ${esc(item.reported_by || 'Campus member')}</span></div></div></a>`;
}
function searchBar(params, includeLocation = false) {
  return `<form class="filter-bar" id="search-form"><label class="search-box"><span>⌕</span><input name="keyword" placeholder="${includeLocation ? 'Search an item or place' : 'Try “blue water bottle” or “student center”'}" value="${esc(params.get('keyword') || '')}"></label>${includeLocation ? `<input class="field" name="location" placeholder="Location" value="${esc(params.get('location') || '')}">` : ''}<select name="item_type" aria-label="Item type"><option value="">${includeLocation ? 'Lost & found' : 'All reports'}</option><option value="lost" ${params.get('item_type') === 'lost' ? 'selected' : ''}>Lost</option><option value="found" ${params.get('item_type') === 'found' ? 'selected' : ''}>Found</option></select><select name="category" aria-label="Category"><option value="">Any category</option>${['Electronics','Bags','Clothing','Keys','Books','Other'].map(x => `<option ${params.get('category') === x ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="button button-dark" type="submit">Search <span>↗</span></button></form>`;
}
function connectSearch() { document.querySelector('#search-form')?.addEventListener('submit', event => { event.preventDefault(); const query = new URLSearchParams(); for (const [key, value] of new FormData(event.currentTarget)) if (value) query.set(key, value); location.hash = `#/browse${query.size ? `?${query}` : ''}`; }); }
async function renderHome() {
  const params = new URLSearchParams();
  renderPage(`<section class="hero"><div class="hero-content"><div class="eyebrow"><span class="eyebrow-mark"></span> YOUR CAMPUS, LOOKING OUT FOR YOU</div><h1>Lost something?<br><em>Found your people.</em></h1><p class="hero-copy">The familiar feeling of finding what you thought was gone. A community that helps the little things find their way back.</p><div class="hero-actions"><a class="button button-dark" href="#/report/lost">Report something lost <span>↗</span></a><a class="button button-outline" href="#/report/found">I found something</a></div><div class="hero-note"><span class="avatar-stack"><span>A</span><span>M</span><span>J</span><span>+</span></span><span>Small acts. Big relief. That's campus.</span></div></div><div class="hero-art" aria-hidden="true"><div class="art-blob"></div><div class="art-sun"></div><div class="art-card"><div class="card-photo"><span class="photo-tag">FOUND</span></div><div class="photo-lines"><b></b><span></span></div></div><div class="art-float float-found"><span class="float-icon">⌕</span><span><b>Found near the library</b>Posted just now</span></div><div class="art-float float-back"><span class="float-icon">↗</span><span><b>Back where it belongs</b>That's the good part</span></div><span class="hero-index">01 / COMMUNITY</span></div></section><section class="section"><div class="section-head"><div><div class="section-kicker">Around campus</div><h2>Recently reported</h2><p>A few things waiting to find their way home.</p></div><a class="text-link" href="#/browse">Browse all items <span>↗</span></a></div>${searchBar(params)}<div id="home-results" class="item-grid"><div class="empty-state">Loading recently reported items…</div></div></section><section class="trust-strip"><div class="trust-copy"><h2>Every return starts with a small step.</h2><p>Share a clear description, and let our campus community help connect the dots.</p></div><div class="trust-stats"><div class="trust-stat"><strong>01</strong><span>Tell us what happened</span></div><div class="trust-stat"><strong>02</strong><span>Let the community help</span></div><div class="trust-stat"><strong>03</strong><span>Make the reunion</span></div></div></section>`);
  connectSearch();
  const target = document.querySelector('#home-results');
  try { const data = await api('/api/items'); const items = (data.items || []).slice(0, 8); target.innerHTML = items.length ? items.map(itemCard).join('') : empty('No items to show yet', 'When someone reports an item, it will appear here.'); }
  catch (error) { target.className = ''; target.innerHTML = `<div class="notice">Couldn't load reports: ${esc(error.message)} <button class="text-link" id="retry">Try again ↻</button></div>`; document.querySelector('#retry')?.addEventListener('click', renderHome); }
}
async function renderBrowse(params) {
  renderPage(shell('Find what you’re looking for.', 'Search recent lost and found reports from around campus.', `${searchBar(params, true)}<p id="browse-count" class="form-hint"></p><div class="item-grid" id="browse-results"><div class="empty-state">Searching reports…</div></div>`));
  connectSearch();
  try { const data = await api(`/api/items/search${params.size ? `?${params}` : ''}`); const items = data.items || []; document.querySelector('#browse-count').textContent = `${data.total ?? items.length} report${(data.total ?? items.length) === 1 ? '' : 's'} found`; document.querySelector('#browse-results').innerHTML = items.length ? items.map(itemCard).join('') : empty('No matches yet', 'Try a broader keyword or remove a filter.'); }
  catch (error) { document.querySelector('#browse-results').innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
async function renderAuth(register) {
  renderPage(`<section class="auth-wrap"><div class="auth-side"><div class="eyebrow"><span class="eyebrow-mark"></span> THE CAMPUS COMMUNITY</div><h1>${register ? 'A little help goes a long way.' : 'Let’s get you back to it.'}</h1><p>${register ? 'Create an account to report items, follow your claims, and help classmates reconnect with what matters.' : 'Sign in to follow your reports, make a claim, or help someone find their way back to a lost item.'}</p><div class="auth-side-art"></div></div><form id="auth-form" class="auth-form" novalidate><h2>${register ? 'Join Foundry' : 'Welcome back'}</h2><p>${register ? 'One account. A more connected campus.' : 'Pick up right where you left off.'}</p><div class="form-stack">${register ? '<div class="form-field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" required maxlength="100" placeholder="Your name"></div>' : ''}<div class="form-field"><label for="email">University email</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="255" placeholder="you@university.edu"></div><div class="form-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="6" required placeholder="${register ? 'At least 6 characters' : 'Your password'}"></div><div class="form-error" id="form-error" role="alert"></div><div class="form-actions"><button class="button button-dark" type="submit">${register ? 'Create my account' : 'Log in'} <span>↗</span></button></div></div><p class="switch-auth">${register ? 'Already part of Foundry? <a href="#/login">Log in</a>' : 'New to the community? <a href="#/register">Create an account</a>'}</p></form></section>`);
  document.querySelector('#auth-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return; const button = form.querySelector('button'), errorBox = document.querySelector('#form-error'); errorBox.textContent = ''; errorBox.classList.remove('show'); busy(button, true, register ? 'Creating account…' : 'Signing in…');
    try { const data = await api(`/api/users/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); if (register) { toast(data.message || 'Registration successful. Please log in.', 'success'); location.hash = '#/login'; } else { localStorage.setItem(tokenKey, data.token); localStorage.setItem(userKey, JSON.stringify(data.user)); toast(`Welcome${data.user?.name ? `, ${data.user.name}` : ''}!`, 'success'); location.hash = '#/dashboard'; } }
    catch (error) { errorBox.textContent = error.message; errorBox.classList.add('show'); } finally { busy(button, false); }
  });
}
function renderReport(type) {
  if (!loggedIn()) { toast('Please log in to report an item.'); location.hash = '#/login'; return; }
  const found = type === 'found';
  renderPage(shell(found ? 'Report something you found.' : 'Report something you lost.', 'A few clear details can help the right person spot it.', `<div class="report-layout"><form class="panel form-stack" id="report-form" novalidate><div><h2>Item details</h2><p class="panel-sub">Fields marked required help people identify the right report.</p></div><div class="form-field"><label for="title">What is it? *</label><input id="title" name="title" required maxlength="150" placeholder="e.g. Navy blue water bottle"></div><div class="form-field"><label for="description">Description</label><textarea id="description" name="description" maxlength="3000" placeholder="Color, brand, distinctive marks, or anything else that might help…"></textarea></div><div class="form-row"><div class="form-field"><label for="category">Category</label><select id="category" name="category"><option value="">Choose a category</option>${['Electronics','Bags','Clothing','Keys','Books','Accessories','Other'].map(x => `<option>${x}</option>`).join('')}</select></div><div class="form-field"><label for="item_date">${found ? 'When did you find it?' : 'When did you lose it?'}</label><input id="item_date" name="item_date" type="date"></div></div><div class="form-field"><label for="location">${found ? 'Where did you find it?' : 'Where did you last see it?'} *</label><input id="location" name="location" required maxlength="250" placeholder="Building, room, or nearby landmark"></div><div class="form-field"><label for="image">Photo (optional)</label><div class="upload-preview" id="upload-preview"><div class="upload-prompt"><div class="upload-icon">↥</div><strong>Add a photo to your report</strong>JPG or PNG · up to 5 MB</div></div><input id="image" name="image" type="file" accept="image/jpeg,image/png,image/jpg" class="field" style="margin-top:8px"><div class="form-hint">Please avoid including private details in photos.</div></div><div class="form-error" id="form-error" role="alert"></div><button class="button button-dark" type="submit">Publish ${found ? 'found' : 'lost'} report <span>↗</span></button></form><aside><div class="side-note"><h3>A helpful report is a clear one.</h3><p>Share a few specific details that could help the owner recognize their item.</p><ul><li>Use a clear, recognizable title.</li><li>Give the closest useful location.</li><li>Keep identifying details private when appropriate.</li></ul></div><div class="side-note"><h3>What happens next?</h3><p>Your report appears in campus search. If someone recognizes their item, they can send you a claim to review.</p></div></aside></div>`));
  const form = document.querySelector('#report-form'), file = form.elements.image, preview = document.querySelector('#upload-preview');
  file.addEventListener('change', () => { const chosen = file.files[0]; if (!chosen) return; if (!/^image\/(jpeg|png)$/.test(chosen.type) || chosen.size > 5 * 1024 * 1024) { file.value = ''; toast('Choose a JPG or PNG image under 5 MB.', 'error'); return; } preview.innerHTML = `<img src="${URL.createObjectURL(chosen)}" alt="Selected image preview">`; });
  form.addEventListener('submit', async event => { event.preventDefault(); if (!form.reportValidity()) return; const button = form.querySelector('button'), errorBox = document.querySelector('#form-error'), body = new FormData(form); body.set('item_type', type); errorBox.textContent = ''; errorBox.classList.remove('show'); try { busy(button, true, 'Publishing report…'); const data = await api('/api/items', { method: 'POST', body }); toast(data.message || 'Report published.', 'success'); location.hash = `#/item/${encodeURIComponent(data.item.item_id)}`; } catch (error) { errorBox.textContent = error.message; errorBox.classList.add('show'); } finally { busy(button, false); } });
}
async function renderItem(id) {
  renderPage('<div class="page-wrap"><div class="page-loading">Loading item…</div></div>');
  try { const data = await api(`/api/items/${encodeURIComponent(id)}`), item = data.item, image = item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" onerror="this.remove()">` : '<div class="item-image-placeholder">✳</div>';
    renderPage(`<div class="page-wrap"><a class="text-link" href="#/browse">← Back to reports</a><div class="detail-layout" style="margin-top:20px"><div class="detail-photo">${image}</div><div class="detail-copy"><span class="item-type ${esc(item.item_type)}">${esc(item.item_type)} item</span><h1>${esc(item.title)}</h1><div class="item-meta"><span>⌖ ${esc(item.location || 'Location not listed')}</span><span>◷ ${dateLabel(item.item_date || item.created_at)}</span></div><p class="detail-desc">${esc(item.description || 'No additional description was provided.')}</p><div class="detail-meta"><div><small>Category</small><strong>${esc(item.category || 'Not specified')}</strong></div><div><small>Reported by</small><strong>${esc(item.reported_by || 'Campus member')}</strong></div><div><small>Reported</small><strong>${dateLabel(item.created_at)}</strong></div><div><small>Status</small><strong>${esc(item.status || 'active')}</strong></div></div>${item.status === 'active' && loggedIn() ? `<form class="claim-box" id="claim-form"><h3>Think it might be yours?</h3><p>Send the item owner a claim. Share details that help them verify it belongs to you.</p><div class="form-field"><label for="claim-message">Message (optional)</label><textarea name="message" id="claim-message" maxlength="2000" placeholder="Describe a detail that identifies this item…"></textarea></div><button class="button button-dark">Send a claim <span>↗</span></button><div class="form-error" id="form-error" role="alert"></div></form>` : item.status === 'active' ? '<div class="claim-box"><h3>Want to claim this item?</h3><p>Log in to send a message to the person who reported it.</p><a class="button button-dark" href="#/login">Log in to claim <span>↗</span></a></div>' : ''}</div></div></div>`);
    document.querySelector('#claim-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'), errorBox = document.querySelector('#form-error'); try { busy(button, true, 'Sending claim…'); const result = await api('/api/claims', { method: 'POST', body: JSON.stringify({ item_id: item.item_id, message: form.elements.message.value.trim() || null }) }); toast(result.message || 'Claim sent.', 'success'); location.hash = '#/claims'; } catch (error) { errorBox.textContent = error.message; errorBox.classList.add('show'); } finally { busy(button, false); } });
  } catch (error) { renderPage(shell('Item unavailable', 'This report may have been removed or is no longer available.', `<div class="notice">${esc(error.message)} <a class="text-link" href="#/browse">Browse all reports ↗</a></div>`)); }
}
async function renderDashboard() {
  if (!loggedIn()) { location.hash = '#/login'; return; }
  renderPage('<div class="page-wrap"><div class="page-loading">Loading your dashboard…</div></div>');
  try {
    const [data, publicData, receivedData] = await Promise.all([api('/api/dashboard'), api('/api/items'), api('/api/claims/received')]);
    const s = data.statistics || [], name = user()?.name?.split(' ')[0], userId = String(user()?.user_id);
    const ownItems = new Map((data.recent_items || []).map(item => [String(item.item_id), item]));
    (publicData.items || []).filter(item => String(item.user_id) === userId).forEach(item => ownItems.set(String(item.item_id), item));
    const items = [...ownItems.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const received = receivedData.claims || [];
    renderPage(shell(`Good to see you${name ? `, ${esc(name)}` : ''}.`, 'Here’s what’s happening with your campus reports.', `<div class="dashboard-grid"><div class="stat-card"><span>Your reports</span><strong>${Number(s.total_items || 0)}</strong><small>All time</small></div><div class="stat-card"><span>Lost items</span><strong>${Number(s.lost_items || 0)}</strong><small>Reports shared</small></div><div class="stat-card"><span>Found items</span><strong>${Number(s.found_items || 0)}</strong><small>Good finds</small></div><div class="stat-card"><span>Your claims</span><strong>${Number(s.total_claims || 0)}</strong><small>Submitted</small></div></div><div class="dashboard-columns"><section class="panel owned-panel"><h2>Your reported items</h2><p class="panel-sub">Manage your reports. Active items and your five latest reports are shown.</p><div class="table-list" id="owned-items">${items.length ? items.map(item => `<div class="list-row owned-row"><span class="owned-title"><a href="#/item/${encodeURIComponent(item.item_id)}"><strong>${esc(item.title)}</strong></a><small>${esc(item.item_type)} · ${esc(item.location || 'Location not listed')}</small></span><span class="status ${esc(item.status || 'active')}">${esc(item.status || 'active')}</span><span class="row-actions"><a class="button button-outline" href="#/edit/${encodeURIComponent(item.item_id)}">Edit</a><button class="button button-danger" type="button" data-delete-item="${esc(item.item_id)}" data-item-title="${esc(item.title)}">Delete</button></span></div>`).join('') : empty('No reports yet', 'If you lost or found something, let the community know. <a href="#/report/lost"><strong>Make your first report ↗</strong></a>')}</div></section><section class="panel"><h2>Quick actions</h2><p class="panel-sub">Pick up where you need to.</p><div class="table-list"><a class="list-row" href="#/report/lost"><span><strong>Report a lost item</strong><small>Tell the community what you’re looking for.</small></span><span>↗</span></a><a class="list-row" href="#/report/found"><span><strong>Report a found item</strong><small>Help an item find its owner.</small></span><span>↗</span></a><a class="list-row" href="#/claims"><span><strong>View your claims</strong><small>Check your claim history.</small></span><span>↗</span></a></div></section></div><section class="panel admin-claims-panel"><h2>Claims Received</h2><p class="panel-sub">Review claims submitted for found items you reported.</p><div class="admin-claim-list">${received.length ? received.map(claim => `<article class="admin-claim"><div class="admin-claim-main"><div class="admin-claim-heading"><div><span class="section-kicker">Claim #${esc(claim.claim_id)}</span><h3>${esc(claim.item_title)}</h3></div><span class="status ${esc(claim.status)}">${esc(claim.status)}</span></div><div class="admin-claim-details"><div><small>Claimant</small><strong>${esc(claim.claimant_name)}</strong><a href="mailto:${encodeURIComponent(claim.claimant_email || '')}">${esc(claim.claimant_email || '')}</a></div><div><small>Submitted</small><strong>${dateLabel(claim.created_at)}</strong></div></div><div class="admin-claim-message"><small>Claim message</small><p>${claim.message ? esc(claim.message) : '<span class="muted">No message provided.</span>'}</p></div></div>${claim.status === 'pending' ? `<div class="admin-claim-actions"><button class="button button-lime" data-owner-decision="approved" data-claim-id="${esc(claim.claim_id)}">Approve</button><button class="button button-outline" data-owner-decision="rejected" data-claim-id="${esc(claim.claim_id)}">Reject</button></div>` : ''}</article>`).join('') : empty('No claims received', 'Claims on your found items will appear here.')}</div></section>`));
    document.querySelector('#owned-items')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-delete-item]');
      if (!button) return;
      if (!window.confirm(`Delete “${button.dataset.itemTitle}”? This action cannot be undone.`)) return;
      button.disabled = true;
      try { const result = await api(`/api/items/${encodeURIComponent(button.dataset.deleteItem)}`, { method: 'DELETE' }); toast(result.message || 'Item deleted.', 'success'); await renderDashboard(); }
      catch (error) { button.disabled = false; toast(error.message, 'error'); }
    });
    document.querySelector('.admin-claims-panel')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-owner-decision]');
      if (!button) return;
      const id = button.dataset.claimId, status = button.dataset.ownerDecision;
      const buttons = button.closest('.admin-claim-actions').querySelectorAll('button');
      buttons.forEach(action => { action.disabled = true; });
      try { const result = await api(`/api/claims/${encodeURIComponent(id)}/review`, { method: 'PUT', body: JSON.stringify({ status }) }); toast(result.message || 'Claim reviewed.', 'success'); await renderDashboard(); }
      catch (error) { toast(error.message, 'error'); buttons.forEach(action => { action.disabled = false; }); }
    });
  } catch (error) { renderPage(shell('Your dashboard', 'We couldn’t load your account summary.', `<div class="notice">${esc(error.message)} <button class="text-link" onclick="location.reload()">Try again ↻</button></div>`)); }
}
async function renderEditItem(id) {
  if (!loggedIn()) { location.hash = '#/login'; return; }
  renderPage('<div class="page-wrap"><div class="page-loading">Loading item details…</div></div>');
  try {
    const { item } = await api(`/api/items/${encodeURIComponent(id)}`);
    const image = item.image_url ? `<img src="${esc(item.image_url)}" alt="Current image" onerror="this.remove()">` : '<div class="upload-prompt"><div class="upload-icon">✳</div><strong>No image attached</strong></div>';
    renderPage(shell('Edit your report', 'Update the details people use to recognize this item.', `<form class="panel form-stack edit-form" id="edit-form" novalidate><div><h2>Item details</h2><p class="panel-sub">Changes are saved to your existing report.</p></div><div class="form-field"><label for="title">Title *</label><input id="title" name="title" required maxlength="150" value="${esc(item.title)}"></div><div class="form-field"><label for="description">Description</label><textarea id="description" name="description" maxlength="3000">${esc(item.description || '')}</textarea></div><div class="form-row"><div class="form-field"><label for="category">Category</label><input id="category" name="category" maxlength="100" value="${esc(item.category || '')}"></div><div class="form-field"><label for="item_date">Item date</label><input id="item_date" name="item_date" type="date" value="${esc(item.item_date ? String(item.item_date).slice(0, 10) : '')}"></div></div><div class="form-row"><div class="form-field"><label for="item_type">Report type *</label><select id="item_type" name="item_type" required><option value="lost" ${item.item_type === 'lost' ? 'selected' : ''}>Lost</option><option value="found" ${item.item_type === 'found' ? 'selected' : ''}>Found</option></select></div><div class="form-field"><label for="location">Location *</label><input id="location" name="location" required maxlength="250" value="${esc(item.location || '')}"></div></div><div class="form-field"><label>Current photo</label><div class="upload-preview">${image}</div><div class="form-hint">The existing item update API does not accept image uploads, so the photo cannot be changed here.</div></div><div id="form-error" class="form-error" role="alert"></div><div class="edit-actions"><a class="button button-outline" href="#/dashboard">Cancel</a><button class="button button-dark" type="submit">Save changes <span>↗</span></button></div></form>`));
    document.querySelector('#edit-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type=submit]'), errorBox = document.querySelector('#form-error');
      errorBox.textContent = ''; errorBox.classList.remove('show');
      const body = Object.fromEntries(new FormData(form));
      body.item_date = body.item_date || null;
      try { busy(button, true, 'Saving changes…'); const result = await api(`/api/items/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }); toast(result.message || 'Item updated.', 'success'); location.hash = '#/dashboard'; await renderDashboard(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (error) { errorBox.textContent = error.message; errorBox.classList.add('show'); }
      finally { busy(button, false); }
    });
  } catch (error) { renderPage(shell('Could not load this report', 'The item may have been removed or is no longer available.', `<div class="notice">${esc(error.message)} <a class="text-link" href="#/dashboard">Return to dashboard ↗</a></div>`)); }
}
async function renderClaims() {
  if (!loggedIn()) { location.hash = '#/login'; return; }
  renderPage('<div class="page-wrap"><div class="page-loading">Loading your claims…</div></div>');
  try { const data = await api('/api/claims/my-claims'), claims = data.claims || []; renderPage(shell('My claims', 'Follow up on the items you’ve reached out about.', `<div class="panel"><h2>Claim history</h2><p class="panel-sub">Your submitted claims and their current status.</p><div class="table-list">${claims.length ? claims.map(claim => `<div class="list-row"><span><a href="#/item/${encodeURIComponent(claim.item_id)}"><strong>${esc(claim.item_title || `Item ${claim.item_id}`)}</strong></a><small>${esc(claim.location || 'Location not listed')} · ${dateLabel(claim.created_at)}</small>${claim.message ? `<small style="display:block;margin-top:5px">“${esc(claim.message)}”</small>` : ''}</span><span class="status ${esc(claim.status)}">${esc(claim.status)}</span></div>`).join('') : empty('No claims yet', 'When you recognize an item, open its report and send the owner a claim.')}</div></div>`)); }
  catch (error) { renderPage(shell('My claims', 'We couldn’t load your claim history.', `<div class="notice">${esc(error.message)}</div>`)); }
}
function renderReview() {
  if (!loggedIn()) { location.hash = '#/login'; return; }
  location.hash = '#/dashboard';
}
async function loadAdminClaims(status = '') {
  const list = document.querySelector('#admin-claims-list');
  if (!list) return;
  list.innerHTML = '<div class="page-loading">Loading claims…</div>';
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await api(`/api/claims/admin${query}`), claims = data.claims || [];
    list.innerHTML = claims.length ? `<div class="admin-claim-list">${claims.map(claim => `<article class="admin-claim"><div class="admin-claim-main"><div class="admin-claim-heading"><div><span class="section-kicker">Claim #${esc(claim.claim_id)}</span><h3>${esc(claim.item_title || `Item ${claim.item_id}`)}</h3></div><span class="status ${esc(claim.status)}">${esc(claim.status)}</span></div><div class="admin-claim-details"><div><small>Claimant</small><strong>${esc(claim.claimant_name || 'Unknown')}</strong><a href="mailto:${encodeURIComponent(claim.claimant_email || '')}">${esc(claim.claimant_email || 'Email not available')}</a></div><div><small>Item location</small><strong>${esc(claim.location || 'Location not listed')}</strong></div><div><small>Submitted</small><strong>${dateLabel(claim.created_at)}</strong></div></div><div class="admin-claim-message"><small>Claim message</small><p>${claim.message ? esc(claim.message) : '<span class="muted">No message provided.</span>'}</p></div></div>${claim.status === 'pending' ? `<div class="admin-claim-actions"><button class="button button-lime" type="button" data-admin-decision="approved" data-claim-id="${esc(claim.claim_id)}">Approve</button><button class="button button-outline" type="button" data-admin-decision="rejected" data-claim-id="${esc(claim.claim_id)}">Reject</button></div>` : ''}</article>`).join('')}</div>` : empty('No claims in this view', status ? `There are no ${esc(status)} claims.` : 'New claims will appear here when students submit them.');
  } catch (error) {
    list.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  }
}
async function renderAdmin() {
  if (!loggedIn()) { location.hash = '#/login'; return; }
  renderPage('<div class="page-wrap"><div class="page-loading">Loading admin statistics…</div></div>');
  try {
    const data = await api('/api/admin'), s = data.statistics || {};
    renderPage(shell('The campus, at a glance.', 'A live overview of portal activity.', `<div class="admin-banner"><span><strong>Admin overview</strong><br>Statistics loaded directly from the portal API.</span><span>Updated just now</span></div><div class="dashboard-grid"><div class="stat-card"><span>Registered users</span><strong>${Number(s.total_users || 0)}</strong><small>Community members</small></div><div class="stat-card"><span>Total reports</span><strong>${Number(s.total_items || 0)}</strong><small>Lost and found items</small></div><div class="stat-card"><span>Lost reports</span><strong>${Number(s.lost_items || 0)}</strong><small>Shared with campus</small></div><div class="stat-card"><span>Found reports</span><strong>${Number(s.found_items || 0)}</strong><small>Waiting for owners</small></div><div class="stat-card"><span>Total claims</span><strong>${Number(s.total_claims || 0)}</strong><small>Submitted</small></div><div class="stat-card"><span>Pending</span><strong>${Number(s.pending_claims || 0)}</strong><small>Awaiting review</small></div><div class="stat-card"><span>Approved</span><strong>${Number(s.approved_claims || 0)}</strong><small>Reunions in progress</small></div><div class="stat-card"><span>Rejected</span><strong>${Number(s.rejected_claims || 0)}</strong><small>Reviewed claims</small></div></div><section class="panel admin-claims-panel"><div class="admin-claims-title"><div><h2>Claims management</h2><p class="panel-sub">Review claims submitted across campus.</p></div><label class="admin-filter-label" for="admin-claim-filter">Filter claims</label><select id="admin-claim-filter" class="field"><option value="">All claims</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><div id="admin-claims-list" aria-live="polite"></div></section>`));
    document.querySelector('#admin-claim-filter').addEventListener('change', event => loadAdminClaims(event.currentTarget.value));
    document.querySelector('#admin-claims-list').addEventListener('click', async event => {
      const button = event.target.closest('[data-admin-decision]');
      if (!button) return;
      const id = button.dataset.claimId, status = button.dataset.adminDecision;
      if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} claim #${id}?`)) return;
      const buttons = button.closest('.admin-claim-actions').querySelectorAll('button');
      buttons.forEach(entry => { entry.disabled = true; });
      try {
        const result = await api(`/api/claims/admin/${encodeURIComponent(id)}/review`, { method: 'PUT', body: JSON.stringify({ status }) });
        toast(result.message || `Claim ${status}.`, 'success');
        await loadAdminClaims(document.querySelector('#admin-claim-filter').value);
      } catch (error) {
        toast(error.message, 'error');
        buttons.forEach(entry => { entry.disabled = false; });
      }
    });
    await loadAdminClaims();
  }
  catch (error) { renderPage(shell('Admin overview', 'Statistics could not be loaded.', `<div class="notice">${esc(error.message)}${error.status === 403 ? ' This account does not have admin access.' : ''}</div>`)); }
}
async function render() {
  updateNav();
  const hash = location.hash.replace(/^#\/?/, ''), question = hash.indexOf('?'), routePath = question < 0 ? hash : hash.slice(0, question), params = new URLSearchParams(question < 0 ? '' : hash.slice(question + 1)), [route, ...args] = routePath.split('/');
  if (!route || route === 'home') return renderHome();
  if (route === 'browse') return renderBrowse(params);
  if (route === 'login') return renderAuth(false);
  if (route === 'register') return renderAuth(true);
  if (route === 'report') return renderReport(args[0] === 'found' ? 'found' : 'lost');
  if (route === 'edit') return renderEditItem(args[0]);
  if (route === 'item') return renderItem(args[0]);
  if (route === 'dashboard') return renderDashboard();
  if (route === 'claims') return renderClaims();
  if (route === 'review') return renderReview();
  if (route === 'admin') return renderAdmin();
  return renderHome();
}
document.querySelector('#menu-toggle').addEventListener('click', event => { const menu = document.querySelector('#main-nav'), open = menu.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
document.querySelector('#logout-button').addEventListener('click', () => { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); toast('You’ve been logged out.', 'success'); location.hash = '#/'; });
window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
render();
