// WebSocket connection
let ws = null;
let myClientId = null;
let myLocation = null;
let map = null;
let markers = new Map();
let polylines = new Map();
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  connectWebSocket();
  startTrackingLocation();
  setInterval(sendLocationUpdate, 5000); // Update location every 5 seconds
});

// Initialize map
function initMap() {
  // Default location: Tel Aviv
  map = L.map('map').setView([32.0853, 34.7818], 13);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
}

// Connect to WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✓ מחובר לשרת');
    updateConnectionStatus('מחובר');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('שגיאת WebSocket:', error);
    updateConnectionStatus('שגיאה בחיבור');
  };
  
  ws.onclose = () => {
    console.log('✗ התנתק מהשרת');
    updateConnectionStatus('מנותק');
    // Try to reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
}

// Handle incoming messages
function handleWebSocketMessage(message) {
  switch(message.type) {
    case 'connection':
      myClientId = message.clientId;
      console.log('ID שלך:', myClientId);
      break;
    
    case 'location_update':
      updateMarkerOnMap(message.clientId, message.location, message.username);
      break;
    
    case 'chat':
      addChatMessage(message.username, message.message, false);
      break;
    
    case 'voice_message':
      addChatMessage(message.username + ' 🎤', message.transcription, false);
      break;
    
    case 'client_list':
      updateClientsList(message.clients);
      break;
    
    case 'distance_result':
      showDistanceResult(message.distance);
      break;
  }
}

// Get user's current location
function startTrackingLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        myLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        // Update location display
        document.getElementById('my-lat').textContent = myLocation.lat.toFixed(6);
        document.getElementById('my-lng').textContent = myLocation.lng.toFixed(6);
        document.getElementById('my-accuracy').textContent = Math.round(myLocation.accuracy);
        document.getElementById('my-time').textContent = new Date().toLocaleTimeString('he-IL');
        
        // Center map on my location on first load
        if (!map.hasLayer(map._PluginImport)) {
          map.setView([myLocation.lat, myLocation.lng], 15);
        }
      },
      (error) => {
        console.error('שגיאה בקבלת מיקום:', error);
        addChatMessage('סיסטם', '⚠️ לא ניתן לקבל את המיקום שלך. בדוק הרשאות דפדפן.', true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    addChatMessage('סיסטם', '❌ דפדפן זה לא תומך בגיאולוקציה', true);
  }
}

// Send location update to server
function sendLocationUpdate() {
  if (ws && ws.readyState === WebSocket.OPEN && myLocation) {
    ws.send(JSON.stringify({
      type: 'location',
      lat: myLocation.lat,
      lng: myLocation.lng,
      accuracy: myLocation.accuracy
    }));
  }
}

// Get my location and center map
function getMyLocation() {
  if (myLocation) {
    map.setView([myLocation.lat, myLocation.lng], 15);
  }
}

// Fit all markers on map
function fitAllMarkers() {
  if (markers.size === 0) return;
  
  const group = new L.featureGroup(Array.from(markers.values()));
  map.fitBounds(group.getBounds().pad(0.1));
}

// Update marker on map
function updateMarkerOnMap(clientId, location, username) {
  const { lat, lng } = location;
  
  if (markers.has(clientId)) {
    // Update existing marker
    markers.get(clientId).setLatLng([lat, lng]);
  } else {
    // Create new marker
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#667eea',
      color: '#667eea',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    })
    .bindPopup(username)
    .addTo(map);
    
    markers.set(clientId, marker);
  }
  
  // Draw line from my location to this user
  if (myClientId && clientId !== myClientId && myLocation) {
    const polylineId = `${myClientId}-${clientId}`;
    const line = [[myLocation.lat, myLocation.lng], [lat, lng]];
    
    if (polylines.has(polylineId)) {
      polylines.get(polylineId).setLatLngs(line);
    } else {
      const polyline = L.polyline(line, {
        color: '#667eea',
        weight: 2,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(map);
      
      polylines.set(polylineId, polyline);
    }
  }
}

// Send chat message
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (message && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat',
      text: message
    }));
    
    addChatMessage('אתה', message, true);
    input.value = '';
  }
}

