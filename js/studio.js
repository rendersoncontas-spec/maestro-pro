/**
 * ==========================================
 * STUDIO MODE: GRAVAÇÃO MULTIPISTA
 * ==========================================
 * Gerencia gravação de Base e Solo, mixagem de áudio
 * usando Web Audio API (compatível com iOS) e exportação.
 */

class StudioApp {
    constructor() {
        this.ctx = null;
        this.stream = null;

        // Elementos de Mídia
        this.elCamera = document.getElementById('studio-camera-video');
        this.elBase = document.getElementById('studio-base-video');

        // UI
        this.btnStart = document.getElementById('btn-studio-start');
        this.btnRecBase = document.getElementById('btn-record-base');
        this.btnRecSolo = document.getElementById('btn-record-solo');
        this.btnStop = document.getElementById('btn-studio-stop');
        this.btnPreview = document.getElementById('btn-studio-preview');
        this.btnExport = document.getElementById('btn-studio-export');
        this.timerDisplay = document.getElementById('studio-timer');

        // Estado
        this.state = 'idle'; // idle, recording_base, recording_solo, mixing
        this.recordedChunks = [];
        this.baseBlob = null;
        this.soloBlob = null;
        this.mediaRecorder = null;

        // Temporizador
        this.startTime = 0;
        this.timerInterval = null;

        // Players Independentes para Scrubbing/Timelines
        this.playerBase = document.createElement('video');
        this.playerBase.playsInline = true;
        this.playerSolo = document.createElement('video');
        this.playerSolo.playsInline = true;

        this.tlBase = document.getElementById('timeline-base');
        this.tlSolo = document.getElementById('timeline-solo');
        this.timeCurBase = document.getElementById('time-current-base');
        this.timeTotBase = document.getElementById('time-total-base');
        this.timeCurSolo = document.getElementById('time-current-solo');
        this.timeTotSolo = document.getElementById('time-total-solo');

        this.bindEvents();
    }

    formatMillis(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "00:00.000";
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
        return `${m}:${s}.${ms}`;
    }

