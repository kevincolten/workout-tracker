// Workout Tracker PWA - Main Application

// ==========================================
// Configuration & Default Data
// ==========================================

const WEIGHT_INCREMENT = 2.5;

const DEFAULT_WORKOUTS = {
    pull: {
        name: "Pull",
        exercises: [
            { id: "deadlift", name: "Deadlift", defaultSets: 3, defaultReps: 5 },
            { id: "pullup", name: "Pullup", defaultSets: 3, defaultReps: 8 },
            { id: "seated-cable-row", name: "Seated Cable Row", defaultSets: 3, defaultReps: 10 },
            { id: "lat-pulldown", name: "Lat Pulldown", defaultSets: 3, defaultReps: 10 },
            { id: "hammer-curl", name: "Hammer Curl", defaultSets: 3, defaultReps: 12 },
            { id: "curl", name: "Curl", defaultSets: 3, defaultReps: 12 }
        ]
    },
    push: {
        name: "Push",
        exercises: [
            { id: "bench-press", name: "Bench Press", defaultSets: 3, defaultReps: 8 },
            { id: "overhead-press", name: "Overhead Press", defaultSets: 3, defaultReps: 8 },
            { id: "incline-bench-press", name: "Incline Bench Press", defaultSets: 3, defaultReps: 10 },
            { id: "tricep-pushdown", name: "Tricep Pushdown", defaultSets: 3, defaultReps: 12 },
            { id: "lateral-raise", name: "Lateral Raise", defaultSets: 3, defaultReps: 15 },
            { id: "side-lateral-raise", name: "Side Lateral Raise", defaultSets: 3, defaultReps: 15 },
            { id: "overhead-triceps-extension", name: "Overhead Triceps Extension", defaultSets: 3, defaultReps: 12 }
        ]
    },
    legs: {
        name: "Legs",
        exercises: [
            { id: "squat", name: "Squat", defaultSets: 3, defaultReps: 8 },
            { id: "romanian-deadlift", name: "Romanian Deadlift", defaultSets: 3, defaultReps: 10 },
            { id: "leg-press", name: "Leg Press", defaultSets: 3, defaultReps: 12 },
            { id: "leg-curl", name: "Leg Curl", defaultSets: 3, defaultReps: 12 },
            { id: "calf-raise", name: "Calf Raise", defaultSets: 4, defaultReps: 15 },
            { id: "glute-drive", name: "Glute Drive", defaultSets: 3, defaultReps: 12 }
        ]
    }
};

// ==========================================
// State Management
// ==========================================

let state = {
    npointId: localStorage.getItem('npointId') || null,
    currentWorkout: 'pull',
    workoutHistory: [],
    currentSession: {},
    exerciseOrder: JSON.parse(localStorage.getItem('exerciseOrder') || '{}'),
    editingWorkout: null,
    isReordering: false
};

// ==========================================
// DOM Elements
// ==========================================

const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    sections: {
        pull: document.getElementById('pull-section'),
        push: document.getElementById('push-section'),
        legs: document.getElementById('legs-section'),
        records: document.getElementById('records-section')
    },
    exercises: {
        pull: document.getElementById('pull-exercises'),
        push: document.getElementById('push-exercises'),
        legs: document.getElementById('legs-exercises')
    },
    npointSetup: document.getElementById('npoint-setup'),
    npointInput: document.getElementById('npoint-id'),
    saveNpointBtn: document.getElementById('save-npoint'),
    syncBtn: document.getElementById('sync-btn'),
    syncIndicator: document.getElementById('sync-indicator'),
    syncText: document.getElementById('sync-text'),
    finishBtn: document.getElementById('finish-workout'),
    historyBtn: document.getElementById('view-history'),
    historyModal: document.getElementById('history-modal'),
    historyContent: document.getElementById('history-content'),
    closeHistoryBtn: document.getElementById('close-history'),
    toast: document.getElementById('toast'),
    workoutActions: document.getElementById('workout-actions'),
    recordsContent: document.getElementById('records-content'),
    editModal: document.getElementById('edit-modal'),
    editContent: document.getElementById('edit-content'),
    exerciseHistoryModal: document.getElementById('exercise-history-modal'),
    exerciseHistoryContent: document.getElementById('exercise-history-content'),
    exerciseHistoryTitle: document.getElementById('exercise-history-title')
};

// ==========================================
// npoint.io API
// ==========================================

