const audio   = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const playIcon= document.getElementById('playIcon');

const ageGate = document.getElementById('ageGate');
const ageYes  = document.getElementById('ageYes');
const ageNo   = document.getElementById('ageNo');

const DURATIONS_KEY = 'cepuyka_fm_durations_sync_v3'; 
const EPOCH = new Date('2024-01-01T00:00:00').getTime(); 

let playlist = {
  songs: Array.from({length: 46}, (_, i) => `./Radio/2/song${i + 1}.mp3`)
};

let durations = []; 
let totalDuration = 0; 
let isPlaying = false;
let syncInterval = null;

async function loadDurations() {
  const cached = localStorage.getItem(DURATIONS_KEY);
  if (cached) {
    durations = JSON.parse(cached);
    totalDuration = durations.reduce((a, b) => a + b, 0);
    return;
  }

  console.log("Замер длительности песен...");
  const tempAudio = new Audio();
  durations = [];

  for (let i = 0; i < playlist.songs.length; i++) {
    await new Promise((resolve) => {
      tempAudio.src = playlist.songs[i];
      tempAudio.onloadedmetadata = () => {
        let dur = tempAudio.duration;
        if (!isFinite(dur) || dur === 0) dur = 180; 
        durations.push(dur);
        resolve();
      };
      tempAudio.onerror = () => { durations.push(180); resolve(); };
    });
  }
  
  localStorage.setItem(DURATIONS_KEY, JSON.stringify(durations));
  totalDuration = durations.reduce((a, b) => a + b, 0);
}

function getCurrentTrackInfo() {
  const now = new Date();
  const moscowHour = parseInt(new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: 'numeric' }).format(now), 10);
  const moscowMinutes = parseInt(new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', minute: 'numeric' }).format(now), 10);
  
  if (moscowHour === 19 && moscowMinutes === 0) {
    return { src: './Radio/3/19.mp3', offset: 0, isProgram: true };
  }

  const timeSinceEpoch = Math.floor((now.getTime() - EPOCH) / 1000);
  let timeInCycle = timeSinceEpoch % totalDuration;

  for (let i = 0; i < durations.length; i++) {
    if (timeInCycle < durations[i]) {
      return { src: playlist.songs[i], offset: timeInCycle, isProgram: false };
    }
    timeInCycle -= durations[i];
  }
  return { src: playlist.songs[0], offset: 0, isProgram: false };
}

function enforceSync(isAutoNext = false) {
  if (!isPlaying || (!isAutoNext && audio.paused)) return;

  const track = getCurrentTrackInfo();

  // Если играет не та песня, включаем нужную
  if (!audio.src.includes(track.src)) {
    audio.playbackRate = 1.0;
    audio.src = track.src;
    // Если это не автопереход, а плановая проверка, отматываем на нужную секунду
    if (!isAutoNext) {
      audio.currentTime = track.offset;
    }
    audio.play().catch(e => console.log(e));
    return;
  }

  // Если это плановая проверка (каждые 10 сек)
  if (!isAutoNext) {
    const diff = audio.currentTime - track.offset;
    if (Math.abs(diff) > 4) {
      audio.playbackRate = 1.0;
      audio.currentTime = track.offset;
    } else if (diff > 1) {
      audio.playbackRate = 1.05; 
    } else if (diff < -1) {
      audio.playbackRate = 0.95; 
    } else {
      audio.playbackRate = 1.0; 
    }
  }
}

// МГНОВЕННОЕ переключение, как только песня кончается
audio.addEventListener('ended', () => {
  if (isPlaying) {
    enforceSync(true); // true означает, что мы не отматываем время, а включаем новую с начала
  }
});

// Плановая проверка каждые 10 секунд
function startSyncLoop() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (isPlaying && !audio.paused) {
      enforceSync(false);
    }
  }, 10000); // 10 000 мс = 10 секунд
}

function startRadio() {
  if (!isPlaying) {
    isPlaying = true;
    enforceSync(false);
    startSyncLoop();
  } else if (audio.paused) {
    audio.play();
  }
  playIcon.textContent = '❚❚';
  playBtn.classList.add('playing');
}

function stopRadio() {
  isPlaying = false;
  audio.pause();
  clearInterval(syncInterval);
  playIcon.textContent = '▶';
  playBtn.classList.remove('playing');
}

ageYes.addEventListener('click', async () => {
  ageGate.classList.add('hidden');
  await loadDurations(); 
  startRadio();
});

ageNo.addEventListener('click', () => window.location.href = 'https://www.google.com');

playBtn.addEventListener('click', async () => {
  if (ageGate.classList.contains('hidden')) {
    if (audio.paused) {
      await loadDurations(); 
      startRadio();
    } else {
      stopRadio();
    }
  }
});

async function init() {
  try {
    const res = await fetch('./playlist.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.songs && data.songs.length > 0) {
        playlist.songs = data.songs;
      }
    }
  } catch (e) {}
}
init();