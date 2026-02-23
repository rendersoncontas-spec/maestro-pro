// ==========================================
// MÓDULO: PROFESSOR MUSICAL (MENTOR)
// Objetivo: Ensinar escalas, campos harmônicos e improvisação no contexto Gospel/Worship
// ==========================================

const ProfessorApp = {
    notes: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],

    // Fórmulas de escalas em semitons a partir da tônica
    formulas: {
        'escala-maior': [0, 2, 4, 5, 7, 9, 11], // T-T-ST-T-T-T-ST
        'escala-menor': [0, 2, 3, 5, 7, 8, 10], // T-ST-T-T-ST-T-T
        'penta-maior': [0, 2, 4, 7, 9],         // 1, 2, 3, 5, 6
        'penta-menor': [0, 3, 5, 7, 10]         // 1, b3, 4, 5, b7
    },

    // Tipos de acordes para o Campo Harmônico
    chordsTriads: {
        'maior': ['', 'm', 'm', '', '', 'm', 'dim'],
        'menor': ['m', 'dim', '', 'm', 'm', '', '']
    },
    chordsTetrads: {
        'maior': ['7M', 'm7', 'm7', '7M', '7', 'm7', 'm7(b5)'],
        'menor': ['m7', 'm7(b5)', '7M', 'm7', 'm7', '7M', '7']
    },
    functions: ['Tônica (Repouso)', 'Subdominante (Ponte)', 'Tônica (Relativa)', 'Subdominante (Meio)', 'Dominante (Tensão)', 'Tônica (Substituto)', 'Dominante (Passagem)'],

    init() {
        const btnGenerate = document.getElementById('btn-prof-generate');
        if (btnGenerate) {
            btnGenerate.addEventListener('click', () => this.generateLesson());
        }
    },

    getNoteIndex(note) {
        return this.notes.indexOf(note);
    },

    getScaleNotes(rootNote, formulaName) {
        const rootIndex = this.getNoteIndex(rootNote);
        let actualFormula;
        if (formulaName === 'campo-maior') actualFormula = this.formulas['escala-maior'];
        else if (formulaName === 'campo-menor') actualFormula = this.formulas['escala-menor'];
        else actualFormula = this.formulas[formulaName];

        return actualFormula.map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            return this.notes[noteIndex];
        });
    },

    generateLesson() {
        try {
            const key = document.getElementById('prof-key').value;
            const style = document.getElementById('prof-style').value;
            const level = document.getElementById('prof-level').value;
            const topic = document.getElementById('prof-topic').value;

            let contentHtml = '';

            if (topic.includes('escala') || topic.includes('penta')) {
                contentHtml = this.generateScaleLesson(key, style, level, topic);
            } else {
                contentHtml = this.generateHarmonyLesson(key, style, level, topic);
            }

            // Atualizar UI
            document.getElementById('prof-empty-state').classList.add('hidden');
            const resultContainer = document.getElementById('prof-result-container');
            resultContainer.classList.remove('hidden');
            document.getElementById('prof-result-content').innerHTML = contentHtml;
        } catch (e) {
            if (window.showToast) window.showToast("Erro: " + e.message, "error");
            console.error(e);
        }
    },

    generateScaleLesson(key, style, level, topic) {
        const titlePairs = {
            'escala-maior': 'Escala Maior (Jônio)',
            'escala-menor': 'Escala Menor Natural (Eólio)',
            'penta-maior': 'Pentatônica Maior',
            'penta-menor': 'Pentatônica Menor'
        };

        const notes = this.getScaleNotes(key, topic);
        const formulaText = topic.includes('penta') ?
            (topic.includes('maior') ? '1 - 2 - 3 - 5 - 6' : '1 - b3 - 4 - 5 - b7') :
            (topic.includes('maior') ? 'T - T - ST - T - T - T - ST' : 'T - ST - T - T - ST - T - T');

        let styleTip = 'Excelente para criar melodias sólidas.';
        if (style === 'gospel') styleTip = 'Use para "beds" (camadas) e arranjos ministrais suaves. Muito útil para dedilhados.';
        if (style === 'rock' && topic.includes('penta')) styleTip = 'Base do Rock. Abuse dos bends na 3ª menor e 4ª justa.';
        if (style === 'blues' && topic.includes('penta')) styleTip = 'Puro sentimento! Adicione a blue note (b5) para o tempero definitivo.';

        let tipHtml = `
            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-layer-group"></i> 1. A Escala de ${key} (${titlePairs[topic]})
                </h3>
                <div class="bg-gray-50 dark:bg-dark-element/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p class="mb-2"><strong>Fórmula:</strong> <span class="text-brand font-mono">${formulaText}</span></p>
                    <p><strong>Notas Práticas:</strong></p>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${notes.map(n => `<span class="bg-white dark:bg-dark-surface px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 font-bold">${n}</span>`).join('')}
                    </div>
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-guitar"></i> 2. Aplicação na Prática (${style.toUpperCase()})
                </h3>
                <p class="leading-relaxed mb-3">${styleTip}</p>
                <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm italic">
                    <i class="fas fa-lightbulb"></i> <strong>Dica do Professor:</strong> Não toque a escala subindo e descendo como um robô. Crie frases pequenas de 3 ou 4 notas tentando cantarolar a melodia junto!
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-stopwatch"></i> 3. Exercício de 5 Minutos
                </h3>
                <ul class="list-disc pl-5 space-y-2 marker:text-brand">
                    <li>Coloque o metrônomo do app em <strong>70 BPM</strong>.</li>
                    <li>Toque as notas de forma alternada (Palhetada Alternada se for Violão/Guitarra).</li>
                    <li>Quando chegar na última nota, repita ela e desça de forma fluida.</li>
                    <li>Concentre-se em não errar, em vez de tocar rápido.</li>
                </ul>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/30">
                    <h4 class="font-bold text-red-600 dark:text-red-400 mb-2"><i class="fas fa-exclamation-triangle"></i> Erros Comuns</h4>
                    <p class="text-sm">Tocar fora do tempo. Querer correr demais antes de memorizar o "shape" ou as posições. Não ouvir o backing track.</p>
                </div>
                <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30">
                    <h4 class="font-bold text-green-600 dark:text-green-400 mb-2"><i class="fas fa-fire"></i> Desafio Diário</h4>
                    <p class="text-sm">Improvise usando apenas 3 notas dessa escala hoje. Tente criar ritmos diferentes em vez de notas novas!</p>
                </div>
            </div>
        `;
        return tipHtml;
    },

    generateHarmonyLesson(key, style, level, topic) {
        const isMajor = topic === 'campo-maior';
        const typeStr = isMajor ? 'maior' : 'menor';
        const title = isMajor ? `Campo Harmônico Maior de ${key}` : `Campo Harmônico Menor de ${key}`;

        const scaleNotes = this.getScaleNotes(key, topic);
        const modifiers = level === 'iniciante' ? this.chordsTriads[typeStr] : this.chordsTetrads[typeStr];

        const chords = scaleNotes.map((note, i) => `${note}${modifiers[i]}`);

        let progression = '';
        let progressionExp = '';

        if (style === 'gospel') {
            progression = isMajor ? 'I - V - vi - IV' : 'i - VI - III - VII';
            progressionExp = isMajor ?
                `<strong>${chords[0]} - ${chords[4]} - ${chords[5]} - ${chords[3]}</strong>. Esta é a progressão de 80% dos louvores Worship. Aprenda ela em ${key} e você tocará mil músicas.` :
                `<strong>${chords[0]} - ${chords[5]} - ${chords[2]} - ${chords[6]}</strong>. Intensa e de guerra. Ótima para ministração vibrante.`;
        } else if (style === 'rock' || style === 'pop') {
            progression = isMajor ? 'I - vi - IV - V' : 'i - VI - iv - v';
            progressionExp = isMajor ?
                `<strong>${chords[0]} - ${chords[5]} - ${chords[3]} - ${chords[4]}</strong>. O clássico Pop Mágico dos anos 50/60.` :
                `<strong>${chords[0]} - ${chords[5]} - ${chords[3]} - ${chords[4]}</strong>. Densa e melancólica.`;
        } else {
            progression = isMajor ? 'ii - V - I' : 'ii(m7b5) - V7 - i';
            progressionExp = isMajor ?
                `<strong>${chords[1]} - ${chords[4]} - ${chords[0]}</strong>. A base do Jazz e da Bossa Nova.` :
                `<strong>${chords[1]} - ${chords[4]} - ${chords[0]}</strong>. Cadência de Bossa / Jazz menor.`;
        }

        let html = `
            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-sitemap"></i> 1. ${title}
                </h3>
                <p class="mb-4">Acordes que fazem parte do tom de ${key} (${level}):</p>
                <div class="overflow-x-auto pb-4">
                    <div class="flex gap-2 min-w-max">
                        ${chords.map((c, idx) => `
                            <div class="flex flex-col text-center">
                                <span class="bg-white dark:bg-dark-surface min-w-[3rem] px-3 py-2 rounded-t-xl border border-b-0 border-gray-200 dark:border-gray-600 font-bold text-lg">${c}</span>
                                <span class="bg-gray-100 dark:bg-dark-element px-2 py-1 text-[10px] rounded-b-xl border border-t-0 border-gray-200 dark:border-gray-600 text-gray-500 font-bold">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][idx]}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-link"></i> 2. Progressão de Ouro (${style.toUpperCase()})
                </h3>
                <div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800/30">
                    <p class="font-black text-lg mb-2">${progression}</p>
                    <p class="text-sm">${progressionExp}</p>
                </div>
            </div>

            <div class="mb-8">
                <h3 class="text-xl font-bold mb-4 text-brand border-b border-brand/20 pb-2">
                    <i class="fas fa-praying-hands"></i> 3. Aplicação no Louvor / Prática
                </h3>
                <ul class="list-disc pl-5 space-y-2 marker:text-brand text-sm">
                    <li>O acorde <strong>${chords[0]} (Tônica)</strong> é a sua casa, sensação de pouso final.</li>
                    <li>O acorde <strong>${chords[3]} (Subdominante)</strong> clama por movimento, usado muito no pré-refrão.</li>
                    <li>O acorde <strong>${chords[4]} (Dominante)</strong> gera enorme tensão que "pede" para voltar para o ${chords[0]}.</li>
                </ul>
            </div>

            <div class="bg-brand/10 p-5 rounded-2xl">
                <h4 class="font-bold text-brand mb-2"><i class="fas fa-dumbbell"></i> Exercício de Fluência</h4>
                <p class="text-sm">Ligue o Metrônomo do Maestro Pro em 65 BPM. Toque a progressão <strong>${progression}</strong> mudando de acorde no exato clique 1 de cada compasso de 4 tempos. Tente tocar usando pestanas/inversões diferentes para não movimentar muito a mão.</p>
            </div>
        `;

        return html;
    }
};

window.ProfessorApp = ProfessorApp;
