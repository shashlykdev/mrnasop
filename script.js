// ====== Utilities ======
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};
const live = (msg) => { const el = $('#live'); el.textContent = ''; setTimeout(() => el.textContent = msg, 10); };

// ====== ACTIONS (Kanban) ======
const ACTIONS_KEY = 'sop_actions_v1';
let actions = store.get(ACTIONS_KEY, []);

function renderActions() {
    const cols = ['todo', 'doing', 'review', 'done'];
    cols.forEach(c => { $('#col-' + c).innerHTML = ''; });

    const filter = $('#searchActions').value.toLowerCase();
    const counts = { todo: 0, doing: 0, review: 0, done: 0 };

    actions.forEach(a => {
        // Skip archived actions unless we're showing them
        if (a.archived && !$('#showArchived')?.checked) return;
        
        const match = [a.title, a.owner, a.notes, a.due].filter(Boolean).join(' ').toLowerCase().includes(filter);
        if (!match) return;
        const el = document.createElement('article');
        el.className = 'cardk';
        el.tabIndex = 0;
        el.draggable = true;
        el.dataset.id = a.id;
        el.dataset.type = a.type || '';
        el.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:.5rem; align-items:start;">
            <div style="font-weight:700;">${escapeHtml(a.title)}</div>
            <button class="btn btn--link" title="Archive" aria-label="Archive action" data-act="archive"><i data-lucide="archive"></i></button>
          </div>
          <div class="cardk__meta">
            ${a.owner ? `<span class="badge" title="Owner"><i data-lucide="user"></i> ${escapeHtml(a.owner)}</span>` : ''}
            ${a.due ? `<span class="badge" title="Due"><i data-lucide="calendar"></i> ${escapeHtml(a.due)}</span>` : ''}
            ${a.type ? `<span class="badge badge--${a.type}">${a.type}</span>` : ''}
          </div>
          ${a.notes ? `<div style="margin-top:.35rem; color:#333;">${escapeHtml(a.notes)}</div>` : ''}
          <div style="margin-top:.5rem; display:flex; gap:.5rem; align-items:center;">
            <label class="visually-hidden" for="mv-${a.id}">Move to</label>
            <select id="mv-${a.id}" data-act="move" class="select">
              <option value="todo" ${a.col === 'todo' ? 'selected' : ''}>To Do</option>
              <option value="doing" ${a.col === 'doing' ? 'selected' : ''}>In Progress</option>
              <option value="review" ${a.col === 'review' ? 'selected' : ''}>Review/Blocked</option>
              <option value="done" ${a.col === 'done' ? 'selected' : ''}>Done</option>
            </select>
          </div>
        `;
        // Drag handlers
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', a.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') archiveAction(a.id);
        });
        el.addEventListener('click', (e) => {
            const t = e.target;
            if (t.matches('[data-act="archive"]')) { archiveAction(a.id); }
            if (t.matches('[data-act="move"], select[data-act="move"]')) { }
        });
        el.querySelector('select[data-act="move"]').addEventListener('change', (e) => {
            a.col = e.target.value; saveActions(); renderActions();
        });

        $('#col-' + a.col)?.appendChild(el);
        counts[a.col]++;
    });

    $('#count-todo').textContent = counts.todo;
    $('#count-doing').textContent = counts.doing;
    $('#count-review').textContent = counts.review;
    $('#count-done').textContent = counts.done;

    // Reinitialize Lucide icons
    lucide.createIcons();
}

function archiveAction(id) {
    const action = actions.find(x => x.id === id);
    if (action) {
        action.archived = true;
        action.archivedAt = new Date().toISOString();
        saveActions(); renderActions(); live('Action archived.');
    }
}
function saveActions() { store.set(ACTIONS_KEY, actions); }

// Drop zones
$$('.col').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.style.background = '#eee'; });
    col.addEventListener('dragleave', () => { col.style.background = 'var(--bg-alt)'; });
    col.addEventListener('drop', (e) => {
        e.preventDefault(); col.style.background = 'var(--bg-alt)';
        const id = e.dataTransfer.getData('text/plain');
        const a = actions.find(x => x.id === id); if (!a) return;
        a.col = col.dataset.col; saveActions(); renderActions();
    });
});

$('#searchActions').addEventListener('input', renderActions);
$('#showArchived').addEventListener('change', renderActions);
function populateRelationshipDropdowns() {
    // Populate events dropdown
    const eventSelect = $('#aRelatedEvent');
    if (eventSelect) {
        eventSelect.innerHTML = '<option value="">Select event (optional)</option>';
        events.forEach(e => {
            if (!e.archived) {
                eventSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.title)} (${e.date})</option>`;
            }
        });
    }
    
    // Populate decisions dropdown
    const decisionSelect = $('#aRelatedDecision');
    if (decisionSelect) {
        decisionSelect.innerHTML = '<option value="">Select decision (optional)</option>';
        decisions.forEach(d => {
            if (!d.archived) {
                decisionSelect.innerHTML += `<option value="${d.id}">${escapeHtml(d.title)} (${d.owner || 'Unknown'})</option>`;
            }
        });
    }
}

