/**
 * MÓDULO: piano.js (Piano Sample Audio Engine Pro V1)
 * Substitui osciladores robóticos por áudio acústico de alta fidelidade
 * via buffers carregados assincronamente (Lazy Load).
 * Utiliza amostras públicas do Salamander Grand Piano (Tone.js repo).
 */

const PianoEngine = {
    // Base URL hospedada estruturada pelo projeto Tone.js Audio (Salamander Grand Piano)
    baseUrl: "https://tonejs.github.io/audio/salamander/",

    // Mapping de notas disponíveis no repo para otimizar tamanho do download.
    // Usamos m3rds (Terças Menores) de distância para cobrir o teclado por pitch-shifting.
    // O sistema mapeará A0, C1, D#1, F#1, A1, C2 etc.
    // Para simplificar a POC, mapearemos as notas exatas da região C3 a C6 comuns no violão.
    samples: {
        "A3": "A3.mp3",
        "C4": "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        "A4": "A4.mp3",
        "C5": "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        "A5": "A5.mp3",
        "C6": "C6.mp3",
    },

    buffers: {}, // Cache em memória HTML5 WebAudio
    nodes: [], // Rastreio de notas ativas
    convolver: null, // Reverb Global
    masterGain: null,

    // Mapeamento MIDI usado para interpolação algoritmica
    noteToMidi(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const note = noteName.replace(/\d/, '');
        const octave = parseInt(noteName.match(/\d/)[0]);
        return notes.indexOf(note) + (octave + 1) * 12;
    },

    init(audioCtx) {
        this.ctx = audioCtx;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;

        // Implementando Reverb Convolver sintético (Impulse Response procedural)
        this.convolver = this.ctx.createConvolver();
        this.setupReverb(1.5, 0.2); // Decay 1.5s, Wet Mix 20%

        this.masterGain.connect(this.ctx.destination);
    },

    setupReverb(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Ruído branco com decaimento exponencial
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 10);
            }
        }

        this.convolver.buffer = impulse;

        // Criando Send Effect (Wet/Dry routing)
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.15; // 15% Reverb (Sutil)

        this.convolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
    },

    findClosestSample(targetNote) {
        const targetMidi = this.noteToMidi(targetNote);
        let closestNote = null;
        let minDistance = Infinity;

        for (const sampleNote in this.samples) {
            const sampleMidi = this.noteToMidi(sampleNote);
            const dist = Math.abs(targetMidi - sampleMidi);
            if (dist < minDistance) {
                minDistance = dist;
                closestNote = sampleNote;
            }
        }

        return {
            note: closestNote,
            url: this.baseUrl + this.samples[closestNote],
            distance: targetMidi - this.noteToMidi(closestNote) // Positivo = subir tom, Negativo = descer tom
        };
    },

    async loadBuffer(url) {
        if (this.buffers[url]) return this.buffers[url];

        // Prevents duplicate fetching
        if (!this.fetchPromises) this.fetchPromises = {};
        if (this.fetchPromises[url]) return await this.fetchPromises[url];

        this.fetchPromises[url] = fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.buffers[url] = audioBuffer;
                return audioBuffer;
            });

        return await this.fetchPromises[url];
    },

    async playNote(noteName, velocity = 0.8, duration = 2.5) {
        if (!this.ctx) return; // Audio System Not Init

        // Ex: D4 mapeia para C4 com distance=+2
        const map = this.findClosestSample(noteName);
        const buffer = await this.loadBuffer(map.url);

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Interpolation via Pitch Rate
        // Formúla: rate = 2 ^ (semitones / 12)
        source.playbackRate.value = Math.pow(2, map.distance / 12);

        // Envelope ADSR via Gain
        const gainNode = this.ctx.createGain();

        // Velocity Curve (Non-linear para mais dinâmica)
        const peakGain = Math.pow(velocity, 2) * 1.5;

        const now = this.ctx.currentTime;

        // ADSR Settings
        const attack = 0.015;
        const decay = 0.3;
        const sustainLevel = peakGain * 0.7; // Cai 30% no decay
        const release = 0.8; // ms depois do noteOff

        // Envelope Automation
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);

        // Simular a morte natural da corda (Duration = Tempo de decaimento natural antes do NoteOff artificial)
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration + release);

        // Routing
        source.connect(gainNode);

        // Dry signal
        gainNode.connect(this.masterGain);

        // Wet signal (Send to Reverb)
        gainNode.connect(this.convolver);

        source.start(now);
        source.stop(now + duration + release);

        // Cleanup rastreio preventivo (para apps pesados)
        source.onended = () => {
            gainNode.disconnect();
            source.disconnect();
        };

        return { source, gainNode };
    }
};

window.PianoEngine = PianoEngine;
