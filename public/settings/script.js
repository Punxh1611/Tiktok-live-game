document.addEventListener('DOMContentLoaded', () => {
    let currentPin = '';

    const loginContainer = document.getElementById('login-container');
    const settingsContainer = document.getElementById('settings-container');
    
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('pin-input').value;
    
        try {
            const res = await fetch('/api/settings', {
                headers: { 'x-pin-code': pin }
            });
            
            if (res.ok) {
                const settings = await res.json();
                currentPin = pin;
                populateSettings(settings);
                loginContainer.classList.add('hidden');
                setTimeout(() => {
                    settingsContainer.classList.remove('hidden');
                }, 400);
                fetchState();
                setInterval(fetchState, 2000); // Poll state every 2s for UI updates
            } else {
                document.getElementById('login-error').innerText = 'Invalid PIN code';
            }
        } catch (err) {
            document.getElementById('login-error').innerText = 'Connection error';
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        currentPin = '';
        document.getElementById('pin-input').value = '';
        settingsContainer.classList.add('hidden');
        setTimeout(() => {
            loginContainer.classList.remove('hidden');
        }, 400);
    });

    // Populate
    function populateSettings(settings) {
        document.getElementById('secondsPerCoin').value = settings.secondsPerCoin;
        document.getElementById('minCoinsPerGift').value = settings.minCoinsPerGift;
        
        document.getElementById('start-hours').value = Math.floor(settings.startTimeSeconds / 3600);
        document.getElementById('start-mins').value = Math.floor((settings.startTimeSeconds % 3600) / 60);
        document.getElementById('start-secs').value = settings.startTimeSeconds % 60;
        
        document.getElementById('max-hours').value = Math.floor(settings.maxTimeSeconds / 3600);
        document.getElementById('max-mins').value = Math.floor((settings.maxTimeSeconds % 3600) / 60);
        document.getElementById('max-secs').value = settings.maxTimeSeconds % 60;
    }

    // Save
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveStatus = document.getElementById('save-status');
        saveStatus.innerText = 'Saving...';
        saveStatus.className = 'status-msg';

        const startHours = parseInt(document.getElementById('start-hours').value) || 0;
        const startMins = parseInt(document.getElementById('start-mins').value) || 0;
        const startSecs = parseInt(document.getElementById('start-secs').value) || 0;
        
        const maxHours = parseInt(document.getElementById('max-hours').value) || 0;
        const maxMins = parseInt(document.getElementById('max-mins').value) || 0;
        const maxSecs = parseInt(document.getElementById('max-secs').value) || 0;

        const newSettings = {
            secondsPerCoin: parseInt(document.getElementById('secondsPerCoin').value),
            minCoinsPerGift: parseInt(document.getElementById('minCoinsPerGift').value),
            startTimeSeconds: (startHours * 3600) + (startMins * 60) + startSecs,
            maxTimeSeconds: (maxHours * 3600) + (maxMins * 60) + maxSecs
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-pin-code': currentPin 
                },
                body: JSON.stringify(newSettings)
            });
            
            if (res.ok) {
                // Apply the new start time to the current timer immediately
                await fetch('/api/state/set', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-pin-code': currentPin 
                    },
                    body: JSON.stringify({ timeSeconds: newSettings.startTimeSeconds })
                });

                saveStatus.innerText = 'Settings saved and timer updated!';
                saveStatus.classList.add('success');
                setTimeout(() => saveStatus.innerText = '', 3000);
                fetchState();
            } else {
                saveStatus.innerText = 'Error saving settings';
                saveStatus.classList.add('error-msg');
            }
        } catch (err) {
            saveStatus.innerText = 'Connection error';
            saveStatus.classList.add('error-msg');
        }
    });

    // State
    async function fetchState() {
        if (!currentPin) return;
        try {
            const res = await fetch('/api/state', {
                headers: { 'x-pin-code': currentPin }
            });
            if (res.ok) {
                const state = await res.json();
                const statusText = state.isRunning ? `Running - ${state.currentTimeSeconds}s remaining` : `Paused - ${state.currentTimeSeconds}s remaining`;
                document.getElementById('timer-status').innerText = `Timer Status: ${statusText}`;
            }
        } catch (e) {}
    }

    // Controls
    document.getElementById('toggle-timer-btn').addEventListener('click', async () => {
        try {
            await fetch('/api/state/toggle', {
                method: 'POST',
                headers: { 'x-pin-code': currentPin }
            });
            fetchState();
        } catch (e) {}
    });

    document.getElementById('reset-timer-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset the timer to the start time?')) {
            try {
                await fetch('/api/state/reset', {
                    method: 'POST',
                    headers: { 'x-pin-code': currentPin }
                });
                fetchState();
            } catch (e) {}
        }
    });
});