$('#newActionBtn').addEventListener('click', () => { 
    populateRelationshipDropdowns();
    $('#actionDlg').showModal(); 
    $('#aTitle').focus(); 
});
$('#saveActionBtn').addEventListener('click', (e) => {
    const f = $('#actionForm'); if (!$('#aTitle').value || !$('#aOwner').value) { e.preventDefault(); return; }
    const act = {
        id: crypto.randomUUID(),
        title: $('#aTitle').value.trim(),
        owner: $('#aOwner').value.trim(),
        due: $('#aDue').value,
        type: $('#aType').value,
        notes: $('#aNotes').value.trim(),
        col: $('#aCol').value || 'todo',
        relatedEvent: $('#aRelatedEvent').value || null,
        relatedDecision: $('#aRelatedDecision').value || null,
        createdAt: new Date().toISOString(),
        archived: false
    };
    actions.push(act); saveActions(); renderActions();
    live('Action added.');
});
$('#exportActionsBtn').addEventListener('click', () => download('actions.json', actions));

// ====== CALENDAR ======
const EVENTS_KEY = 'sop_events_v1';
let events = store.get(EVENTS_KEY, []);
let view = new Date(); view.setDate(1);

const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function renderCalendar() {
    const y = view.getFullYear();
    const m = view.getMonth();
    $('#calLabel').textContent = view.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const grid = $('#calGrid'); grid.innerHTML = '';
    
    // Clean up existing tooltips
    document.querySelectorAll('.event-tooltip').forEach(tooltip => tooltip.remove());

    // Header DOW (Mon-first)
    dow.forEach(d => { const el = document.createElement('div'); el.className = 'cal__dow'; el.textContent = d; grid.appendChild(el); });

    // Calculate start offset (Mon=0)
    const first = new Date(y, m, 1);
    let start = (first.getDay() + 6) % 7; // 0=Mon
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < start; i++) { grid.appendChild(cell('', false)); }
    for (let d = 1; d <= daysInMonth; d++) { grid.appendChild(cell(d, true)); }

    function cell(day, active) {
        const el = document.createElement('div');
        el.className = 'cal__cell';
        if (!active) { el.style.background = '#fcfcfc'; el.setAttribute('aria-hidden', 'true'); return el; }
        const cellDate = new Date(y, m, day);
        const today = new Date();

        // Compare dates using local time, not UTC
        const cellDateStr = fmtDate(cellDate);
        const todayStr = fmtDate(today);

        if (cellDateStr === todayStr) {
            el.classList.add('cal__cell--today');
        } else if (cellDate < today) {
            el.classList.add('cal__cell--past');
        }

        el.innerHTML = `<div style="font-weight:700;">${day}</div>`;
        const list = document.createElement('div');
        const dayEvents = events.filter(e => e.date === cellDateStr);
        
        // Add tooltip if there are events
        if (dayEvents.length > 0) {
            const tooltip = document.createElement('div');
            tooltip.className = 'event-tooltip';
            if (dayEvents.length === 1) {
                tooltip.textContent = dayEvents[0].title;
            } else {
                tooltip.className += ' multi-line';
                tooltip.innerHTML = `${dayEvents.length} events:<br>${dayEvents.map(ev => `• ${ev.title}`).join('<br>')}`;
            }
            
            // Add hover functionality
            el.addEventListener('mouseenter', () => {
                const rect = el.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.bottom + 5}px`;
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
            });
            
            el.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            });
            
            document.body.appendChild(tooltip);
        }
        
        dayEvents.forEach(ev => {
            const a = document.createElement('a');
            a.href = '#'; 
            a.className = 'evt' + (ev.status ? ` evt--${ev.status}` : ''); 
            a.textContent = ev.title; 
            a.title = ev.title; 
            a.addEventListener('click', (e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                openEventDialog(ev);
            }); 
            list.appendChild(a);
        });
        el.appendChild(list);
        // Add click handler for creating new events
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target === el.querySelector('div:first-child')) {
                openEventDialog(null, cellDateStr);
            }
        });
        return el;
    }

    // Reinitialize Lucide icons
    lucide.createIcons();
}
function fmtDate(dt) {
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function saveEvents() { store.set(EVENTS_KEY, events); }

$('#prevMonth').addEventListener('click', () => { view.setMonth(view.getMonth() - 1); renderCalendar(); });
$('#nextMonth').addEventListener('click', () => { view.setMonth(view.getMonth() + 1); renderCalendar(); });

$('#eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = $('#evtDate').value, title = $('#evtTitle').value.trim(); if (!date || !title) return;
    const status = $('#evtStatus').value;
    events.push({ id: crypto.randomUUID(), date, title, status }); saveEvents(); renderCalendar();
    $('#evtTitle').value = ''; live('Event added.');
});
$('#exportEventsBtn').addEventListener('click', () => download('events.json', events));

// ====== EVENT DIALOG FUNCTIONALITY ======
let currentEditingEvent = null;

function openEventDialog(event = null, date = null) {
    currentEditingEvent = event;
    const dialog = $('#eventDetailsDlg');
    const title = $('#eventDialogTitle');
    const deleteBtn = $('#deleteEventBtn');
    
    if (event) {
        // Editing existing event
        title.textContent = 'Edit Event';
        deleteBtn.style.display = 'block';
        populateEventForm(event);
    } else {
        // Creating new event
        title.textContent = 'New Event';
        deleteBtn.style.display = 'none';
        clearEventForm();
        if (date) {
            $('#eventDate').value = date;
        }
    }
    
    dialog.showModal();
    $('#eventTitle').focus();
    
    // Reinitialize Lucide icons for the dialog
    lucide.createIcons();
}

function populateEventForm(event) {
    $('#eventTitle').value = event.title || '';
    $('#eventDate').value = event.date || '';
    $('#eventMeeting').value = event.status || '';
    $('#eventDescription').value = event.description || '';
    $('#eventTranscript').value = event.transcript || '';
    
    // Show summary if exists
    if (event.summary) {
        $('#summaryField').style.display = 'block';
        $('#eventSummary').innerHTML = event.summary;
    } else {
        $('#summaryField').style.display = 'none';
    }
    
    // Show files if exists
    displayEventFiles(event.files || []);
    
    // Show summarize button if transcript exists
    const summarizeBtn = $('#summarizeBtn');
    if (event.transcript && event.transcript.trim()) {
        summarizeBtn.style.display = 'inline-flex';
    } else {
        summarizeBtn.style.display = 'none';
    }
    
    // Show workflow actions for editing existing events
    if (event.id) {
        $('#workflowActions').style.display = 'block';
    } else {
        $('#workflowActions').style.display = 'none';
    }
}

function clearEventForm() {
    $('#eventTitle').value = '';
    $('#eventDate').value = '';
    $('#eventMeeting').value = '';
    $('#eventDescription').value = '';
    $('#eventTranscript').value = '';
    $('#eventSummary').innerHTML = '';
    $('#summaryField').style.display = 'none';
    $('#summarizeBtn').style.display = 'none';
    clearEventFiles();
}

function displayEventFiles(files) {
    const container = $('#eventFilesList');
    container.innerHTML = '';
    
    if (files && files.length > 0) {
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.style.cssText = 'display:flex; align-items:center; gap:.5rem; padding:.25rem; background:#f8f9fa; border-radius:6px; margin-bottom:.25rem;';
            fileItem.innerHTML = `
                <i data-lucide="file"></i>
                <span style="flex:1;">${file.name}</span>
                <button type="button" class="btn btn--link" data-remove-file="${index}" title="Remove file">
                    <i data-lucide="x"></i>
                </button>
            `;
            container.appendChild(fileItem);
        });
        lucide.createIcons();
    }
}

function clearEventFiles() {
    $('#eventFilesList').innerHTML = '';
    $('#eventFiles').value = '';
}

// ====== DECISIONS ======
const DECS_KEY = 'sop_decisions_v1';
let decisions = store.get(DECS_KEY, []);

function renderDecisions() {
    const tbody = $('#decTbody'); tbody.innerHTML = '';
    decisions.forEach((d) => {
        // Skip archived decisions unless we're showing them
        if (d.archived && !$('#showArchivedDecisions')?.checked) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(d.title)}</td>
          <td>${escapeHtml(d.owner || '')}</td>
          <td>${escapeHtml(d.date || '')}</td>
          <td>${escapeHtml(d.status || '')}</td>
          <td>${escapeHtml(d.notes || '')}</td>
          <td><button class="btn btn--link" aria-label="Archive decision"><i data-lucide="archive"></i></button></td>
        `;
        tr.querySelector('button').addEventListener('click', () => { 
            const decision = decisions.find(x => x.id === d.id);
            if (decision) {
                decision.archived = true;
                decision.archivedAt = new Date().toISOString();
                saveDecisions(); renderDecisions(); live('Decision archived.');
            }
        });
        tbody.appendChild(tr);
    });

    // Reinitialize Lucide icons
    lucide.createIcons();
}
function saveDecisions() { store.set(DECS_KEY, decisions); }

