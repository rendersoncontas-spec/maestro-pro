import os, re

files = ["manifest.json", "service-worker.js", "css/style.css", "js/app.js", "js/pwa.js", "Untitled-1.html"]

def replace_all(content):
    # known replacements
    content = content.replace("A©", "é")
    content = content.replace("A´", "ô")
    content = content.replace("A¡", "á")
    content = content.replace("A­", "í") # A + \xad
    content = content.replace("A\xad", "í")
    content = content.replace("A§", "ç")
    content = content.replace("A£", "ã")
    content = content.replace("Aº", "ú")
    content = content.replace("Aµ", "õ")
    content = content.replace("A¢", "â")
    content = content.replace("Aê", "ê")
    content = content.replace("A³", "ó")
    
    # "A rea"
    content = re.sub(r'A[\x00-\x20\xa0\xad]?rea', 'Área', content)
    
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
