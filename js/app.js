
/** * ==========================================
 * CORE & UTILITARIOS 
 * ==========================================
 */
const MaestroCore = {
    audioCtx: null,
    state: {
        theme: 'dark',
        activeView: 'view-metronome',
        mode: 'normal' // normal, worship
    },

    // Constantes Musicais Universais
    NOTES: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    ENHARMONICS: { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' },

    formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    },

    noteToFreq(noteNum, refA = 440) { return refA * Math.pow(2, (noteNum - 69) / 12); },
    freqToNote(freq, refA = 440) { return Math.round(12 * (Math.log(freq / refA) / Math.log(2))) + 69; },

    toast(message, type = 'success') {
        // Remove toats antigos para não acumular
        const old = document.getElementById('maestro-toast');
        if (old) old.remove();

        const el = document.createElement('div');
        el.id = 'maestro-toast';
        const icon = type === 'success' ? '<i class="fas fa-check-circle text-brand"></i>' : '<i class="fas fa-info-circle text-blue-500"></i>';

        el.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm z-[200] transition-all duration-300 translate-y-[-150%] opacity-0 flex items-center gap-3 border border-white/10';
        el.innerHTML = `${icon} ${message}`;
        document.body.appendChild(el);

        // Força reflow
        void el.offsetWidth;

        el.classList.remove('translate-y-[-150%]', 'opacity-0');
        setTimeout(() => {
            el.classList.add('translate-y-[-150%]', 'opacity-0');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    },

    initAudio() {
        try {
            if (!this.audioCtx) {
                // Criar contexto com fallback para Safari antigo
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContextClass();
                this.recorderDest = this.audioCtx.createMediaStreamDestination();

                // Inicializa Motor de Pianos Reais
                if (window.PianoEngine) PianoEngine.init(this.audioCtx);
            }

            // Requisito iOS: Desbloquear contexto sonoro após interação do usuário
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        } catch (e) {
            console.warn("Web Audio API bloqueada ou indisponível:", e);
        }
    }
};

// Torna toast global para conveniência dos módulos
window.showToast = (msg, type) => MaestroCore.toast(msg, type);
window.MaestroCore = MaestroCore; // Exportação global para o Studio Modo

/** * ==========================================
 * MÓDULO: backup.js (Local Storage)
 * ==========================================
 */

const appId = typeof __app_id !== 'undefined' ? __app_id : 'maestro-pro-v3';

const StorageManager = {
    data: {
        stats: [],
        achievements: [],
        maxBpm: 120
    },

    load() {
        try {
            const stored = localStorage.getItem('maestro_v3_data');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data.stats = parsed.stats || [];
                this.data.achievements = parsed.achievements || [];
                this.data.maxBpm = parsed.maxBpm || 120;
            }
        } catch (e) {
            console.error("Corrupted LocalStorage", e);
        }
    },

    save() {
        try {
            localStorage.setItem('maestro_v3_data', JSON.stringify(this.data));
        } catch (e) {
            console.error("Failed to save to LocalStorage (possibly full)", e);
        }
    },

    addSessionTime(secondsToAdd) {
        if (!this.data.stats) this.data.stats = [];
        const todayStr = new Date().toISOString().split('T')[0];
        let todayRecord = this.data.stats.find(s => s.date === todayStr);
        if (todayRecord) todayRecord.seconds += secondsToAdd;
        else this.data.stats.push({ date: todayStr, seconds: secondsToAdd });
        // We don't save to storage every second to avoid hitting Firestore limits. Handled on stop/leave.
    }
};


/**
 * ==========================================
 * MÓDULO: Navegação & Tema (Configurações Visuais)
 * ==========================================
 */
const NavigationModule = {
    init() {
        const views = document.querySelectorAll('.view-section');
        const navBtns = document.querySelectorAll('.nav-btn');
        const themeBtn = document.getElementById('btn-theme-toggle');

        // =====================================
        // ETAPA 5: AJUSTAR ALTURA REAL DO MOBILE (PWA Safari Fix)
        // =====================================
        const updateViewportHeight = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        };
        window.addEventListener('resize', updateViewportHeight);
        window.addEventListener('orientationchange', updateViewportHeight);
        updateViewportHeight(); // Call on init
        // =====================================

        themeBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            MaestroCore.state.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            themeBtn.innerHTML = MaestroCore.state.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            if (EstatisticasApp.chart) EstatisticasApp.renderChart();
        });

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-target');
                if (!target) return; // Ignore pure toggle buttons without target

                navBtns.forEach(b => b.classList.remove('active'));

                // Tratar estado visual da aba pai "Ferramentas" (Hub)
                // Se estiver dentro de uma subferramenta, manter o Hub de Ferramentas aceso na barra lateral
                const toolsTargets = ['view-tools', 'view-professor', 'view-eartrainer', 'view-detector', 'view-fretboard', 'view-harmony', 'view-dashboard'];

                const sidebarHubBtn = document.querySelector('.nav-btn[data-target="view-tools"]');
                if (toolsTargets.includes(target)) {
                    // Mantem a label do "Ferramentas" ativa
                    if (sidebarHubBtn) sidebarHubBtn.classList.add('active');
                    // E destaca visualmente se o clique veio de dentro da propria grid
                    btn.classList.add('active', 'border-brand');
                } else {
                    if (sidebarHubBtn) sidebarHubBtn.classList.remove('active');
                    btn.classList.add('active');
                }

                views.forEach(v => {
                    v.classList.add('hidden');
                    if (v.id === target) v.classList.remove('hidden');
                });
                MaestroCore.state.activeView = target;

                // Lifecycle Hooks (Desligar recursos de hardware para poupar CPU/Bateria ao trocar de tela)
                if (target !== 'view-tuner' && AfinadorApp.isActive) AfinadorApp.stop();
                if (target !== 'view-detector' && DetectorApp.isActive) DetectorApp.stop();

                if (target === 'view-dashboard') EstatisticasApp.renderChart();

                // Forçar rolagem pro topo se entrar na hub de ferramentas
                if (target === 'view-tools') window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }
};


/**
 * ==========================================
 * MÓDULO: metronomo.js (AudioContext Scheduler)
 * ==========================================
 */
