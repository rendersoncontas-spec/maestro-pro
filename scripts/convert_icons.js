const sharp = require('sharp');
const fs = require('fs');

async function convert(size) {
    const input = `c:/Users/rende/OneDrive/Área de Trabalho/ALIMENTAÇÃO/icons/icon-${size}.svg`;
    const output = `c:/Users/rende/OneDrive/Área de Trabalho/ALIMENTAÇÃO/icons/icon-${size}.png`;

    if (fs.existsSync(input)) {
        console.log(`Converting ${input}...`);
        await sharp(input)
            .resize(size, size)
            .png()
            .toFile(output);
        console.log(`Converted ${input} to ${output}`);
        fs.unlinkSync(input);
        console.log(`Deleted ${input}`);
    } else {
        console.log(`File not found: ${input}`);
    }
}

async function main() {
    try {
        await convert(192);
        await convert(512);
        console.log('Conversion successful.');
    } catch (e) {
        console.error('Error during conversion:', e);
    }
}

main();
