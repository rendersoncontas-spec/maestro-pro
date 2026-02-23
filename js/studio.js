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

        this.bindEvents();
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

        if (type === 'base') {
            this.baseBlob = blob;
            this.elBase.src = url;

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

            document.getElementById('status-track-solo').innerText = 'Gravada';
            document.getElementById('status-track-solo').classList.replace('text-brand', 'text-green-500');
            document.getElementById('status-track-solo').classList.replace('bg-brand/10', 'bg-green-500/10');
            document.getElementById('btn-trash-solo').classList.remove('hidden');

            this.btnRecBase.classList.remove('opacity-50', 'pointer-events-none');
            this.btnRecSolo.classList.remove('opacity-50', 'pointer-events-none');
            this.btnRecSolo.innerHTML = '<div class="w-2 h-2 rounded-full bg-orange-500"></div> Refazer Solo';

            // Libera Mixagem
            document.getElementById('studio-mixer').classList.remove('opacity-50', 'pointer-events-none');
            this.btnPreview.classList.remove('disabled', 'pointer-events-none');
            this.btnExport.classList.remove('disabled', 'pointer-events-none');

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

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!this.mixAudioCtx) {
            this.mixAudioCtx = new AudioContextClass();
        }
        if (this.mixAudioCtx.state === 'suspended') await this.mixAudioCtx.resume();

        this.stopPreviewPlayback();

        this.btnPreview.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        this.btnPreview.classList.add('opacity-75', 'pointer-events-none');

        try {
            // Decodificar blobs em AudioBuffers nativos
            const baseBuffer = await this.getAudioBuffer(this.mixAudioCtx, this.baseBlob);
            const soloBuffer = await this.getAudioBuffer(this.mixAudioCtx, this.soloBlob);

            this.previewGainBase = this.mixAudioCtx.createGain();
            this.previewGainSolo = this.mixAudioCtx.createGain();

            this.previewBaseSource = this.mixAudioCtx.createBufferSource();
            this.previewBaseSource.buffer = baseBuffer;
            this.previewBaseSource.connect(this.previewGainBase).connect(this.mixAudioCtx.destination);

            this.previewSoloSource = this.mixAudioCtx.createBufferSource();
            this.previewSoloSource.buffer = soloBuffer;
            this.previewSoloSource.connect(this.previewGainSolo).connect(this.mixAudioCtx.destination);

            const updateVols = () => {
                if (this.previewGainBase && this.previewGainBase.gain) {
                    this.previewGainBase.gain.value = document.getElementById('vol-base').value;
                }
                if (this.previewGainSolo && this.previewGainSolo.gain) {
                    this.previewGainSolo.gain.value = document.getElementById('vol-solo').value;
                }
            };
            updateVols();

            document.getElementById('vol-base').addEventListener('input', updateVols);
            document.getElementById('vol-solo').addEventListener('input', updateVols);

            // Visual: Exibir o vídeo do solo mutado em sincronia
            this.elBase.src = URL.createObjectURL(this.soloBlob);
            this.elBase.muted = true;
            this.elBase.currentTime = 0;
            this.elBase.play().catch(e => console.warn("Video play prevented: ", e));

            this.elBase.style.display = 'block';
            this.elCamera.style.display = 'none';

            // Iniciar sincronamente os buffers
            this.previewBaseSource.start(0);
            this.previewSoloSource.start(0);
            this.isPlayingPreview = true;

            const maxDuration = Math.max(baseBuffer.duration, soloBuffer.duration) * 1000;

            // Auto stop quando terminar
            this.previewTimeout = setTimeout(() => {
                if (this.isPlayingPreview) {
                    this.stopPreviewPlayback();
                    this.btnPreview.innerHTML = '<i class="fas fa-play"></i> Ouvir Mixagem';
                    this.btnPreview.classList.replace('text-red-500', 'text-gray-500');
                }
            }, maxDuration + 100);

        } catch (e) {
            console.error("Erro no previewMix:", e);
            MaestroCore.toast("Erro ao processar as faixas para reprodução.", "error");
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

        if (this.previewBaseSource) {
            try { this.previewBaseSource.stop(); } catch (e) { }
            this.previewBaseSource.disconnect();
            this.previewBaseSource = null;
        }
        if (this.previewSoloSource) {
            try { this.previewSoloSource.stop(); } catch (e) { }
            this.previewSoloSource.disconnect();
            this.previewSoloSource = null;
        }

        if (this.previewGainBase) {
            this.previewGainBase.disconnect();
            this.previewGainBase = null;
        }
        if (this.previewGainSolo) {
            this.previewGainSolo.disconnect();
            this.previewGainSolo = null;
        }
        if (this.elBase) this.elBase.pause();
        if (this.mixAudioCtx && this.mixAudioCtx.state === 'running') {
            this.mixAudioCtx.suspend();
        }
    }

    trashTrack(type) {
        this.stopPreviewPlayback();
        if (type === 'base') {
            this.baseBlob = null;
            this.elBase.src = "";
            document.getElementById('status-track-base').innerText = 'Vazia';
            document.getElementById('status-track-base').classList.replace('text-green-500', 'text-brand');
            document.getElementById('status-track-base').classList.replace('bg-green-500/10', 'bg-brand/10');
            document.getElementById('btn-trash-base').classList.add('hidden');
            this.btnRecBase.innerHTML = '<div class="w-2 h-2 rounded-full bg-red-500"></div> Base';

            if (this.soloBlob) this.trashTrack('solo');

            this.btnRecSolo.classList.add('cursor-not-allowed', 'opacity-50', 'pointer-events-none');
            document.getElementById('studio-mixer').classList.add('opacity-50', 'pointer-events-none');
            this.btnPreview.classList.add('disabled', 'pointer-events-none');
            this.btnExport.classList.add('disabled', 'pointer-events-none');

            // Força a pessoa a Iniciar Estúdio novamente para religar a camera
            document.getElementById('studio-start-prompt').classList.remove('opacity-0', 'pointer-events-none');
            document.getElementById('studio-controls-bar').classList.add('opacity-50', 'pointer-events-none');
            this.elCamera.style.display = 'block';
            this.elBase.style.display = 'none';

        } else if (type === 'solo') {
            this.soloBlob = null;
            document.getElementById('status-track-solo').innerText = 'Vazia';
            document.getElementById('status-track-solo').classList.replace('text-green-500', 'text-brand');
            document.getElementById('status-track-solo').classList.replace('bg-green-500/10', 'bg-brand/10');
            document.getElementById('btn-trash-solo').classList.add('hidden');
            this.btnRecSolo.innerHTML = '<div class="w-2 h-2 rounded-full bg-orange-500"></div> Solo';

            document.getElementById('studio-mixer').classList.add('opacity-50', 'pointer-events-none');
            this.btnPreview.classList.add('disabled', 'pointer-events-none');
            this.btnExport.classList.add('disabled', 'pointer-events-none');

            // Religar a camera para gravar o solo de novo
            this.initStudio();
            this.elCamera.style.display = 'block';
            this.elBase.style.display = 'none';
        }
        MaestroCore.toast(`Faixa ${type} apagada.`, "info");
    }

    async exportFinal() {
        if (!this.baseBlob || !this.soloBlob) {
            MaestroCore.toast("Grave as duas faixas antes de gerar a mixagem final.", "error");
            return;
        }

        this.btnExport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando Mixagem...';
        this.btnExport.classList.add('opacity-75', 'pointer-events-none');
        MaestroCore.toast("Renderizando vídeo com áudio mixado...", "info");

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const renderCtx = new AudioContextClass();
        const dest = renderCtx.createMediaStreamDestination();

        let baseBuffer, soloBuffer;
        try {
            baseBuffer = await this.getAudioBuffer(renderCtx, this.baseBlob);
            soloBuffer = await this.getAudioBuffer(renderCtx, this.soloBlob);
        } catch (e) {
            MaestroCore.toast("Erro ao processar áudio.", "error");
            this.btnExport.innerHTML = '<i class="fas fa-file-export"></i> Gerar Versão Final';
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none');
            return;
        }

        const sourceBase = renderCtx.createBufferSource();
        sourceBase.buffer = baseBuffer;
        const gainBase = renderCtx.createGain();
        gainBase.gain.value = document.getElementById('vol-base').value;
        sourceBase.connect(gainBase).connect(dest);

        const sourceSolo = renderCtx.createBufferSource();
        sourceSolo.buffer = soloBuffer;
        const gainSolo = renderCtx.createGain();
        gainSolo.gain.value = document.getElementById('vol-solo').value;
        sourceSolo.connect(gainSolo).connect(dest);

        // Prepara video visível
        this.elBase.src = URL.createObjectURL(this.soloBlob);
        this.elBase.muted = true;
        this.elBase.currentTime = 0;
        this.elBase.style.display = 'block';

        let videoStream = null;
        let isFallback = false;

        try {
            await this.elBase.play();
            if (this.elBase.captureStream) {
                videoStream = this.elBase.captureStream(30);
            } else if (this.elBase.mozCaptureStream) {
                videoStream = this.elBase.mozCaptureStream(30);
            }
        } catch (e) {
            console.warn("Capture Stream Error: ", e);
        }

        const combinedStream = new MediaStream();
        if (videoStream && videoStream.getVideoTracks().length > 0) {
            combinedStream.addTrack(videoStream.getVideoTracks()[0]);
        } else {
            isFallback = true;
            MaestroCore.toast("Vídeo indisponível. Exportando mixagem de Áudio...", "warning");
        }

        dest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

        let mimeType = 'video/webm;codecs=vp8,opus';
        if (isFallback) mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = isFallback ? 'audio/mp4' : 'video/mp4';

        let recorder;
        try {
            recorder = new MediaRecorder(combinedStream, { mimeType: mimeType, videoBitsPerSecond: 2500000 });
        } catch (e) {
            recorder = new MediaRecorder(combinedStream);
        }

        let finalChunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) finalChunks.push(e.data); };

        recorder.onstop = () => {
            const finalBlob = new Blob(finalChunks, { type: recorder.mimeType || mimeType });
            const url = URL.createObjectURL(finalBlob);

            const ext = (recorder.mimeType || mimeType).includes('mp4') ? 'mp4' : 'webm';
            const fileName = isFallback ? `MaestroPro_AudioMix_${Date.now()}.${ext}` : `MaestroPro_VideoMix_${Date.now()}.${ext}`;

            this.btnExport.innerHTML = `<a href="${url}" download="${fileName}" class="w-full h-full flex items-center justify-center gap-2"><i class="fas fa-download"></i> Baixar Arquivo Final</a>`;
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none');
            this.btnExport.classList.replace('bg-purple-600', 'bg-green-600');
            this.btnExport.classList.replace('hover:bg-purple-700', 'hover:bg-green-700');

            let dLink = document.getElementById('studio-download-link');
            if (dLink && dLink.parentElement) {
                const existing = document.getElementById('isolate-downloads');
                if (existing) existing.remove();

                dLink.parentElement.innerHTML += `
                   <div class="flex gap-2 mt-2" id="isolate-downloads">
                       <a href="${URL.createObjectURL(this.baseBlob)}" download="Video_Base.webm" class="flex-1 py-3 text-center bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors">Baixar Câmera Base</a>
                       <a href="${URL.createObjectURL(this.soloBlob)}" download="Video_Solo.webm" class="flex-1 py-3 text-center bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors">Baixar Câmera Solo</a>
                   </div>
                `;
            }

            MaestroCore.toast("Processamento concluído! Clique no botão verde para Salvar.", "success");
            this.elBase.pause();
        };

        recorder.start();
        sourceBase.start(0);
        sourceSolo.start(0);

        const maxDuration = Math.max(baseBuffer.duration, soloBuffer.duration) * 1000;
        setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
        }, maxDuration + 200);
    }
}

// Inicializar apenas quando a página estiver carregada
window.addEventListener('DOMContentLoaded', () => {
    window.studioApp = new StudioApp();
});
