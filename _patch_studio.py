import sys

content = open('js/studio.js', 'r', encoding='utf-8').read()

new_method = """    async exportFinal() {
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
    }"""

start_marker = '    async exportFinal() {'
end_of_class = '}\n\n// Inicializar'

start_idx = content.find(start_marker)
end_idx = content.find(end_of_class)

if start_idx == -1 or end_idx == -1:
    # Try CRLF variant
    end_of_class = '}\r\n\r\n// Inicializar'
    end_idx = content.find(end_of_class)

print(f'start: {start_idx}, end_of_class: {end_idx}')

if start_idx == -1:
    print('ERROR: could not find exportFinal', file=sys.stderr)
    sys.exit(1)
if end_idx == -1:
    print('ERROR: could not find end of class', file=sys.stderr)
    sys.exit(1)

# Reconstruct: keep everything before exportFinal, add new method, then close class + initializer
before = content[:start_idx]
after_marker = content.find('// Inicializar', end_idx)
after = content[after_marker:]  # from "// Inicializar..." to end

new_content = before + new_method + '\n}\n\n// ' + after[3:]  # strip leading '// '

open('js/studio.js', 'w', encoding='utf-8').write(new_content)
print('OK. New length:', len(new_content))