const npointAPI = {
    baseUrl: 'https://api.npoint.io',
    async fetch() {
        if (!state.npointId) return null;
        try {
            const response = await fetch(`${this.baseUrl}/${state.npointId}`);
            if (!response.ok) throw new Error('Failed to fetch');
            return await response.json();
        } catch (e) {
            console.error('npoint fetch error:', e);
            return null;
        }
    },
    async save(data) {
        if (!state.npointId) return false;
        try {
            const response = await fetch(`${this.baseUrl}/${state.npointId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (e) {
            console.error('npoint save error:', e);
            return false;
        }
    }
};

// ==========================================
// Data Management
// ==========================================

function loadLocalData() {
    const localData = localStorage.getItem('workoutData');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            state.workoutHistory = parsed.workoutHistory || [];
            state.currentSession = parsed.currentSession || {};
        } catch (e) {
            console.error('Error parsing local data:', e);
        }
    }
}

function saveLocalData() {
    localStorage.setItem('workoutData', JSON.stringify({
        workoutHistory: state.workoutHistory,
        currentSession: state.currentSession
    }));
}

function saveExerciseOrder() {
    localStorage.setItem('exerciseOrder', JSON.stringify(state.exerciseOrder));
}

async function syncData() {
    if (!state.npointId) return;
    updateSyncStatus('syncing');

    try {
        const remoteData = await npointAPI.fetch();

        if (remoteData && remoteData.workoutHistory) {
            const localIds = new Set(state.workoutHistory.map(w => w.id));
            const remoteIds = new Set(remoteData.workoutHistory.map(w => w.id));

            remoteData.workoutHistory.forEach(workout => {
                if (!localIds.has(workout.id)) {
                    state.workoutHistory.push(workout);
                } else {
                    const idx = state.workoutHistory.findIndex(w => w.id === workout.id);
                    if (idx !== -1) state.workoutHistory[idx] = workout;
                }
            });

            const localOnly = state.workoutHistory.filter(w => !remoteIds.has(w.id));
            if (localOnly.length > 0 || state.workoutHistory.length !== remoteData.workoutHistory.length) {
                await npointAPI.save({ workoutHistory: state.workoutHistory });
            }

            state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            saveLocalData();
            refreshAllExercises();
            renderDesktopView();
        } else {
            await npointAPI.save({ workoutHistory: state.workoutHistory });
        }

        state.lastSync = new Date();
        updateSyncStatus('synced');
        showToast('Data synced!', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('error');
        showToast('Sync failed', 'error');
    }
}

function updateSyncStatus(status) {
    const indicators = [elements.syncIndicator, document.getElementById('desktop-sync-indicator')];
    const texts = [elements.syncText, document.getElementById('desktop-sync-text')];

    indicators.forEach(ind => {
        if (!ind) return;
        ind.className = '';
        if (status === 'synced') ind.classList.add('synced');
        else if (status === 'syncing') ind.classList.add('syncing');
        else if (status === 'error') ind.classList.add('error');
    });

    texts.forEach(txt => {
        if (!txt) return;
        txt.textContent = status === 'synced' ? 'Synced' : status === 'syncing' ? 'Syncing...' : status === 'error' ? 'Sync error' : 'Not synced';
    });
}

// ==========================================
// Exercise Data Helpers
// ==========================================

function getOrderedExercises(workoutType) {
    const exercises = [...DEFAULT_WORKOUTS[workoutType].exercises];
    const order = state.exerciseOrder[workoutType];
    if (order && order.length) {
        exercises.sort((a, b) => {
            const idxA = order.indexOf(a.id);
            const idxB = order.indexOf(b.id);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }
    return exercises;
}

function getLastPerformance(workoutType, exerciseId) {
    const workouts = state.workoutHistory
        .filter(w => w.type === workoutType)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const w of workouts) {
        const ex = w.exercises.find(e => e.id === exerciseId);
        if (ex && ex.sets && ex.sets.length > 0) return ex;
    }
    return null;
}

function getExerciseHistory(workoutType, exerciseId, limit = 10) {
    return state.workoutHistory
        .filter(w => w.type === workoutType)
        .map(w => {
            const ex = w.exercises.find(e => e.id === exerciseId);
            return ex ? { date: w.date, ...ex } : null;
        })
        .filter(Boolean)
        .slice(0, limit);
}

function getAllExercises() {
    const all = [];
    Object.keys(DEFAULT_WORKOUTS).forEach(type => {
        DEFAULT_WORKOUTS[type].exercises.forEach(ex => {
            all.push({ ...ex, type });
        });
    });
    return all;
}

function getSuggestedWeight(lastWeight) {
    if (!lastWeight || lastWeight === 0) return '';
    return lastWeight + WEIGHT_INCREMENT;
}

// ==========================================
// Records Calculation
// ==========================================

function calculateRecords() {
    const records = {
        maxWeight: {},
        maxReps: {},
        maxVolume: {},
        totalReps: {}
    };

    const allExercises = getAllExercises();

    allExercises.forEach(ex => {
        records.maxWeight[ex.id] = { value: 0, date: null, exercise: ex.name };
        records.maxReps[ex.id] = { value: 0, date: null, exercise: ex.name };
        records.maxVolume[ex.id] = { value: 0, date: null, exercise: ex.name };
        records.totalReps[ex.id] = { value: 0, exercise: ex.name };
    });

    state.workoutHistory.forEach(workout => {
        workout.exercises.forEach(ex => {
            if (!records.maxWeight[ex.id]) return;

            ex.sets.forEach(set => {
                if (set.weight > records.maxWeight[ex.id].value) {
                    records.maxWeight[ex.id] = { value: set.weight, date: workout.date, exercise: ex.name };
                }
                if (set.reps > records.maxReps[ex.id].value) {
                    records.maxReps[ex.id] = { value: set.reps, date: workout.date, exercise: ex.name };
                }
                const volume = (set.weight || 0) * (set.reps || 0);
                if (volume > records.maxVolume[ex.id].value) {
                    records.maxVolume[ex.id] = { value: volume, date: workout.date, exercise: ex.name };
                }
                records.totalReps[ex.id].value += set.reps || 0;
            });
        });
    });

    return records;
}

function renderRecords() {
    const records = calculateRecords();
    const container = elements.recordsContent || document.getElementById('desktop-records-content');
    if (!container) return;

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    const maxWeightItems = Object.values(records.maxWeight)
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const maxVolumeItems = Object.values(records.maxVolume)
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const totalRepsItems = Object.values(records.totalReps)
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    container.innerHTML = `
        <div class="records-grid">
            <div class="record-card">
                <h3>Max Weight</h3>
                ${maxWeightItems.map(r => `
                    <div class="record-item">
                        <div>
                            <div class="record-exercise">${r.exercise}</div>
                            <div class="record-date">${formatDate(r.date)}</div>
                        </div>
                        <div class="record-value">${r.value} lbs</div>
                    </div>
                `).join('')}
            </div>
            <div class="record-card">
                <h3>Max Volume (Weight × Reps)</h3>
                ${maxVolumeItems.map(r => `
                    <div class="record-item">
                        <div>
                            <div class="record-exercise">${r.exercise}</div>
                            <div class="record-date">${formatDate(r.date)}</div>
                        </div>
                        <div class="record-value">${r.value.toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
            <div class="record-card">
                <h3>Total Reps (All Time)</h3>
                ${totalRepsItems.map(r => `
                    <div class="record-item">
                        <div class="record-exercise">${r.exercise}</div>
                        <div class="record-value">${r.value.toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==========================================
// UI Rendering
// ==========================================

function refreshAllExercises() {
    state.currentSession = {};
    saveLocalData();
    ['pull', 'push', 'legs'].forEach(type => {
        if (elements.exercises[type] && elements.exercises[type].children.length > 0) {
            renderExercises(type);
        }
    });
}

function renderExercises(workoutType) {
    const container = elements.exercises[workoutType];
    if (!container) return;

    const exercises = getOrderedExercises(workoutType);
    container.innerHTML = '';
    container.classList.toggle('reordering', state.isReordering);

    exercises.forEach(exercise => {
        const lastPerformance = getLastPerformance(workoutType, exercise.id);
        const card = createExerciseCard(exercise, lastPerformance, workoutType);
        container.appendChild(card);
    });

    if (state.isReordering) {
        initDragAndDrop(container, workoutType);
    }
}

function createExerciseCard(exercise, lastPerformance, workoutType) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exerciseId = exercise.id;
    card.draggable = state.isReordering;

    if (!state.currentSession[exercise.id]) {
        state.currentSession[exercise.id] = { sets: [] };
        for (let i = 0; i < exercise.defaultSets; i++) {
            const lastSet = lastPerformance?.sets?.[i];
            state.currentSession[exercise.id].sets.push({
                weight: lastSet ? getSuggestedWeight(lastSet.weight) : '',
                reps: exercise.defaultReps,
                completed: false
            });
        }
    }

    const currentSets = state.currentSession[exercise.id].sets;
    const completedSets = currentSets.filter(s => s.completed).length;
    const history = getExerciseHistory(workoutType, exercise.id, 5);

    card.innerHTML = `
        <div class="exercise-header">
            <div class="drag-handle">⋮⋮</div>
            <div style="flex:1">
                <div class="exercise-name">${exercise.name}</div>
                <div class="exercise-summary">${completedSets}/${currentSets.length} sets</div>
            </div>
            <span class="exercise-toggle">▼</span>
        </div>
        <div class="exercise-body">
            ${lastPerformance ? `
                <div class="previous-performance">
                    <div class="label">Last (${new Date(lastPerformance.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}):</div>
                    <div class="value">${lastPerformance.sets.map(s => `${s.weight}×${s.reps}`).join(', ')}</div>
                </div>
            ` : ''}
            <div class="sets-container">
                ${currentSets.map((set, i) => createSetRowHTML(exercise, set, i, lastPerformance)).join('')}
            </div>
            <button class="add-set-btn" data-exercise-id="${exercise.id}">+ Add Set</button>
            ${history.length > 1 ? `
                <button class="exercise-history-toggle" data-exercise="${exercise.id}" data-type="${workoutType}">
                    View Full History (${history.length} sessions)
                </button>
            ` : ''}
        </div>
    `;

    const header = card.querySelector('.exercise-header');
    header.addEventListener('click', (e) => {
        if (!e.target.closest('.drag-handle')) {
            card.classList.toggle('expanded');
        }
    });

    card.querySelectorAll('.set-row').forEach((row, i) => {
        setupSetRowListeners(row, exercise.id, i);
    });

    card.querySelector('.add-set-btn')?.addEventListener('click', () => addSet(exercise.id, workoutType));

    card.querySelector('.exercise-history-toggle')?.addEventListener('click', (e) => {
        showExerciseHistory(e.target.dataset.exercise, e.target.dataset.type);
    });

    return card;
}

function createSetRowHTML(exercise, set, index, lastPerformance) {
    const lastSet = lastPerformance?.sets?.[index];
    const suggested = lastSet ? getSuggestedWeight(lastSet.weight) : null;

    return `
        <div class="set-row" data-set-index="${index}">
            <div class="set-label">Set ${index + 1}</div>
            <div class="set-input">
                <label>Weight</label>
                <input type="number" class="weight-input" value="${set.weight || ''}" placeholder="${suggested || 0}" step="2.5" min="0">
            </div>
            <div class="set-input">
                <label>Reps</label>
                <input type="number" class="reps-input" value="${set.reps || exercise.defaultReps}" min="0">
            </div>
            <button class="set-check ${set.completed ? 'completed' : ''}">${set.completed ? '✓' : ''}</button>
        </div>
    `;
}

function setupSetRowListeners(row, exerciseId, setIndex) {
    const weightInput = row.querySelector('.weight-input');
    const repsInput = row.querySelector('.reps-input');
    const checkBtn = row.querySelector('.set-check');

    weightInput?.addEventListener('change', (e) => {
        state.currentSession[exerciseId].sets[setIndex].weight = parseFloat(e.target.value) || 0;
        saveLocalData();
    });

    repsInput?.addEventListener('change', (e) => {
        state.currentSession[exerciseId].sets[setIndex].reps = parseInt(e.target.value) || 0;
        saveLocalData();
    });

    checkBtn?.addEventListener('click', () => {
        const set = state.currentSession[exerciseId].sets[setIndex];
        set.completed = !set.completed;

        if (set.completed && !set.weight) {
            const placeholder = weightInput.placeholder;
            if (placeholder && placeholder !== '0') {
                set.weight = parseFloat(placeholder);
                weightInput.value = set.weight;
            }
        }

        checkBtn.classList.toggle('completed', set.completed);
        checkBtn.textContent = set.completed ? '✓' : '';
        updateExerciseSummary(exerciseId);
        saveLocalData();
    });
}

function updateExerciseSummary(exerciseId) {
    const card = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
    if (!card) return;
    const sets = state.currentSession[exerciseId].sets;
    const completed = sets.filter(s => s.completed).length;
    card.querySelector('.exercise-summary').textContent = `${completed}/${sets.length} sets`;
}

function addSet(exerciseId, workoutType) {
    const exercise = DEFAULT_WORKOUTS[workoutType].exercises.find(e => e.id === exerciseId);
    const lastPerf = getLastPerformance(workoutType, exerciseId);
    const count = state.currentSession[exerciseId].sets.length;
    const lastSet = lastPerf?.sets?.[count];

    state.currentSession[exerciseId].sets.push({
        weight: lastSet ? getSuggestedWeight(lastSet.weight) : '',
        reps: exercise.defaultReps,
        completed: false
    });

    saveLocalData();
    renderExercises(workoutType);
}

// ==========================================
// Exercise History Modal
// ==========================================

function showExerciseHistory(exerciseId, workoutType) {
    const exercise = DEFAULT_WORKOUTS[workoutType].exercises.find(e => e.id === exerciseId);
    const history = getExerciseHistory(workoutType, exerciseId, 20);

    elements.exerciseHistoryTitle.textContent = `${exercise.name} History`;
    elements.exerciseHistoryContent.innerHTML = history.length ? history.map(entry => `
        <div class="history-entry">
            <div class="history-entry-date">${new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div class="history-entry-sets">${entry.sets.map(s => `${s.weight}×${s.reps}`).join(', ')}</div>
        </div>
    `).join('') : '<p class="no-history">No history for this exercise</p>';

    elements.exerciseHistoryModal.classList.remove('hidden');
}

// ==========================================
// Drag and Drop Reordering (Touch + Desktop)
// ==========================================

let dragState = {
    el: null,
    startY: 0,
    currentY: 0,
    placeholder: null,
    container: null,
    workoutType: null
};

function initDragAndDrop(container, workoutType) {
    dragState.container = container;
    dragState.workoutType = workoutType;

    container.querySelectorAll('.exercise-card').forEach(card => {
        const handle = card.querySelector('.drag-handle');
        if (!handle) return;

        // Touch events for mobile
        handle.addEventListener('touchstart', (e) => handleDragStart(e, card), { passive: false });
        handle.addEventListener('touchmove', (e) => handleDragMove(e), { passive: false });
        handle.addEventListener('touchend', (e) => handleDragEnd(e), { passive: false });

        // Mouse events for desktop
        handle.addEventListener('mousedown', (e) => handleMouseStart(e, card));
    });

    // Desktop mouse events on document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseEnd);
}

function handleDragStart(e, card) {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(card, touch.clientY);
}

function handleMouseStart(e, card) {
    e.preventDefault();
    startDrag(card, e.clientY);
}

function startDrag(card, y) {
    dragState.el = card;
    dragState.startY = y;
    dragState.currentY = y;

    // Create placeholder
    dragState.placeholder = document.createElement('div');
    dragState.placeholder.className = 'exercise-card drag-placeholder';
    dragState.placeholder.style.height = card.offsetHeight + 'px';
    dragState.placeholder.style.background = 'var(--border-color)';
    dragState.placeholder.style.borderRadius = '12px';
    dragState.placeholder.style.marginBottom = '1rem';

    card.classList.add('dragging');
    card.style.position = 'fixed';
    card.style.zIndex = '1000';
    card.style.width = card.offsetWidth + 'px';
    card.style.left = card.getBoundingClientRect().left + 'px';
    card.style.top = card.getBoundingClientRect().top + 'px';
    card.style.pointerEvents = 'none';

    card.parentNode.insertBefore(dragState.placeholder, card);
}

function handleDragMove(e) {
    if (!dragState.el) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveDrag(touch.clientY);
}

function handleMouseMove(e) {
    if (!dragState.el) return;
    moveDrag(e.clientY);
}

function moveDrag(y) {
    if (!dragState.el) return;

    const deltaY = y - dragState.currentY;
    dragState.currentY = y;

    const currentTop = parseFloat(dragState.el.style.top);
    dragState.el.style.top = (currentTop + deltaY) + 'px';

    // Find element we're hovering over
    const cards = [...dragState.container.querySelectorAll('.exercise-card:not(.dragging):not(.drag-placeholder)')];

    for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (y < midY) {
            card.parentNode.insertBefore(dragState.placeholder, card);
            break;
        } else if (card === cards[cards.length - 1]) {
            card.parentNode.insertBefore(dragState.placeholder, card.nextSibling);
        }
    }
}

function handleDragEnd(e) {
    if (!dragState.el) return;
    e.preventDefault();
    endDrag();
}

function handleMouseEnd() {
    if (!dragState.el) return;
    endDrag();
}

function endDrag() {
    if (!dragState.el || !dragState.placeholder) return;

    // Move card to placeholder position
    dragState.placeholder.parentNode.insertBefore(dragState.el, dragState.placeholder);
    dragState.placeholder.remove();

    // Reset styles
    dragState.el.classList.remove('dragging');
    dragState.el.style.position = '';
    dragState.el.style.zIndex = '';
    dragState.el.style.width = '';
    dragState.el.style.left = '';
    dragState.el.style.top = '';
    dragState.el.style.pointerEvents = '';

    // Save new order
    const newOrder = [...dragState.container.querySelectorAll('.exercise-card')].map(c => c.dataset.exerciseId);
    state.exerciseOrder[dragState.workoutType] = newOrder;
    saveExerciseOrder();

    // Reset state
    dragState.el = null;
    dragState.placeholder = null;
}

function toggleReorderMode(workoutType) {
    state.isReordering = !state.isReordering;
    renderExercises(workoutType);

    document.querySelectorAll('.reorder-toggle').forEach(btn => {
        if (btn.dataset.workout === workoutType) {
            btn.classList.toggle('active', state.isReordering);
            btn.textContent = state.isReordering ? 'Done' : 'Reorder';
        }
    });
}

// ==========================================
// Tab Navigation
// ==========================================

function switchTab(workoutType) {
    state.currentWorkout = workoutType;

    elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.workout === workoutType);
    });

    Object.keys(elements.sections).forEach(type => {
        if (elements.sections[type]) {
            elements.sections[type].classList.toggle('hidden', type !== workoutType);
        }
    });

    if (elements.workoutActions) {
        elements.workoutActions.classList.toggle('hidden', workoutType === 'records');
    }

    if (workoutType === 'records') {
        renderRecords();
    } else if (elements.exercises[workoutType] && elements.exercises[workoutType].children.length === 0) {
        renderExercises(workoutType);
    }
}

// ==========================================
// Finish Workout
// ==========================================

function finishWorkout() {
    const workoutType = state.currentWorkout;
    if (workoutType === 'records') return;

    const exercises = [];
    getOrderedExercises(workoutType).forEach(exercise => {
        const session = state.currentSession[exercise.id];
        if (session && session.sets.some(s => s.completed)) {
            exercises.push({
                id: exercise.id,
                name: exercise.name,
                sets: session.sets.filter(s => s.completed).map(s => ({ weight: s.weight || 0, reps: s.reps })),
                date: new Date().toISOString()
            });
        }
    });

    if (!exercises.length) {
        showToast('Complete at least one set', 'error');
        return;
    }

    const workout = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: workoutType,
        date: new Date().toISOString(),
        exercises
    };

    state.workoutHistory.unshift(workout);
    exercises.forEach(e => delete state.currentSession[e.id]);
    saveLocalData();

    if (state.npointId) syncData();
    renderExercises(workoutType);
    renderDesktopView();
    showToast(`${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} workout saved!`, 'success');
}

// ==========================================
// History Modal
// ==========================================

function showHistory() {
    renderHistory();
    elements.historyModal.classList.remove('hidden');
}

function hideHistory() {
    elements.historyModal.classList.add('hidden');
}

function renderHistory() {
    if (!state.workoutHistory.length) {
        elements.historyContent.innerHTML = '<div class="no-history">No workout history yet</div>';
        return;
    }

    elements.historyContent.innerHTML = state.workoutHistory.slice(0, 30).map(workout => {
        const date = new Date(workout.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        return `
            <div class="history-item" data-workout-id="${workout.id}">
                <div class="history-date">
                    <span>${date}</span>
                    <div>
                        <button class="edit-history-btn" data-id="${workout.id}">Edit</button>
                        <span class="history-type ${workout.type}">${workout.type.toUpperCase()}</span>
                    </div>
                </div>
                <div class="history-exercises">
                    ${workout.exercises.map(ex => `
                        <div class="history-exercise">
                            <div class="history-exercise-name">${ex.name}</div>
                            <div class="history-sets">${ex.sets.map(s => `${s.weight}×${s.reps}`).join(', ')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    elements.historyContent.querySelectorAll('.edit-history-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
}

// ==========================================
// Edit Workout Modal
// ==========================================

function openEditModal(workoutId) {
    const workout = state.workoutHistory.find(w => w.id === workoutId);
    if (!workout) return;

    state.editingWorkout = JSON.parse(JSON.stringify(workout));

    renderEditModal();
    elements.editModal.classList.remove('hidden');
}

function renderEditModal() {
    const workout = state.editingWorkout;
    if (!workout) return;

    const date = new Date(workout.date);

    elements.editContent.innerHTML = `
        <div style="margin-bottom:1rem">
            <label style="display:block;margin-bottom:0.5rem;font-weight:600">Date</label>
            <input type="datetime-local" id="edit-date" value="${date.toISOString().slice(0, 16)}" style="padding:0.5rem;border:1px solid var(--border-color);border-radius:4px;width:100%">
        </div>
        ${workout.exercises.map((ex, exIdx) => `
            <div class="edit-exercise" data-exercise-idx="${exIdx}">
                <div class="edit-exercise-header">${ex.name}</div>
                ${ex.sets.map((set, setIdx) => `
                    <div class="edit-set-row" data-set-idx="${setIdx}">
                        <span>Set ${setIdx + 1}</span>
                        <input type="number" class="edit-weight" value="${set.weight}" placeholder="Weight" step="2.5">
                        <input type="number" class="edit-reps" value="${set.reps}" placeholder="Reps">
                        <button class="delete-set-btn" data-ex="${exIdx}" data-set="${setIdx}">×</button>
                    </div>
                `).join('')}
                <button class="add-set-btn" data-ex-idx="${exIdx}" style="margin-top:0.5rem">+ Add Set</button>
            </div>
        `).join('')}
    `;

    elements.editContent.querySelectorAll('.edit-weight, .edit-reps').forEach(input => {
        input.addEventListener('change', updateEditingWorkout);
    });

    elements.editContent.querySelectorAll('.delete-set-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const exIdx = parseInt(btn.dataset.ex);
            const setIdx = parseInt(btn.dataset.set);
            state.editingWorkout.exercises[exIdx].sets.splice(setIdx, 1);
            renderEditModal();
        });
    });

    elements.editContent.querySelectorAll('.add-set-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const exIdx = parseInt(btn.dataset.exIdx);
            state.editingWorkout.exercises[exIdx].sets.push({ weight: 0, reps: 0 });
            renderEditModal();
        });
    });

    document.getElementById('edit-date')?.addEventListener('change', (e) => {
        state.editingWorkout.date = new Date(e.target.value).toISOString();
    });
}

function updateEditingWorkout() {
    elements.editContent.querySelectorAll('.edit-exercise').forEach((exEl, exIdx) => {
        exEl.querySelectorAll('.edit-set-row').forEach((setEl, setIdx) => {
            const weight = parseFloat(setEl.querySelector('.edit-weight').value) || 0;
            const reps = parseInt(setEl.querySelector('.edit-reps').value) || 0;
            if (state.editingWorkout.exercises[exIdx]?.sets[setIdx]) {
                state.editingWorkout.exercises[exIdx].sets[setIdx] = { weight, reps };
            }
        });
    });
}

function saveEditedWorkout() {
    if (!state.editingWorkout) return;

    updateEditingWorkout();

    const idx = state.workoutHistory.findIndex(w => w.id === state.editingWorkout.id);
    if (idx !== -1) {
        state.workoutHistory[idx] = state.editingWorkout;
        state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveLocalData();
        if (state.npointId) syncData();
        refreshAllExercises();
        renderHistory();
        renderDesktopView();
        showToast('Workout updated!', 'success');
    }

    closeEditModal();
}

function deleteWorkout() {
    if (!state.editingWorkout) return;
    if (!confirm('Delete this workout?')) return;

    state.workoutHistory = state.workoutHistory.filter(w => w.id !== state.editingWorkout.id);
    saveLocalData();
    if (state.npointId) syncData();
    refreshAllExercises();
    renderHistory();
    renderDesktopView();
    showToast('Workout deleted', 'success');
    closeEditModal();
}

function closeEditModal() {
    state.editingWorkout = null;
    elements.editModal.classList.add('hidden');
}

// ==========================================
// Desktop View
// ==========================================

function renderDesktopView() {
    if (window.innerWidth < 1024) return;

    ['pull', 'push', 'legs'].forEach(type => {
        const list = document.getElementById(`desktop-${type}-list`);
        if (!list) return;

        const workouts = state.workoutHistory.filter(w => w.type === type).slice(0, 10);
        list.innerHTML = workouts.length ? workouts.map(w => {
            const date = new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const summary = w.exercises.map(e => e.name).join(', ');
            return `
                <div class="desktop-workout-card" data-id="${w.id}">
                    <div class="desktop-workout-date">${date}</div>
                    <div class="desktop-workout-summary">${summary}</div>
                </div>
            `;
        }).join('') : '<p style="color:var(--text-secondary);text-align:center">No workouts yet</p>';

        list.querySelectorAll('.desktop-workout-card').forEach(card => {
            card.addEventListener('click', () => openEditModal(card.dataset.id));
        });
    });

    populateExerciseSelector();
}

function populateExerciseSelector() {
    const select = document.getElementById('progress-exercise-select');
    if (!select) return;

    const exercises = getAllExercises();
    select.innerHTML = exercises.map(ex => `<option value="${ex.id}" data-type="${ex.type}">${ex.name} (${ex.type})</option>`).join('');

    select.addEventListener('change', () => renderProgressCharts(select.value));

    if (exercises.length) renderProgressCharts(exercises[0].id);
}

function renderProgressCharts(exerciseId) {
    const exercise = getAllExercises().find(e => e.id === exerciseId);
    if (!exercise) return;

    const history = getExerciseHistory(exercise.type, exerciseId, 52);

    renderHeatmap(history, exerciseId);
    renderWeightChart(history);
}

function renderHeatmap(history, exerciseId) {
    const container = document.getElementById('volume-heatmap');
    if (!container) return;

    const volumes = {};
    history.forEach(entry => {
        const dateKey = new Date(entry.date).toISOString().slice(0, 10);
        const volume = entry.sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
        volumes[dateKey] = (volumes[dateKey] || 0) + volume;
    });

    const maxVolume = Math.max(...Object.values(volumes), 1);

    const today = new Date();
    const weeks = 26;
    const cells = [];

    for (let w = weeks - 1; w >= 0; w--) {
        const weekCells = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (w * 7 + (6 - d)));
            const dateKey = date.toISOString().slice(0, 10);
            const volume = volumes[dateKey] || 0;
            const level = volume ? Math.min(5, Math.ceil((volume / maxVolume) * 5)) : 0;
            weekCells.push({ dateKey, volume, level });
        }
        cells.push(weekCells);
    }

    container.innerHTML = `
        <div class="heatmap">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => `
                <div class="heatmap-row">
                    <div class="heatmap-label">${i % 2 === 1 ? day : ''}</div>
                    ${cells.map(week => {
                        const cell = week[i];
                        return `<div class="heatmap-cell level-${cell.level}" data-tooltip="${cell.dateKey}: ${cell.volume.toLocaleString()}"></div>`;
                    }).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function renderWeightChart(history) {
    const container = document.getElementById('weight-chart');
    if (!container) return;

    const data = history.map(entry => ({
        date: entry.date,
        maxWeight: Math.max(...entry.sets.map(s => s.weight || 0))
    })).reverse();

    if (!data.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No data</p>';
        return;
    }

    const maxWeight = Math.max(...data.map(d => d.maxWeight), 1);

    container.innerHTML = data.map(d => {
        const height = (d.maxWeight / maxWeight) * 100;
        return `<div class="chart-bar" style="height:${height}%" data-value="${d.maxWeight}lbs"></div>`;
    }).join('');
}

function switchDesktopTab(view) {
    document.querySelectorAll('.desktop-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    document.querySelectorAll('.desktop-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`desktop-${view}`)?.classList.remove('hidden');

    if (view === 'records') renderRecords();
    if (view === 'progress') populateExerciseSelector();
}

// ==========================================
// Toast
// ==========================================

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    setTimeout(() => elements.toast.classList.add('hidden'), 3000);
}