$('#decForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = {
        id: crypto.randomUUID(),
        title: $('#decTitle').value.trim(),
        owner: $('#decOwner').value.trim(),
        date: $('#decDate').value,
        status: $('#decStatus').value,
        notes: $('#decNotes').value.trim(),
        relatedEvent: $('#decRelatedEvent').value || null,
        createdAt: new Date().toISOString(),
        archived: false
    };
    if (!d.title || !d.owner) return;
    decisions.push(d); saveDecisions(); renderDecisions(); e.target.reset(); live('Decision added.');
});
$('#addDecisionBtn').addEventListener('click', () => { 
    // Populate event dropdown
    const eventSelect = $('#decRelatedEvent');
    if (eventSelect) {
        eventSelect.innerHTML = '<option value="">Select event (optional)</option>';
        events.forEach(e => {
            if (!e.archived) {
                eventSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.title)} (${e.date})</option>`;
            }
        });
    }
    $('#decTitle').focus(); 
});
$('#exportDecBtn').addEventListener('click', () => download('decisions.json', decisions));

// ====== STAKEHOLDERS ======
const STK_KEY = 'sop_stakeholders_v1';
let stakeholders = store.get(STK_KEY, []);

function renderStakeholders() {
    const tbody = $('#stkTbody'); tbody.innerHTML = '';
    const filter = ($('#stakeholderSearch').value || '').toLowerCase();
    stakeholders
        .filter(s => (`${s.name} ${s.role} ${s.contact} ${s.raci} ${s.notes}`).toLowerCase().includes(filter))
        .forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.role || '')}</td>
            <td>${escapeHtml(s.contact || '')}</td>
            <td>${escapeHtml(s.raci || '')}</td>
            <td>${escapeHtml(s.notes || '')}</td>
            <td><button class="btn btn--link" aria-label="Delete stakeholder"><i data-lucide="trash-2"></i></button></td>`;
            tr.querySelector('button').addEventListener('click', () => { stakeholders = stakeholders.filter(x => x.id !== s.id); saveStakeholders(); renderStakeholders(); live('Stakeholder removed.'); });
            tbody.appendChild(tr);
        });

    // Reinitialize Lucide icons
    lucide.createIcons();
}
function saveStakeholders() { store.set(STK_KEY, stakeholders); }

$('#stkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = {
        id: crypto.randomUUID(),
        name: $('#stkName').value.trim(),
        role: $('#stkRole').value.trim(),
        contact: $('#stkContact').value.trim(),
        raci: $('#stkRaci').value,
        notes: $('#stkNotes').value.trim(),
    };
    if (!s.name || !s.role) return;
    stakeholders.push(s); saveStakeholders(); renderStakeholders(); e.target.reset(); live('Stakeholder added.');
});
$('#stakeholderSearch').addEventListener('input', renderStakeholders);
$('#exportStkBtn').addEventListener('click', () => download('stakeholders.json', stakeholders));

