from pathlib import Path
p = Path('index.html')
print('exists', p.exists())
print('size', p.stat().st_size if p.exists() else 'missing')
for i, line in enumerate(p.open('r', encoding='utf-8')):
    if i >= 30:
        break
    print(repr(line))