    bindEvents() {
        if (!this.btnStart) return;

        this.btnStart.addEventListener('click', () => this.initStudio());
        this.btnRecBase.addEventListener('click', () => this.startRecording('base'));
        this.btnRecSolo.addEventListener('click', () => this.startRecording('solo'));
        this.btnStop.addEventListener('click', () => this.stopRecording());
        this.btnPreview.addEventListener('click', () => this.togglePreview());
        this.btnExport.addEventListener('click', () => this.exportFinal());

        // Toggle orientação visualmente e no input hidden
        const oriBtns = document.querySelectorAll('.btn-orientation');
        oriBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                oriBtns.forEach(b => {
                    b.classList.replace('bg-purple-600', 'bg-gray-700');
                    b.classList.replace('hover:bg-purple-500', 'hover:bg-gray-600');
                });
                const target = e.target;
                target.classList.replace('bg-gray-700', 'bg-purple-600');
                target.classList.replace('hover:bg-gray-600', 'hover:bg-purple-500');
                document.getElementById('studio-video-orientation').value = target.getAttribute('data-val');
            });
        });

        // Apagar faixas
        document.getElementById('btn-trash-base').addEventListener('click', () => this.trashTrack('base'));
        document.getElementById('btn-trash-solo').addEventListener('click', () => this.trashTrack('solo'));

        // Timelines / Scrubbing Events
        if (this.tlBase) {
            this.tlBase.addEventListener('input', (e) => {
                if (this.playerBase.duration) {
                    this.playerBase.currentTime = parseFloat(e.target.value);
                }
            });
            this.playerBase.addEventListener('timeupdate', () => {
                if (!this.tlBase.matches(':active')) {
                    this.tlBase.value = this.playerBase.currentTime;
                }
                this.timeCurBase.innerText = this.formatMillis(this.playerBase.currentTime);
            });
            this.playerBase.addEventListener('loadedmetadata', () => {
                this.tlBase.max = this.playerBase.duration;
                this.tlBase.removeAttribute('disabled');
                this.timeTotBase.innerText = this.formatMillis(this.playerBase.duration);
            });
        }

        if (this.tlSolo) {
            this.tlSolo.addEventListener('input', (e) => {
                if (this.playerSolo.duration) {
                    this.playerSolo.currentTime = parseFloat(e.target.value);
                }
            });
            this.playerSolo.addEventListener('timeupdate', () => {
                if (!this.tlSolo.matches(':active')) {
                    this.tlSolo.value = this.playerSolo.currentTime;
                }
                this.timeCurSolo.innerText = this.formatMillis(this.playerSolo.currentTime);
            });
            this.playerSolo.addEventListener('loadedmetadata', () => {
                this.tlSolo.max = this.playerSolo.duration;
                this.tlSolo.removeAttribute('disabled');
                this.timeTotSolo.innerText = this.formatMillis(this.playerSolo.duration);
            });
        }
    }

    async initStudio() {
        try {
            // Requisito: AudioContext (iOS fallback)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();

            // Requisito: Resume on User Interaction
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            // Ocultar prompt de inicio
            document.getElementById('studio-start-prompt').classList.add('opacity-0', 'pointer-events-none');

            // Layout (Horizontal vs Vertical)
            const orientation = document.getElementById('studio-video-orientation').value;

            // Perfil Ideal
            let videoConstraints = {};
            if (orientation === 'vertical') {
                videoConstraints.width = { ideal: 720 };
                videoConstraints.height = { ideal: 1280 };
            } else {
                videoConstraints.width = { ideal: 1280 };
                videoConstraints.height = { ideal: 720 };
            }

            const idealConstraints = {
                video: videoConstraints,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            const fallbackConstraints = {
                video: true,
                audio: true
            };

            try {
                // Tenta o perfil ideal de estúdio
                this.stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
            } catch (err1) {
                console.warn("Falha no perfil ideal de câmera/mic. Tentando modelo básico...", err1);
                // Fallback para as configurações mínimas do navegador se a webcam não suportar a resolução da UI
                this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            }

            this.elCamera.srcObject = this.stream;
            // Libera controles
            document.getElementById('studio-controls-bar').classList.remove('opacity-50', 'pointer-events-none');

            MaestroCore.toast("Estúdio ativado! Use fones de ouvido.", "success");
        } catch (error) {
            console.error("Erro fatal ao iniciar estúdio:", error);

            let errMsg = "Permissão negada ou hardware não encontrado.";
            if (error.name === 'NotAllowedError') errMsg = "Permissão de câmera/microfone foi negada pelo navegador.";
            if (error.name === 'NotFoundError') errMsg = "Nenhuma câmera ou microfone foi encontrado no sistema.";
            if (error.name === 'NotReadableError') errMsg = "A câmera já está em uso por outro aplicativo (ex: Zoom, OBS).";

            MaestroCore.toast(`Erro: ${errMsg} (${error.name})`, "error");

            // Mostra o prompt de novo se falhar
            document.getElementById('studio-start-prompt').classList.remove('opacity-0', 'pointer-events-none');
        }
    }

    startRecording(type) {
        if (!this.stream) return;

        this.state = `recording_${type}`;
        this.recordedChunks = [];

        let videoBitsPerSecond = 2500000;
        let mimeType = 'video/webm;codecs=vp8,opus';
        let options = { videoBitsPerSecond };

        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options.mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options.mimeType = 'video/mp4';
        }

        try {
            this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e) {
            try {
                // Em caso de erro extremo na plataforma caí pro default (útil no iOS Safari)
                this.mediaRecorder = new MediaRecorder(this.stream);
            } catch (e2) {
                MaestroCore.toast("Erro ao iniciar gravador. Navegador indisponível.", "error");
                return;
            }
        }

        this.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => this.handleRecordStop(type);

        // UI Updates
        this.btnRecBase.classList.add('opacity-50', 'pointer-events-none');
        this.btnRecSolo.classList.add('opacity-50', 'pointer-events-none');

        // Remove disabled html tag from the button otherwise events wont fire
        this.btnStop.removeAttribute('disabled');
        this.btnStop.classList.remove('disabled', 'pointer-events-none');

        // Se for gravação de Solo (Overdub), tocar a base em sincronia!
        if (type === 'solo' && this.baseBlob) {
            this.elBase.currentTime = 0;
            this.elBase.play();
        }

        this.mediaRecorder.start();
        this.startTimer();

        document.getElementById('studio-action-container').classList.add('ring-2', 'ring-red-500', 'animate-pulse');
        MaestroCore.toast(`Gravando ${type === 'base' ? 'Pista Base' : 'Solo'}...`, "success");
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.stopTimer();

            if (this.state === 'recording_solo') {
                this.elBase.pause();
            }

            document.getElementById('studio-action-container').classList.remove('ring-2', 'ring-red-500', 'animate-pulse');

            // Add disabled attribute physically back
            this.btnStop.setAttribute('disabled', 'true');
            this.btnStop.classList.add('disabled', 'pointer-events-none');
        }
    }

    handleRecordStop(type) {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        const duration = (Date.now() - this.startTime) / 1000;

        if (type === 'base') {
            this.baseBlob = blob;
            this.baseDuration = duration;
            this.playerBase.src = url; // Sincroniza player independente
            this.elBase.src = url; // Mantém view principal de câmera embutida

            document.getElementById('status-track-base').innerText = 'Gravada';
            document.getElementById('status-track-base').classList.replace('text-brand', 'text-green-500');
            document.getElementById('status-track-base').classList.replace('bg-brand/10', 'bg-green-500/10');
            document.getElementById('btn-trash-base').classList.remove('hidden');

            // Libera o botão de gravar Solo
            this.btnRecSolo.classList.remove('cursor-not-allowed', 'opacity-50', 'pointer-events-none');
            this.btnRecBase.classList.remove('opacity-50', 'pointer-events-none');
            this.btnRecBase.innerHTML = '<div class="w-2 h-2 rounded-full bg-red-500"></div> Refazer Base';

        } else if (type === 'solo') {
            this.soloBlob = blob;
            this.soloDuration = duration;
            this.playerSolo.src = url; // Sincroniza player independente

            document.getElementById('status-track-solo').innerText = 'Gravada';
            document.getElementById('status-track-solo').classList.replace('text-brand', 'text-green-500');
            document.getElementById('status-track-solo').classList.replace('bg-brand/10', 'bg-green-500/10');
            document.getElementById('btn-trash-solo').classList.remove('hidden');

            this.btnRecBase.classList.remove('opacity-50', 'pointer-events-none');
            this.btnRecSolo.classList.remove('opacity-50', 'pointer-events-none');
            this.btnRecSolo.innerHTML = '<div class="w-2 h-2 rounded-full bg-orange-500"></div> Refazer Solo';

            // Libera Mixagem
            document.getElementById('studio-mixer').classList.remove('opacity-50', 'pointer-events-none');
            this.btnPreview.removeAttribute('disabled');
            this.btnPreview.classList.remove('pointer-events-none');
            this.btnExport.removeAttribute('disabled');
            this.btnExport.classList.remove('pointer-events-none');

            // Desligar câmera e mostrar o vídeo do Solo na tela
            this.turnOffCamera();
            this.elCamera.style.display = 'none';
            this.elBase.src = URL.createObjectURL(this.soloBlob);
            this.elBase.style.display = 'block';
        }

        this.state = 'idle';
        MaestroCore.toast("Faixa salva temporariamente.", "success");
    }

    turnOffCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.elCamera.srcObject = null;
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerDisplay.innerText = "00:00";
        this.timerInterval = setInterval(() => {
            const elaps = Math.floor((Date.now() - this.startTime) / 1000);
            this.timerDisplay.innerText = MaestroCore.formatTime(elaps);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    // ==========================================
    // FASE 4: MIXAGEM E EXPORTAÇÃO
    // ==========================================

    async previewMix() {
        if (!this.baseBlob || !this.soloBlob) {
            MaestroCore.toast("Grave as duas faixas antes de gerar a mixagem.", "error");
            return;
        }

        this.state = 'mixing';
        this.stopPreviewPlayback();

        this.btnPreview.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        this.btnPreview.classList.add('opacity-75', 'pointer-events-none');

        try {
            // Criar elementos de vídeo em memória (Offscreen / Invisíveis)
            this.previewVideoBase = document.createElement('video');
            this.previewVideoSolo = document.createElement('video');

            this.previewVideoBase.src = URL.createObjectURL(this.baseBlob);
            this.previewVideoSolo.src = URL.createObjectURL(this.soloBlob);

            // Sincronização via Promises (canplaythrough garantido)
            const syncPromise = (vid) => new Promise(resolve => {
                vid.oncanplaythrough = resolve;
                vid.onerror = resolve; // Avança mesmo com erro para não travar
                vid.load();
            });

            await Promise.all([
                syncPromise(this.previewVideoBase),
                syncPromise(this.previewVideoSolo)
            ]);

            // Reseta tempos cirurgicamente
            this.previewVideoBase.currentTime = 0;
            this.previewVideoSolo.currentTime = 0;

            // Feedback Visual: Apenas 1 precisa aparecer mudo ou manter oculto e tocar o audio
            this.elBase.src = URL.createObjectURL(this.soloBlob);
            this.elBase.muted = true;
            this.elBase.currentTime = 0;
            this.elBase.play().catch(() => { });
            this.elBase.style.display = 'block';
            this.elCamera.style.display = 'none';

            // Plays Simultâneos Acústicos
            this.previewVideoBase.play();
            this.previewVideoSolo.play();
            this.isPlayingPreview = true;

            const minDuration = Math.min(this.baseDuration || 0, this.soloDuration || 0) * 1000;
            const fallbackDuration = Math.min(this.previewVideoBase.duration, this.previewVideoSolo.duration) * 1000 || 5000;

            const timeToStop = minDuration > 0 ? minDuration : fallbackDuration;

            // Auto stop rigoroso com tempo mínimo da faixa
            this.previewTimeout = setTimeout(() => {
                if (this.isPlayingPreview) {
                    this.stopPreviewPlayback();
                    this.btnPreview.innerHTML = '<i class="fas fa-play"></i> Ouvir Mixagem';
                    this.btnPreview.classList.replace('text-red-500', 'text-gray-500');
                }
            }, timeToStop + 100);

        } catch (e) {
            console.error("Erro absoluto no previewMix:", e);
            MaestroCore.toast("Falha na sincronização de vias de áudio.", "error");
            this.stopPreviewPlayback();
        }

        this.btnPreview.classList.remove('opacity-75', 'pointer-events-none');
        this.btnPreview.innerHTML = '<i class="fas fa-stop"></i> Parar Preview';
        this.btnPreview.classList.replace('text-gray-500', 'text-red-500');
    }

    async togglePreview() {
        if (this.isPlayingPreview) {
            this.stopPreviewPlayback();
            this.btnPreview.innerHTML = '<i class="fas fa-play"></i> Ouvir Mixagem';
            this.btnPreview.classList.replace('text-red-500', 'text-gray-500');
        } else {
            await this.previewMix();
        }
    }

    stopPreviewPlayback() {
        this.isPlayingPreview = false;
        if (this.previewTimeout) clearTimeout(this.previewTimeout);

        if (this.previewVideoBase) {
            try { this.previewVideoBase.pause(); this.previewVideoBase.currentTime = 0; } catch (e) { }
        }
        if (this.previewVideoSolo) {
            try { this.previewVideoSolo.pause(); this.previewVideoSolo.currentTime = 0; } catch (e) { }
        }

        if (this.elBase) {
            this.elBase.pause();
            try { this.elBase.currentTime = 0; } catch (e) { }
        }
    }

    trashTrack(type) {
        this.stopPreviewPlayback();
        if (type === 'base') {
            this.baseBlob = null;
            this.baseDuration = 0;
            this.elBase.src = "";
            this.playerBase.src = "";
            if (this.timeTotBase) this.timeTotBase.innerText = "00:00.000";
            if (this.timeCurBase) this.timeCurBase.innerText = "00:00.000";
            if (this.tlBase) { this.tlBase.value = 0; this.tlBase.setAttribute('disabled', 'true'); }

            document.getElementById('status-track-base').innerText = 'Vazia';
            document.getElementById('status-track-base').classList.replace('text-green-500', 'text-brand');
            document.getElementById('status-track-base').classList.replace('bg-green-500/10', 'bg-brand/10');
            document.getElementById('btn-trash-base').classList.add('hidden');
            this.btnRecBase.innerHTML = '<div class="w-2 h-2 rounded-full bg-red-500"></div> Base';

            if (this.soloBlob) this.trashTrack('solo');

            this.btnRecSolo.classList.add('cursor-not-allowed', 'opacity-50', 'pointer-events-none');
            document.getElementById('studio-mixer').classList.add('opacity-50', 'pointer-events-none');
            this.btnPreview.setAttribute('disabled', 'true');
            this.btnPreview.classList.add('pointer-events-none');
            this.btnExport.setAttribute('disabled', 'true');
            this.btnExport.classList.add('pointer-events-none');

            // Força a pessoa a Iniciar Estúdio novamente para religar a camera
            document.getElementById('studio-start-prompt').classList.remove('opacity-0', 'pointer-events-none');
            document.getElementById('studio-controls-bar').classList.add('opacity-50', 'pointer-events-none');
            this.elCamera.style.display = 'block';
            this.elBase.style.display = 'none';

        } else if (type === 'solo') {
            this.soloBlob = null;
            this.soloDuration = 0;
            this.playerSolo.src = "";
            if (this.timeTotSolo) this.timeTotSolo.innerText = "00:00.000";
            if (this.timeCurSolo) this.timeCurSolo.innerText = "00:00.000";
            if (this.tlSolo) { this.tlSolo.value = 0; this.tlSolo.setAttribute('disabled', 'true'); }

            document.getElementById('status-track-solo').innerText = 'Vazia';
            document.getElementById('status-track-solo').classList.replace('text-green-500', 'text-brand');
            document.getElementById('status-track-solo').classList.replace('bg-green-500/10', 'bg-brand/10');
            document.getElementById('btn-trash-solo').classList.add('hidden');
            this.btnRecSolo.innerHTML = '<div class="w-2 h-2 rounded-full bg-orange-500"></div> Solo';

            document.getElementById('studio-mixer').classList.add('opacity-50', 'pointer-events-none');
            this.btnPreview.setAttribute('disabled', 'true');
            this.btnPreview.classList.add('pointer-events-none');
            this.btnExport.setAttribute('disabled', 'true');
            this.btnExport.classList.add('pointer-events-none');

            // Religar a camera para gravar o solo de novo
            this.initStudio();
            this.elCamera.style.display = 'block';
            this.elBase.style.display = 'none';
        }
        MaestroCore.toast(`Faixa ${type} apagada.`, "info");
    }

    async exportFinal() {
        if (!this.baseBlob || !this.soloBlob) {
            MaestroCore.toast('Grave as duas faixas antes de gerar a mixagem final.', 'error');
            return;
        }

        this.btnExport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando Mixagem...';
        this.btnExport.classList.add('opacity-75', 'pointer-events-none');
        MaestroCore.toast('Processando audio... aguarde.', 'info');

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const decodeCtx = new AudioContextClass();

            const decodeBlob = async (blob) => {
                const arrayBuf = await blob.arrayBuffer();
                return decodeCtx.decodeAudioData(arrayBuf);
            };

            const [bufBase, bufSolo] = await Promise.all([
                decodeBlob(this.baseBlob),
                decodeBlob(this.soloBlob)
            ]);
            await decodeCtx.close();

            const sampleRate = bufBase.sampleRate || 44100;
            const length = Math.min(bufBase.length, bufSolo.length);
            const channels = Math.max(bufBase.numberOfChannels, bufSolo.numberOfChannels);

            const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

            const s1 = offlineCtx.createBufferSource();
            s1.buffer = bufBase;
            s1.connect(offlineCtx.destination);
            s1.start(0);

            const s2 = offlineCtx.createBufferSource();
            s2.buffer = bufSolo;
            s2.connect(offlineCtx.destination);
            s2.start(0);

            const rendered = await offlineCtx.startRendering();
            const wavBlob = this.encodeWav(rendered);
            const url = URL.createObjectURL(wavBlob);
            const fileName = 'MaestroPro_Mix_' + Date.now() + '.wav';

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);

            this.btnExport.innerHTML = '<i class="fas fa-check"></i> Mixagem Baixada!';
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none', 'bg-purple-600', 'hover:bg-purple-700');
            this.btnExport.classList.add('bg-green-600', 'hover:bg-green-700');
            MaestroCore.toast('Arquivo salvo! Verifique seus downloads.', 'success');

        } catch (error) {
            console.error('Studio render error:', error);
            MaestroCore.toast('Falha: ' + error.message, 'error');
            this.btnExport.innerHTML = '<i class="fas fa-file-export"></i> Gerar Versao Final';
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none');
        }
    }

    encodeWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const numSamples = buffer.length;
        const dataSize = numSamples * numChannels * 2;
        const ab = new ArrayBuffer(44 + dataSize);
        const view = new DataView(ab);
        const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
                view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
                offset += 2;
            }
        }
        return new Blob([ab], { type: 'audio/wav' });
    }
}

// Inicializar apenas quando a página estiver carregada
window.addEventListener('DOMContentLoaded', () => {
    window.studioApp = new StudioApp();
});