// Add message to chat
function addChatMessage(username, message, isOwn) {
  const chatMessages = document.getElementById('chat-messages');
  const messageEl = document.createElement('div');
  
  messageEl.className = 'message ' + (isOwn ? 'own' : 'other');
  if (!isOwn && username === 'סיסטם') {
    messageEl.className = 'message system';
  }
  
  messageEl.innerHTML = `<strong>${username}</strong><br>${escapeHtml(message)}`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update clients list
function updateClientsList(clients) {
  const clientsList = document.getElementById('clients-list');
  clientsList.innerHTML = '';
  
  clients.forEach(client => {
    const clientEl = document.createElement('div');
    clientEl.className = 'client-item';
    clientEl.innerHTML = `
      <div class="client-name">
        <span>${client.username}</span>
        <span>${client.hasLocation ? '📍' : '❌'}</span>
      </div>
      <div class="client-status">
        ID: ${client.id.substring(0, 8)}...
      </div>
    `;
    clientsList.appendChild(clientEl);
  });
}

// Calculate distance
function calculateDistance() {
  if (!myLocation) {
    alert('המיקום שלך עדיין לא נטען');
    return;
  }
  
  const toLat = parseFloat(document.getElementById('to-lat').value);
  const toLng = parseFloat(document.getElementById('to-lng').value);
  
  if (isNaN(toLat) || isNaN(toLng)) {
    alert('הכנס קואורדינטות תקינות');
    return;
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'distance_request',
      from: { lat: myLocation.lat, lng: myLocation.lng },
      to: { lat: toLat, lng: toLng }
    }));
  }
}

// Show distance result
function showDistanceResult(distance) {
  const resultEl = document.getElementById('distance-result');
  resultEl.innerHTML = `📏 המרחק: <strong>${distance} ק"מ</strong>`;
  resultEl.style.display = 'block';
}

// Voice recording toggle
async function toggleVoiceRecord() {
  const btn = document.getElementById('voice-btn');
  
  if (!isRecording) {
    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start();
      isRecording = true;
      btn.classList.add('recording');
      btn.textContent = '⏹️ עצור';
    } catch (error) {
      console.error('שגיאה בהתחלת הקלטה:', error);
      alert('לא ניתן להקליט קול. בדוק הרשאות דפדפן.');
    }
  } else {
    // Stop recording
    mediaRecorder.stop();
    isRecording = false;
    btn.classList.remove('recording');
    btn.textContent = '🎤 הקלט';
  }
}

// Transcribe audio (using Web Speech API as fallback)
function transcribeAudio(audioBlob) {
  // Using Web Speech API for transcription
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.language = 'he-IL';
  recognition.continuous = false;
  recognition.interimResults = false;
  
  recognition.onstart = () => {
    addChatMessage('סיסטם', '🎤 מאזין...', true);
  };
  
  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      finalTranscript += event.results[i][0].transcript;
    }
    
    if (finalTranscript) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'voice_transcription',
          transcription: finalTranscript
        }));
      }
      addChatMessage('אתה 🎤', finalTranscript, true);
    }
  };
  
  recognition.onerror = (event) => {
    console.error('שגיאה בתמלול:', event.error);
  };
  
  // Create a temporary audio context for Web Speech
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
}

// Switch tabs
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabName).classList.add('active');
  
  // Mark button as active
  event.target.classList.add('active');
}

// Update username
function updateUsername() {
  const username = document.getElementById('username-input').value.trim();
  
  if (username && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'set_username',
      username: username
    }));
    
    addChatMessage('סיסטם', `✓ שמך שונה ל-"${username}"`, true);
  }
}

// Update connection status
function updateConnectionStatus(status) {
  document.getElementById('connection-status').textContent = status;
}

// Escape HTML special characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