// ====== IDEAS ======
const IDEAS_KEY = 'sop_ideas_v1';
let ideas = store.get(IDEAS_KEY, []);

function renderIdeas() {
    const list = $('#ideasList'); list.innerHTML = '';
    if (ideas.length === 0) {
        list.innerHTML = '<div style="color:var(--muted)">No ideas yet. Add your first one!</div>';
        return;
    }
    ideas.forEach(i => {
        const item = document.createElement('div');
        item.className = 'cardk';
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:.5rem; align-items:start;">
            <div>
              <div style="font-weight:700">${escapeHtml(i.title)}</div>
              ${i.desc ? `<div style="margin-top:.35rem; color:#333;">${escapeHtml(i.desc)}</div>` : ''}
              <div class="cardk__meta">
                <span class="badge">${escapeHtml(i.status || 'Idea')}</span>
              </div>
            </div>
            <div style="display:flex; gap:.4rem; align-items:center;">
              <button class="btn" data-act="up"><i data-lucide="triangle"></i> ${i.votes || 0}</button>
              <button class="btn btn--link" data-act="del" aria-label="Delete idea"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.matches('[data-act="up"]')) { i.votes = (i.votes || 0) + 1; saveIdeas(); renderIdeas(); }
            if (e.target.matches('[data-act="del"]')) { ideas = ideas.filter(x => x.id !== i.id); saveIdeas(); renderIdeas(); live('Idea deleted.'); }
        });
        list.appendChild(item);
    });

    // Reinitialize Lucide icons
    lucide.createIcons();
}
function saveIdeas() { store.set(IDEAS_KEY, ideas); }

$('#addIdeaBtn').addEventListener('click', () => { $('#ideaDlg').showModal(); $('#iTitle').focus(); });
$('#saveIdeaBtn').addEventListener('click', (e) => {
    if (!$('#iTitle').value) { e.preventDefault(); return; }
    ideas.push({ id: crypto.randomUUID(), title: $('#iTitle').value.trim(), desc: $('#iDesc').value.trim(), status: $('#iStatus').value, votes: 0 });
    saveIdeas(); renderIdeas(); live('Idea added.');
});
$('#exportIdeasBtn').addEventListener('click', () => download('ideas.json', ideas));