const MetronomoApp = {
    isPlaying: false, tempo: 70, beatsPerBar: 4, noteValue: 4, subdivision: 1,
    currentNote: 0, currentBeat: 0, nextNoteTime: 0.0,
    lookahead: 25.0, // ms entre callbacks do scheduler
    scheduleAheadTime: 0.1, // segundos agendados no futuro
    timerID: null, sound: 'digital', accentFirst: true,
    progActive: false, progStep: 5, progBars: 4, progMax: 200, barCount: 0, tapTimes: [],
    practiceInterval: null,

    init() {
        this.bindUI();
        this.renderIndicators();
    },

    bindUI() {
        document.getElementById('btn-play-metronome').addEventListener('click', () => this.toggle());

        const bpmInput = document.getElementById('bpm-display');
        bpmInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 120;
            this.setBPM(val);
        });

        document.getElementById('bpm-slider').addEventListener('input', (e) => this.setBPM(parseInt(e.target.value)));
        document.getElementById('btn-bpm-minus').addEventListener('click', () => this.setBPM(this.tempo - 1));
        document.getElementById('btn-bpm-plus').addEventListener('click', () => this.setBPM(this.tempo + 1));

        document.getElementById('time-sig-beats').addEventListener('change', (e) => { this.beatsPerBar = parseInt(e.target.value); this.renderIndicators(); });
        document.getElementById('time-sig-note').addEventListener('change', (e) => this.noteValue = parseInt(e.target.value));

        document.querySelectorAll('.subdiv-btn').forEach(btn => btn.addEventListener('click', (e) => {
            document.querySelectorAll('.subdiv-btn').forEach(b => b.classList.remove('active', 'bg-brand/20', 'text-brand'));
            e.currentTarget.classList.add('active', 'bg-brand/20', 'text-brand');
            this.subdivision = parseInt(e.currentTarget.getAttribute('data-val'));
        }));

        document.getElementById('sound-select').addEventListener('change', (e) => this.sound = e.target.value);
        document.getElementById('accent-toggle').addEventListener('change', (e) => this.accentFirst = e.target.checked);

        const progSettings = document.getElementById('prog-settings');
        document.getElementById('prog-toggle').addEventListener('change', (e) => {
            this.progActive = e.target.checked; this.barCount = 0;
            progSettings.classList.toggle('opacity-40', !this.progActive);
            progSettings.classList.toggle('pointer-events-none', !this.progActive);
        });

        document.getElementById('prog-bpm-step').addEventListener('change', e => this.progStep = parseInt(e.target.value));
        document.getElementById('prog-bars').addEventListener('change', e => this.progBars = parseInt(e.target.value));
        document.getElementById('prog-bpm-max').addEventListener('change', e => this.progMax = parseInt(e.target.value));

        document.getElementById('btn-tap').addEventListener('click', () => this.tapTempo());
    },

    setBPM(newTempo) {
        if (newTempo < 20) newTempo = 20; if (newTempo > 300) newTempo = 300;
        this.tempo = newTempo;
        document.getElementById('bpm-display').value = this.tempo;
        document.getElementById('bpm-slider').value = this.tempo;

        // Track max BPM for stats
        if (this.tempo > StorageManager.data.maxBpm) {
            StorageManager.data.maxBpm = this.tempo;
            ConquistasApp.checkBpm(this.tempo);
        }
    },

    tapTempo() {
        const now = Date.now();
        if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 2000) this.tapTimes = [];
        this.tapTimes.push(now);
        if (this.tapTimes.length > 4) this.tapTimes.shift();

        if (this.tapTimes.length > 1) {
            let totalInterval = 0;
            for (let i = 1; i < this.tapTimes.length; i++) totalInterval += this.tapTimes[i] - this.tapTimes[i - 1];
            this.setBPM(Math.round(60000 / (totalInterval / (this.tapTimes.length - 1))));
        }
    },

    renderIndicators() {
        const container = document.getElementById('beat-indicators');
        container.innerHTML = '';
        for (let i = 0; i < this.beatsPerBar; i++) {
            const div = document.createElement('div');
            div.className = `flex-1 h-3 rounded-full transition-all duration-100 ${i === 0 && this.accentFirst ? 'bg-gray-400 dark:bg-gray-600 h-6' : 'bg-gray-200 dark:bg-gray-800'}`;
            div.id = `beat-ind-${i}`;
            container.appendChild(div);
        }
    },

    toggle() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('btn-play-metronome');

        if (this.isPlaying) {
            MaestroCore.initAudio();

            // Garantir retomada imediata de contexto no evento click para iOS
            if (MaestroCore.audioCtx && MaestroCore.audioCtx.state === 'suspended') {
                MaestroCore.audioCtx.resume();
            }

            // O Safari exige q algo seja tocado imediatamente no gesto do usuário para validar o unblock,
            // então tocaremos um som mudo ou um 'tick' no tempo 0.
            const osc = MaestroCore.audioCtx.createOscillator();
            const gain = MaestroCore.audioCtx.createGain();
            gain.gain.value = 0; // Som mudo de destravamento
            osc.connect(gain);
            gain.connect(MaestroCore.audioCtx.destination);
            osc.start(MaestroCore.audioCtx.currentTime);
            osc.stop(MaestroCore.audioCtx.currentTime + 0.01);

            this.currentNote = 0; this.currentBeat = 0; this.barCount = 0;
            this.nextNoteTime = MaestroCore.audioCtx.currentTime + 0.05;
            this.scheduler();

            btn.innerHTML = '<i class="fas fa-stop"></i>';
            btn.classList.replace('bg-brand', 'bg-red-500');
            btn.classList.replace('hover:bg-brand-dark', 'hover:bg-red-600');
            btn.classList.replace('shadow-[0_10px_40px_-10px_rgba(16,185,129,0.8)]', 'shadow-[0_10px_40px_-10px_rgba(239,68,68,0.8)]');

            // Iniciar tracking de tempo de estudo passivo
            if (this.practiceInterval) clearInterval(this.practiceInterval);
            this.practiceInterval = setInterval(() => {
                EstatisticasApp.sessionSeconds++;
                document.getElementById('timer-display').innerText = MaestroCore.formatTime(EstatisticasApp.sessionSeconds);
                // Save every 30 seconds to minimize IO
                if (EstatisticasApp.sessionSeconds % 30 === 0) {
                    StorageManager.addSessionTime(30);
                    ConquistasApp.checkTime(StorageManager.data.stats);
                }
            }, 1000);

        } else {
            window.clearTimeout(this.timerID);
            btn.innerHTML = '<i class="fas fa-play ml-2"></i>';
            btn.classList.replace('bg-red-500', 'bg-brand');
            btn.classList.replace('hover:bg-red-600', 'hover:bg-brand-dark');
            btn.classList.replace('shadow-[0_10px_40px_-10px_rgba(239,68,68,0.8)]', 'shadow-[0_10px_40px_-10px_rgba(16,185,129,0.8)]');

            for (let i = 0; i < this.beatsPerBar; i++) {
                const ind = document.getElementById(`beat-ind-${i}`);
                if (ind) ind.style.backgroundColor = '';
            }

            if (this.practiceInterval) {
                clearInterval(this.practiceInterval);
                // Salva restos menores que 30 seg
                StorageManager.addSessionTime(EstatisticasApp.sessionSeconds % 30);
                StorageManager.save(); // Salva estado persistente ao parar o estudo
            }
        }
    },

    nextNote() {
        // Cálculo de duração da nota baseada na fórmula de compasso
        let secondsPerBeat = 60.0 / this.tempo;
        if (this.noteValue === 8) secondsPerBeat = secondsPerBeat / 2;

        this.nextNoteTime += secondsPerBeat / this.subdivision;
        this.currentNote++;

        if (this.currentNote === this.subdivision) {
            this.currentNote = 0;
            this.currentBeat++;

            if (this.currentBeat === this.beatsPerBar) {
                this.currentBeat = 0;
                this.barCount++;

                // Lógica de Speed Trainer
                if (this.progActive && this.barCount >= this.progBars) {
                    this.barCount = 0;
                    if (this.tempo + this.progStep <= this.progMax) {
                        this.setBPM(this.tempo + this.progStep);
                        showToast(`Acelerando: ${this.tempo} BPM`, 'info');
                    }
                }
            }
        }
    },

    scheduleNote(beatNumber, subNote, time) {
        // Sincronização visual UI frame-locked via rAF para não dessincronizar com o áudio
        requestAnimationFrame(() => {
            if (subNote === 0) {
                const pulse = document.getElementById('visual-pulse');
                pulse.classList.remove('pulse-active');
                void pulse.offsetWidth; // Force reflow trigger CSS Animation
                pulse.classList.add('pulse-active');

                for (let i = 0; i < this.beatsPerBar; i++) {
                    const ind = document.getElementById(`beat-ind-${i}`);
                    if (ind) {
                        ind.classList.remove('bg-brand', 'bg-brand-light');
                        ind.classList.add(i === 0 && this.accentFirst ? 'bg-gray-400' : 'bg-gray-200');
                        if (document.documentElement.classList.contains('dark')) {
                            ind.classList.remove('bg-gray-400', 'bg-gray-200');
                            ind.classList.add(i === 0 && this.accentFirst ? 'bg-gray-600' : 'bg-gray-800');
                        }
                    }
                }
                const activeInd = document.getElementById(`beat-ind-${beatNumber}`);
                if (activeInd) {
                    activeInd.classList.remove('bg-gray-200', 'bg-gray-400', 'bg-gray-600', 'bg-gray-800');
                    activeInd.classList.add(beatNumber === 0 && this.accentFirst ? 'bg-emerald-400' : 'bg-brand');
                }
            }
        });

        // A udio Synthesis Engine
        const osc = MaestroCore.audioCtx.createOscillator();
        const gain = MaestroCore.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(MaestroCore.audioCtx.destination);
        if (MaestroCore.recorderDest) gain.connect(MaestroCore.recorderDest); // Envia o bip para a gravação de estudos simultaneamente

        let freq = 440; let vol = 1; let type = 'sine';

        // Mapeamento Timbral Profissional
        if (subNote === 0) {
            if (beatNumber === 0 && this.accentFirst) { freq = 1760; vol = 1; } else { freq = 880; vol = 0.8; }
        } else {
            freq = 440; vol = 0.3; // Subdivision notes are quieter
        }

        if (this.sound === 'digital') { type = 'square'; }
        else if (this.sound === 'woodblock') { type = 'triangle'; if (beatNumber === 0) freq = 1200; else freq = 800; if (subNote !== 0) freq = 600; }
        else if (this.sound === 'cowbell') { type = 'square'; freq = (beatNumber === 0) ? 900 : 800; if (subNote !== 0) { freq = 600; vol = 0.2; } }
        else if (this.sound === 'voice') {
            vol = 0;
            if (subNote === 0) {
                const utterances = ['Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze'];
                const text = utterances[beatNumber] || 'Bip';
                const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; u.rate = 1.6; window.speechSynthesis.speak(u);
            } else if (subNote === 1 && this.subdivision === 2) {
                const u = new SpeechSynthesisUtterance('E'); u.lang = 'pt-BR'; u.rate = 1.6; window.speechSynthesis.speak(u);
            }
        }

        // Attack and Release Envelope ADSR
        if (vol > 0) {
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.001, time); // avoid pop
            gain.gain.exponentialRampToValueAtTime(vol, time + 0.005); // fast attack
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05); // sharp release
            osc.start(time);
            osc.stop(time + 0.06);
        }
    },

    scheduler() {
        // Loop assíncrono para agendar notas A  frente do tempo (sem atrasos de setTimeout do navegador)
        while (this.nextNoteTime < MaestroCore.audioCtx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.currentNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
};

/**
 * ==========================================
 * MÓDULO: afinador.js (Pitch Detection Autocorrelação Estendida)
 * ==========================================
 */
const AfinadorApp = {
    isActive: false, analyser: null, mediaStreamSource: null, buffer: null, rafID: null, refA: 440,

    // Dicionário de afinações complexas (Mapeadas em Hz físico)
    presets: {
        chromatic: null,
        guitar: { names: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], freqs: [82.41, 110.00, 146.83, 196.00, 246.94, 329.63] },
        guitarDropD: { names: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'], freqs: [73.42, 110.00, 146.83, 196.00, 246.94, 329.63] },
        guitar7: { names: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], freqs: [61.74, 82.41, 110.00, 146.83, 196.00, 246.94, 329.63] },
        viola: { names: ['B2', 'E3', 'G#3', 'B3', 'E4'], freqs: [123.47, 164.81, 207.65, 246.94, 329.63] },
        bass: { names: ['E1', 'A1', 'D2', 'G2'], freqs: [41.20, 55.00, 73.42, 98.00] },
        bass5: { names: ['B0', 'E1', 'A1', 'D2', 'G2'], freqs: [30.87, 41.20, 55.00, 73.42, 98.00] },
        ukulele: { names: ['G4', 'C4', 'E4', 'A4'], freqs: [392.00, 261.63, 329.63, 440.00] },
        violin: { names: ['G3', 'D4', 'A4', 'E5'], freqs: [196.00, 293.66, 440.00, 659.25] }
    },

    currentPreset: 'chromatic', manualStringIndex: -1,

    // Subsistema de Média Móvel para Suavização Profissional de UI
    pitchHistory: [], smoothedCents: 0, wasInTune: false, inTuneLockUntil: 0,

    init() {
        document.getElementById('btn-start-tuner').addEventListener('click', () => this.start());
        document.getElementById('tuner-ref').addEventListener('change', (e) => { this.refA = parseInt(e.target.value) || 440; });
        document.getElementById('tuner-preset').addEventListener('change', (e) => {
            this.currentPreset = e.target.value;
            this.manualStringIndex = -1;
            this.renderStringSelector();
        });
    },

    renderStringSelector() {
        const container = document.getElementById('string-selector-container');
        const btnContainer = document.getElementById('manual-strings');
        btnContainer.innerHTML = '';

        if (this.currentPreset === 'chromatic') { container.classList.add('hidden'); container.classList.remove('flex'); return; }

        container.classList.remove('hidden'); container.classList.add('flex');
        const presetData = this.presets[this.currentPreset];

        presetData.names.forEach((name, idx) => {
            const btn = document.createElement('button');
            btn.className = 'string-btn px-6 py-2 rounded-full bg-gray-200 dark:bg-dark-element text-gray-700 dark:text-gray-300 text-sm font-black shrink-0 transition-all shadow-sm transform hover:scale-105';
            btn.innerText = name;
            btn.setAttribute('data-idx', idx);
            btnContainer.appendChild(btn);
        });

        document.querySelectorAll('.string-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.string-btn').forEach(b => {
                    b.classList.remove('bg-brand', 'text-white');
                    b.classList.add('bg-gray-200', 'dark:bg-dark-element', 'text-gray-700', 'dark:text-gray-300');
                });
                e.target.classList.remove('bg-gray-200', 'dark:bg-dark-element', 'text-gray-700', 'dark:text-gray-300');
                e.target.classList.add('bg-brand', 'text-white');
                this.manualStringIndex = parseInt(e.target.getAttribute('data-idx'));
            });
        });
    },

    async start() {
        MaestroCore.initAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } // Modo raw/bruto para captação pura de harmônicos
            });

            document.getElementById('tuner-init-overlay').classList.add('opacity-0');
            setTimeout(() => document.getElementById('tuner-init-overlay').classList.add('hidden'), 500);

            this.analyser = MaestroCore.audioCtx.createAnalyser();
            this.analyser.fftSize = 8192; // Alta resolução para frequências baixas (Baixo/B0)
            this.mediaStreamSource = MaestroCore.audioCtx.createMediaStreamSource(stream);
            this.mediaStreamSource.connect(this.analyser);

            this.buffer = new Float32Array(this.analyser.fftSize);
            this.isActive = true;
            this.updatePitch();
        } catch (err) {
            showToast("Permissão de microfone negada. Verifique as configurações do navegador.", "error");
        }
    },

    stop() {
        this.isActive = false;
        if (this.rafID) cancelAnimationFrame(this.rafID);
        if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
        document.getElementById('tuner-init-overlay').classList.remove('hidden', 'opacity-0');
    },

    // Algoritmo Yin-like (Autocorrelação no domínio do tempo) - O melhor para monofonia
    autoCorrelate(buf, sampleRate) {
        let size = buf.length; let rms = 0;
        for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / size);

        if (rms < 0.015) return -1; // Gate de Ruído Dinâmico

        let r1 = 0, r2 = size - 1, thres = 0.2;
        for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }

        buf = buf.slice(r1, r2); size = buf.length;
        let c = new Array(size).fill(0);
        for (let i = 0; i < size; i++) for (let j = 0; j < size - i; j++) c[i] = c[i] + buf[j] * buf[j + i];

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < size; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
        let T0 = maxpos;

        // Interpolação parabólica para precisão submúltipla
        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2; let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
    },

    updatePitch() {
        if (!this.isActive) return;
        this.analyser.getFloatTimeDomainData(this.buffer);
        const rawPitch = this.autoCorrelate(this.buffer, MaestroCore.audioCtx.sampleRate);

        if (rawPitch !== -1) {
            this.pitchHistory.push(rawPitch);
            if (this.pitchHistory.length > 10) this.pitchHistory.shift();

            // Suavização por Mediana (Ignora anomalias pontuais / erro de oitava comum no microfone)
            let sortedHistory = [...this.pitchHistory].sort((a, b) => a - b);
            let pitch = sortedHistory[Math.floor(sortedHistory.length / 2)];
            let idealFreq = pitch; let targetNoteStr = ""; let targetCents = 0;

            if (this.currentPreset !== 'chromatic') {
                const freqs = this.presets[this.currentPreset].freqs;
                if (this.manualStringIndex !== -1) {
                    idealFreq = freqs[this.manualStringIndex];
                } else {
                    // Algoritmo de "Snap to closest string" automático
                    idealFreq = freqs[0]; let minDiff = Math.abs(pitch - idealFreq);
                    for (let i = 1; i < freqs.length; i++) {
                        let diff = Math.abs(pitch - freqs[i]);
                        if (diff < minDiff) { minDiff = diff; idealFreq = freqs[i]; }
                    }
                }
                const closestNoteNum = MaestroCore.freqToNote(idealFreq, this.refA);
                targetNoteStr = MaestroCore.NOTES[closestNoteNum % 12];
                targetCents = (1200 * Math.log(pitch / idealFreq) / Math.log(2));
            } else {
                // Modo Livre (Cromático)
                const note = MaestroCore.freqToNote(pitch, this.refA);
                targetNoteStr = MaestroCore.NOTES[note % 12];
                idealFreq = MaestroCore.noteToFreq(note, this.refA);
                targetCents = (1200 * Math.log(pitch / idealFreq) / Math.log(2));
            }

            // Suavização de Agulha via EMA (Exponential Moving Average)
            if (Math.abs(this.smoothedCents - targetCents) > 50) this.smoothedCents = targetCents; // Evita inércia ao mudar de corda
            else this.smoothedCents = this.smoothedCents * 0.85 + targetCents * 0.15;

            this.renderUI(targetNoteStr, pitch, idealFreq, this.smoothedCents);
        } else {
            if (this.pitchHistory.length > 0) this.pitchHistory.shift();
        }
        this.rafID = requestAnimationFrame(() => this.updatePitch());
    },

    renderUI(noteStr, currentFreq, idealFreq, cents) {
        const now = Date.now();
        // REGRA DE OURO: Zona Profissional de Afinação de Â±3 cents
        let isCurrentlyInTune = Math.abs(cents) <= 3;

        if (isCurrentlyInTune) this.inTuneLockUntil = now + 500; // Mantém verde por 0.5s para evitar flicker irritante
        else if (Math.abs(cents) > 15) this.inTuneLockUntil = 0; // Desbloqueia instantaneamente se sair muito

        let isLockedInTune = now < this.inTuneLockUntil;
        let displayCents = isLockedInTune ? 0 : cents; // Magnetiza ao centro visualmente na UI se afinado

        document.getElementById('tuner-note').innerText = noteStr.replace('#', '');
        document.getElementById('tuner-accidental').innerText = noteStr.includes('#') ? '#' : '';
        document.getElementById('tuner-freq').innerText = currentFreq.toFixed(1);
        document.getElementById('tuner-ideal-freq').innerText = idealFreq.toFixed(1);
        document.getElementById('tuner-cents').innerText = `${Math.round(displayCents) > 0 ? '+' : ''}${Math.round(displayCents)} cents`;

        let clampedCents = Math.max(-50, Math.min(50, displayCents));
        const needle = document.getElementById('tuner-needle');
        const digitalBar = document.getElementById('tuner-digital-bar');
        const actionText = document.getElementById('tuner-action');

        needle.style.transform = `translateX(-50%) rotate(${(clampedCents / 50) * 90}deg)`;
        digitalBar.style.width = `${Math.abs(clampedCents)}%`;
        digitalBar.style.left = displayCents < 0 ? `${50 - Math.abs(clampedCents)}%` : `50%`;

        if (isLockedInTune) {
            digitalBar.className = "absolute top-0 bottom-0 transition-all duration-100 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]";
            actionText.innerHTML = `<span class="text-green-500 text-2xl font-black uppercase tracking-wider flex items-center gap-2"><i class="fas fa-check-circle"></i> Afinado!</span>`;
            if (!this.wasInTune) { if (navigator.vibrate) navigator.vibrate([150]); this.wasInTune = true; }
        } else {
            this.wasInTune = false;
            let dirIcon = displayCents < 0 ? `<i class="fas fa-arrow-up animate-bounce-up inline-block ml-1"></i>` : `<i class="fas fa-arrow-down animate-bounce-down inline-block ml-1"></i>`;
            let dirText = displayCents < 0 ? `Aperte a corda` : `Afrouxe a corda`;

            if (Math.abs(displayCents) <= 5) {
                digitalBar.className = `absolute top-0 bottom-0 transition-all duration-100 bg-yellow-500`;
                actionText.innerHTML = `<span class="text-yellow-500 flex flex-col items-center leading-tight"><span class="text-xs font-black uppercase tracking-[0.2em] mb-1"><i class="fas fa-exclamation-triangle"></i> Quase afinado</span><span class="text-lg font-bold">${dirText} ${dirIcon}</span></span>`;
            } else {
                digitalBar.className = `absolute top-0 bottom-0 transition-all duration-100 bg-red-500`;
                actionText.innerHTML = `<span class="text-red-500 flex flex-col items-center leading-tight"><span class="text-xs font-black uppercase tracking-[0.2em] mb-1"><i class="fas fa-times-circle"></i> Desafinado</span><span class="text-lg font-bold">${dirText} ${dirIcon}</span></span>`;
            }
        }
    }
};

