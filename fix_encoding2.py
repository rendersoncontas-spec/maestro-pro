import os, re

files = ["manifest.json", "service-worker.js", "css/style.css", "js/app.js", "js/pwa.js", "Untitled-1.html"]

def replace_all(content):
    # known replacements
    content = content.replace('MA“DULO', 'MÓDULO')
    content = content.replace('CABEA‡ALHO', 'CABEÇALHO')
    content = content.replace('NAVEGAA‡AƒO', 'NAVEGAÇÃO')
    content = content.replace('METRA”NOMO', 'METRÔNOMO')
    content = content.replace('PRECISAƒO', 'PRECISÃO')
    content = content.replace('BRAA‡O', 'BRAÇO')
    content = content.replace('HARMA”NICO', 'HARMÔNICO')
    content = content.replace('Ašnicas', 'Únicas')
    content = content.replace('MONETIZAA‡AƒO', 'MONETIZAÇÃO')
    content = content.replace('INICIALIZAA‡AƒO', 'INICIALIZAÇÃO')
    content = content.replace('ALIMENTAÇAO', 'ALIMENTAÇÃO')

    # with spaces/special spaces
    content = re.sub(r'A[\x00-\x20\xa0\xad]?ndice', 'Índice', content)
    content = re.sub(r'ESTATA[\x00-\x20\xa0\xad]?STICAS', 'ESTATÍSTICAS', content)
    content = re.sub(r'A[\x00-\x20\xa0\xad]?udio', 'Áudio', content)
    
    return content

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        new_content = replace_all(content)
        
        if content != new_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed {filepath}")
print("Done")