// ==========================================
// nPoint Setup
// ==========================================

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key) {
        state.npointId = key;
        localStorage.setItem('npointId', key);
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }
    return false;
}

function setupNpoint() {
    checkUrlParams();
    if (state.npointId) {
        elements.npointSetup?.classList.add('hidden');
        if (elements.npointInput) elements.npointInput.value = state.npointId;
        showConnectedStatus();
        syncData();
    }
}

function showConnectedStatus() {
    const el = document.getElementById('npoint-connected');
    if (el) {
        el.classList.remove('hidden');
        document.getElementById('connected-id').textContent = state.npointId;
    }
}

function clearNpointId() {
    if (!confirm('Clear sync connection?')) return;
    state.npointId = null;
    localStorage.removeItem('npointId');
    elements.npointSetup?.classList.remove('hidden');
    if (elements.npointInput) elements.npointInput.value = '';
    document.getElementById('npoint-connected')?.classList.add('hidden');
    updateSyncStatus('disconnected');
    showToast('Sync cleared', 'success');
}

function saveNpointId() {
    const id = elements.npointInput?.value.trim();
    if (!id) {
        showToast('Enter a valid ID', 'error');
        return;
    }
    state.npointId = id;
    localStorage.setItem('npointId', id);
    elements.npointSetup?.classList.add('hidden');
    showConnectedStatus();
    syncData();
}