/**
 * ==========================================
 * MÓDULO: detectorAcorde.js (Ouvido Biônico FFT)
 * ==========================================
 */
const DetectorApp = {
    isActive: false, analyser: null, mediaStreamSource: null, rafID: null, mode: 'auto', canvasCtx: null, canvasEl: null, timeData: null, freqData: null, lastAnalysisTime: 0,

    // Banco Estruturado de Fórmulas e Relacionamentos Harmônicos (Extensível para jazz chords)
    chordFormulas: [
        { name: 'Maior', intervals: [0, 4, 7], suffix: '' },
        { name: 'Menor', intervals: [0, 3, 7], suffix: 'm' },
        { name: 'Sétima', intervals: [0, 4, 7, 10], suffix: '7' },
        { name: 'Menor 7', intervals: [0, 3, 7, 10], suffix: 'm7' },
        { name: 'Maior 7', intervals: [0, 4, 7, 11], suffix: 'maj7' },
        { name: 'Sus 4', intervals: [0, 5, 7], suffix: 'sus4' },
        { name: 'Diminuto', intervals: [0, 3, 6], suffix: 'dim' }
    ],

    init() {
        this.canvasEl = document.getElementById('detector-spectrum'); this.canvasCtx = this.canvasEl.getContext('2d');
        const resize = () => { this.canvasEl.width = this.canvasEl.clientWidth; this.canvasEl.height = this.canvasEl.clientHeight; };
        window.addEventListener('resize', resize); resize();

        document.getElementById('btn-start-detector').addEventListener('click', () => this.start());

        document.querySelectorAll('.detector-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.detector-mode-btn').forEach(b => {
                    b.classList.remove('bg-white', 'dark:bg-dark-surface', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
                    b.classList.add('text-gray-500');
                });
                e.target.classList.add('bg-white', 'dark:bg-dark-surface', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
                e.target.classList.remove('text-gray-500');

                // Atualiza o indicador visual animado de UI subjacente
                const indicator = document.getElementById('detector-mode-indicator');
                if (e.target.dataset.mode === 'auto') indicator.style.left = '0%';
                else if (e.target.dataset.mode === 'note') indicator.style.left = '33.33%';
                else indicator.style.left = '66.66%';

                this.mode = e.target.getAttribute('data-mode'); this.resetUI();
            });
        });
    },

    async start() {
        MaestroCore.initAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
            const overlay = document.getElementById('detector-init-overlay');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 500);

            this.analyser = MaestroCore.audioCtx.createAnalyser();
            this.analyser.fftSize = 16384; // Espectro cirúrgico
            this.analyser.smoothingTimeConstant = 0.85; // Alta inércia para acordes estáveis

            this.mediaStreamSource = MaestroCore.audioCtx.createMediaStreamSource(stream);
            this.mediaStreamSource.connect(this.analyser);

            this.timeData = new Float32Array(this.analyser.fftSize);
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

            this.isActive = true; this.processLoop();
        } catch (err) { showToast("Permissão negada. Ative o microfone.", "error"); }
    },

    stop() {
        this.isActive = false;
        if (this.rafID) cancelAnimationFrame(this.rafID);
        if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
        document.getElementById('detector-init-overlay').classList.remove('hidden', 'opacity-0');
    },

    resetUI() {
        document.getElementById('detector-main-result').innerText = '-';
        document.getElementById('detector-glow').classList.remove('bg-blue-500/30', 'scale-150');
        document.getElementById('detector-confidence-bar').style.width = '0%';
        document.getElementById('detector-confidence-text').innerText = '0%';
        document.getElementById('detector-notes-badges').innerHTML = '<span class="text-xs text-gray-300 dark:text-gray-600 font-medium px-4 py-1 italic">Nenhuma nota ativa</span>';
        document.getElementById('detector-status').innerHTML = '<div class="w-2 h-2 rounded-full bg-gray-400"></div> Escuta Suspensa';
    },

    drawSpectrum() {
        const width = this.canvasEl.width; const height = this.canvasEl.height; const ctx = this.canvasCtx;
        ctx.clearRect(0, 0, width, height);
        this.analyser.getByteFrequencyData(this.freqData);

        const barWidth = 3; const gap = 1;
        const usableBins = Math.min(this.freqData.length, 1200); // Foca nos graves e médios
        const step = Math.ceil(usableBins / (width / (barWidth + gap)));

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#3b82f6'); // blue 500
        gradient.addColorStop(1, '#8b5cf6'); // purple 500
        ctx.fillStyle = gradient;

        for (let i = 0; i < width / (barWidth + gap); i++) {
            let sum = 0; for (let j = 0; j < step; j++) sum += this.freqData[(i * step) + j] || 0;
            let avg = sum / step; let barHeight = (avg / 255) * height;
            if (barHeight > 0) {
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight, 2);
                else ctx.rect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
                ctx.fill();
            }
        }
    },

    getPeaks() {
        this.analyser.getByteFrequencyData(this.freqData);
        const binHz = MaestroCore.audioCtx.sampleRate / this.analyser.fftSize;
        let peaks = [];

        const startBin = Math.floor(70 / binHz);
        const endBin = Math.floor(1500 / binHz);

        for (let i = startBin; i < endBin; i++) {
            let val = this.freqData[i];
            if (val > 60 && val > this.freqData[i - 1] && val > this.freqData[i + 1]) {
                // Interpolação de Pico para análise espectral precisa
                let a = this.freqData[i - 1], b = val, g = this.freqData[i + 1], denom = a - 2 * b + g, p = denom === 0 ? 0 : 0.5 * (a - g) / denom;
                peaks.push({ freq: Math.max(0, (i + p) * binHz), amp: val });
            }
        }
        peaks.sort((a, b) => b.amp - a.amp); return peaks;
    },

    analyzeChord(peaks) {
        const detectedNotesMap = new Map();
        peaks.slice(0, 15).forEach(p => {
            const pc = MaestroCore.freqToNote(p.freq) % 12;
            if (!detectedNotesMap.has(pc) || detectedNotesMap.get(pc) < p.amp) detectedNotesMap.set(pc, p.amp);
        });

        const maxAmp = Math.max(...detectedNotesMap.values());
        const activePitchClasses = [];
        detectedNotesMap.forEach((amp, pc) => {
            if (amp > maxAmp * 0.35) activePitchClasses.push(pc); // Reduzido threshold para pegar terças e sétimas fracas
        });

        if (activePitchClasses.length < 2) return null; // No mínimo um Power Chord (2 notas)

        let bestMatch = null; let highestScore = 0;

        for (let root = 0; root < 12; root++) {
            // Opcionalmente root pode não ser a nota mais grave em acordes invertidos, mas testamos todas para encontrar a melhor fórmula
            const normalizedNotes = activePitchClasses.map(n => (n - root + 12) % 12);

            for (let formula of this.chordFormulas) {
                let score = 0, missing = 0;
                formula.intervals.forEach(interval => { if (normalizedNotes.includes(interval)) score++; else missing++; });
                const extraNotes = normalizedNotes.length - (formula.intervals.length - missing);

                // Lógica Ponderada: Acordes com notas fundamentais faltantes perdem muitos pontos, mas ruídos extras perdem menos pontos
                if (missing <= 1 && extraNotes <= 3) {
                    let confidence = (score / formula.intervals.length) * 100 - (extraNotes * 10) - (missing * 20);
                    if (confidence > highestScore) {
                        highestScore = confidence;
                        bestMatch = {
                            root: root,
                            name: `${MaestroCore.NOTES[root]}${formula.suffix}`,
                            confidence: Math.max(0, Math.min(100, Math.round(confidence))),
                            notesPlaying: activePitchClasses.map(n => MaestroCore.NOTES[n])
                        };
                    }
                }
            }
        }
        return bestMatch;
    },

    analyzeNote() {
        // Modo monofônico utiliza o motor bruto do Afinador (Autocorrelação com corte preventivo de 4096 para não travar CPU)
        const pitch = AfinadorApp.autoCorrelate(this.timeData.slice(0, 4096), MaestroCore.audioCtx.sampleRate);
        if (pitch !== -1) {
            const noteStr = MaestroCore.NOTES[MaestroCore.freqToNote(pitch) % 12];
            return { name: noteStr, type: 'note', confidence: 98, notesPlaying: [noteStr] };
        }
        return null;
    },

    processLoop() {
        if (!this.isActive) return;
        this.drawSpectrum();

        const now = performance.now();
        // Limite de taxa de cálculo pesado (Processamento Profissional para evitar memory leak/drop de frames)
        if (now - this.lastAnalysisTime > 150) {
            this.lastAnalysisTime = now;
            this.analyser.getFloatTimeDomainData(this.timeData);

            let sumSquare = 0; for (let i = 0; i < this.timeData.length; i++) sumSquare += this.timeData[i] * this.timeData[i];

            if (Math.sqrt(sumSquare / this.timeData.length) > 0.012) {

                document.getElementById('detector-status').innerHTML = '<div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div> Computando Espectro...';
                document.getElementById('detector-status').classList.replace('text-gray-400', 'text-blue-500');

                const peaks = this.getPeaks(); let result = null;

                if (this.mode === 'chord') result = this.analyzeChord(peaks);
                else if (this.mode === 'note') result = this.analyzeNote();
                else {
                    result = this.analyzeChord(peaks);
                    if (!result || result.confidence < 40) result = this.analyzeNote();
                }

                if (result) {
                    this.updateResultUI(result);
                    // INTEGRAÇñO INTELIGENTE: Puxa o resultado e pinta no braço do violão dinamicamente
                    FretboardApp.highlightNotes(result.notesPlaying);
                }
            } else {
                // Fallback estético para o silêncio
                document.getElementById('detector-status').innerHTML = '<div class="w-2 h-2 rounded-full bg-gray-400"></div> Escuta Suspensa (Silêncio)';
                document.getElementById('detector-status').classList.replace('text-blue-500', 'text-gray-400');
                document.getElementById('detector-confidence-bar').style.width = '0%';
                document.getElementById('detector-confidence-text').innerText = '0%';
                document.getElementById('detector-glow').classList.remove('bg-blue-500/30', 'scale-150');
            }
        }
        this.rafID = requestAnimationFrame(() => this.processLoop());
    },

    updateResultUI(data) {
        const resultEl = document.getElementById('detector-main-result');
        resultEl.innerText = data.name;
        resultEl.classList.remove('opacity-50');

        const glow = document.getElementById('detector-glow');
        glow.classList.add('bg-blue-500/30', 'scale-150');

        const bar = document.getElementById('detector-confidence-bar');
        bar.style.width = `${data.confidence}%`;
        bar.className = `h-full transition-all duration-300 ease-out relative ${data.confidence > 80 ? 'bg-green-500' : (data.confidence > 50 ? 'bg-yellow-500' : 'bg-red-500')}`;

        document.getElementById('detector-confidence-text').innerText = `${data.confidence}%`;

        const badgesContainer = document.getElementById('detector-notes-badges');
        badgesContainer.innerHTML = '';

        data.notesPlaying.forEach(n => {
            const badge = document.createElement('span');
            badge.className = 'px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-black rounded-xl text-sm border border-blue-200 dark:border-blue-800 shadow-sm transition-all transform hover:-translate-y-1 cursor-default';
            badge.innerText = n;
            badgesContainer.appendChild(badge);
        });
    }
};

