// State & Variables
let playlist = [];
let albums = {};
let currentIndex = -1;
let isShuffle = false;
let isRepeat = false;

// Web Audio API & Equalizer State
let audioCtx;
let trackSource;
let analyser;
let eqFilters = [];
const Frequencies = [60, 230, 910, 3600, 14000];

// DOM Elements
const audioElement = document.getElementById('audio-element');
const playBtn = document.getElementById('btn-play');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const shuffleBtn = document.getElementById('btn-shuffle');
const repeatBtn = document.getElementById('btn-repeat');

const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const volumeBar = document.getElementById('volume-bar');

const playerCover = document.getElementById('player-cover');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');

const songsGrid = document.getElementById('songs-grid');
const carouselTrack = document.getElementById('carousel-track');
const searchInput = document.getElementById('search-input');
const audioUpload = document.getElementById('audio-upload');

const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// Default fallback cover image
const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80';

// Initialize Web Audio API
function initAudioContext() {
    if (audioCtx) return;
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    trackSource = audioCtx.createMediaElementSource(audioElement);

    // Build Equalizer Filters
    let previousNode = trackSource;
    eqFilters = Frequencies.map(freq => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = freq < 100 ? 'lowshelf' : freq > 10000 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = 0;

        previousNode.connect(filter);
        previousNode = filter;
        return filter;
    });

    previousNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    setupVisualizer();
}

// Visualizer Canvas Rendering
function setupVisualizer() {
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');

    function render() {
        requestAnimationFrame(render);
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = `#00d2ff`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            x += barWidth;
        }
    }
    render();
}

// Handle Local Music Files Upload
audioUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const song = {
            id: Date.now() + Math.random(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Artista Desconocido',
            album: 'Sin Álbum',
            cover: defaultCover,
            url: URL.createObjectURL(file)
        };
        playlist.push(song);
        
        // Group into default albums
        if (!albums[song.album]) albums[song.album] = [];
        albums[song.album].push(song);
    });

    renderLibrary();
    renderCarousel();
    renderAlbums();

    if (currentIndex === -1 && playlist.length > 0) {
        loadSong(0);
    }
});

// Render Songs in Library Section
function renderLibrary(songsToRender = playlist) {
    songsGrid.innerHTML = '';
    
    if (songsToRender.length === 0) {
        songsGrid.innerHTML = `<div class="empty-msg">No se encontraron canciones.</div>`;
        return;
    }

    songsToRender.forEach((song) => {
        const index = playlist.findIndex(s => s.id === song.id);
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${song.cover}" alt="Cover">
                <div class="card-play-overlay">
                    <button class="play-icon-btn" onclick="playSongAtIndex(${index})">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="song-title">${song.title}</div>
            <div class="song-artist">${song.artist}</div>
        `;
        songsGrid.appendChild(card);
    });
}

// Render Songs in Carousel Section
function renderCarousel() {
    carouselTrack.innerHTML = '';
    
    if (playlist.length === 0) {
        carouselTrack.innerHTML = `<div class="empty-msg">Carga canciones para verlas destacadas en el carrusel</div>`;
        return;
    }

    playlist.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'carousel-card';
        card.onclick = () => playSongAtIndex(index);
        card.innerHTML = `
            <img src="${song.cover}" alt="Cover">
            <div class="song-title">${song.title}</div>
            <div class="song-artist">${song.artist}</div>
        `;
        carouselTrack.appendChild(card);
    });
}

// Render Albums
function renderAlbums() {
    const grid = document.getElementById('albums-grid');
    grid.innerHTML = '';

    const keys = Object.keys(albums);
    if (keys.length === 0) {
        grid.innerHTML = `<div class="empty-msg">No hay álbumes creados aún.</div>`;
        return;
    }

    keys.forEach(albumName => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        albumCard.innerHTML = `
            <h3 class="album-title">${albumName}</h3>
            <p style="color: var(--text-dim); font-size: 0.85rem;">${albums[albumName].length} canciones</p>
        `;
        grid.appendChild(albumCard);
    });
}

// Carousel Controls Navigation
document.getElementById('carousel-next').onclick = () => {
    carouselTrack.scrollBy({ left: 240, behavior: 'smooth' });
};
document.getElementById('carousel-prev').onclick = () => {
    carouselTrack.scrollBy({ left: -240, behavior: 'smooth' });
};

// Play Specific Song Function
function playSongAtIndex(index) {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    initAudioContext();
    
    currentIndex = index;
    loadSong(currentIndex);
    audioElement.play();
    updatePlayButtonState(true);
}

function loadSong(index) {
    const song = playlist[index];
    if (!song) return;

    audioElement.src = song.url;
    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist;
    playerCover.src = song.cover;
}

// Main Controls Functionality
playBtn.onclick = () => {
    if (playlist.length === 0) return;
    initAudioContext();

    if (audioElement.paused) {
        audioElement.play();
        updatePlayButtonState(true);
    } else {
        audioElement.pause();
        updatePlayButtonState(false);
    }
};

function updatePlayButtonState(isPlaying) {
    playBtn.innerHTML = isPlaying 
        ? `<i class="fa-solid fa-pause"></i>` 
        : `<i class="fa-solid fa-play"></i>`;
}

prevBtn.onclick = () => {
    if (playlist.length === 0) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSongAtIndex(currentIndex);
};

nextBtn.onclick = () => {
    if (playlist.length === 0) return;
    
    if (isShuffle) {
        currentIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    playSongAtIndex(currentIndex);
};

shuffleBtn.onclick = () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
};

repeatBtn.onclick = () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
};

audioElement.onended = () => {
    if (isRepeat) {
        audioElement.play();
    } else {
        nextBtn.click();
    }
};

// Progress and Volume Controls
audioElement.ontimeupdate = () => {
    if (!isNaN(audioElement.duration)) {
        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        progressBar.value = progress;
        
        currentTimeEl.textContent = formatTime(audioElement.currentTime);
        totalDurationEl.textContent = formatTime(audioElement.duration);
    }
};

progressBar.oninput = () => {
    if (!isNaN(audioElement.duration)) {
        audioElement.currentTime = (progressBar.value / 100) * audioElement.duration;
    }
};

volumeBar.oninput = () => {
    audioElement.volume = volumeBar.value;
};

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// Search Filter Input
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = playlist.filter(song => 
        song.title.toLowerCase().includes(term) || 
        song.artist.toLowerCase().includes(term)
    );
    renderLibrary(filtered);
});

// Navigation View Tabs
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${btn.dataset.target}-view`).classList.add('active');
    };
});

// Equalizer Bands Adjustment
document.querySelectorAll('.eq-band').forEach((slider, idx) => {
    slider.oninput = (e) => {
        const val = e.target.value;
        const freq = slider.dataset.freq;
        document.getElementById(`val-${freq}`).textContent = `${val}dB`;
        
        if (eqFilters[idx]) {
            eqFilters[idx].gain.value = parseFloat(val);
        }
    };
});

// Responsive Sidebar Toggle
menuToggle.onclick = () => {
    sidebar.classList.toggle('open');
};