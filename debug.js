// --- APP STATE & LOGIC ---

class AppStore {
    constructor() {
        // Default State
        this.state = {
            version: 1,
            onboardingComplete: false,
            currentWeek: 1,
            vision: "Define your 12-week vision here...",
            goals: [
                // Example Goal structure for new users
                {
                    id: 'g1',
                    title: 'Launch MVP Website',
                    tactics: [
                        { id: 't1', title: 'Draft PRFAQ', completed: false },
                        { id: 't2', title: 'Set up Repo', completed: true }
                    ]
                }
            ],
            metrics: {
                wesHistory: [],
                lagLeadHandlers: {}
            },
            // New fields
            emotionalHistory: {}, // { weekNum: "Phase Name" }
            healthLogs: [], // { id, date, note, week }
            openWeeks: {} // { goalId: { weekNum: true } } - Moved to state for persistence
        };


        this.init();
    }

    init() {
        this.load();
        this.render();
        lucide.createIcons();

        if (!this.state.onboardingComplete) {
            this.startOnboarding();
        }

        // Auto-save on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.save();
        });
    }

    // --- PERSISTENCE ---
    save() {
        try {
            localStorage.setItem('sprintpulse_data', JSON.stringify(this.state));
        } catch (e) {
            console.error('Save failed', e);
            this.showModal("Storage Error", "Could not save data. LocalStorage might be full or disabled.", null);
        }
    }

    load() {
        const saved = localStorage.getItem('sprintpulse_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Simple migration/merge if needed, for now direct replace
                this.state = { ...this.state, ...parsed };
            } catch (e) { console.error('Load failed', e); }
        }
    }

    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state));
        const node = document.createElement('a');
        node.href = dataStr;
        node.download = `sprintpulse_week${this.state.currentWeek}.json`;
        node.click();
    }

    // --- CORE LOGIC ---

    // Goals
    addGoal() {
        const newGoal = {
            id: 'g' + Date.now(),
            title: '',
            tactics: []
        };
        this.state.goals.push(newGoal);
        this.save();
        this.render();

        // Focus the new goal input
        setTimeout(() => {
            const inputs = document.querySelectorAll(`input[data-goal-id="${newGoal.id}"]`);
            if (inputs.length > 0) inputs[0].focus();
        }, 50);
    }

    updateGoalTitle(id, newTitle) {
        const goal = this.state.goals.find(g => g.id === id);
        if (goal) {
            goal.title = newTitle;
            this.save();
        }
    }



    // Tactics
    addTactic(goalId) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            const newTactic = {
                id: 't' + Date.now(),
                title: '',
                completed: false
            };
            goal.tactics.push(newTactic);
            this.save();
            this.render();

            // Focus the new tactic input
            setTimeout(() => {
                const inputs = document.querySelectorAll(`input[data-tactic-id="${newTactic.id}"]`);
                if (inputs.length > 0) inputs[0].focus();
            }, 50);
        }
    }

    updateTacticTitle(goalId, tacticId, newTitle) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            const tactic = goal.tactics.find(t => t.id === tacticId);
            if (tactic) {
                tactic.title = newTitle;
                this.save();
            }
        }
    }

    toggleTactic(goalId, tacticId) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            const tactic = goal.tactics.find(t => t.id === tacticId);
            if (tactic) {
                tactic.completed = !tactic.completed;
                this.save();
                this.render(); // Re-render to update WES
            }
        }
    }

    removeTactic(goalId, tacticId) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            goal.tactics = goal.tactics.filter(t => t.id !== tacticId);
            this.save();
            this.render();
        }
    }

    // Calculations
    calculateWES() {
        let total = 0;
        let completed = 0;
        this.state.goals.forEach(g => {
            g.tactics.forEach(t => {
                // Filter by current week
                if ((t.week || 1) == this.state.currentWeek) {
                    total++;
                    if (t.completed) completed++;
                }
            });
        });
        return total === 0 ? 0 : Math.round((completed / total) * 100);
    }

    evaluateEmotionalPhase() {
        // If user manually set it for this week, use that
        if (this.state.emotionalHistory && this.state.emotionalHistory[this.state.currentWeek]) {
            return { phase: this.state.emotionalHistory[this.state.currentWeek], msg: "" };
        }
        // Default fallback
        return { phase: "Peaceful", msg: "Select your emotional state." };
    }

    setEmotionalPhase(phase) {
        if (!this.state.emotionalHistory) this.state.emotionalHistory = {};
        this.state.emotionalHistory[this.state.currentWeek] = phase;
        this.save();
        this.render(); // Update both Dashboard and Review
    }

    addHealthLog() {
        const input = document.getElementById('health-note-input');
        const note = input.value;
        if (note) {
            if (!this.state.healthLogs) this.state.healthLogs = [];
            this.state.healthLogs.unshift({
                id: 'h' + Date.now(),
                date: new Date().toLocaleDateString(),
                week: this.state.currentWeek,
                note: note
            });
            input.value = '';
            this.save();
            this.renderReview(); // Re-render review tab to show new log
        }
    }

    removeHealthLog(id) {
        if (this.state.healthLogs) {
            this.state.healthLogs = this.state.healthLogs.filter(h => h.id !== id);
            this.save();
            this.renderReview();
        }
    }

    // --- DUE DATES (New Feature) ---
    addDueDate() {
        if (!this.state.dueDates) this.state.dueDates = [];
        const id = 'ddl_' + Date.now();
        this.state.dueDates.push({
            id: id,
            title: '',
            type: '',
            duration: ''
        });
        this.save();
        this.renderDashboard();
    }

    updateDueDate(id, field, value) {
        const item = this.state.dueDates.find(d => d.id === id);
        if (item) {
            item[field] = value;
            this.save();
            // No need to re-render entire dashboard for simple input changes if we used onchange,
            // but for simplicity we can, or just let it stay. 
            // To be safe and keep it simple:
            this.save();
        }
    }

    removeDueDate(id) {
        this.state.dueDates = this.state.dueDates.filter(d => d.id !== id);
        this.save();
        this.renderDashboard();
    }

    updateVision(newVal) {
        this.state.vision = newVal;
        this.save();
        // Should update dashboard view if logical, but currently on Plan tab.
        // It will update when tab switches.
    }

    // --- ONBOARDING MANAGER ---
    startOnboarding() {
        document.getElementById('onboarding-modal').classList.add('open');
        this.onboardingStep = 0;
        this.renderOnboardingStep();
    }

    renderOnboardingStep() {
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const btn = document.querySelector('#onboarding-modal .btn-primary');

        if (this.onboardingStep === 0) {
            title.textContent = "Welcome to the 12 Week Year";
            body.innerHTML = "<p>Most people overestimate what they can do in a day, but underestimate what they can do in 12 weeks.</p><p>This system replaces 'annualized thinking' with a 12-week execution sprint.</p>";
            btn.textContent = "Next: Define Vision";
            btn.onclick = () => { this.onboardingStep++; this.renderOnboardingStep(); };
        } else if (this.onboardingStep === 1) {
            title.textContent = "Step 1: Your Vision";
            body.innerHTML = `<p>What do you want to achieve in 12 weeks? Be specific.</p><textarea id="ob-vision" style="width:100%; height:80px; margin-top:10px; padding:8px;">${this.state.vision}</textarea>`;
            btn.textContent = "Next: Set First Goal";
            btn.onclick = () => {
                const v = document.getElementById('ob-vision').value;
                if (v) this.state.vision = v;
                this.onboardingStep++;
                this.renderOnboardingStep();
            };
        } else if (this.onboardingStep === 2) {
            title.textContent = "Step 2: Your First Goal";
            body.innerHTML = `<p>Create one major goal that aligns with your vision.</p><input id="ob-goal" type="text" placeholder="e.g. Write 5 chapters" style="width:100%; padding:8px; margin-top:10px;">`;
            btn.textContent = "Ready to Start";
            btn.onclick = () => {
                const g = document.getElementById('ob-goal').value;
                if (g) {
                    this.state.goals = [{ id: 'g1', title: g, tactics: [] }];
                } else {
                    this.state.goals = [];
                }
                this.completeOnboarding();
            };
        }
    }

    completeOnboarding() {
        this.state.onboardingComplete = true;
        this.save();
        document.getElementById('onboarding-modal').classList.remove('open');
        this.render();
    }

    // --- UI RENDERERS ---
    render() {
        this.renderDashboard();
        this.renderPlan();
        this.renderExecution();
        this.renderReview();
        this.renderHourlyPlanner();
        lucide.createIcons();
    }

    renderDashboard() {
        document.getElementById('dash-vision').textContent = this.state.vision;
        document.getElementById('dash-week-display').textContent = `Week ${this.state.currentWeek} of 12`;

        // WES
        const score = this.calculateWES();
        const scoreEl = document.getElementById('dash-wes-val');
        const msgEl = document.getElementById('dash-wes-msg');

        scoreEl.textContent = score + '%';
        scoreEl.className = 'wes-display ' + (score >= 85 ? 'wes-good' : score >= 65 ? 'wes-warn' : 'wes-bad');

        if (score >= 85) msgEl.textContent = "Excellent! Statistically likely to hit goals.";
        else if (score >= 65) msgEl.textContent = "Keep pushing. Focus on high-impact tactics.";
        else msgEl.textContent = "Lagging behind. Reclaim your calendar.";

        // Emotional Phase
        const emo = this.evaluateEmotionalPhase();
        document.getElementById('dash-emo-phase').textContent = emo.phase;
        document.getElementById('dash-emo-phase').textContent = emo.phase;
        document.getElementById('dash-emo-msg').textContent = emo.msg;

        // Due Dates
        const ddContainer = document.getElementById('dash-due-dates');
        if (ddContainer) {
            const dates = this.state.dueDates || [];
            if (dates.length === 0) {
                ddContainer.innerHTML = '<div class="text-sub text-sm">No due dates added.</div>';
            } else {
                ddContainer.innerHTML = dates.map(d => `
                            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center;">
                                <input type="text" class="seamless-input" placeholder="Task / Deadline" value="${d.title}" onchange="app.updateDueDate('${d.id}', 'title', this.value)">
                                <input type="text" class="seamless-input" placeholder="Type" value="${d.type}" onchange="app.updateDueDate('${d.id}', 'type', this.value)">
                                <input type="text" class="seamless-input" placeholder="Hours needed?" value="${d.duration}" onchange="app.updateDueDate('${d.id}', 'duration', this.value)">
                                <button class="text-sub" onclick="app.removeDueDate('${d.id}')"><i data-lucide="trash-2" size="14"></i></button>
                            </div>
                        `).join('');
                lucide.createIcons();
            }
        }
    }

    renderPlan() {
        // Render Vision Input logic
        const visInput = document.getElementById('plan-vision-input');
        if (visInput) {
            visInput.value = this.state.vision;
        }

        const container = document.getElementById('plan-goals-container');
        container.innerHTML = '';

        this.state.goals.forEach(goal => {
            const el = document.createElement('div');
            el.className = 'card';
            el.style.marginBottom = '24px';

            // Header
            let html = `
                        <div class="flex-between" style="margin-bottom:16px;">
                            <div style="flex-grow:1; display:flex; align-items:center; gap:8px;">
                                <i data-lucide="flag" size="20" class="text-sub"></i>
                                <input type="text" 
                                    class="seamless-input" 
                                    style="font-size:1.25rem; font-weight:700; color:var(--primary-red);" 
                                    value="${goal.title}" 
                                    placeholder="Enter Goal Title..."
                                    data-goal-id="${goal.id}"
                                    onchange="app.updateGoalTitle('${goal.id}', this.value)">
                            </div>
                            <div style="flex-shrink:0;">
                                <button class="btn btn-secondary text-sm" onclick="app.addTactic('${goal.id}', null, true)">+ Add Recurring (All Weeks)</button>
                                <button class="btn btn-outline text-sm" onclick="app.removeGoal('${goal.id}')" style="margin-left:8px; border:none; color: #999;">
                                    <i data-lucide="trash-2" size="16"></i>
                                </button>
                            </div>
                        </div>
                    `;

            // Weekly Accordion
            html += '<div class="weekly-accordion" style="display:flex; flex-direction:column; gap:8px;">';

            for (let w = 1; w <= 12; w++) {
                const tactics = goal.tactics.filter(t => (t.week || 1) == w);

                // Use state.openWeeks for persistence
                // HARDENING: ensure we use string keys for robustness
                if (!this.state.openWeeks) this.state.openWeeks = {}; // Ensure root exists
                const goalOpenState = this.state.openWeeks[goal.id] || {};
                const wKey = String(w);
                const isOpen = goalOpenState[wKey];

                // Debug Log (Temporary)
                // console.log(`Rendering Goal ${goal.id} Week ${w} (${wKey}): isOpen = ${isOpen}`);

                html += `
                        <div style="border:1px solid #eee; border-radius:8px; overflow:hidden;"
                             ondragover="app.allowDrop(event)" 
                             ondrop="app.dropWeek(event, '${goal.id}', ${w})">
                            <div class="flex-between" style="padding:10px 16px; background:${isOpen ? '#fff0f0' : '#fafafa'}; cursor:pointer;" onclick="app.toggleWeekAccordion('${goal.id}', ${w})">
                                <span style="font-weight:600; font-size:0.9rem; color:${isOpen ? 'var(--primary-red)' : '#666'};">Week ${w}</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="text-sub text-sm">${tactics.length} tactics</span>
                                    <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" size="16"></i>
                                </div>
                            </div>
                            <div id="accordion-${goal.id}-w${w}" style="display:${isOpen ? 'block' : 'none'}; padding:16px; background:#fff; border-top:1px solid #eee;">
                                ${tactics.map((t, idx) => `
                                    <div class="flex-between tactic-row" 
                                         style="padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.05);"
                                         ondragover="app.allowDrop(event)"
                                         ondrop="app.drop(event, '${goal.id}', ${w}, '${t.id}')">
                                            <div style="flex-grow:1; display:flex; align-items:center; gap:12px;">
                                                <div style="cursor:grab; color:#ccc; display:flex; align-items:center; padding:4px;"
                                                     draggable="true"
                                                     ondragstart="app.dragStart(event, '${goal.id}', ${w}, '${t.id}')">
                                                    <!-- Fallback to SVG directly if lucide fails to init quickly -->
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                                </div>
                                                <input type="text" 
                                                    class="seamless-input" 
                                                    value="${t.title}" 
                                                    placeholder="Enter tactic..."
                                                    onchange="app.updateTacticTitle('${goal.id}', '${t.id}', this.value)">
                                            </div>
                                            <button class="text-sub" onclick="app.removeTactic('${goal.id}', '${t.id}')" style="padding:4px;"><i data-lucide="x" size="14"></i></button>
                                        </div>
                                    `).join('')}
                                    
                                    <div style="margin-top:12px; display:flex; gap:8px;">
                                        <input type="text" id="new-tactic-${goal.id}-w${w}" 
                                            class="seamless-input" 
                                            placeholder="+ Add new tactic..." 
                                            style="background:#f9f9f9;"
                                            onkeydown="if(event.key==='Enter') app.addTactic('${goal.id}', ${w}, false, this.value)">
                                        <button class="btn btn-secondary text-sm" style="padding:4px 12px;"
                                            onclick="app.addTactic('${goal.id}', ${w}, false, document.getElementById('new-tactic-${goal.id}-w${w}').value)">
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
            }
            html += '</div>';

            el.innerHTML = html;
            container.appendChild(el);
        });

        const addGoalWrapper = document.createElement('div');
        addGoalWrapper.style.textAlign = 'center';
        addGoalWrapper.style.marginTop = '24px';
        addGoalWrapper.innerHTML = `<button class="btn btn-secondary" onclick="app.addGoal()">+ Add New Goal</button>`;
        container.appendChild(addGoalWrapper);

        // Ensure icons are created immediately
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            console.error("Lucide not found");
        }
    }

    toggleWeekAccordion(goalId, week) {
        console.log("Toggle called for", goalId, week);
        // Initialize if needed
        if (!this.state.openWeeks) this.state.openWeeks = {};
        if (!this.state.openWeeks[goalId]) this.state.openWeeks[goalId] = {};

        const wKey = String(week);

        // Toggle
        this.state.openWeeks[goalId][wKey] = !this.state.openWeeks[goalId][wKey];

        console.log(`Toggling Goal ${goalId} Week ${wKey} -> ${this.state.openWeeks[goalId][wKey]}`);

        this.save(); // Save state so it survives reloads!
        this.renderPlan();
    }



    removeGoal(id) {
        this.showModal(
            "Delete Goal?",
            "Are you sure you want to delete this goal and all its tactics?",
            () => {
                this.state.goals = this.state.goals.filter(g => g.id !== id);
                this.save();
                this.render();
            },
            true,
            "Delete"
        );
    }

    addTactic(goalId, week, isRecurring, optionalTitle) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (!goal) return;

        // 1. Direct Add (Inline Input)
        if (optionalTitle) {
            this._createTactic(goal, week, isRecurring, optionalTitle);
            return;
        }

        // 2. Button Clicked (Recurring or Empty) -> Show Modal Input
        if (isRecurring) {
            const html = `
                <p>Enter tactic to repeat across all 12 weeks:</p>
                <input id="app-modal-input" type="text" class="seamless-input" 
                       style="border:1px solid #e0e0e0; background:#f9f9f9; padding:12px; margin-top:12px; width:100%; border-radius:8px;"
                       placeholder="e.g. Read 10 pages">
            `;
            this.showModal(
                "Add Recurring Tactic",
                html,
                (val) => {
                    if (val) this._createTactic(goal, week, true, val);
                },
                true,
                "Add Tactic"
            );
            return;
        }

        // Legacy/Fallback for empty non-recurring calls
        if (!optionalTitle && !isRecurring) {
            const html = `
                <p>Enter tactic for Week ${week}:</p>
                <input id="app-modal-input" type="text" class="seamless-input" 
                       style="border:1px solid #e0e0e0; background:#f9f9f9; padding:12px; margin-top:12px; width:100%; border-radius:8px;"
                       placeholder="Enter tactic...">
            `;
            this.showModal(
                "Add Tactic",
                html,
                (val) => {
                    if (val) this._createTactic(goal, week, false, val);
                },
                true,
                "Add Tactic"
            );
        }
    }

    _createTactic(goal, week, isRecurring, title) {
        if (!title) return;

        if (isRecurring) {
            // Generator: Create 12 tactics
            for (let w = 1; w <= 12; w++) {
                goal.tactics.push({
                    id: 't' + Date.now() + '_w' + w,
                    title: title,
                    completed: false,
                    week: w
                });
            }
        } else {
            goal.tactics.push({
                id: 't' + Date.now(),
                title: title,
                completed: false,
                week: week
            });
        }

        // AUTO-OPEN TARGET WEEK
        if (week && !isRecurring) {
            if (!this.state.openWeeks) this.state.openWeeks = {};
            if (!this.state.openWeeks[goal.id]) this.state.openWeeks[goal.id] = {};

            const wKey = String(week);
            this.state.openWeeks[goal.id][wKey] = true;
        }

        this.save();
        this.render();

        // Focus strategy for inline inputs
        if (!isRecurring) {
            setTimeout(() => {
                const params = document.getElementById(`new-tactic-${goal.id}-w${week}`);
                if (params) {
                    params.value = ''; // Clear the input
                    params.focus();
                }
            }, 50);
        }
    }

    // --- DRAG AND DROP HANDLERS ---
    dragStart(ev, goalId, week, tacticId) {
        console.log("Drag Start:", goalId, week, tacticId);
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData("text/plain", JSON.stringify({ goalId, week, tacticId }));
        // Visual feedback
        ev.target.parentNode.parentNode.style.opacity = '0.5';
        // Note: ev.target is the handle. parentNode is div-flex-center. parentNode.parentNode is the tactic-row. 
        // It's safer to just set opacity on the handle or find the row.
    }

    allowDrop(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
    }

    drop(ev, targetGoalId, targetWeek, targetTacticId) {
        console.log("Drop Item:", targetGoalId, targetWeek, targetTacticId);
        ev.preventDefault();
        ev.stopPropagation(); // Stop bubbling to week drop
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));

        // Restore opacity if we could reference the source... difficult in drop without ID query.
        // We'll rely on render reset.

        this.handleTacticMove(data, { goalId: targetGoalId, week: targetWeek, tacticId: targetTacticId });
    }

    dropWeek(ev, targetGoalId, targetWeek) {
        console.log("Drop Week:", targetGoalId, targetWeek);
        ev.preventDefault();
        const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        // Dropped on the week container (empty space or header) -> Move to end of week
        this.handleTacticMove(data, { goalId: targetGoalId, week: targetWeek, tacticId: null });
    }

    handleTacticMove(src, target) {
        // Find Source Goal
        const sGoal = this.state.goals.find(g => g.id === src.goalId);
        if (!sGoal) return;
        const sTacticIndex = sGoal.tactics.findIndex(t => t.id === src.tacticId);
        if (sTacticIndex === -1) return;

        const tacticToMove = sGoal.tactics[sTacticIndex];

        // Remove from source
        sGoal.tactics.splice(sTacticIndex, 1);

        // Update Tactic Week
        tacticToMove.week = target.week;

        // Find Target Goal
        const tGoal = this.state.goals.find(g => g.id === target.goalId);
        // Note: Multi-goal drag support? Yes, we found goal objects separately.

        if (target.tacticId) {
            // Insert before target tactic
            const tTacticIndex = tGoal.tactics.findIndex(t => t.id === target.tacticId);
            // If moving within same list and we removed first, indices might shift?
            // But we spliced the object out of the array reference.
            // IMPORTANT: If sGoal === tGoal, `tGoal.tactics` is the same array we just spliced.
            // So we must re-find index.

            const newIndex = tGoal.tactics.findIndex(t => t.id === target.tacticId);
            if (newIndex !== -1) {
                tGoal.tactics.splice(newIndex, 0, tacticToMove);
            } else {
                tGoal.tactics.push(tacticToMove); // Fallback
            }
        } else {
            // Append to end of target week list
            // But `tGoal.tactics` is a flat list of ALL weeks. We want it at the end of THIS week's group?
            // Actually, order in the array determines render order. 
            // So we need to find the last index of that week and insert after it.

            const weekTactics = tGoal.tactics.filter(t => (t.week || 1) == target.week);
            if (weekTactics.length > 0) {
                const lastTactic = weekTactics[weekTactics.length - 1];
                const lastIndex = tGoal.tactics.indexOf(lastTactic);
                tGoal.tactics.splice(lastIndex + 1, 0, tacticToMove);
            } else {
                // No tactics in this week yet, just push?
                // We should push, but maybe we need to respect overall sort? 
                // The current render just filters, so array position matters only relative to others in same filter.
                tGoal.tactics.push(tacticToMove);
            }
        }

        this.save();
        this.render();
    }

    removeTactic(goalId, tacticId) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            goal.tactics = goal.tactics.filter(t => t.id !== tacticId);
            this.save();
            this.render();
        }
    }

    updateTacticTitle(goalId, tacticId, title) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            const t = goal.tactics.find(t => t.id === tacticId);
            if (t) {
                t.title = title;
                // If it was a recurring one, should we update others? 
                // With Generator strategy, they are independent. Updating one updates only that week's.
                // This is actually safer for history. If I change W5's tactic, W1's historical record remains.
                this.save();
            }
        }
    }

    toggleTactic(goalId, tacticId) {
        const goal = this.state.goals.find(g => g.id === goalId);
        if (goal) {
            const t = goal.tactics.find(t => t.id === tacticId);
            if (t) {
                t.completed = !t.completed;
                this.save();
                this.render();
            }
        }
    }

    renderExecution() {
        const container = document.getElementById('execution-list');
        container.innerHTML = '';

        if (this.state.goals.length === 0) {
            container.innerHTML = `<div class="card text-sub text-center">No goals set.</div>`;
            // return; // Don't return early so we still render the side panel logic if needed
        } else {
            this.state.goals.forEach(goal => {
                // Filter tactics for the current week
                const currentWeekTactics = goal.tactics.filter(t => (t.week || 1) === this.state.currentWeek);

                if (currentWeekTactics.length === 0) return;

                const group = document.createElement('div');
                group.className = 'card';
                group.style.marginBottom = '16px';
                group.innerHTML = `<h4 style="margin-bottom:12px; font-size:0.9rem; color:var(--accent-orange);">${goal.title}</h4>`;

                currentWeekTactics.forEach(t => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.padding = '8px 0';
                    row.style.borderBottom = '1px solid #f9f9f9';

                    row.innerHTML = `
                                <input type="checkbox" ${t.completed ? 'checked' : ''} 
                                       style="width:20px; height:20px; margin-right:12px; cursor:pointer;"
                                       onchange="app.toggleTactic('${goal.id}', '${t.id}')">
                                <span style="flex:1; ${t.completed ? 'text-decoration:line-through; opacity:0.4;' : ''}">${t.title}</span>
                            `;
                    group.appendChild(row);
                });
                container.appendChild(group);
            });
        }

        // Bind Indicator Inputs
        // We assume there are inputs with specific IDs or we render them here. 
        // In the HTML I created earlier, they didn't have specific IDs, so I should probably select them by placeholder or add IDs.
        // Better approach: Re-render that side panel or bind events if they exist.
        // Actually, I'll access them via the DOM if they are static in the HTML.
        // But wait, the previous HTML had them static. Let's look at the identifiers.
        // They were: <input type="text" placeholder="e.g. Revenue ($)" ...>
        // I will add IDs to them in a separate step or just querySelector them.
        // Let's assume for this step I will inject IDs or find them.

        const inputs = document.querySelectorAll('#tab-execution input[type="text"]');
        if (inputs.length >= 2) {
            inputs[0].value = this.state.metrics[`week${this.state.currentWeek}_lag`] || '';
            inputs[0].onchange = (e) => this.updateMetric('lag', e.target.value);

            inputs[1].value = this.state.metrics[`week${this.state.currentWeek}_lead`] || '';
            inputs[1].onchange = (e) => this.updateMetric('lead', e.target.value);
        }
    }

    updateMetric(type, value) {
        this.state.metrics[`week${this.state.currentWeek}_${type}`] = value;
        this.save();
    }

    renderReview() {
        // ... Existing chart logic will be handled by Chart.js update ... but we need to ensure the container is ready
        if (document.getElementById('review-week-num')) {
            document.getElementById('review-week-num').textContent = this.state.currentWeek;
        }

        // Show Strategic Hours for specific historical weeks? 
        // Using the requested format: "X hours in week X used strategically"
        // We'll append this to score history card or a new location.
        // Let's put it under the chart title or in the details.
        // Actually, let's create a list of past weeks' stats.
        const historyContainer = document.getElementById('review-history-stats');
        if (!historyContainer) {
            // Inject container if missing (hacky but works if html structure is strict)
            // Better: Update HTML structure in a separate pass? 
            // Let's just find the Score History card and append.
            const card = document.querySelector('#wesChart').parentElement;
            let statsDiv = card.querySelector('.strat-stats');
            if (!statsDiv) {
                statsDiv = document.createElement('div');
                statsDiv.className = 'strat-stats';
                statsDiv.style.marginTop = '16px';
                statsDiv.style.borderTop = '1px solid #eee';
                statsDiv.style.paddingTop = '16px';
                card.appendChild(statsDiv);
            }

            const history = this.state.metrics.wesHistory || [];
            if (history.length === 0) {
                statsDiv.innerHTML = '<div class="text-sub text-sm">No history yet.</div>';
            } else {
                statsDiv.innerHTML = history.map(h =>
                    `<div class="text-sm" style="margin-bottom:4px;">
                                <span style="font-weight:600; color:var(--primary-red);">${h.strategicHours || 0} hours</span> 
                                in Week ${h.week} used strategically.
                            </div>`
                ).join('');
            }
        }

        // --- Emotional Selector ---
        // --- Emotional Selector ---
        const phases = ["Amazed", "Peaceful", "Passionate", "Frustrated", "Purposeless", "Depressed"];
        const currentPhase = this.evaluateEmotionalPhase().phase; // This gets saved or default

        const selContainer = document.getElementById('emotional-selector');
        if (selContainer) {
            selContainer.innerHTML = phases.map(p => {
                const active = p === currentPhase;
                return `
                            <button onclick="app.setEmotionalPhase('${p}')" class="emo-btn ${active ? 'active' : ''}">
                                ${p} ${active ? '<i data-lucide="check" size="16"></i>' : ''}
                            </button>
                        `;
            }).join('');
            lucide.createIcons();
        }

        // --- Health Logs ---
        const logContainer = document.getElementById('health-log-list');
        const logs = (this.state.healthLogs || []).filter(h => h.week === this.state.currentWeek);

        if (logContainer) {
            if (logs.length === 0) {
                logContainer.innerHTML = '<div class="text-sub text-sm">No notes for this week.</div>';
            } else {
                logContainer.innerHTML = logs.map(l => `
                            <div style="padding:8px; margin-bottom:8px; background:white; border:1px solid #eee; border-radius:8px; font-size:0.9rem;">
                                <div class="flex-between">
                                    <span class="text-sub text-sm">${l.date}</span>
                                    <button class="text-sub" onclick="app.removeHealthLog('${l.id}')"><i data-lucide="x" size="12"></i></button>
                                </div>
                                <div style="margin-top:4px;">${l.note}</div>
                            </div>
                        `).join('');
            }
        }

        // Chart.js WES
        this.updateWesChart();
        lucide.createIcons();
    }

    updateWesChart() {
        const ctx = document.getElementById('wesChart');
        if (!ctx) return;

        // Destroy old instance if exists
        if (window.myWesChart) window.myWesChart.destroy();

        const wesData = this.state.metrics.wesHistory || [];

        // Labels should match the data points exactly
        const labels = wesData.map(d => `W${d.week}`);
        const dataPoints = wesData.map(d => d.score);

        window.myWesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Execution Score',
                    data: dataPoints,
                    borderColor: '#D0021B',
                    backgroundColor: 'rgba(208, 2, 27, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { min: 0, max: 100 }
                }
            }
        });
    }



    toggleTimeBlock(id) {
        if (!this.state.modelWeek) this.state.modelWeek = {};

        // Updated types per user request: plan, action, breakout
        const types = ['empty', 'plan', 'action', 'breakout'];
        const current = this.state.modelWeek[id] || 'empty';
        // Handle migration from old keys if necessary by defaulting unknown to empty or mapping?
        // Simple switch: if current is old key, it resets to 'plan' (index 1).
        let idx = types.indexOf(current);
        if (idx === -1) idx = 0;

        const next = types[(idx + 1) % types.length];

        this.state.modelWeek[id] = next;
        this.save();
        this.renderHourlyPlanner();
    }

    calculateStrategicHours() {
        if (!this.state.modelWeek) return 0;
        // Each block is 1 hour? Assuming grid 5 days x hours.
        // Count values === 'action' (formerly strategic)
        return Object.values(this.state.modelWeek).filter(v => v === 'action').length;
    }

    completeWeek() {
        this.showModal(
            "Complete Week?",
            `Finish Week ${this.state.currentWeek}? This will lock current stats for this week.`,
            () => {
                // 1. Archive Stats
                const existingEntryIndex = this.state.metrics.wesHistory.findIndex(h => h.week === this.state.currentWeek);

                const entry = {
                    week: this.state.currentWeek,
                    score: this.calculateWES(),
                    strategicHours: this.calculateStrategicHours(),
                    lag: this.state.metrics[`week${this.state.currentWeek}_lag`],
                    lead: this.state.metrics[`week${this.state.currentWeek}_lead`]
                };

                if (existingEntryIndex >= 0) {
                    this.state.metrics.wesHistory[existingEntryIndex] = entry;
                } else {
                    this.state.metrics.wesHistory.push(entry);
                }

                this.save();

                // 2. Increment Week
                if (this.state.currentWeek < 12) {
                    this.state.currentWeek++;
                    this.render();
                    setTimeout(() => {
                        this.showModal("Level Up", "Welcome to Week " + this.state.currentWeek, null);
                    }, 300);
                } else {
                    this.state.currentWeek = 13;
                    this.render();
                    setTimeout(() => {
                        this.showModal("Sprint Complete", "🎉 CONGRATULATIONS! You completed the 12 Week Year!", null);
                    }, 300);
                }
            },
            true,
            "Complete"
        );
    }

    // Renamed from renderResources
    renderHourlyPlanner() {
        const container = document.getElementById('hourly-planner-grid');
        if (!container) return;

        // 7 Days (Mon-Sun) x 16 Hours (8am-12am)
        const hours = 17;
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        let html = '<div style="display:grid; grid-template-columns: 40px repeat(7, 1fr); gap:4px;">';

        // Headers
        html += '<div></div>'; // Corner
        days.forEach(d => html += `<div class="text-center text-sm text-sub" style="font-weight:600; padding-bottom:8px;">${d}</div>`);

        for (let h = 0; h < 16; h++) {
            const timeLabel = (8 + h) + ':00';
            html += `<div class="text-sub text-xs text-right" style="padding-right:8px; transform:translateY(6px);">${timeLabel}</div>`;

            for (let d = 0; d < 7; d++) {
                const id = `d${d}-h${h}`;
                const type = (this.state.modelWeek && this.state.modelWeek[id]) ? this.state.modelWeek[id] : 'empty';
                let color = '#f5f5f5';
                let textColor = 'black';

                // Mappings: 
                // Plan (buffer) -> Grey
                // Action (strategic) -> Red
                // Breakout -> Orange
                if (type === 'plan') { color = '#ddd'; textColor = '#555'; }
                if (type === 'action') { color = 'var(--primary-red)'; textColor = 'white'; }
                if (type === 'breakout') { color = '#F5A623'; textColor = 'white'; }

                // Handle legacy data or fallback
                if (type === 'strategic') { color = 'var(--primary-red)'; textColor = 'white'; } // legacy
                if (type === 'buffer') { color = '#ddd'; textColor = '#555'; } // legacy

                const label = type === 'empty' ? '' : type.charAt(0).toUpperCase();

                html += `
                            <div onclick="app.toggleTimeBlock('${id}')" 
                                 style="height:35px; background:${color}; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:${textColor}; font-size:0.75rem; font-weight:600; user-select:none; transition: all 0.1s ease;">
                                ${label}
                            </div>
                        `;
            }
        }
        html += '</div>';

        // Legend
        html += `
                    <div style="display:flex; gap:24px; margin-top:24px; justify-content:center;">
                        <div style="display:flex; align-items:center; gap:6px;"><div style="width:16px; height:16px; background:#ddd; border-radius:4px;"></div><span class="text-sm font-medium">Plan</span></div>
                        <div style="display:flex; align-items:center; gap:6px;"><div style="width:16px; height:16px; background:var(--primary-red); border-radius:4px;"></div><span class="text-sm font-medium">Action</span></div>
                        <div style="display:flex; align-items:center; gap:6px;"><div style="width:16px; height:16px; background:#F5A623; border-radius:4px;"></div><span class="text-sm font-medium">Breakout</span></div>
                    </div>
                `;

        container.innerHTML = html;
    }

    resetData() {
        this.showModal(
            "Start Over?",
            "DANGER: This will delete ALL your goals, vision, and history.<br><br>Are you sure?",
            () => {
                // key correction: prevent auto-save from writing old data back during reload
                this.save = () => { };
                localStorage.removeItem('sprintpulse_data');
                location.reload();
            },
            true,
            "Reset Everything"
        );
    }

    switchTab(tabId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        document.getElementById(`tab-${tabId}`).classList.add('active');

        if (tabId === 'dashboard') this.renderDashboard();
        if (tabId === 'plan') this.renderPlan();
        if (tabId === 'execution') this.renderExecution();
        if (tabId === 'resources') this.renderHourlyPlanner();
        if (tabId === 'review') this.renderReview();

        const btns = document.querySelectorAll('.tab-btn');
        btns.forEach(b => {
            if (b.onclick.toString().includes(tabId)) b.classList.add('active');
        });
    }
    showModal(title, htmlContent, onConfirm, showCancel = false, confirmText = "OK") {
        const modal = document.getElementById('app-modal');
        if (!modal) return;

        document.getElementById('app-modal-title').textContent = title;
        document.getElementById('app-modal-body').innerHTML = htmlContent;

        const btnConfirm = document.getElementById('app-modal-confirm');
        const btnCancel = document.getElementById('app-modal-cancel');

        btnConfirm.textContent = confirmText;

        // Clone to clear listeners
        const newConfirm = btnConfirm.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        newConfirm.onclick = () => {
            // If there is an input in the modal, we might want to validate it? 
            // For now, simpler is better.
            const input = document.getElementById('app-modal-input');
            const value = input ? input.value : true;

            modal.classList.remove('open');
            if (onConfirm) onConfirm(value);
        };

        if (showCancel) {
            newCancel.style.display = 'inline-block';
            newCancel.onclick = () => {
                modal.classList.remove('open');
            };
        } else {
            newCancel.style.display = 'none';
        }

        modal.classList.add('open');

        // Auto focus input if present
        const input = document.getElementById('app-modal-input');
        if (input) setTimeout(() => input.focus(), 50);
    }
}

// Initialize App
let app;
try {
    app = new AppStore();
} catch (e) {
    alert("App Error: " + e.message + "\n" + e.stack);
    console.error(e);
}

// Helper for tabs class toggling
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
        tabBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

