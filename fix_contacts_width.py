import os

filepath = r'd:\forsgetires\components\TyreShop.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix phone blocks width
new_content = content.replace('flex-1 min-w-[200px]', 'w-fit')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replacement complete.")