// ====== Helpers ======
function escapeHtml(s = '') { return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[m])); }
function download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// ====== Init with sample data (only first-time) ======
function seedIfEmpty() {
    if (actions.length === 0) {
        actions = [
            { id: crypto.randomUUID(), title: 'Draft SOP intro & scope', owner: 'Peta', due: new Date(Date.now() + 86400000).toISOString().slice(0, 10), type: 'pending', notes: 'Outline v1', col: 'todo' },
            { id: crypto.randomUUID(), title: 'Review risk register', owner: 'Deanna', due: '', type: 'alert', notes: 'Dependencies blocked', col: 'review' },
            { id: crypto.randomUUID(), title: 'Publish v0.9 to drive', owner: 'Alex', due: '', type: 'done', notes: 'Awaiting sign-off', col: 'done' },
        ]; saveActions();
    }
    if (events.length === 0) {
        const today = new Date(); const ds = today.toISOString().slice(0, 10);
        events = [{ id: crypto.randomUUID(), date: ds, title: 'Kickoff', status: 'pending' }]; saveEvents();
    }
    if (decisions.length === 0) {
        decisions = [
            { id: crypto.randomUUID(), title: 'Adopt Kanban for action tracking', owner: 'Peta', date: new Date().toISOString().slice(0, 10), status: 'Approved', notes: 'Weekly standup cadence' }
        ]; saveDecisions();
    }
    if (stakeholders.length === 0) {
        stakeholders = [
            { id: crypto.randomUUID(), name: 'Deanna', role: 'Director of Operations', contact: 'deanna@example.com', raci: 'A - Accountable', notes: 'High influence' },
            { id: crypto.randomUUID(), name: 'Gilly', role: 'GM North', contact: 'gilly@example.com', raci: 'R - Responsible', notes: '' }
        ]; saveStakeholders();
    }
    if (ideas.length === 0) {
        ideas = [{ id: crypto.randomUUID(), title: 'Add SOP glossary section', desc: 'Define key terms for new hires.', status: 'Idea', votes: 2 }]; saveIdeas();
    }
}

// ====== EVENT DIALOG EVENT HANDLERS ======
$('#saveEventBtn').addEventListener('click', (e) => {
    const title = $('#eventTitle').value.trim();
    const date = $('#eventDate').value;
    const meeting = $('#eventMeeting').value;
    const description = $('#eventDescription').value.trim();
    const transcript = $('#eventTranscript').value.trim();
    const summary = $('#eventSummary').innerHTML;
    
    if (!title || !date) {
        e.preventDefault();
        return;
    }
    
    const eventData = {
        id: currentEditingEvent ? currentEditingEvent.id : crypto.randomUUID(),
        title,
        date,
        status: meeting,
        description,
        transcript,
        summary,
        files: currentEditingEvent ? currentEditingEvent.files || [] : [],
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditingEvent) {
        // Update existing event
        const index = events.findIndex(e => e.id === currentEditingEvent.id);
        if (index !== -1) {
            events[index] = eventData;
        }
        live('Event updated.');
    } else {
        // Create new event
        events.push(eventData);
        live('Event created.');
    }
    
    saveEvents();
    renderCalendar();
});

$('#deleteEventBtn').addEventListener('click', () => {
    if (currentEditingEvent && confirm('Are you sure you want to delete this event?')) {
        events = events.filter(e => e.id !== currentEditingEvent.id);
        saveEvents();
        renderCalendar();
        $('#eventDetailsDlg').close();
        live('Event deleted.');
    }
});

// File upload handling
$('#eventFiles').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        const fileData = files.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        }));
        
        if (currentEditingEvent) {
            currentEditingEvent.files = (currentEditingEvent.files || []).concat(fileData);
        }
        
        displayEventFiles(currentEditingEvent ? currentEditingEvent.files : fileData);
    }
});

// Transcript upload handling
$('#uploadTranscriptBtn').addEventListener('click', () => {
    $('#transcriptFile').click();
});

$('#transcriptFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            $('#eventTranscript').value = e.target.result;
            $('#summarizeBtn').style.display = 'inline-flex';
            lucide.createIcons();
        };
        reader.readAsText(file);
    }
});

// Show/hide summarize button based on transcript content
$('#eventTranscript').addEventListener('input', (e) => {
    const summarizeBtn = $('#summarizeBtn');
    if (e.target.value.trim()) {
        summarizeBtn.style.display = 'inline-flex';
    } else {
        summarizeBtn.style.display = 'none';
    }
    lucide.createIcons();
});

// AI Summarization with OpenAI integration
$('#summarizeBtn').addEventListener('click', async () => {
    const transcript = $('#eventTranscript').value.trim();
    if (!transcript) return;
    
    const btn = $('#summarizeBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2"></i> Summarizing...';
    btn.disabled = true;
    lucide.createIcons();
    
    try {
        // OpenAI API Configuration - Replace with your actual API key
        const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // TODO: Replace with actual API key
        
        if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            // Mock response when no API key is configured
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mockSummary = `
                <h4>Meeting Summary (Mock - Configure API Key)</h4>
                <p><strong>Key Points:</strong></p>
                <ul>
                    <li>Discussed project timeline and deliverables</li>
                    <li>Reviewed budget allocations and resource requirements</li>
                    <li>Identified potential risks and mitigation strategies</li>
                </ul>
                <p><strong>Action Items:</strong></p>
                <ul>
                    <li>Follow up on pending approvals by next Friday</li>
                    <li>Schedule technical review meeting</li>
                    <li>Update project documentation</li>
                </ul>
                <p><em>Note: Configure your OpenAI API key to enable real summarization.</em></p>
            `;
            
            $('#eventSummary').innerHTML = mockSummary;
            $('#summaryField').style.display = 'block';
            live('Mock summary generated. Configure API key for real summarization.');
            return;
        }
        
        // Actual OpenAI API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional meeting summarizer. Create a concise summary with key points and action items from meeting transcripts. Format your response in HTML with proper headings and lists.'
                    },
                    {
                        role: 'user',
                        content: `Please summarize this meeting transcript and extract key points and action items:\n\n${transcript}`
                    }
                ],
                max_tokens: 800,
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const summary = data.choices[0].message.content;
        
        $('#eventSummary').innerHTML = `<h4>AI Summary</h4>${summary}`;
        $('#summaryField').style.display = 'block';
        live('Transcript summarized successfully with AI.');
        
    } catch (error) {
        console.error('Summarization error:', error);
        
        let errorMessage = 'Failed to summarize transcript.';
        if (error.message.includes('401')) {
            errorMessage = 'Invalid API key. Please check your OpenAI configuration.';
        } else if (error.message.includes('429')) {
            errorMessage = 'API rate limit exceeded. Please try again later.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your connection.';
        }
        
        live(errorMessage);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
    }
});