/**
 * ==========================================
 * MÓDULO: bracoViolao.js (DOM Fretboard Mapper)
 * ==========================================
 */
const FretboardApp = {
    stringNames: ['E', 'B', 'G', 'D', 'A', 'E'],
    stringStartIdx: [4, 11, 7, 2, 9, 4],
    stringOctaves: [4, 3, 3, 3, 2, 2],
    totalFrets: 12,
    currentFilter: 'all',
    modoAtual: 'chord',
    currentVariations: [],
    currentVarIndex: 0,

    init() {
        this.renderGrid();
        this.bindUI();
    },

    bindUI() {
        const searchBtn = document.getElementById('btn-fb-search');
        const input = document.getElementById('fb-note-input');
        const filter = document.getElementById('fb-filter-select');
        const clearBtn = document.getElementById('btn-fb-clear');

        // Alternar modo de busca
        const searchModeSelect = document.getElementById('fb-search-mode');
        if (searchModeSelect) {
            this.modoAtual = searchModeSelect.value || 'chord';
            searchModeSelect.addEventListener('change', (e) => {
                this.modoAtual = e.target.value;
                const placeholder = e.target.value === 'chord' ? 'Ex: C, Am7, D#...' : 'Ex: C, A#, Gb...';
                input.placeholder = placeholder;
                input.focus();
            });
        }

        const performSearch = () => {
            const mode = searchModeSelect ? searchModeSelect.value : 'chord';
            let val = input.value.trim();
            if (!val) return;

            if (mode === 'chord') {
                // Busca por Acorde Inteligente
                if (window.ChordDictionary) {
                    const chordData = window.ChordDictionary.getChordPositions(val);
                    if (chordData && chordData.length > 0) {
                        this.renderChordVariationsUI(chordData, val);
                        return; // Retorna pois é um acorde, não nota isolada
                    } else {
                        showToast(`Acorde não encontrado: ${val}`, "warning");
                        return;
                    }
                }
            } else if (mode === 'note') {
                // Fallback: Busca Clássica por Nota Isolada
                val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
                if (MaestroCore.ENHARMONICS[val]) val = MaestroCore.ENHARMONICS[val];

                if (MaestroCore.NOTES.includes(val)) {
                    // Esconder ui de acordes caso voltando para nota solta
                    document.getElementById('chord-shapes-container').classList.add('hidden');
                    this.highlightNotes([val]);
                } else {
                    showToast("Entrada inválida. Digite uma nota (ex: C, F#).", "error");
                }
            }
        };

        searchBtn.addEventListener('click', performSearch);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
        filter.addEventListener('change', (e) => { this.currentFilter = e.target.value; if (input.value.trim()) performSearch(); });
        clearBtn.addEventListener('click', () => { input.value = ''; this.clearHighlights(); });
    },

    renderGrid() {
        const container = document.getElementById('fretboard-container');
        container.innerHTML = '';

        const numbersRow = document.createElement('div');
        numbersRow.className = 'flex h-8 w-full ml-[60px] pt-2';

        for (let s = 5; s >= 0; s--) {
            const stringRow = document.createElement('div');
            stringRow.className = 'flex h-[45px] relative w-full group';

            // Desenho hiper-realista das cordas
            const thickness = 1 + (s * 0.6);
            const strLine = document.createElement('div');
            strLine.className = 'absolute w-full bg-[#cbd5e1] dark:bg-[#94a3b8] z-0 top-1/2 -translate-y-1/2 shadow-[0_2px_4px_rgba(0,0,0,0.5)]';
            strLine.style.height = `${thickness}px`;
            if (s >= 3) strLine.style.backgroundImage = 'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)'; // Textura de bordão
            stringRow.appendChild(strLine);

            // Nut (Pestana)
            const openCell = document.createElement('div');
            openCell.className = 'w-[60px] h-full flex items-center justify-center relative z-10 border-r-8 border-[#f8fafc] dark:border-[#e2e8f0] bg-wood-light/80 dark:bg-wood-dark/80 cursor-pointer hover:bg-white/20 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.5)]';
            const openNote = MaestroCore.NOTES[this.stringStartIdx[s]];

            openCell.innerHTML = `<div class="note-circle w-8 h-8 bg-brand text-white font-black text-sm rounded-full flex items-center justify-center shadow-lg border border-white/20" data-note="${openNote}" data-string="${s + 1}" data-fret="0">${openNote}</div>`;
            openCell.addEventListener('click', () => this.playStringSound(s, 0));
            stringRow.appendChild(openCell);

            for (let f = 1; f <= this.totalFrets; f++) {
                const cell = document.createElement('div');
                const width = 110 - (f * 3.5); // Escala logarítmica das casas reais

                cell.className = `h-full flex items-center justify-center relative z-10 border-r-2 border-[#94a3b8] dark:border-[#64748b] cursor-pointer hover:bg-white/10 transition-colors box-border`;
                cell.style.flex = `0 0 ${width}px`;

                // Fret Markers (Bolinhas do Braço)
                if (s === 2 && [3, 5, 7, 9].includes(f)) {
                    const dot = document.createElement('div'); dot.className = 'fret-marker'; cell.appendChild(dot);
                } else if (s === 1 && f === 12) {
                    const dot = document.createElement('div'); dot.className = 'fret-marker top-[100%]'; cell.appendChild(dot);
                } else if (s === 3 && f === 12) {
                    const dot = document.createElement('div'); dot.className = 'fret-marker top-[0%]'; cell.appendChild(dot);
                }

                const noteName = MaestroCore.NOTES[(this.stringStartIdx[s] + f) % 12];
                const noteDiv = document.createElement('div');
                noteDiv.className = `note-circle w-8 h-8 bg-brand text-white font-black text-sm rounded-full flex items-center justify-center shadow-lg border border-white/20 relative z-20`;
                noteDiv.setAttribute('data-note', noteName);
                noteDiv.setAttribute('data-string', s + 1);
                noteDiv.setAttribute('data-fret', f);
                noteDiv.innerText = noteName;

                cell.appendChild(noteDiv);
                cell.addEventListener('click', () => this.playStringSound(s, f));
                stringRow.appendChild(cell);

                if (s === 5) {
                    const num = document.createElement('div');
                    num.className = 'flex items-center justify-center text-xs text-white/50 font-black';
                    num.style.flex = `0 0 ${width}px`; num.innerText = f;
                    numbersRow.appendChild(num);
                }
            }
            container.appendChild(stringRow);
        }
        container.appendChild(numbersRow);
    },

    clearHighlights() {
        // Remover destaques originais de notas
        document.querySelectorAll('.note-circle').forEach(el => {
            el.classList.remove('active', 'bg-blue-600', 'bg-purple-600');
            // Resetar o texto de volta para o nome da nota (caso tenha sido substituído por dedo)
            el.innerText = el.getAttribute('data-note');
            el.classList.add('bg-brand');
            el.parentElement.classList.remove('opacity-20'); // Remover mute
        });

        // Limpar pestanas desenhadas
        document.querySelectorAll('.chord-barre, .pestana-seta').forEach(el => el.remove());

        document.getElementById('fb-results-list').innerHTML = '<p class="text-gray-400 text-sm font-medium italic my-auto w-full text-center md:text-left">Faça uma busca ou use o módulo Ouvido para projetar algo aqui.</p>';
        document.getElementById('fb-result-count').innerText = '0';
    },

    /**
     * Renderiza os botões com as variações de shape geradas pelo Dicionário
     */
    renderChordVariationsUI(variations, query) {
        this.clearHighlights();

        const container = document.getElementById('chord-shapes-container');
        container.innerHTML = '';

        this.currentVariations = variations;
        this.currentVarIndex = 0;

        if (variations.length === 0) {
            container.innerHTML = `<span class="text-sm italic text-orange-500">Nenhum shape válido encontrado no braço.</span>`;
            container.classList.remove('hidden');
            return;
        }

        const navWrapper = document.createElement('div');
        navWrapper.className = 'flex items-center gap-4 w-full md:w-auto bg-gray-50 dark:bg-dark-element/50 p-2 rounded-2xl border border-gray-100 dark:border-gray-800';

        const infoSpan = document.createElement('span');
        infoSpan.className = 'text-sm font-black text-gray-700 dark:text-gray-300 min-w-[120px] text-center';

        const btnPrev = document.createElement('button');
        btnPrev.className = 'w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand hover:border-brand transition-colors active:scale-95 shadow-sm';
        btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';

        const btnNext = document.createElement('button');
        btnNext.className = 'w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand hover:border-brand transition-colors active:scale-95 shadow-sm';
        btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';

        const updateUI = () => {
            infoSpan.innerText = `Posição ${this.currentVarIndex + 1} de ${this.currentVariations.length}`;
            btnPrev.disabled = this.currentVarIndex === 0;
            btnNext.disabled = this.currentVarIndex === this.currentVariations.length - 1;

            btnPrev.style.opacity = btnPrev.disabled ? '0.3' : '1';
            btnNext.style.opacity = btnNext.disabled ? '0.3' : '1';
            btnPrev.style.cursor = btnPrev.disabled ? 'not-allowed' : 'pointer';
            btnNext.style.cursor = btnNext.disabled ? 'not-allowed' : 'pointer';

            this.renderChordShape(this.currentVariations[this.currentVarIndex]);
        };

        btnPrev.addEventListener('click', () => {
            if (this.currentVarIndex > 0) {
                this.currentVarIndex--;
                updateUI();
            }
        });

        btnNext.addEventListener('click', () => {
            if (this.currentVarIndex < this.currentVariations.length - 1) {
                this.currentVarIndex++;
                updateUI();
            }
        });

        navWrapper.appendChild(btnPrev);
        navWrapper.appendChild(infoSpan);
        navWrapper.appendChild(btnNext);

        const label = document.createElement('span');
        label.className = 'text-xs font-bold text-gray-500 uppercase tracking-widest shrink-0 mr-2';
        label.innerText = 'Variações:';

        container.appendChild(label);
        container.appendChild(navWrapper);

        container.classList.remove('hidden');

        updateUI();
    },

    /**
     * Aplica um formato específico (Shape) no braço visível
     */
    renderChordShape(shape) {
        this.clearHighlights();

        const resultsList = document.getElementById('fb-results-list');
        resultsList.innerHTML = `<p class="text-amber-600 text-sm font-bold my-auto">Mostrando Acorde: ${shape.titulo}. Traste Inicial: ${shape.casaInicial || 'Nut'}</p>`;

        let notesCount = 0;

        // Cordas Soltas
        shape.cordasSoltas.forEach(s => {
            notesCount++;
            const noteElement = document.querySelector(`.note-circle[data-string="${s}"][data-fret="0"]`);
            if (noteElement) noteElement.classList.add('active');
        });

        // Dedos Apertados
        shape.dedos.forEach(d => {
            notesCount++;
            const noteElement = document.querySelector(`.note-circle[data-string="${d.corda}"][data-fret="${d.casa}"]`);
            if (noteElement) {
                noteElement.classList.add('active');
                if (d.dedo && d.dedo !== 'x') {
                    noteElement.innerText = d.dedo;
                    noteElement.classList.remove('bg-brand');
                    noteElement.classList.add('bg-purple-600');
                }
            }
        });

        // Desenhar Pestana (Barre)
        if (shape.pestana) {
            const startS = shape.pestana.daCorda;
            const endS = shape.pestana.ateCorda;
            const barreFret = shape.pestana.casa;

            if (barreFret > 0) {
                setTimeout(() => {
                    // Pegar a bolinha superior e a inferior da pestana na mesma casa
                    const topEl = document.querySelector(`.note-circle[data-string="${endS}"][data-fret="${barreFret}"]`);
                    const botEl = document.querySelector(`.note-circle[data-string="${startS}"][data-fret="${barreFret}"]`);

                    if (botEl && topEl) {
                        const topRect = topEl.getBoundingClientRect();
                        const botRect = botEl.getBoundingClientRect();
                        const containerRect = document.getElementById('fretboard-container').getBoundingClientRect();

                        const topY = topRect.top - containerRect.top;
                        const botY = botRect.bottom - containerRect.top;
                        const leftX = botRect.left - containerRect.left;

                        const barreDiv = document.createElement('div');
                        // Estilo "Seta" para a Pestana
                        barreDiv.className = 'pestana-seta z-25 pointer-events-none transition-all duration-300 drop-shadow-md';

                        // Calcular altura dinamicamente para cobrir todas as cordas necessárias
                        const height = (botY - topY);

                        barreDiv.style.top = `${topY + 16}px`; // Ajuste fino com base na bolinha
                        barreDiv.style.left = `${leftX + 13}px`; // Posição centralizada para a bolinha
                        barreDiv.style.height = `${height}px`;

                        // Se tiver numero do dedo na bolinha menor, salvar para plotar na base da seta
                        const fingerText = topEl.innerText;

                        // Numero do dedo na base da flecha
                        if (!isNaN(parseInt(fingerText))) {
                            const numLabel = document.createElement('div');
                            numLabel.className = 'absolute -bottom-4 -left-2.5 w-6 h-6 bg-purple-600 rounded-full text-white font-black text-xs flex items-center justify-center shadow-md z-40 border-2 border-[#3a2318] ring-1 ring-purple-400';
                            numLabel.innerText = fingerText;
                            barreDiv.appendChild(numLabel);
                        }

                        // Ocultar os números soltos sob a pestana para evitar sobreposição visual
                        for (let c = startS; c <= endS; c++) {
                            let innerNote = document.querySelector(`.note-circle[data-string="${c}"][data-fret="${barreFret}"]`);
                            if (innerNote) {
                                // Esconde a bolinha por completo para a pestana ficar "limpa"
                                innerNote.classList.remove('active', 'bg-brand', 'bg-purple-600');
                                innerNote.style.opacity = '0';

                                if (innerNote.parentElement) {
                                    innerNote.parentElement.classList.remove('bg-white/20', 'scale-110');
                                }
                            }
                        }

                        // FIXED: Renderizar a pestana montada no DOM
                        document.getElementById('fretboard-container').appendChild(barreDiv);
                    }
                }, 50); // delay leve para garantir renderização no DOM
            }
        }

        document.getElementById('fb-result-count').innerText = notesCount;
    },

    highlightNotes(targetNotesArray) {
        if (this.modoAtual === 'chord') return; // SEPARAÇÃO DE MODOS: Não cruzar renderização

        if (!Array.isArray(targetNotesArray)) targetNotesArray = [targetNotesArray];
        this.clearHighlights();
        let count = 0;
        const resultsList = document.getElementById('fb-results-list');
        resultsList.innerHTML = '';

        document.querySelectorAll('.note-circle').forEach(el => {
            const noteAttr = el.getAttribute('data-note');
            if (targetNotesArray.includes(noteAttr)) {
                const fret = parseInt(el.getAttribute('data-fret'));
                const string = parseInt(el.getAttribute('data-string'));

                if (this.currentFilter === '5' && fret > 5) return;
                if (this.currentFilter === 'open' && fret !== 0) return;

                // Cascata visual suave
                setTimeout(() => {
                    el.classList.add('active');
                    el.parentElement.classList.add('scale-110', 'bg-white/20');
                    setTimeout(() => el.parentElement.classList.remove('scale-110', 'bg-white/20'), 250);
                }, count * 30);

                const item = document.createElement('div');
                item.className = 'bg-white dark:bg-dark-element p-3 rounded-xl text-xs border border-gray-200 dark:border-gray-700 shadow-sm font-mono flex flex-col justify-center min-w-[100px] text-center border-b-2 border-b-brand';
                item.innerHTML = `<span class="font-black text-lg text-brand mb-1 leading-none">${noteAttr}</span> <span class="text-gray-500 font-bold">Corda ${string}</span> <span class="text-gray-400 font-bold">Casa ${fret}</span>`;
                resultsList.appendChild(item);

                count++;
            }
        });

        document.getElementById('fb-result-count').innerText = count;
        if (count === 0) resultsList.innerHTML = '<p class="text-orange-500 text-sm font-bold col-span-full">Atenção: Nenhuma posição encontrada com o filtro atual selecionado.</p>';
    },

    playStringSound(stringIdx, fret) {
        MaestroCore.initAudio();
        // Calculate the actual parsed note name for PianoEngine (Ex: "C4")
        const openNoteStr = MaestroCore.NOTES[this.stringStartIdx[stringIdx]];
        const noteMapping = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

        const absoluteSemitones = noteMapping[openNoteStr] + (this.stringOctaves[stringIdx] + 1) * 12 + fret;
        const playedNoteExtracted = MaestroCore.NOTES[absoluteSemitones % 12];
        const playedOctave = Math.floor(absoluteSemitones / 12) - 1;

        PianoEngine.playNote(`${playedNoteExtracted}${playedOctave}`, 0.8, 2.5);
    }
};

