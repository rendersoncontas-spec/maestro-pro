import os, re

files = ["manifest.json", "css/style.css", "js/app.js", "js/pwa.js", "Untitled-1.html", "service-worker.js"]

def replace_all(content):
    mapping = {
        'MA“DULO': 'MÓDULO',
        'CABEA‡ALHO': 'CABEÇALHO',
        'NAVEGAA‡AƒO': 'NAVEGAÇÃO',
        'METRA”NOMO': 'METRÔNOMO',
        'PRECISAƒO': 'PRECISÃO',
        'BRAA‡O': 'BRAÇO',
        'HARMA”NICO': 'HARMÔNICO',
        'Ašnicas': 'Únicas',
        'MONETIZAA‡AƒO': 'MONETIZAÇÃO',
        'INICIALIZAA‡AƒO': 'INICIALIZAÇÃO',
        'OBRIGATA“RIA': 'OBRIGATÓRIA',
        'INTEGRAA‡AƒO': 'INTEGRAÇÃO',
        'A udio': 'Áudio',
        'A ndice': 'Índice',
        'A rea': 'Área',
        'ESTATA STICAS': 'ESTATÍSTICAS'
    }
    for k, v in mapping.items():
        content = content.replace(k, v)
        
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