// File removal handling
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-remove-file]') || e.target.closest('[data-remove-file]')) {
        const btn = e.target.closest('[data-remove-file]');
        const index = parseInt(btn.dataset.removeFile);
        
        if (currentEditingEvent && currentEditingEvent.files) {
            currentEditingEvent.files.splice(index, 1);
            displayEventFiles(currentEditingEvent.files);
        }
    }
});

// ====== TIMELINE & DEPENDENCIES ======
function renderTimeline() {
    const container = $('#timelineContent');
    container.innerHTML = '';
    
    // Collect all items with dates
    const timelineItems = [];
    
    // Add events
    events.forEach(e => {
        if (!e.archived && e.date) {
            timelineItems.push({
                type: 'event',
                id: e.id,
                title: e.title,
                date: e.date,
                status: e.status,
                data: e
            });
        }
    });
    
    // Add decisions with dates
    decisions.forEach(d => {
        if (!d.archived && d.date) {
            timelineItems.push({
                type: 'decision',
                id: d.id,
                title: d.title,
                date: d.date,
                status: d.status,
                data: d
            });
        }
    });
    
    // Add actions with due dates
    actions.forEach(a => {
        if (!a.archived && a.due) {
            timelineItems.push({
                type: 'action',
                id: a.id,
                title: a.title,
                date: a.due,
                status: a.col,
                data: a
            });
        }
    });
    
    // Sort by date
    timelineItems.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (timelineItems.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--muted); padding:2rem;">No items with dates found.</div>';
        return;
    }
    
    // Render timeline
    timelineItems.forEach(item => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        timelineItem.style.cssText = 'display:flex; gap:1rem; padding:1rem; border-left:3px solid var(--line); margin-left:1rem; margin-bottom:1rem; position:relative;';
        
        // Add type indicator
        const typeColor = item.type === 'event' ? '#2196f3' : item.type === 'decision' ? '#ff9800' : '#4caf50';
        timelineItem.style.borderLeftColor = typeColor;
        
        // Add circle indicator
        const circle = document.createElement('div');
        circle.style.cssText = `position:absolute; left:-8px; top:1rem; width:12px; height:12px; border-radius:50%; background:${typeColor}; border:2px solid white; box-shadow:0 0 0 1px var(--line);`;
        timelineItem.appendChild(circle);
        
        timelineItem.innerHTML += `
            <div style="flex:1;">
                <div style="display:flex; gap:.5rem; align-items:center; margin-bottom:.25rem;">
                    <span class="badge" style="background:${typeColor}; color:white; border-color:${typeColor};">${item.type.toUpperCase()}</span>
                    <span style="font-size:.875rem; color:var(--muted);">${item.date}</span>
                </div>
                <div style="font-weight:500; margin-bottom:.25rem;">${escapeHtml(item.title)}</div>
                ${item.status ? `<div style="font-size:.875rem; color:var(--muted);">Status: ${escapeHtml(item.status)}</div>` : ''}
                ${getRelationships(item)}
            </div>
        `;
        
        container.appendChild(timelineItem);
    });
}

function getRelationships(item) {
    const relationships = [];
    
    if (item.type === 'action') {
        if (item.data.relatedEvent) {
            const event = events.find(e => e.id === item.data.relatedEvent);
            if (event) relationships.push(`📅 From: ${escapeHtml(event.title)}`);
        }
        if (item.data.relatedDecision) {
            const decision = decisions.find(d => d.id === item.data.relatedDecision);
            if (decision) relationships.push(`⚖️ From: ${escapeHtml(decision.title)}`);
        }
    }
    
    if (item.type === 'decision') {
        if (item.data.relatedEvent) {
            const event = events.find(e => e.id === item.data.relatedEvent);
            if (event) relationships.push(`📅 From: ${escapeHtml(event.title)}`);
        }
        
        // Find actions that relate to this decision
        const relatedActions = actions.filter(a => a.relatedDecision === item.id && !a.archived);
        if (relatedActions.length > 0) {
            relationships.push(`🎯 Actions: ${relatedActions.length}`);
        }
    }
    
    if (item.type === 'event') {
        // Find decisions that relate to this event
        const relatedDecisions = decisions.filter(d => d.relatedEvent === item.id && !d.archived);
        if (relatedDecisions.length > 0) {
            relationships.push(`⚖️ Decisions: ${relatedDecisions.length}`);
        }
        
        // Find actions that relate to this event
        const relatedActions = actions.filter(a => a.relatedEvent === item.id && !a.archived);
        if (relatedActions.length > 0) {
            relationships.push(`🎯 Actions: ${relatedActions.length}`);
        }
    }
    
    return relationships.length > 0 ? 
        `<div style="margin-top:.5rem; font-size:.875rem; color:var(--muted);">${relationships.join(' • ')}</div>` : '';
}