/**
 * ==========================================
 * MÓDULO: campoHarmonico.js (Teoria Musical Computacional)
 * ==========================================
 */
const HarmoniaApp = {
    scalesDict: {
        major: { intervals: [0, 2, 4, 5, 7, 9, 11], suffixes: ['M', 'm', 'm', 'M', 'M', 'm', 'dim'] },
        minor: { intervals: [0, 2, 3, 5, 7, 8, 10], suffixes: ['m', 'dim', 'M', 'm', 'm', 'M', 'M'] },
        harmonic_minor: { intervals: [0, 2, 3, 5, 7, 8, 11], suffixes: ['m', 'dim', 'aug', 'm', 'M', 'M', 'dim'] }
    },

    init() {
        document.getElementById('btn-generate-harmony').addEventListener('click', () => this.generate());
        document.getElementById('btn-harm-to-fret').addEventListener('click', () => {
            if (this.lastGeneratedScale) {
                document.querySelector('.nav-btn[data-target="view-fretboard"]').click();
                FretboardApp.highlightNotes(this.lastGeneratedScale);
                showToast("Escala transferida para o braço com sucesso.", "success");
            }
        });
    },

    generate() {
        const rootNote = document.getElementById('harm-root').value;
        const scaleType = document.getElementById('harm-scale').value;

        const rootIdx = MaestroCore.NOTES.indexOf(rootNote);
        const structure = this.scalesDict[scaleType];

        const scaleNotes = structure.intervals.map(interval => MaestroCore.NOTES[(rootIdx + interval) % 12]);
        this.lastGeneratedScale = scaleNotes; // Guarda estado

        // Render Notas
        document.getElementById('harm-scale-result').classList.remove('hidden');
        const badgeContainer = document.getElementById('harm-scale-badges');
        badgeContainer.innerHTML = '';
        scaleNotes.forEach((n, i) => {
            const badge = document.createElement('div');
            badge.className = 'w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-black flex items-center justify-center text-lg border border-purple-200 dark:border-purple-800 shadow-sm';
            badge.innerText = n;
            badgeContainer.appendChild(badge);
        });

        // Render Acordes (Graus)
        document.getElementById('harm-chords-result').classList.remove('hidden');
        const chordsContainer = document.querySelector('#harm-chords-result .grid');
        chordsContainer.innerHTML = '';
        const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

        scaleNotes.forEach((note, idx) => {
            const chordName = `${note}${structure.suffixes[idx].replace('M', '')}`;
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-dark-element p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center group hover:border-purple-500 transition-colors cursor-pointer';
            card.innerHTML = `
                        <span class="text-xs font-black text-gray-400 mb-1">${romans[idx]}</span>
                        <span class="text-3xl font-black text-gray-800 dark:text-white group-hover:text-purple-500 transition-colors">${chordName}</span>
                        <span class="text-[10px] text-gray-500 mt-2">Clique para ouvir</span>
                    `;
            // Ao clicar, toca o acorde sinteticamente e mapeia no braço
            card.addEventListener('click', () => {
                this.playChordSynthetic(note, structure.suffixes[idx]);
                // Extrair as 3 notas do acorde para mostrar no braço (1, 3, 5)
                const cIdx = MaestroCore.NOTES.indexOf(note);
                let third = structure.suffixes[idx].includes('m') || structure.suffixes[idx] === 'dim' ? 3 : 4;
                let fifth = structure.suffixes[idx] === 'dim' ? 6 : (structure.suffixes[idx] === 'aug' ? 8 : 7);
                const arr = [MaestroCore.NOTES[cIdx], MaestroCore.NOTES[(cIdx + third) % 12], MaestroCore.NOTES[(cIdx + fifth) % 12]];

                document.querySelector('.nav-btn[data-target="view-fretboard"]').click();
                FretboardApp.highlightNotes(arr);
            });
            chordsContainer.appendChild(card);
        });
    },

    playChordSynthetic(root, suffix) {
        MaestroCore.initAudio();

        let third = suffix.includes('m') || suffix === 'dim' ? 3 : 4;
        let fifth = suffix === 'dim' ? 6 : (suffix === 'aug' ? 8 : 7);

        const intervals = [0, third, fifth];
        const rootIdx = MaestroCore.NOTES.indexOf(root);
        const baseOctave = 3;

        intervals.forEach((interval, i) => {
            const currentSemi = rootIdx + interval;
            const noteChar = MaestroCore.NOTES[currentSemi % 12];
            const octaveSpan = baseOctave + Math.floor(currentSemi / 12);

            // Stagger play times slowly via Promise delays to simulate natural arpeggiated strum
            setTimeout(() => {
                PianoEngine.playNote(`${noteChar}${octaveSpan}`, 0.7 - (i * 0.1), 3.0);
            }, i * 40);
        });
    }
};

