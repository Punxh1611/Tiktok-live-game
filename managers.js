const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'data', 'settings.json');
const statePath = path.join(__dirname, 'data', 'state.json');

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(settingsPath)) {
                return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return {
            pinCode: "1234",
            secondsPerCoin: 10,
            startTimeSeconds: 1800,
            maxTimeSeconds: 21600,
            minCoinsPerGift: 1
        };
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
    }

    getSettings() {
        return this.settings;
    }
}

class StateManager {
    constructor(settingsManager, io) {
        this.settingsManager = settingsManager;
        this.io = io;
        this.state = this.loadState();
        this.processedEvents = new Set(); // For idempotency
        this.timerInterval = null;
        this.startTimer();
    }

    loadState() {
        try {
            if (fs.existsSync(statePath)) {
                return JSON.parse(fs.readFileSync(statePath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
        return {
            currentTimeSeconds: this.settingsManager.getSettings().startTimeSeconds,
            isRunning: false
        };
    }

    saveState() {
        fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
    }

    getState() {
        return this.state;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Tick every 1 second
        this.timerInterval = setInterval(() => {
            if (this.state.isRunning && this.state.currentTimeSeconds > 0) {
                this.state.currentTimeSeconds -= 1;
                this.broadcastState();
                
                // Save state periodically (e.g., every 10 seconds to avoid disk spam)
                if (this.state.currentTimeSeconds % 10 === 0) {
                    this.saveState();
                }
            } else if (this.state.currentTimeSeconds <= 0 && this.state.isRunning) {
                this.state.isRunning = false;
                this.state.currentTimeSeconds = 0;
                this.broadcastState();
                this.saveState();
            }
        }, 1000);
    }

    setRunning(isRunning) {
        this.state.isRunning = isRunning;
        this.broadcastState();
        this.saveState();
    }

    resetTime() {
        const settings = this.settingsManager.getSettings();
        this.state.currentTimeSeconds = settings.startTimeSeconds;
        this.state.isRunning = false;
        this.broadcastState();
        this.saveState();
    }

    addTimeFromGift(eventId, coins, giftName, senderName) {
        // Idempotency check
        if (this.processedEvents.has(eventId)) {
            console.log(`Event ${eventId} already processed, skipping.`);
            return false;
        }

        const settings = this.settingsManager.getSettings();
        
        if (coins < settings.minCoinsPerGift) {
            console.log(`Gift coins (${coins}) is less than minimum (${settings.minCoinsPerGift}), skipping.`);
            return false;
        }

        this.processedEvents.add(eventId);

        // Keep Set size manageable
        if (this.processedEvents.size > 1000) {
            const iterator = this.processedEvents.values();
            this.processedEvents.delete(iterator.next().value);
        }

        const secondsToAdd = coins * settings.secondsPerCoin;
        this.state.currentTimeSeconds += secondsToAdd;

        // Apply max time ceiling
        if (this.state.currentTimeSeconds > settings.maxTimeSeconds) {
            this.state.currentTimeSeconds = settings.maxTimeSeconds;
        }

        console.log(`Added ${secondsToAdd}s for ${coins} coins from ${senderName}. New time: ${this.state.currentTimeSeconds}s`);

        // Emit gift event for animation
        this.io.emit('giftEvent', {
            senderName,
            giftName,
            coins,
            addedSeconds: secondsToAdd
        });

        this.broadcastState();
        this.saveState();
        return true;
    }

    broadcastState() {
        this.io.emit('stateUpdate', this.state);
    }
}

module.exports = { SettingsManager, StateManager };
