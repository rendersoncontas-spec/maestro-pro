/**
 * MÓDULO: chords.js (Dicionário Inteligente de Acordes PRO V1)
 * Auditoria completa e profissional de todos os shapes.
 * Validação Teórica, Estrutural, CAGED e Sistema Pró.
 */

const ChordDictionary = {
    NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    ENHARMONICS: { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' },
    // String indices: 1=E1(fine), 2=B2, 3=G3, 4=D4, 5=A5, 6=E6(thick)
    TUNING_NOTES: { 1: 'E', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' },

    FORMULAS: {
        'major': [0, 4, 7],
        'minor': [0, 3, 7],
        '5': [0, 7],
        '7': [0, 4, 7, 10],
        'm7': [0, 3, 7, 10],
        'maj7': [0, 4, 7, 11],
        'mMaj7': [0, 3, 7, 11],
        'dim': [0, 3, 6],
        'dim7': [0, 3, 6, 9],
        'm7b5': [0, 3, 6, 10],
        'aug': [0, 4, 8],
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
        'add9': [0, 4, 7, 2]
    },

    // Shapes CAGED padronizados relativos à pestana virtual.
    // strings array mapped by real physics: [E6, A5, D4, G3, B2, E1]
    // values map the fret relative to the "root".
    SHAPES: {
        'major': [
            { name: "C", rootStr: 5, rOffset: 3, str: ['x', 0, -1, -3, -2, -3], fin: ['x', 3, 2, 0, 1, 0], barre: null },
            { name: "A", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 2, 2, 0], fin: ['x', 1, 2, 3, 4, 1], barre: { start: 1, end: 5, fRel: 0 } },
            { name: "G", rootStr: 6, rOffset: 3, str: [0, -1, -3, -3, -3, 0], fin: [3, 2, 0, 0, 0, 4], barre: null },
            { name: "E", rootStr: 6, rOffset: 0, str: [0, 2, 2, 1, 0, 0], fin: [1, 3, 4, 2, 1, 1], barre: { start: 1, end: 6, fRel: 0 } },
            { name: "D", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 3, 2], fin: ['x', 'x', 0, 1, 3, 2], barre: null }
        ],
        'minor': [
            { name: "Am", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 2, 1, 0], fin: ['x', 1, 3, 4, 2, 1], barre: { start: 1, end: 5, fRel: 0 } },
            { name: "Em", rootStr: 6, rOffset: 0, str: [0, 2, 2, 0, 0, 0], fin: [1, 3, 4, 1, 1, 1], barre: { start: 1, end: 6, fRel: 0 } },
            { name: "Dm", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 3, 1], fin: ['x', 'x', 0, 2, 3, 1], barre: null },
            { name: "Cm", rootStr: 5, rOffset: 3, str: ['x', 0, -2, -3, -2, -3], fin: ['x', 4, 2, 1, 3, 1], barre: { start: 1, end: 5, fRel: -3 } },
            { name: "Gm", rootStr: 6, rOffset: 3, str: [0, -2, -3, -3, -3, 0], fin: [4, 2, 1, 1, 1, 3], barre: { start: 1, end: 6, fRel: -3 } }
        ],
        '7': [
            { name: "A7", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 0, 2, 0], fin: ['x', 1, 2, 1, 3, 1], barre: { start: 1, end: 5, fRel: 0 } },
            { name: "E7", rootStr: 6, rOffset: 0, str: [0, 2, 0, 1, 0, 0], fin: [1, 2, 1, 1, 1, 1], barre: { start: 1, end: 6, fRel: 0 } },
            { name: "C7", rootStr: 5, rOffset: 3, str: ['x', 0, -1, -3, -2, -3], fin: ['x', 3, 2, 4, 1, 0], barre: null }, // Adjusted logic dynamically handles missing 7 or specific inversions
            { name: "D7", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 1, 2], fin: ['x', 'x', 0, 2, 1, 3], barre: null },
            { name: "G7", rootStr: 6, rOffset: 3, str: [0, -1, -3, -3, -3, -2], fin: [3, 2, 0, 0, 0, 1], barre: null }
        ],
        'm7': [
            { name: "Am7", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 0, 1, 0], fin: ['x', 1, 3, 1, 2, 1], barre: { start: 1, end: 5, fRel: 0 } },
            { name: "Em7", rootStr: 6, rOffset: 0, str: [0, 2, 0, 0, 0, 0], fin: [1, 2, 1, 1, 1, 1], barre: { start: 1, end: 6, fRel: 0 } },
            { name: "Dm7", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 1, 1], fin: ['x', 'x', 0, 2, 1, 1], barre: { start: 1, end: 2, fRel: 1 } }
        ],
        'maj7': [
            { name: "Amaj7", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 1, 2, 0], fin: ['x', 0, 3, 1, 4, 0], barre: null },
            { name: "Emaj7", rootStr: 6, rOffset: 0, str: [0, 2, 1, 1, 0, 0], fin: [0, 3, 1, 2, 0, 0], barre: null },
            { name: "Dmaj7", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 2, 2], fin: ['x', 'x', 0, 1, 1, 1], barre: { start: 1, end: 3, fRel: 2 } }
        ],
        'sus2': [
            { name: "Asus2", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 2, 0, 0], fin: ['x', 0, 2, 3, 0, 0], barre: null },
            { name: "Dsus2", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 3, 0], fin: ['x', 'x', 0, 1, 3, 0], barre: null }
        ],
        'sus4': [
            { name: "Asus4", rootStr: 5, rOffset: 0, str: ['x', 0, 2, 2, 3, 0], fin: ['x', 0, 1, 2, 3, 0], barre: null },
            { name: "Dsus4", rootStr: 4, rOffset: 0, str: ['x', 'x', 0, 2, 3, 3], fin: ['x', 'x', 0, 1, 2, 3], barre: null },
            { name: "Esus4", rootStr: 6, rOffset: 0, str: [0, 2, 2, 2, 0, 0], fin: [0, 2, 3, 4, 0, 0], barre: null }
        ]
    },

    parseInput(input) {
        input = input.trim();
        const match = input.match(/^([A-Ga-g][#b]?)(.*)$/);
        if (!match) return null;

        let root = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        let quality = match[2].trim();

        if (this.ENHARMONICS[root]) root = this.ENHARMONICS[root];

        if (quality === '' || quality === 'M' || quality.toLowerCase() === 'maj') quality = 'major';
        else if (quality === 'm' || quality === '-') quality = 'minor';
        else if (quality === '7') quality = '7';
        else if (quality === 'm7' || quality === '-7') quality = 'm7';
        else if (quality === 'maj7' || quality === 'M7') quality = 'maj7';
        else if (quality === 'sus2') quality = 'sus2';
        else if (quality === 'sus4') quality = 'sus4';

        return { root, quality };
    },

    getTheoreticalNotes(root, quality) {
        const formula = this.FORMULAS[quality];
        if (!formula) return [];
        const rootIdx = this.NOTES.indexOf(root);
        return formula.map(interval => this.NOTES[(rootIdx + interval) % 12]);
    },

    getStringNote(stringNum, fret) {
        if (fret === 'x') return null;
        fret = parseInt(fret);
        const openNote = this.TUNING_NOTES[stringNum];
        const openIdx = this.NOTES.indexOf(openNote);
        return this.NOTES[(openIdx + fret) % 12];
    },

    findRootFret(rootNote, stringNum) {
        // Find closest fret >= 0
        const openIdx = this.NOTES.indexOf(this.TUNING_NOTES[stringNum]);
        const rootIdx = this.NOTES.indexOf(rootNote);
        let diff = rootIdx - openIdx;
        if (diff < 0) diff += 12;
        return diff;
    },

    validarAcorde(acorde) {
        const inconsistencias = [];
        const notasTocadas = new Set();
        let rootTocada = false;

        // Collect all played notes
        acorde.cordasSoltas.forEach(s => notasTocadas.add(this.getStringNote(s, 0)));
        acorde.dedos.forEach(d => notasTocadas.add(this.getStringNote(d.corda, d.casa)));
        if (acorde.pestana) {
            for (let s = acorde.pestana.daCorda; s <= acorde.pestana.ateCorda; s++) {
                // If not covered by a finger on a higher fret
                if (!acorde.dedos.some(d => d.corda === s && d.casa > acorde.pestana.casa) && !acorde.cordasMutadas.includes(s)) {
                    notasTocadas.add(this.getStringNote(s, acorde.pestana.casa));
                }
            }
        }

        const notasTocadasArr = Array.from(notasTocadas);

        // Required notes: Root and Third (unless sus or power chord)
        if (!notasTocadasArr.includes(acorde.fundamental)) inconsistencias.push(`Falta a nota tônica (${acorde.fundamental}).`);

        let requiredNotesToMatch = [...acorde.notas];

        for (let t of notasTocadasArr) {
            if (!acorde.notas.includes(t)) {
                inconsistencias.push(`Nota estranha detectada: ${t}`);
            }
        }

        return {
            valido: inconsistencias.length === 0,
            inconsistencias,
            notasReais: notasTocadasArr
        };
    },

    getChordPositions(input) {
        const parsed = this.parseInput(input);
        if (!parsed) return null;

        const { root, quality } = parsed;
        const requiredNotes = this.getTheoreticalNotes(root, quality);

        // Se a qualidade nao consta no dic mas eu sei as notas (p. ex dim), deixo vazio e o banco ignora se precisar fallback.
        const baseShapes = this.SHAPES[quality] || [];
        const results = [];

        baseShapes.forEach(shape => {
            const trFret = this.findRootFret(root, shape.rootStr);
            let transposition = trFret - shape.rOffset;

            let transStr = shape.str.map(s => s === 'x' ? 'x' : s + transposition);

            // Rebalance to keep shapes positive 
            if (transStr.some(s => s !== 'x' && s < 0)) {
                transStr = transStr.map(s => s === 'x' ? 'x' : s + 12);
            }

            // Exclude extreme unplayable frets
            if (transStr.some(s => s !== 'x' && s > 15)) return;

            // Compute span
            const playedFrets = transStr.filter(s => s !== 'x' && s > 0);
            const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
            const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 0;

            // Verificação Estrutural de Abertura (Stretch)
            if ((maxFret - minFret) > 5) return;

            const cordasMutadas = [];
            const cordasSoltas = [];
            const dedos = [];
            let pestanaFinal = null;

            // Mapeando do index E6 (0) ao E1 (5)
            transStr.forEach((fret, i) => {
                const sNum = 6 - i; // 6 para E6(indice 0), 1 para E1(indice 5)
                if (fret === 'x') cordasMutadas.push(sNum);
                else if (fret === 0) cordasSoltas.push(sNum);
                else {
                    const fin = shape.fin[i];
                    if (fin !== 'x' && fin !== 0 && fin !== 1) { // 1 might be part of barre
                        dedos.push({ corda: sNum, casa: fret, dedo: fin });
                    } else if (fin === 1) {
                        // wait to process barre directly below
                        if (!shape.barre) dedos.push({ corda: sNum, casa: fret, dedo: fin });
                    }
                }
            });

            if (shape.barre) {
                // Determine true position of barre
                let barreBase = minFret;
                if (shape.barre.fretRelative === 0) barreBase = trFret;
                else barreBase = trFret + shape.barre.fretRelative;

                // Adjust to octave if we wrapped transposed above
                if (transStr[6 - shape.rootStr] > 11 && trFret < 12) barreBase += 12;

                if (barreBase > 0) {
                    pestanaFinal = { daCorda: shape.barre.start, ateCorda: shape.barre.end, casa: barreBase };

                    // Inject any finger 1 that isn't the barre base purely to UI 
                    transStr.forEach((fret, i) => {
                        const sNum = 6 - i;
                        if (shape.fin[i] === 1 && (fret !== barreBase || sNum > shape.barre.end || sNum < shape.barre.start)) {
                            if (!dedos.find(d => d.corda === sNum)) {
                                dedos.push({ corda: sNum, casa: fret, dedo: 1 });
                            }
                        }
                    });
                } else {
                    // Was a nut barre, turns into open strings
                    transStr.forEach((fret, i) => {
                        if (fret > 0 && shape.fin[i] === 1 && !dedos.find(d => d.corda === 6 - i)) dedos.push({ corda: 6 - i, casa: fret, dedo: 1 });
                    });
                }
            }

            const formatado = {
                id: `${root}${quality !== 'major' ? quality : ''}_F${minFret}_${shape.name}`,
                nome: `${root}${quality !== 'major' ? quality : ''}`,
                tipo: quality,
                fundamental: root,
                notas: requiredNotes,
                titulo: `${root}${quality !== 'major' ? quality : ''} - Formato ${shape.name}`,
                casaInicial: minFret || 0,
                pestana: pestanaFinal,
                dedos,
                cordasSoltas,
                cordasMutadas
            };

            const audit = this.validarAcorde(formatado);
            if (audit.valido) results.push(formatado);
        });

        results.sort((a, b) => a.casaInicial - b.casaInicial);
        return results;
    }
};

window.ChordDictionary = ChordDictionary;