// ==========================================
// PWA Service Worker
// ==========================================

let newWorker = null;

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const reg = await navigator.serviceWorker.register('sw.js');
        reg.update();
        setInterval(() => reg.update(), 60000);

        reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    document.getElementById('update-banner')?.classList.remove('hidden');
                }
            });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    } catch (e) {
        console.log('SW registration failed:', e);
    }
}

// ==========================================
// Event Listeners
// ==========================================

function initEventListeners() {
    elements.tabs?.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.workout)));

    elements.saveNpointBtn?.addEventListener('click', saveNpointId);
    elements.syncBtn?.addEventListener('click', syncData);
    document.getElementById('desktop-sync-btn')?.addEventListener('click', syncData);
    document.getElementById('clear-npoint')?.addEventListener('click', clearNpointId);

    elements.finishBtn?.addEventListener('click', finishWorkout);
    elements.historyBtn?.addEventListener('click', showHistory);
    elements.closeHistoryBtn?.addEventListener('click', hideHistory);

    elements.historyModal?.addEventListener('click', (e) => { if (e.target === elements.historyModal) hideHistory(); });

    elements.npointInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNpointId(); });

    document.getElementById('close-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('save-workout')?.addEventListener('click', saveEditedWorkout);
    document.getElementById('delete-workout')?.addEventListener('click', deleteWorkout);
    elements.editModal?.addEventListener('click', (e) => { if (e.target === elements.editModal) closeEditModal(); });

    document.getElementById('close-exercise-history')?.addEventListener('click', () => elements.exerciseHistoryModal?.classList.add('hidden'));
    elements.exerciseHistoryModal?.addEventListener('click', (e) => { if (e.target === elements.exerciseHistoryModal) elements.exerciseHistoryModal.classList.add('hidden'); });

    document.querySelectorAll('.reorder-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleReorderMode(btn.dataset.workout));
    });

    document.querySelectorAll('.desktop-tab').forEach(tab => {
        tab.addEventListener('click', () => switchDesktopTab(tab.dataset.view));
    });

    document.getElementById('update-btn')?.addEventListener('click', () => {
        newWorker?.postMessage({ type: 'SKIP_WAITING' });
        document.getElementById('update-banner')?.classList.add('hidden');
    });
    document.getElementById('dismiss-update')?.addEventListener('click', () => {
        document.getElementById('update-banner')?.classList.add('hidden');
    });
}

// ==========================================
// Init
// ==========================================

function init() {
    loadLocalData();
    setupNpoint();
    initEventListeners();
    renderExercises('pull');
    renderDesktopView();
    registerServiceWorker();

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) renderDesktopView();
    });
}

document.addEventListener('DOMContentLoaded', init);