/**
 * ==========================================
 * MÓDULO: treinoOuvido.js (Ear Trainer Gamification)
 * ==========================================
 */
const EarTrainerApp = {
    score: { correct: 0, wrong: 0 },
    currentNote: null,
    options: [],

    init() {
        document.getElementById('btn-ear-start').addEventListener('click', () => {
            document.getElementById('btn-ear-start').classList.add('hidden');
            this.nextChallenge();
        });
        document.getElementById('btn-ear-play').addEventListener('click', () => this.playCurrent());
        document.getElementById('btn-ear-next').addEventListener('click', () => this.nextChallenge());
    },

    nextChallenge() {
        // Esconde feedback
        document.getElementById('ear-feedback').classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => document.getElementById('ear-feedback').classList.add('hidden'), 300);

        // Gera nova nota aleatória (Entre Oitavas 3 e 4)
        const randIdx = Math.floor(Math.random() * 12);
        this.currentNote = MaestroCore.NOTES[randIdx];

        // Prepara opções
        this.options = [this.currentNote];
        while (this.options.length < 4) {
            let r = MaestroCore.NOTES[Math.floor(Math.random() * 12)];
            if (!this.options.includes(r)) this.options.push(r);
        }
        // Embaralha
        this.options.sort(() => Math.random() - 0.5);

        this.renderOptions();

        // Toca automaticamente
        setTimeout(() => this.playCurrent(), 400);
    },

    renderOptions() {
        const container = document.getElementById('ear-options-container');
        container.innerHTML = '';
        this.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'bg-gray-100 dark:bg-dark-element hover:bg-indigo-100 dark:hover:bg-indigo-900/30 p-4 rounded-xl font-black text-2xl text-gray-700 dark:text-gray-200 border border-transparent hover:border-indigo-500 transition-all active:scale-95 shadow-sm';
            btn.innerText = opt;
            btn.addEventListener('click', () => this.checkAnswer(opt));
            container.appendChild(btn);
        });
    },

    playCurrent() {
        if (!this.currentNote) return;
        MaestroCore.initAudio();

        PianoEngine.playNote(`${this.currentNote}4`, 0.85, 2.0);

        // Animação no botão
        const btn = document.getElementById('btn-ear-play');
        btn.classList.add('scale-110', 'bg-indigo-500');
        setTimeout(() => btn.classList.remove('scale-110', 'bg-indigo-500'), 200);
    },

    checkAnswer(guess) {
        const isCorrect = guess === this.currentNote;
        const feedback = document.getElementById('ear-feedback');

        if (isCorrect) {
            this.score.correct++;
            document.getElementById('ear-score-correct').innerText = this.score.correct;
            document.getElementById('ear-feedback-icon').innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
            document.getElementById('ear-feedback-title').innerText = "Perfeito!";
            document.getElementById('ear-feedback-title').className = "text-2xl font-black mb-1 text-green-500";
            document.getElementById('ear-feedback-desc').innerText = `A nota era realmente ${this.currentNote}.`;
            feedback.className = "absolute inset-0 bg-white/95 dark:bg-dark-bg/95 backdrop-blur rounded-[2rem] flex flex-col items-center justify-center transition-opacity duration-300 z-10 border-4 border-green-500";
            ConquistasApp.checkEarTraining(this.score.correct); // Check gamification
        } else {
            this.score.wrong++;
            document.getElementById('ear-score-wrong').innerText = this.score.wrong;
            document.getElementById('ear-feedback-icon').innerHTML = '<i class="fas fa-times-circle text-red-500"></i>';
            document.getElementById('ear-feedback-title').innerText = "Quase lá...";
            document.getElementById('ear-feedback-title').className = "text-2xl font-black mb-1 text-red-500";
            document.getElementById('ear-feedback-desc').innerText = `Você escolheu ${guess}, mas a nota correta era ${this.currentNote}.`;
            feedback.className = "absolute inset-0 bg-white/95 dark:bg-dark-bg/95 backdrop-blur rounded-[2rem] flex flex-col items-center justify-center transition-opacity duration-300 z-10 border-4 border-red-500";
        }

        feedback.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    }
};

/**
 * ==========================================
 * MÓDULO: conquistas.js (Gamification Engine)
 * ==========================================
 */
const ConquistasApp = {
    rules: [
        { id: 'c_start', title: 'Iniciação', desc: 'Sua primeira sessão de estudos salva.', icon: 'fas fa-fire', color: 'text-orange-500' },
        { id: 'c_time_1', title: 'Foco de Aço', desc: 'Acumule 1 hora de estudo total.', icon: 'fas fa-stopwatch', color: 'text-brand' },
        { id: 'c_bpm_200', title: 'Mão de Fogo', desc: 'Atinja 200 BPM no metrônomo.', icon: 'fas fa-tachometer-alt', color: 'text-purple-500' },
        { id: 'c_ear_20', title: 'Ouvido Absoluto', desc: 'Acerte 20 notas no Treinador.', icon: 'fas fa-assistive-listening-systems', color: 'text-blue-500' }
    ],

    init() {
        this.render();
    },

    render() {
        const container = document.getElementById('achievements-list');
        if (!container) return;
        container.innerHTML = '';

        const myAcvs = StorageManager.data.achievements || [];

        this.rules.forEach(rule => {
            const isUnlocked = myAcvs.includes(rule.id);
            const div = document.createElement('div');

            if (isUnlocked) {
                div.className = 'flex items-center gap-4 bg-white dark:bg-dark-surface p-4 rounded-2xl border-2 border-brand/50 shadow-md transform hover:scale-[1.02] transition-transform';
                div.innerHTML = `
                            <div class="w-14 h-14 bg-gray-100 dark:bg-dark-element rounded-xl flex items-center justify-center text-2xl shadow-inner ${rule.color}">
                                <i class="${rule.icon}"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-base font-black text-gray-800 dark:text-white flex items-center gap-2">${rule.title} <i class="fas fa-check-circle text-brand text-xs"></i></h4>
                                <p class="text-xs text-gray-500 font-medium leading-tight mt-1">${rule.desc}</p>
                            </div>
                        `;
            } else {
                div.className = 'flex items-center gap-4 bg-gray-50 dark:bg-dark-element/30 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 opacity-50 grayscale cursor-not-allowed';
                div.innerHTML = `
                            <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center text-xl shadow-inner text-gray-400">
                                <i class="fas fa-lock"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-sm font-bold text-gray-500 dark:text-gray-400">${rule.title}</h4>
                                <p class="text-xs text-gray-400 leading-tight mt-0.5">${rule.desc}</p>
                            </div>
                        `;
            }
            container.appendChild(div);
        });
    },

    unlock(id) {
        if (!StorageManager.data.achievements) StorageManager.data.achievements = [];
        if (!StorageManager.data.achievements.includes(id)) {
            StorageManager.data.achievements.push(id);
            StorageManager.save();
            const rule = this.rules.find(r => r.id === id);
            showToast(`ðŸ† Troféu Desbloqueado: ${rule.title}!`, 'success');
            this.render();
        }
    },

    checkTime(statsArray) {
        const totalSec = statsArray.reduce((acc, curr) => acc + curr.seconds, 0);
        if (totalSec > 0) this.unlock('c_start');
        if (totalSec >= 3600) this.unlock('c_time_1'); // 1 hora
    },

    checkBpm(bpm) {
        if (bpm >= 200) this.unlock('c_bpm_200');
    },

    checkEarTraining(score) {
        if (score >= 20) this.unlock('c_ear_20');
    }
};

