document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const timerText = document.getElementById('timer-text');
    const timerContainer = document.getElementById('timer-container');
    const eventsContainer = document.getElementById('events-container');

    let currentSeconds = 0;
    let isRunning = false;
    let localTimerInterval = null;

    function formatTime(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        const pad = (num) => num.toString().padStart(2, '0');
        
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    }

    function updateTimerUI() {
        timerText.innerText = formatTime(currentSeconds);

        if (currentSeconds <= 60 && currentSeconds > 0 && isRunning) {
            timerText.classList.add('danger');
        } else {
            timerText.classList.remove('danger');
        }
    }

    // Connect & State Sync
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('stateUpdate', (state) => {
        console.log('State update received:', state);
        currentSeconds = state.currentTimeSeconds;
        isRunning = state.isRunning;
        updateTimerUI();
        
        // Use local interval to tick between server updates for smoother UI
        if (localTimerInterval) clearInterval(localTimerInterval);
        if (isRunning && currentSeconds > 0) {
            localTimerInterval = setInterval(() => {
                if (currentSeconds > 0) {
                    currentSeconds--;
                    updateTimerUI();
                } else {
                    clearInterval(localTimerInterval);
                }
            }, 1000);
        }
    });

    // Gift Events & Animations
    socket.on('giftEvent', (data) => {
        // data: { senderName, giftName, coins, addedSeconds }
        showEventAnimation(data);
        triggerTimerGlow();
    });

    function triggerTimerGlow() {
        timerContainer.classList.add('active-glow');
        // Add a slight bounce
        timerContainer.style.transform = 'scale(1.05)';
        setTimeout(() => {
            timerContainer.style.transform = 'scale(1)';
            timerContainer.classList.remove('active-glow');
        }, 500);
    }

    function showEventAnimation(data) {
        const el = document.createElement('div');
        el.className = 'event-card';
        
        if (data.coins >= 100) {
            el.classList.add('large-gift');
        }

        el.innerText = `${data.senderName} ส่ง ${data.giftName} (+${data.addedSeconds}s)`;
        
        eventsContainer.prepend(el);

        // Remove element after animation ends
        setTimeout(() => {
            if (eventsContainer.contains(el)) {
                eventsContainer.removeChild(el);
            }
        }, 6000);
    }
});