function renderDependencyGraph() {
    const container = $('#dependencyGraph');
    container.innerHTML = '';
    
    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '400');
    svg.setAttribute('viewBox', '0 0 800 400');
    svg.style.border = '1px solid var(--line)';
    svg.style.borderRadius = '12px';
    svg.style.background = '#fafafa';
    
    // Collect all items with relationships
    const nodes = [];
    const links = [];
    
    // Add events as nodes
    events.forEach(e => {
        if (!e.archived) {
            nodes.push({
                id: e.id,
                type: 'event',
                title: e.title,
                date: e.date,
                x: 0,
                y: 0
            });
        }
    });
    
    // Add decisions as nodes and create links
    decisions.forEach(d => {
        if (!d.archived) {
            nodes.push({
                id: d.id,
                type: 'decision',
                title: d.title,
                date: d.date,
                x: 0,
                y: 0
            });
            
            // Link to related event
            if (d.relatedEvent) {
                links.push({
                    source: d.relatedEvent,
                    target: d.id,
                    type: 'event-to-decision'
                });
            }
        }
    });
    
    // Add actions as nodes and create links
    actions.forEach(a => {
        if (!a.archived) {
            nodes.push({
                id: a.id,
                type: 'action',
                title: a.title,
                date: a.due,
                x: 0,
                y: 0
            });
            
            // Link to related event
            if (a.relatedEvent) {
                links.push({
                    source: a.relatedEvent,
                    target: a.id,
                    type: 'event-to-action'
                });
            }
            
            // Link to related decision
            if (a.relatedDecision) {
                links.push({
                    source: a.relatedDecision,
                    target: a.id,
                    type: 'decision-to-action'
                });
            }
        }
    });
    
    if (nodes.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--muted); padding:2rem;">No relationships found. Create some connected events, decisions, and actions to see the dependency graph.</div>';
        return;
    }
    
    // Simple force-directed layout
    layoutNodes(nodes, links);
    
    // Create links (lines)
    links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        
        if (sourceNode && targetNode) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', sourceNode.x);
            line.setAttribute('y1', sourceNode.y);
            line.setAttribute('x2', targetNode.x);
            line.setAttribute('y2', targetNode.y);
            line.setAttribute('stroke', getStrokeColor(link.type));
            line.setAttribute('stroke-width', '2');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            svg.appendChild(line);
        }
    });
    
    // Add arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#666');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
    
    // Create nodes (circles with text)
    nodes.forEach(node => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'node-group');
        group.style.cursor = 'pointer';
        
        // Node circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', '20');
        circle.setAttribute('fill', getNodeColor(node.type));
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        
        // Node label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x);
        text.setAttribute('y', node.y - 25);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', '#333');
        text.textContent = truncateText(node.title, 15);
        
        // Add tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${node.type.toUpperCase()}: ${node.title}${node.date ? ` (${node.date})` : ''}`;
        
        group.appendChild(circle);
        group.appendChild(text);
        group.appendChild(title);
        svg.appendChild(group);
    });
    
    container.appendChild(svg);
    
    // Add legend
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex; gap:1rem; justify-content:center; margin-top:1rem; font-size:.875rem;';
    legend.innerHTML = `
        <div style="display:flex; align-items:center; gap:.25rem;">
            <div style="width:12px; height:12px; border-radius:50%; background:#2196f3;"></div>
            <span>Events</span>
        </div>
        <div style="display:flex; align-items:center; gap:.25rem;">
            <div style="width:12px; height:12px; border-radius:50%; background:#ff9800;"></div>
            <span>Decisions</span>
        </div>
        <div style="display:flex; align-items:center; gap:.25rem;">
            <div style="width:12px; height:12px; border-radius:50%; background:#4caf50;"></div>
            <span>Actions</span>
        </div>
    `;
    container.appendChild(legend);
}

function layoutNodes(nodes, links) {
    const width = 800;
    const height = 400;
    const padding = 60;
    
    // Group nodes by type for better layout
    const eventNodes = nodes.filter(n => n.type === 'event');
    const decisionNodes = nodes.filter(n => n.type === 'decision');
    const actionNodes = nodes.filter(n => n.type === 'action');
    
    // Position events on the left
    eventNodes.forEach((node, i) => {
        node.x = padding + 50;
        node.y = (height / (eventNodes.length + 1)) * (i + 1);
    });
    
    // Position decisions in the middle
    decisionNodes.forEach((node, i) => {
        node.x = width / 2;
        node.y = (height / (decisionNodes.length + 1)) * (i + 1);
    });
    
    // Position actions on the right
    actionNodes.forEach((node, i) => {
        node.x = width - padding - 50;
        node.y = (height / (actionNodes.length + 1)) * (i + 1);
    });
}