/**
 * ==========================================
 * MÓDULO: estatisticas.js (Painel Central)
 * ==========================================
 */
const EstatisticasApp = {
    chart: null, sessionSeconds: 0,

    init() {
        this.bindUI();
        this.updateUI();
        setTimeout(() => this.renderChart(), 500); // Async to ensure DOM layout
    },

    bindUI() {
        const resetBtn = document.getElementById('btn-reset-progress');
        const modal = document.getElementById('reset-modal');
        const cancelBtn = document.getElementById('btn-cancel-reset');
        const confirmBtn = document.getElementById('btn-confirm-reset');
        const btnExport = document.getElementById('btn-export-backup');

        if (btnExport) btnExport.addEventListener('click', () => StorageManager.exportJSON());

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('scale-95'); }, 10);
            });
        }
        const closeModal = () => {
            modal.classList.add('opacity-0'); modal.querySelector('div').classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                StorageManager.data.stats = [];
                StorageManager.data.achievements = [];
                StorageManager.data.maxBpm = 120;
                await StorageManager.save();
                this.updateUI(); this.renderChart(); ConquistasApp.render(); closeModal();
                showToast("Progresso deletado com sucesso.");
            });
        }
    },

    updateUI() {
        if (!StorageManager.data.stats) StorageManager.data.stats = [];
        const todayStr = new Date().toISOString().split('T')[0];
        let todayRecord = StorageManager.data.stats.find(s => s.date === todayStr);
        document.getElementById('stat-time-today').innerText = todayRecord ? Math.floor(todayRecord.seconds / 60) : 0;

        document.getElementById('stat-bpm-max').innerText = StorageManager.data.maxBpm || 120;

        // Previne null pointers no gamification
        ConquistasApp.render();
    },

    calculateStreak() {
        if (!StorageManager.data.stats || StorageManager.data.stats.length === 0) return 0;
        let streak = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        // Verifica ultimos 365 dias
        for (let i = 0; i < 365; i++) {
            let d = new Date(today); d.setDate(d.getDate() - i); let dStr = d.toISOString().split('T')[0];
            if (StorageManager.data.stats.find(s => s.date === dStr && s.seconds > 60)) streak++;
            else if (i > 0) break; // Quebrou a ofensiva ontem
        }
        return streak;
    },

    renderChart() {
        document.getElementById('stat-streak').innerText = `${this.calculateStreak()}`;

        const totalSec = (StorageManager.data.stats || []).reduce((acc, curr) => acc + curr.seconds, 0);
        document.getElementById('stat-time-total-h').innerText = Math.floor(totalSec / 3600);
        document.getElementById('stat-time-total-m').innerText = Math.floor((totalSec % 3600) / 60);

        const labels = []; const data = []; const today = new Date();
        for (let i = 6; i >= 0; i--) {
            let d = new Date(); d.setDate(today.getDate() - i); let dStr = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase());
            let record = (StorageManager.data.stats || []).find(s => s.date === dStr);
            data.push(record ? (record.seconds / 60).toFixed(1) : 0);
        }

        const ctxEl = document.getElementById('practiceChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        if (this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutos Estudados',
                    data: data,
                    backgroundColor: '#10b981',
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor, padding: 10, font: { family: 'monospace' } } },
                    x: { grid: { display: false }, ticks: { color: textColor, font: { weight: 'bold' } } }
                },
                animation: { duration: 1000, easing: 'easeOutQuart' }
            }
        });
    }
};

/**
 * ==========================================
 * MÓDULO: extras.js (Tools, Gravação, Worship Mode)
 * ==========================================
 */
