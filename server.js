const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { SettingsManager, StateManager } = require('./managers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Managers
const settingsManager = new SettingsManager();
const stateManager = new StateManager(settingsManager, io);

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Send current state to newly connected client immediately
    socket.emit('stateUpdate', stateManager.getState());
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Middleware for PIN authentication
const requirePin = (req, res, next) => {
    const pin = req.headers['x-pin-code'];
    const currentPin = settingsManager.getSettings().pinCode;
    if (pin === currentPin) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
    }
};

// --- Webhook API ---
app.post('/webhook/gift', (req, res) => {
    // Expected Payload from TikFinity (example)
    // Adjust based on actual TikFinity webhook structure
    const { eventId, giftName, coins, senderName, repeatEnd } = req.body;

    // TikFinity usually sends repeatEnd for combo gifts. We only want to process when combo ends or it's a single gift.
    if (repeatEnd === false) {
        return res.status(200).send('Ignoring until repeatEnd is true');
    }

    if (!eventId || coins === undefined) {
        return res.status(400).send('Bad Request: Missing required fields');
    }

    const success = stateManager.addTimeFromGift(eventId, parseInt(coins, 10), giftName, senderName);
    
    if (success) {
        res.status(200).send('Gift processed and time added');
    } else {
        res.status(200).send('Gift ignored (duplicate or below minimum)');
    }
});

// --- Settings & State APIs ---
app.get('/api/settings', requirePin, (req, res) => {
    res.json(settingsManager.getSettings());
});

app.post('/api/settings', requirePin, (req, res) => {
    settingsManager.saveSettings(req.body);
    res.json({ success: true, settings: settingsManager.getSettings() });
});

app.get('/api/state', requirePin, (req, res) => {
    res.json(stateManager.getState());
});

app.post('/api/state/toggle', requirePin, (req, res) => {
    const currentState = stateManager.getState();
    stateManager.setRunning(!currentState.isRunning);
    res.json({ success: true, isRunning: stateManager.getState().isRunning });
});

app.post('/api/state/reset', requirePin, (req, res) => {
    stateManager.resetTime();
    res.json({ success: true, state: stateManager.getState() });
});

app.post('/api/state/set', requirePin, (req, res) => {
    const { timeSeconds } = req.body;
    if (typeof timeSeconds === 'number') {
        stateManager.state.currentTimeSeconds = timeSeconds;
        stateManager.broadcastState();
        stateManager.saveState();
        res.json({ success: true, state: stateManager.getState() });
    } else {
        res.status(400).json({ error: 'Invalid time' });
    }
});


// --- Frontend Routes ---
app.get('/', (req, res) => {
    res.redirect('/settings');
});
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings', 'index.html'));
});
app.get('/overlay', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'overlay', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Overlay URL: http://localhost:${PORT}/overlay`);
  console.log(`Settings URL: http://localhost:${PORT}/settings`);
});
