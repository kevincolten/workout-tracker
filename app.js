// Workout Tracker PWA - Main Application

// ==========================================
// Configuration & Default Data
// ==========================================

const WEIGHT_INCREMENT = 2.5; // lbs to add for progression

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
    isSyncing: false,
    lastSync: null
};

// ==========================================
// DOM Elements
// ==========================================

const elements = {
    tabs: document.querySelectorAll('.tab-btn'),
    sections: {
        pull: document.getElementById('pull-section'),
        push: document.getElementById('push-section'),
        legs: document.getElementById('legs-section')
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
    toast: document.getElementById('toast')
};

// ==========================================
// npoint.io API Integration
// ==========================================

const npointAPI = {
    baseUrl: 'https://api.npoint.io',

    async fetch() {
        if (!state.npointId) return null;

        try {
            const response = await fetch(`${this.baseUrl}/${state.npointId}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            return await response.json();
        } catch (error) {
            console.error('npoint fetch error:', error);
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
        } catch (error) {
            console.error('npoint save error:', error);
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
    const data = {
        workoutHistory: state.workoutHistory,
        currentSession: state.currentSession
    };
    localStorage.setItem('workoutData', JSON.stringify(data));
}

async function syncData() {
    if (!state.npointId) return;

    updateSyncStatus('syncing');

    try {
        // Fetch remote data
        const remoteData = await npointAPI.fetch();

        if (remoteData && remoteData.workoutHistory) {
            // Merge histories (prefer remote for conflicts, but add local unique entries)
            const localIds = new Set(state.workoutHistory.map(w => w.id));
            const remoteIds = new Set(remoteData.workoutHistory.map(w => w.id));

            // Add remote entries we don't have locally
            remoteData.workoutHistory.forEach(workout => {
                if (!localIds.has(workout.id)) {
                    state.workoutHistory.push(workout);
                }
            });

            // Find local entries that aren't remote
            const localOnly = state.workoutHistory.filter(w => !remoteIds.has(w.id));

            // If we have local-only entries, push them to remote
            if (localOnly.length > 0) {
                await npointAPI.save({
                    workoutHistory: state.workoutHistory
                });
            }

            // Sort by date descending
            state.workoutHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            saveLocalData();
        } else {
            // No remote data, push local data
            await npointAPI.save({
                workoutHistory: state.workoutHistory
            });
        }

        state.lastSync = new Date();
        updateSyncStatus('synced');
        showToast('Data synced successfully!', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('error');
        showToast('Sync failed. Data saved locally.', 'error');
    }
}

function updateSyncStatus(status) {
    const indicator = elements.syncIndicator;
    const text = elements.syncText;

    indicator.className = '';

    switch (status) {
        case 'synced':
            indicator.classList.add('synced');
            text.textContent = 'Synced';
            break;
        case 'syncing':
            indicator.classList.add('syncing');
            text.textContent = 'Syncing...';
            break;
        case 'error':
            indicator.classList.add('error');
            text.textContent = 'Sync error';
            break;
        default:
            text.textContent = 'Not synced';
    }
}

// ==========================================
// Previous Performance & Weight Suggestions
// ==========================================

function getLastPerformance(workoutType, exerciseId) {
    // Find the most recent workout of this type that includes this exercise
    const relevantWorkouts = state.workoutHistory
        .filter(w => w.type === workoutType)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const workout of relevantWorkouts) {
        const exercise = workout.exercises.find(e => e.id === exerciseId);
        if (exercise && exercise.sets && exercise.sets.length > 0) {
            return exercise;
        }
    }

    return null;
}

function getSuggestedWeight(lastWeight) {
    if (!lastWeight || lastWeight === 0) return '';
    return lastWeight + WEIGHT_INCREMENT;
}

// ==========================================
// UI Rendering
// ==========================================

function renderExercises(workoutType) {
    const container = elements.exercises[workoutType];
    const workout = DEFAULT_WORKOUTS[workoutType];

    container.innerHTML = '';

    workout.exercises.forEach(exercise => {
        const lastPerformance = getLastPerformance(workoutType, exercise.id);
        const card = createExerciseCard(exercise, lastPerformance, workoutType);
        container.appendChild(card);
    });
}

function createExerciseCard(exercise, lastPerformance, workoutType) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exerciseId = exercise.id;

    // Initialize current session for this exercise if not exists
    if (!state.currentSession[exercise.id]) {
        state.currentSession[exercise.id] = {
            sets: []
        };

        // Pre-populate with suggested weights from last performance
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

    card.innerHTML = `
        <div class="exercise-header">
            <div>
                <div class="exercise-name">${exercise.name}</div>
                <div class="exercise-summary">${completedSets}/${currentSets.length} sets completed</div>
            </div>
            <span class="exercise-toggle">▼</span>
        </div>
        <div class="exercise-body">
            ${lastPerformance ? createPreviousPerformanceHTML(lastPerformance) : ''}
            <div class="sets-container">
                ${currentSets.map((set, index) => createSetRowHTML(exercise, set, index, lastPerformance)).join('')}
            </div>
            <button class="add-set-btn" data-exercise-id="${exercise.id}">+ Add Set</button>
        </div>
    `;

    // Event listeners
    const header = card.querySelector('.exercise-header');
    header.addEventListener('click', () => {
        card.classList.toggle('expanded');
    });

    // Set input event listeners
    card.querySelectorAll('.set-row').forEach((row, index) => {
        setupSetRowListeners(row, exercise.id, index);
    });

    // Add set button
    const addSetBtn = card.querySelector('.add-set-btn');
    addSetBtn.addEventListener('click', () => addSet(exercise.id, workoutType));

    return card;
}

function createPreviousPerformanceHTML(lastPerformance) {
    const date = new Date(lastPerformance.date || Date.now());
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const setsInfo = lastPerformance.sets
        .map(s => `${s.weight || 0}×${s.reps}`)
        .join(', ');

    return `
        <div class="previous-performance">
            <div class="label">Last time (${formattedDate}):</div>
            <div class="value">${setsInfo}</div>
        </div>
    `;
}

function createSetRowHTML(exercise, set, index, lastPerformance) {
    const lastSet = lastPerformance?.sets?.[index];
    const suggestedWeight = lastSet ? getSuggestedWeight(lastSet.weight) : null;
    const showSuggestion = suggestedWeight && !set.weight;

    return `
        <div class="set-row" data-set-index="${index}">
            <div class="set-label">Set ${index + 1}</div>
            <div class="set-input">
                <label>Weight</label>
                <input type="number"
                       class="weight-input"
                       value="${set.weight || ''}"
                       placeholder="${suggestedWeight || '0'}"
                       step="2.5"
                       min="0">
                ${showSuggestion ? `<div class="weight-suggestion">Suggested: ${suggestedWeight} lbs</div>` : ''}
            </div>
            <div class="set-input">
                <label>Reps</label>
                <input type="number"
                       class="reps-input"
                       value="${set.reps || exercise.defaultReps}"
                       min="0">
            </div>
            <button class="set-check ${set.completed ? 'completed' : ''}" title="Mark as complete">
                ${set.completed ? '✓' : ''}
            </button>
        </div>
    `;
}

function setupSetRowListeners(row, exerciseId, setIndex) {
    const weightInput = row.querySelector('.weight-input');
    const repsInput = row.querySelector('.reps-input');
    const checkBtn = row.querySelector('.set-check');

    weightInput.addEventListener('change', (e) => {
        state.currentSession[exerciseId].sets[setIndex].weight = parseFloat(e.target.value) || 0;
        saveLocalData();
    });

    repsInput.addEventListener('change', (e) => {
        state.currentSession[exerciseId].sets[setIndex].reps = parseInt(e.target.value) || 0;
        saveLocalData();
    });

    checkBtn.addEventListener('click', () => {
        const set = state.currentSession[exerciseId].sets[setIndex];
        set.completed = !set.completed;

        // Use placeholder value if weight is empty
        if (set.completed && !set.weight) {
            const placeholder = weightInput.placeholder;
            if (placeholder && placeholder !== '0') {
                set.weight = parseFloat(placeholder);
                weightInput.value = set.weight;
            }
        }

        checkBtn.classList.toggle('completed', set.completed);
        checkBtn.textContent = set.completed ? '✓' : '';

        // Update summary
        updateExerciseSummary(exerciseId);
        saveLocalData();
    });
}

function updateExerciseSummary(exerciseId) {
    const card = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
    if (!card) return;

    const sets = state.currentSession[exerciseId].sets;
    const completed = sets.filter(s => s.completed).length;
    const summary = card.querySelector('.exercise-summary');
    summary.textContent = `${completed}/${sets.length} sets completed`;
}

function addSet(exerciseId, workoutType) {
    const exercise = DEFAULT_WORKOUTS[workoutType].exercises.find(e => e.id === exerciseId);
    const lastPerformance = getLastPerformance(workoutType, exerciseId);
    const currentSetCount = state.currentSession[exerciseId].sets.length;
    const lastSet = lastPerformance?.sets?.[currentSetCount];

    state.currentSession[exerciseId].sets.push({
        weight: lastSet ? getSuggestedWeight(lastSet.weight) : '',
        reps: exercise.defaultReps,
        completed: false
    });

    saveLocalData();
    renderExercises(workoutType);
}

// ==========================================
// Workout Tab Navigation
// ==========================================

function switchTab(workoutType) {
    state.currentWorkout = workoutType;

    // Update tab buttons
    elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.workout === workoutType);
    });

    // Update sections
    Object.keys(elements.sections).forEach(type => {
        elements.sections[type].classList.toggle('hidden', type !== workoutType);
    });

    // Render exercises for this tab if not already rendered
    if (elements.exercises[workoutType].children.length === 0) {
        renderExercises(workoutType);
    }
}

// ==========================================
// Finish Workout
// ==========================================

function finishWorkout() {
    const workoutType = state.currentWorkout;
    const exercises = [];

    // Collect all exercises with at least one completed set
    DEFAULT_WORKOUTS[workoutType].exercises.forEach(exercise => {
        const sessionData = state.currentSession[exercise.id];
        if (sessionData && sessionData.sets.some(s => s.completed)) {
            exercises.push({
                id: exercise.id,
                name: exercise.name,
                sets: sessionData.sets.filter(s => s.completed).map(s => ({
                    weight: s.weight || 0,
                    reps: s.reps
                })),
                date: new Date().toISOString()
            });
        }
    });

    if (exercises.length === 0) {
        showToast('Complete at least one set to save workout', 'error');
        return;
    }

    // Create workout record
    const workout = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: workoutType,
        date: new Date().toISOString(),
        exercises: exercises
    };

    // Add to history
    state.workoutHistory.unshift(workout);

    // Clear current session for completed exercises
    exercises.forEach(e => {
        delete state.currentSession[e.id];
    });

    saveLocalData();

    // Sync if connected
    if (state.npointId) {
        syncData();
    }

    // Re-render exercises
    renderExercises(workoutType);

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
    if (state.workoutHistory.length === 0) {
        elements.historyContent.innerHTML = '<div class="no-history">No workout history yet. Complete your first workout!</div>';
        return;
    }

    const html = state.workoutHistory.slice(0, 20).map(workout => {
        const date = new Date(workout.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const exercisesHTML = workout.exercises.map(exercise => {
            const setsInfo = exercise.sets.map(s => `${s.weight}×${s.reps}`).join(', ');
            return `
                <div class="history-exercise">
                    <div class="history-exercise-name">${exercise.name}</div>
                    <div class="history-sets">${setsInfo}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="history-item">
                <div class="history-date">
                    <span>${formattedDate}</span>
                    <span class="history-type ${workout.type}">${workout.type.toUpperCase()}</span>
                </div>
                <div class="history-exercises">
                    ${exercisesHTML}
                </div>
            </div>
        `;
    }).join('');

    elements.historyContent.innerHTML = html;
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ==========================================
// nPoint Setup
// ==========================================

function setupNpoint() {
    if (state.npointId) {
        elements.npointSetup.classList.add('hidden');
        elements.npointInput.value = state.npointId;
        syncData();
    }
}

function saveNpointId() {
    const id = elements.npointInput.value.trim();
    if (!id) {
        showToast('Please enter a valid npoint.io bin ID', 'error');
        return;
    }

    state.npointId = id;
    localStorage.setItem('npointId', id);
    elements.npointSetup.classList.add('hidden');
    syncData();
}

// ==========================================
// PWA Service Worker Registration
// ==========================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('ServiceWorker registered:', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    }
}

// ==========================================
// Event Listeners
// ==========================================

function initEventListeners() {
    // Tab navigation
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.workout));
    });

    // nPoint setup
    elements.saveNpointBtn.addEventListener('click', saveNpointId);
    elements.syncBtn.addEventListener('click', syncData);

    // Workout actions
    elements.finishBtn.addEventListener('click', finishWorkout);
    elements.historyBtn.addEventListener('click', showHistory);
    elements.closeHistoryBtn.addEventListener('click', hideHistory);

    // Close modal on background click
    elements.historyModal.addEventListener('click', (e) => {
        if (e.target === elements.historyModal) {
            hideHistory();
        }
    });

    // Enter key on npoint input
    elements.npointInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNpointId();
        }
    });
}

// ==========================================
// Initialization
// ==========================================

function init() {
    loadLocalData();
    setupNpoint();
    initEventListeners();
    renderExercises('pull');
    registerServiceWorker();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