function getNodeColor(type) {
    switch (type) {
        case 'event': return '#2196f3';
        case 'decision': return '#ff9800';
        case 'action': return '#4caf50';
        default: return '#666';
    }
}

function getStrokeColor(linkType) {
    switch (linkType) {
        case 'event-to-decision': return '#ff9800';
        case 'event-to-action': return '#4caf50';
        case 'decision-to-action': return '#4caf50';
        default: return '#666';
    }
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

$('#timelineViewBtn').addEventListener('click', () => {
    $('#timelineContainer').style.display = 'block';
    $('#dependencyContainer').style.display = 'none';
    $('#timelineViewBtn').classList.add('btn--primary');
    $('#dependencyGraphBtn').classList.remove('btn--primary');
    renderTimeline();
});

$('#dependencyGraphBtn').addEventListener('click', () => {
    $('#timelineContainer').style.display = 'none';
    $('#dependencyContainer').style.display = 'block';
    $('#timelineViewBtn').classList.remove('btn--primary');
    $('#dependencyGraphBtn').classList.add('btn--primary');
    renderDependencyGraph();
});

// ====== Start ======
seedIfEmpty();
renderActions();
renderCalendar();
renderDecisions();
renderStakeholders();
renderIdeas();
renderTimeline();

// ====== WORKFLOW INTEGRATION ======
// Event workflow buttons
$('#createDecisionFromEvent').addEventListener('click', () => {
    if (currentEditingEvent) {
        // Close event dialog
        $('#eventDetailsDlg').close();
        
        // Pre-fill decision form with event relationship
        $('#decTitle').value = `Decision from: ${currentEditingEvent.title}`;
        $('#decRelatedEvent').innerHTML = `<option value="${currentEditingEvent.id}" selected>${escapeHtml(currentEditingEvent.title)} (${currentEditingEvent.date})</option>`;
        $('#decDate').value = new Date().toISOString().slice(0, 10);
        $('#decOwner').focus();
        
        // Scroll to decision section
        document.getElementById('decision-tracker').scrollIntoView({ behavior: 'smooth' });
        live('Pre-filled decision form with event relationship.');
    }
});

$('#createActionFromEvent').addEventListener('click', () => {
    if (currentEditingEvent) {
        // Close event dialog
        $('#eventDetailsDlg').close();
        
        // Pre-fill and open action dialog
        populateRelationshipDropdowns();
        $('#aTitle').value = `Action from: ${currentEditingEvent.title}`;
        $('#aRelatedEvent').value = currentEditingEvent.id;
        $('#aDue').value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 7 days from now
        
        $('#actionDlg').showModal();
        $('#aOwner').focus();
        live('Pre-filled action form with event relationship.');
    }
});

$('#createActionFromDecision').addEventListener('click', () => {
    // Get the most recently added decision or use form data
    const decisionTitle = $('#decTitle').value.trim();
    if (!decisionTitle) {
        live('Please add a decision title first.');
        return;
    }
    
    // Pre-fill and open action dialog
    populateRelationshipDropdowns();
    $('#aTitle').value = `Action from decision: ${decisionTitle}`;
    $('#aDue').value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 7 days from now
    
    // If there's a related event in the decision form, carry it over
    const relatedEvent = $('#decRelatedEvent').value;
    if (relatedEvent) {
        $('#aRelatedEvent').value = relatedEvent;
    }
    
    $('#actionDlg').showModal();
    $('#aOwner').focus();
    live('Pre-filled action form with decision relationship.');
});

// Update relationship dropdowns when forms are opened
const originalNewActionHandler = $('#newActionBtn').onclick;
$('#newActionBtn').addEventListener('click', () => {
    populateRelationshipDropdowns();
});

// Refresh timeline and dependency graph when items are added
const originalSaveActions = saveActions;
const originalSaveEvents = saveEvents;
const originalSaveDecisions = saveDecisions;

function saveActions() {
    originalSaveActions();
    if ($('#timelineContainer').style.display !== 'none') {
        renderTimeline();
    }
    if ($('#dependencyContainer').style.display !== 'none') {
        renderDependencyGraph();
    }
}

function saveEvents() {
    originalSaveEvents();
    if ($('#timelineContainer').style.display !== 'none') {
        renderTimeline();
    }
    if ($('#dependencyContainer').style.display !== 'none') {
        renderDependencyGraph();
    }
}

function saveDecisions() {
    originalSaveDecisions();
    if ($('#timelineContainer').style.display !== 'none') {
        renderTimeline();
    }
    if ($('#dependencyContainer').style.display !== 'none') {
        renderDependencyGraph();
    }
}

// Initialize Lucide icons
lucide.createIcons();