const ExtrasApp = {
    droneOsc: null, droneGain: null, dronePlaying: false, mediaRecorder: null, audioChunks: [], recordTimer: null, recordSecs: 0,

    init() {
        // Drone Generator
        const btnDrone = document.getElementById('btn-drone-play');
        const volDrone = document.getElementById('drone-volume');
        const noteDrone = document.getElementById('drone-note');
        const octDrone = document.getElementById('drone-octave');

        btnDrone.addEventListener('click', () => {
            this.dronePlaying = !this.dronePlaying;
            if (this.dronePlaying) {
                this.startDrone(noteDrone.value, octDrone.value, volDrone.value);
                btnDrone.innerHTML = '<i class="fas fa-stop"></i> Silenciar Drone';
                btnDrone.classList.replace('bg-gray-900', 'bg-red-500');
                btnDrone.classList.replace('dark:bg-white', 'dark:bg-red-500');
                btnDrone.classList.replace('text-white', 'text-white'); // Força branco no vermelho
                btnDrone.classList.replace('dark:text-gray-900', 'dark:text-white');
            } else {
                this.stopDrone();
                btnDrone.innerHTML = '<i class="fas fa-play"></i> Ligar Som Constante';
                btnDrone.classList.replace('bg-red-500', 'bg-gray-900');
                btnDrone.classList.replace('dark:bg-red-500', 'dark:bg-white');
                btnDrone.classList.replace('dark:text-white', 'dark:text-gray-900');
            }
        });
        volDrone.addEventListener('input', (e) => { if (this.droneGain) this.droneGain.gain.setTargetAtTime(e.target.value / 100, MaestroCore.audioCtx.currentTime, 0.1); });
        const updateDronePitch = () => { if (this.dronePlaying) this.droneOsc.frequency.setTargetAtTime(MaestroCore.noteToFreq(MaestroCore.NOTES.indexOf(noteDrone.value) + (parseInt(octDrone.value) + 1) * 12), MaestroCore.audioCtx.currentTime, 0.1); };
        noteDrone.addEventListener('change', updateDronePitch); octDrone.addEventListener('change', updateDronePitch);

        // Gravador Nativo (Antigo) - Substituído pelo GravadorApp
        const btnRecord = document.getElementById('btn-record');
        const btnStopRec = document.getElementById('btn-stop-record');
        if (btnRecord && btnStopRec) {
            btnRecord.addEventListener('click', () => this.startRecording(btnRecord, btnStopRec));
            btnStopRec.addEventListener('click', () => this.stopRecording(btnRecord, btnStopRec));
        }

        // Worship Mode
        document.getElementById('btn-mode-worship').addEventListener('click', () => this.toggleWorshipMode());

        // PIX Box
        const btnCopyPix = document.getElementById('btn-copy-pix');
        if (btnCopyPix) {
            btnCopyPix.addEventListener('click', () => {
                const pixKey = "rendersonluan@gmail.com";
                const textArea = document.createElement("textarea");
                textArea.value = pixKey; document.body.appendChild(textArea); textArea.select();
                try {
                    document.execCommand('copy');
                    showToast("Chave PIX copiada com sucesso!", "success");
                    const originalHtml = btnCopyPix.innerHTML;
                    btnCopyPix.innerHTML = '<i class="fas fa-check"></i> Copiada!';
                    btnCopyPix.classList.add('bg-green-600', 'hover:bg-green-700');
                    setTimeout(() => {
                        btnCopyPix.innerHTML = originalHtml;
                        btnCopyPix.classList.remove('bg-green-600', 'hover:bg-green-700');
                    }, 2500);
                } catch (err) { console.error('Falha ao copiar'); }
                document.body.removeChild(textArea);
            });
        }
    },

    toggleWorshipMode() {
        const btn = document.getElementById('btn-mode-worship');
        if (MaestroCore.state.mode !== 'worship') {
            MaestroCore.state.mode = 'worship';
            // Altera tema estético do App via custom properties Tailwind
            document.body.classList.add('dark'); // Força modo escuro base
            document.documentElement.style.setProperty('--bg-color', '#1a1025');

            // Configura Metronomo Padrão Louvor
            MetronomoApp.setBPM(70);
            document.getElementById('time-sig-beats').value = 4;
            document.getElementById('sound-select').value = 'woodblock'; // Som suave
            document.getElementById('accent-toggle').checked = false; // Sem acento pra pads

            showToast("Modo Worship Ativado. Ritmo suave de 70bpm configurado.", "info");

            // Add badge
            document.getElementById('global-status-badges').innerHTML = '<span class="px-3 py-1 bg-purple-500/20 text-purple-500 border border-purple-500/50 rounded-full text-[10px] font-black tracking-widest uppercase"><i class="fas fa-church mr-1"></i> Worship</span>';

            btn.innerHTML = '<i class="fas fa-times"></i> Desativar Ambiente';
            btn.classList.replace('bg-purple-500', 'bg-gray-800');
        } else {
            MaestroCore.state.mode = 'normal';
            document.documentElement.style.removeProperty('--bg-color');
            document.getElementById('global-status-badges').innerHTML = '';
            showToast("Modo padrão restaurado.", "info");

            btn.innerHTML = '<i class="fas fa-power-off"></i> Ativar Ambiente';
            btn.classList.replace('bg-gray-800', 'bg-purple-500');
        }
    },

    startDrone(note, octave, vol) {
        MaestroCore.initAudio();
        this.droneOsc = MaestroCore.audioCtx.createOscillator(); this.droneGain = MaestroCore.audioCtx.createGain();
        // Usa Sawtooth + Lowpass para gerar um som rico que lembre um Harmônio ou Synth Pad
        this.droneOsc.type = 'sawtooth'; const filter = MaestroCore.audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
        this.droneOsc.frequency.value = MaestroCore.noteToFreq(MaestroCore.NOTES.indexOf(note) + (parseInt(octave) + 1) * 12);
        this.droneGain.gain.value = vol / 100;

        this.droneOsc.connect(filter); filter.connect(this.droneGain); this.droneGain.connect(MaestroCore.audioCtx.destination);
        this.droneOsc.start();
    },
    stopDrone() {
        if (this.droneOsc) {
            this.droneGain.gain.exponentialRampToValueAtTime(0.001, MaestroCore.audioCtx.currentTime + 1.0); // Release suave no drone
            this.droneOsc.stop(MaestroCore.audioCtx.currentTime + 1.0);
        }
    },

    async startRecording(btnRec, btnStop) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream); this.audioChunks = [];
            this.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this.audioChunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                const url = URL.createObjectURL(new Blob(this.audioChunks, { type: 'audio/webm' }));
                this.addRecordingToList(url); stream.getTracks().forEach(track => track.stop());
            };
            this.mediaRecorder.start();
            btnRec.classList.add('animate-pulse'); btnRec.classList.replace('bg-red-500', 'bg-red-700');
            btnStop.classList.remove('opacity-50', 'pointer-events-none'); btnStop.classList.add('hover:bg-gray-300', 'dark:hover:bg-gray-700');
            this.recordSecs = 0; document.getElementById('recorder-time').innerText = '00:00';
            this.recordTimer = setInterval(() => { this.recordSecs++; document.getElementById('recorder-time').innerText = MaestroCore.formatTime(this.recordSecs); }, 1000);
        } catch (err) { showToast("O gravador exige permissão do microfone.", "error"); }
    },
    stopRecording(btnRec, btnStop) {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop(); clearInterval(this.recordTimer);
            btnRec.classList.remove('animate-pulse', 'bg-red-700'); btnRec.classList.add('bg-red-500');
            btnStop.classList.add('opacity-50', 'pointer-events-none'); btnStop.classList.remove('hover:bg-gray-300', 'dark:hover:bg-gray-700');
        }
    },
    addRecordingToList(url) {
        const list = document.getElementById('recordings-list'); const div = document.createElement('div');
        div.className = 'flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 dark:bg-dark-element/50 rounded-2xl border border-gray-200 dark:border-gray-700 gap-3 mb-2';
        const title = document.createElement('span'); title.className = 'text-xs font-black text-gray-500 uppercase tracking-widest'; title.innerText = `Take de Estudo - ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        const audio = document.createElement('audio'); audio.controls = true; audio.src = url; audio.className = 'h-10 w-full md:w-64 outline-none';
        const a = document.createElement('a'); a.href = url; a.download = `take_maestro_${new Date().getTime()}.webm`; a.className = 'text-brand hover:text-brand-dark transition-colors text-center font-bold text-sm bg-brand/10 px-4 py-2 rounded-lg'; a.innerHTML = '<i class="fas fa-download mr-1"></i> Baixar';

        div.appendChild(title); div.appendChild(audio); div.appendChild(a); list.prepend(div);
    }
};

/**
 * ==========================================
 * MÓDULO: gravador.js (WebRTC Study Recorder com Audio Mix)
 * ==========================================
 */
const GravadorApp = {
    mediaRecorder: null,
    audioChunks: [],
    mixedStream: null,
    sourceStream: null,
    micSourceNode: null,
    isVideoMode: true,
    isRecording: false,

    init() {
        this.bindUI();
    },

    bindUI() {
        const toggle = document.getElementById('recorder-video-toggle');
        const btnStart = document.getElementById('btn-recorder-start');
        const btnStop = document.getElementById('btn-recorder-stop');
        const camIcon = document.getElementById('recorder-audio-only-icon');
        const videoElement = document.getElementById('recorder-preview');

        if (!toggle || !btnStart || !btnStop) return;

        toggle.addEventListener('change', (e) => {
            this.isVideoMode = e.target.checked;
            if (this.isVideoMode) {
                camIcon.classList.add('hidden');
                videoElement.classList.remove('hidden');
            } else {
                camIcon.classList.remove('hidden');
                videoElement.classList.add('hidden');
            }
        });

        btnStart.addEventListener('click', () => this.startRecording());
        btnStop.addEventListener('click', () => this.stopRecording());
    },

    async startRecording() {
        if (this.isRecording) return;

        const btnStart = document.getElementById('btn-recorder-start');
        const btnStop = document.getElementById('btn-recorder-stop');
        const videoPreview = document.getElementById('recorder-preview');
        const badge = document.getElementById('recorder-live-badge');
        const downloadBox = document.getElementById('recorder-download-container');

        // Inicializa o Engine de Áudio (necessário para a mixagem)
        MaestroCore.initAudio();

        try {
            // Restore AudioContext if suspended
            if (MaestroCore.audioCtx && MaestroCore.audioCtx.state === 'suspended') {
                await MaestroCore.audioCtx.resume();
            }

            // Esconde download anterior se houver
            downloadBox.classList.add('hidden');

            btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';

            // 1. Solicitando Dispositivos
            // Buscando a melhor qualidade possível no WebRTC (Full HD, 60fps se suportado)
            const videoConstraints = this.isVideoMode ? {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60 }
            } : false;

            this.sourceStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: videoConstraints
            });

            // 2. Definindo Preview da Câmera
            if (this.isVideoMode) {
                videoPreview.srcObject = this.sourceStream;
            }

            // 3. Roteamento de Áudio Avançado (Mixando Mic + Metrônomo)
            const audioTrack = this.sourceStream.getAudioTracks()[0];
            const tempStreamForAudio = new MediaStream([audioTrack]);

            this.micSourceNode = MaestroCore.audioCtx.createMediaStreamSource(tempStreamForAudio);

            // Conecta o microfone ao canal de gravação (recorderDest)
            this.micSourceNode.connect(MaestroCore.recorderDest);

            // 4. Montagem da Stream Final de Gravação
            const tracksToRecord = [];
            const mixedAudioTrack = MaestroCore.recorderDest.stream.getAudioTracks()[0];
            if (mixedAudioTrack) tracksToRecord.push(mixedAudioTrack);

            if (this.isVideoMode) {
                const videoTrack = this.sourceStream.getVideoTracks()[0];
                if (videoTrack) tracksToRecord.push(videoTrack);
            }

            this.mixedStream = new MediaStream(tracksToRecord);

            // 5. Instanciando o Gravação
            // Prioriza MP4 com codecs h264 de alta resolução, fallback para webm se o OS/Engine não suportar muxing MP4 nativo
            const getSupportedMimeType = () => {
                const types = this.isVideoMode ?
                    [
                        'video/mp4;codecs=avc1,mp4a.40.2',
                        'video/mp4;codecs=h264,aac',
                        'video/mp4',
                        'video/webm;codecs=h264',
                        'video/webm;codecs=vp9,opus',
                        'video/webm;codecs=vp8,opus',
                        'video/webm'
                    ] :
                    ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

                for (let t of types) {
                    if (MediaRecorder.isTypeSupported(t)) return t;
                }
                return ''; // Fallback default
            };

            const mimeType = getSupportedMimeType();

            // Requisita alta taxa de bits (Aproximadamente 5Mbps para vídeo) para garantir "melhor qualidade"
            const options = {
                mimeType: mimeType || undefined,
                videoBitsPerSecond: 5000000,
                audioBitsPerSecond: 128000
            };

            this.mediaRecorder = new MediaRecorder(this.mixedStream, options);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => this.handleRecordingStop();

            // 6. Iniciar Gravação de Fato
            this.mediaRecorder.start(200);
            this.isRecording = true;
            console.log("[Gravação] Iniciada com sucesso. MimeType:", mimeType);

            // Update UI
            btnStart.innerHTML = '<i class="fas fa-circle text-[10px] animate-pulse"></i> Gravando';
            btnStart.classList.replace('bg-brand', 'bg-red-500');
            btnStart.classList.replace('hover:bg-brand-dark', 'hover:bg-red-600');

            btnStop.classList.remove('opacity-50', 'pointer-events-none');
            badge.classList.remove('opacity-0');

            showToast("A gravação começou!", "success");

        } catch (err) {
            console.error("[Gravação] Erro ao iniciar:", err);
            btnStart.innerHTML = '<i class="fas fa-circle text-[10px] text-red-500"></i> Preparar';
            alert(`Erro ao iniciar gravação: ${err.message || 'Permissão negada ou dispositivo não encontrado.'}`);
        }
    },

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        this.mediaRecorder.stop();
        this.isRecording = false;
        console.log("[Gravação] Parada pelo usuário.");

        if (this.sourceStream) {
            this.sourceStream.getTracks().forEach(track => track.stop());
        }
        if (this.micSourceNode) {
            this.micSourceNode.disconnect();
        }

        const videoPreview = document.getElementById('recorder-preview');
        videoPreview.srcObject = null;

        const btnStart = document.getElementById('btn-recorder-start');
        const btnStop = document.getElementById('btn-recorder-stop');
        const badge = document.getElementById('recorder-live-badge');

        btnStart.innerHTML = '<i class="fas fa-check text-[10px] text-brand"></i> Novo Take';
        btnStart.classList.replace('bg-red-500', 'bg-brand');
        btnStart.classList.replace('hover:bg-red-600', 'hover:bg-brand-dark');

        btnStop.classList.add('opacity-50', 'pointer-events-none');
        badge.classList.add('opacity-0');
    },

    handleRecordingStop() {
        if (this.audioChunks.length === 0) return;

        console.log("[Gravação] Processando chunks e gerando arquivo.");
        const downloadBox = document.getElementById('recorder-download-container');
        const btnDownload = document.getElementById('btn-recorder-download');
        const vidPlayer = document.getElementById('recorder-playback');
        const audPlayer = document.getElementById('recorder-playback-audio');

        // Check format based on what was actually recorded
        let mimeType = 'video/mp4'; // Try to force mp4 extension conceptually
        let ext = 'mp4';

        if (this.mediaRecorder && this.mediaRecorder.mimeType) {
            mimeType = this.mediaRecorder.mimeType;
            if (mimeType.includes('mp4')) {
                ext = 'mp4';
            } else if (mimeType.includes('webm')) {
                // If the browser strictly fell back to webm, we could keep .webm,
                // but many modern players play .mp4 renamed webm streams if the codec was h264.
                // We'll trust the browser.
                ext = 'webm';
                // Safari on iOS ignores webm entirely and does MP4
            }
        } else if (!this.isVideoMode) {
            mimeType = 'audio/mp4';
            ext = 'm4a'; // M4A is the standard extension for MP4 Audio
        }

        // Even if we record in webm because Chrome doesn't support mp4 encoding directly,
        // we can still save as .mp4. Chrome's WebM often plays fine when renamed to .mp4,
        // particularly if the user intends to share it to iOS or Whatsapp.
        // As requested by user, force output filename to .mp4
        if (this.isVideoMode) {
            ext = 'mp4';
            mimeType = 'video/mp4'; // IMPORTANTE: Obriga o navegador a salvar como mp4 no Android
        }

        const fileExtension = this.isVideoMode ? 'mp4' : 'm4a';
        const fileName = `Estudo_Maestro_Pro_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.${fileExtension}`;

        const blob = new Blob(this.audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        btnDownload.href = url;
        btnDownload.setAttribute('download', fileName);

        if (this.isVideoMode) {
            vidPlayer.src = url;
            vidPlayer.classList.remove('hidden');
            audPlayer.classList.add('hidden');
        } else {
            audPlayer.src = url;
            audPlayer.classList.remove('hidden');
            vidPlayer.classList.add('hidden');
        }

        downloadBox.classList.remove('hidden');
        showToast("Seu vídeo em Alta Qualidade foi salvo!", "success");

        // Fazer download automático do vídeo!
        console.log("[Gravação] Iniciando download automático: " + fileName);

        const tempLink = document.createElement('a');
        tempLink.style.display = 'none';
        tempLink.href = url;
        tempLink.setAttribute('download', fileName);
        document.body.appendChild(tempLink);
        tempLink.click();

        // Cleanup after click
        setTimeout(() => {
            document.body.removeChild(tempLink);
        }, 300);
    }
};


/**
 * ==========================================
 * INICIALIZAÇñO DA PLATAFORMA (BOOTSTRAP)
 * ==========================================
 */
window.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega dados locais persistentes
    StorageManager.load();

    // 2. Registra módulos visuais principais
    NavigationModule.init();
    MetronomoApp.init();
    AfinadorApp.init();
    DetectorApp.init();
    FretboardApp.init();
    HarmoniaApp.init();
    EarTrainerApp.init();
    ExtrasApp.init();
    ProfessorApp.init();
    GravadorApp.init();

    // 3. Inicializa Gráficos, Gamificação e UI
    EstatisticasApp.init();
    ConquistasApp.init();
    EstatisticasApp.updateUI();

    // 4. Copiar PIX com feedback visual
    const btnCopyPix = document.getElementById('btn-copy-pix');
    if (btnCopyPix) {
        btnCopyPix.addEventListener('click', () => {
            navigator.clipboard.writeText('rendersonluan@gmail.com').then(() => {
                window.showToast('Chave PIX copiada!', 'success');

                // Animação temporária no botão
                const originalHtml = btnCopyPix.innerHTML;
                btnCopyPix.innerHTML = '<i class="fas fa-check text-brand"></i> Copiado!';
                btnCopyPix.classList.add('bg-gray-200', 'text-brand', 'scale-105');

                setTimeout(() => {
                    btnCopyPix.innerHTML = originalHtml;
                    btnCopyPix.classList.remove('bg-gray-200', 'text-brand', 'scale-105');
                }, 2000);
            });
        });
    }
});


