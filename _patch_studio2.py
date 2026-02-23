import sys

content = open('js/studio.js', 'r', encoding='utf-8').read()

# New exportFinal that uses live Web Audio routing instead of decodeAudioData
# This reliably works on Android because it uses HTMLVideoElement as audio source
new_method = """    async exportFinal() {
        if (!this.baseBlob || !this.soloBlob) {
            MaestroCore.toast('Grave as duas faixas antes de gerar a mixagem final.', 'error');
            return;
        }

        this.btnExport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando Mixagem...';
        this.btnExport.classList.add('opacity-75', 'pointer-events-none');
        MaestroCore.toast('Iniciando mixagem de audio...', 'info');

        try {
            // Criar videos offscreen com os blobs gravados
            const vBase = document.createElement('video');
            const vSolo = document.createElement('video');
            vBase.src = URL.createObjectURL(this.baseBlob);
            vSolo.src = URL.createObjectURL(this.soloBlob);
            vBase.playsInline = true;
            vSolo.playsInline = true;

            // Precisam estar no DOM para Android liberar o audio
            const hide = el => { el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px'; };
            hide(vBase); hide(vSolo);
            document.body.appendChild(vBase);
            document.body.appendChild(vSolo);

            // Aguardar metadados
            await Promise.all([
                new Promise(r => { vBase.onloadedmetadata = r; vBase.onerror = r; setTimeout(r, 3000); }),
                new Promise(r => { vSolo.onloadedmetadata = r; vSolo.onerror = r; setTimeout(r, 3000); })
            ]);

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            await ctx.resume();

            const dest = ctx.createMediaStreamDestination();

            // Roteamento: video element -> Web Audio -> recorder destination
            const srcA = ctx.createMediaElementSource(vBase);
            const gainA = ctx.createGain(); gainA.gain.value = 1;
            srcA.connect(gainA).connect(dest);

            const srcB = ctx.createMediaElementSource(vSolo);
            const gainB = ctx.createGain(); gainB.gain.value = 1;
            srcB.connect(gainB).connect(dest);

            // Manter o clock vivo ligando a ctx.destination em volume 0
            const silent = ctx.createGain(); silent.gain.value = 0;
            dest.connect(silent).connect(ctx.destination);

            // Escolher formato de audio suportado
            const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
            let mimeType = '';
            for (const t of audioTypes) {
                if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
            }

            const recorder = mimeType
                ? new MediaRecorder(dest.stream, { mimeType })
                : new MediaRecorder(dest.stream);

            const chunks = [];
            recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

            const duration = Math.min(this.baseDuration || 30, this.soloDuration || 30) * 1000;

            // Iniciar gravacao e reproducao sincronizada
            vBase.currentTime = 0; vSolo.currentTime = 0;
            await Promise.all([
                vBase.play().catch(() => {}),
                vSolo.play().catch(() => {})
            ]);
            recorder.start(300);

            await new Promise(resolve => setTimeout(resolve, duration + 500));

            recorder.stop();
            vBase.pause(); vSolo.pause();
            await ctx.close();

            // Montar Blob final e baixar
            await new Promise(resolve => { recorder.onstop = resolve; });

            const finalBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
            const ext = (recorder.mimeType || mimeType || '').includes('mp4') ? 'm4a' : 'webm';
            const url = URL.createObjectURL(finalBlob);
            const fileName = 'MaestroPro_Mix_' + Date.now() + '.' + ext;

            // Limpar DOM
            document.body.removeChild(vBase);
            document.body.removeChild(vSolo);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);

            this.btnExport.innerHTML = '<i class="fas fa-check"></i> Mixagem Baixada!';
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none', 'bg-purple-600', 'hover:bg-purple-700');
            this.btnExport.classList.add('bg-green-600', 'hover:bg-green-700');
            MaestroCore.toast('Mixagem salva nos downloads!', 'success');

        } catch (error) {
            console.error('Studio export error:', error);
            MaestroCore.toast('Falha na exportacao: ' + error.message, 'error');
            this.btnExport.innerHTML = '<i class="fas fa-file-export"></i> Gerar Versao Final';
            this.btnExport.classList.remove('opacity-75', 'pointer-events-none');
        }
    }"""

start_marker = '    async exportFinal() {'
end_of_class = '}\n\n// Inicializar'

start_idx = content.find(start_marker)
end_idx = content.find(end_of_class)

print(f'start: {start_idx}, end: {end_idx}')

if start_idx == -1 or end_idx == -1:
    print('ERROR: markers not found', file=sys.stderr)
    sys.exit(1)

# Everything from "// Inicializar" to end of file
after_marker_idx = content.find('// Inicializar', end_idx)
after = content[after_marker_idx:]

new_content = content[:start_idx] + new_method + '\n}\n\n// ' + after[3:]
open('js/studio.js', 'w', encoding='utf-8').write(new_content)
print('OK. New length:', len(new_content))
