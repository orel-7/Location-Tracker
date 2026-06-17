const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Store connected clients
const clients = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  const clientInfo = {
    id: clientId,
    ws,
    location: null,
    username: 'משתמש ' + clients.size
  };
  
  clients.set(clientId, clientInfo);
  console.log(`✓ לקוח חדש מחובר: ${clientId}`);
  
  // שלח את מזהה הלקוח ללקוח
  ws.send(JSON.stringify({
    type: 'connection',
    clientId,
    message: 'התחברת בהצלחה!'
  }));
  
  // שלח רשימת לקוחות פעילים
  broadcastClientList();
  
  // קבל הודעות
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(clientId, message);
    } catch (err) {
      console.error('שגיאה בפענוח הודעה:', err);
    }
  });
  
  // טיפול בניתוק
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`✗ לקוח התנתק: ${clientId}`);
    broadcastClientList();
  });
  
  ws.on('error', (err) => {
    console.error(`שגיאת WebSocket עבור ${clientId}:`, err);
  });
});

function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;
  
  switch (message.type) {
    case 'location':
      // עדכן מיקום
      client.location = {
        lat: message.lat,
        lng: message.lng,
        accuracy: message.accuracy,
        timestamp: new Date().toISOString()
      };
      
      // שלח עדכון מיקום לכל הלקוחות
      broadcastMessage({
        type: 'location_update',
        clientId,
        location: client.location,
        username: client.username
      });
      break;
    
    case 'chat':
      // שלח הודעת צ'ט
      broadcastMessage({
        type: 'chat',
        clientId,
        username: client.username,
        message: message.text,
        timestamp: new Date().toISOString()
      });
      break;
    
    case 'voice_transcription':
      // שלח תמלול קול
      broadcastMessage({
        type: 'voice_message',
        clientId,
        username: client.username,
        transcription: message.transcription,
        timestamp: new Date().toISOString()
      });
      break;
    
    case 'distance_request':
      // חשב מרחק בין שתי נקודות
      const distance = calculateDistance(
        message.from.lat,
        message.from.lng,
        message.to.lat,
        message.to.lng
      );
      
      client.ws.send(JSON.stringify({
        type: 'distance_result',
        distance: distance,
        unit: 'km'
      }));
      break;
    
    case 'set_username':
      client.username = message.username || client.username;
      broadcastClientList();
      break;
  }
}

function broadcastMessage(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  });
}

function broadcastClientList() {
  const clientList = Array.from(clients.values()).map(c => ({
    id: c.id,
    username: c.username,
    hasLocation: c.location !== null
  }));
  
  broadcastMessage({
    type: 'client_list',
    clients: clientList
  });
}

// חשב מרחק בין שתי נקודות (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}

function toRad(x) {
  return x * Math.PI / 180;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running ✓' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 השרת פעיל ב-http://localhost:${PORT}`);
});
