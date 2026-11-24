"""Builds clean tyre titles: "<Brand> <Model> <W>/<H> R<D>[C] <LI/SI>[ XL][ (під шип)]".
Reads tyres.json ([id, title, manufacturer, radius, season, vehicle_type, description]) and writes proposals.json.
"""
import json, re, sys
from collections import Counter

SRC = sys.argv[1]
OUT = sys.argv[2]
rows = json.load(open(SRC))

BRANDS = {
    'bridgestone': 'Bridgestone', 'nexen': 'Nexen', 'doublestar': 'Doublestar', 'firestone': 'Firestone', 'nokian': 'Nokian',
    'laufenn': 'Laufenn', 'matador': 'Matador', 'hankook': 'Hankook', 'aplus': 'Aplus', 'kumho': 'Kumho', 'michelin': 'Michelin',
    'ovation': 'Ovation', 'continental': 'Continental', 'sunny': 'Sunny', 'kapsen': 'Kapsen', 'fulda': 'Fulda', 'hifly': 'Hifly',
    'kabat tyres': 'Kabat Tyres', 'kabat': 'Kabat Tyres', 'ozka': 'OZKA', 'premiorri': 'Premiorri', 'росава': 'Росава', 'rosava': 'Росава',
    'ecovision': 'Ecovision', 'goodyear': 'Goodyear', 'yokohama': 'Yokohama', 'eternity': 'Eternity', 'viking': 'Viking',
    'taurus': 'Taurus', 'rydanz': 'Rydanz', 'pirelli': 'Pirelli', 'dunlop': 'Dunlop', 'toyo': 'Toyo', 'barum': 'Barum', 'sava': 'Sava',
    'debica': 'Debica', 'kleber': 'Kleber', 'tigar': 'Tigar', 'triangle': 'Triangle', 'sailun': 'Sailun', 'linglong': 'Linglong',
    'petlas': 'Petlas', 'general': 'General', 'gislaved': 'Gislaved', 'bfgoodrich': 'BFGoodrich', 'uniroyal': 'Uniroyal',
    'cooper': 'Cooper', 'lassa': 'Lassa', 'starmaxx': 'Starmaxx', 'belshina': 'Belshina', 'kormoran': 'Kormoran', 'riken': 'Riken',
    'ш.ханкук тайр': 'Hankook', 'bkt': 'BKT', 'mirage': 'Mirage', 'westlake': 'Westlake', 'goodride': 'Goodride', 'roadstone': 'Roadstone',
}

# model keywords → season (checked on the original title + description)
WINTER = r"(winter|iceguard|wint|vikingcontact|wintercontact|ultragrip|snowcontrol|ice ?grip|зим|snow|ice\b|i\*cept|icept|i\*pike|ipike|w452|w616|w429|rw10|rw12|iw01|winguard|winspike|blizzak|nordic|nordica|nordman|hakka|alpin|arctic|frigo|polar|sottozero|kristall|wintercraft|winterhawk|winterking|dw0\d|dw1\d|lw31|lw71|i fit|i\*fit|x-ice|ice zero|под шип|під шип|ws\d|snow'g|w300|w320|w310|eurowinter|wintrac|cw-?\d|a703|a503|nw312)"
SUMMER = r"(summer|ultracontact|advan|bluearth|geolandar h/t|pilot|crugen|roadster|raleigh|reac\b|ltech|hectorra|turanza|touring|potenza|літ|лет|roadhawk|turanza|potenza|ecopia|alenza|dueler h/p|primacy|energy saver|pilot sport|ventus|kinergy eco|k135|k125|k435|nfera|n'blue|nblue|n'fera|n fera|s fit|g fit|lk01|lk41|z fit|ecsta|solus|hectorra|high performance|ultra high performance|touring\b|super2000|s2000|hf201|hf805|dh0\d|dsu02|dss02|reac r05|raleigh|raxus|cargospeed|vanhawk|turanza|eagle f1|efficientgrip|premiumcontact|ecocontact|sportcontact|conticontact|p zero|cinturato|itegro|a919|a607|a610|a609|nc501|nu025|na305|vi-388|vi-682|sport\b)"
ALLSEASON = r"(all ?season|allseason|all-season|4seasons|4 seasons|quatrac|crossclimate|weather|fourtech|kinergy 4s|4s\b|all weather|multiseason|a/t\b|at601|wildtiger|raptor|all terrain|s601)"

SIZE = re.compile(r"(\d{3})\s*/\s*(\d{2})\s*(Z?R)\s?(\d{2}(?:[.,]5)?)\s*(C|LT)?\b", re.I)
SIZE_SPLIT = re.compile(r"(\d{3})\s*/\s*(\d{2})\s+(?:\d{2,3}(?:/\d{2,3})?[A-Z]?\s+)?R\s?(\d{2}(?:[.,]5)?)(C)?\b", re.I)
INDEX = re.compile(r"(?<![\w/])(\d{2,3}(?:/\d{2,3})?)([JKLMNPQRSTUHVWYZ])(?![\w])")
HEADER_JUNK = re.compile(r"^(номенклатура|найменування товара|шин[иы]\s+\S+|(легков\w*|легковантажн\w*)\s+(літо|лето|зим\w*|всесезон\w*)\s+\S+|\S+\s+(літо|лето|зима))$", re.I)

def nice_word(w):
    # "HIGH" -> "High", keep codes with digits / short acronyms (XL, HP, SUV, LK01, DW01) as is
    if w.isalpha() and w.isupper() and len(w) >= 4:
        return w.capitalize()
    return w

def season_of(text, fallback):
    t = text.lower()
    w, s, a = re.search(WINTER, t), re.search(SUMMER, t), re.search(ALLSEASON, t)
    if a and not w:
        return 'all-season'
    if w and not s:
        return 'winter'
    if s and not w:
        return 'summer'
    if w and s:  # e.g. "Winter" model of a summer line → trust the stronger winter marker
        return 'winter'
    return fallback

out, stats = [], Counter()
for rid, title, man, radius, season, vt, desc in rows:
    t0 = re.sub(r'(\d)С\b', r'\1C', title.strip())  # Cyrillic С in 'R16С'
    rec = {'id': rid, 'old_title': title, 'old_manufacturer': man, 'old_radius': radius, 'old_season': season}
    if HEADER_JUNK.match(t0) or (not re.search(r"\d", t0) and len(t0.split()) <= 4):
        rec['action'] = 'hide'
        out.append(rec); stats['hide'] += 1
        continue
    m = SIZE.search(t0)
    sz = None
    if m:
        sz = (m.group(1), m.group(2), m.group(4).replace(',', '.'), (m.group(5) or '').upper())
    else:
        m2 = SIZE_SPLIT.search(t0)
        if m2:
            sz = (m2.group(1), m2.group(2), m2.group(3).replace(',', '.'), (m2.group(4) or '').upper())
            m = m2
    if not sz:
        m4 = re.search(r"(?<![\d/x,])(\d{3})\s*R\s?(\d{2})(C)\b", t0)
        if m4:
            sz = (m4.group(1), None, m4.group(2), 'C')
            m = m4
    if not sz:
        rec['action'] = 'skip'   # agro / special sizes like 31x10,50R15LT, 18x7-8 — leave as is
        out.append(rec); stats['skip'] += 1
        continue
    w, h, d, suffix = sz
    if suffix == 'LT':
        suffix = 'C' if vt == 'cargo' else ''
        lt = True
    else:
        lt = False
    work = t0
    work = SIZE.sub(' ', work, count=1) if SIZE.search(work) else work.replace(m.group(0), ' ')
    # index
    idx = None
    for im in INDEX.finditer(work):
        load = int(im.group(1).split('/')[0])
        if 50 <= load <= 170:
            idx = im.group(1) + im.group(2)
            work = work[:im.start()] + ' ' + work[im.end():]
            break
    xl = bool(re.search(r"\bXL\b", work)) or bool(re.search(r"\bEXTRA LOAD\b", work, re.I))
    spike = bool(re.search(r"під шип|под шип", t0, re.I))
    # brand: from manufacturer column, "(Brand ...)" or a known brand word
    brand = None
    paren = re.search(r"\(([^()]*?)(?:\s*\(вир-во\s*([^)]*)\))?\)", work)
    candidates = []
    if man.strip():
        candidates.append(man.strip())
    for pm in re.finditer(r"\(([^()]+)\)", t0):
        candidates.append(pm.group(1))
    m3 = re.search(r"\(([^()]+?)\s*\(вир-во", t0)
    if m3:
        candidates.append(m3.group(1))
    words = re.findall(r"[A-Za-zА-Яа-яІіЇїЄє.\-]+(?:\s+Tyres)?", t0)
    candidates += words
    for c in candidates:
        key = c.strip().lower()
        if key in BRANDS:
            brand = BRANDS[key]; break
    if not brand:
        rec['action'] = 'skip'; rec['reason'] = 'brand'
        out.append(rec); stats['skip_brand'] += 1
        continue
    # remove noise
    work = re.sub(r"\(\s*\)", ' ', work)
    work = re.sub(r"\([^()]*\(вир-во[^)]*\)\)?", ' ', work)             # (Hankook (вир-во Угорщина)
    work = re.sub(r"\((?:під|под) шип\)|(?:під|под) шип", ' ', work, flags=re.I)
    work = re.sub(r"\(([^()]+)\)", lambda mm: ' ' if mm.group(1).strip().lower() in BRANDS else mm.group(0), work)
    work = re.sub(r"\bDOT\s?\d{2,4}\b", ' ', work, flags=re.I)
    work = re.sub(r"\b(TL|TT|XL|LT|EXTRA LOAD)\b", ' ', work)
    work = re.sub(r"^\s*(Шина|Шини|Шины)\b", ' ', work, flags=re.I)
    work = re.sub(r"\b(Шина|Шини|Шины)\b", ' ', work, flags=re.I)
    work = re.sub(r"\b(Чехія|Угорщина|Корея|Китай|Польща|Іспанія|Японія|Франція|Німеччина|Румунія|Словаччина|Таїланд|Індонезія)\b", ' ', work)
    # trailing season word appended by the old admin form
    work = re.sub(r"\s(Summer|Winter|All Season)\s*$", ' ', work.strip() + ' ')
    # brand word itself
    for alias, canon in BRANDS.items():
        if canon == brand:
            work = re.sub(r"(?<![\w])" + re.escape(alias) + r"(?![\w])", ' ', work, flags=re.I)
    work = re.sub(r"\s+", ' ', work).strip(" -,/")
    model = ' '.join(nice_word(x) for x in work.split())
    new_radius = f"R{d}{suffix}"
    new_season = season_of(t0, season if season in ('summer', 'winter') else None)
    size_txt = f"{w}/{h} R{d}{suffix}" if h else f"{w} R{d}{suffix}"
    parts = [brand, model, size_txt + (' LT' if lt and not suffix else ''), idx or '']
    new_title = re.sub(r"\s+", ' ', ' '.join(p for p in parts if p)).strip()
    if xl: new_title += ' XL'
    if spike: new_title += ' (під шип)'
    rec.update({'action': 'update', 'title': new_title, 'manufacturer': brand, 'radius': new_radius, 'season': new_season})
    stats['update'] += 1
    if new_radius != radius: stats['radius_fixed'] += 1
    if new_season != season: stats['season_changed'] += 1
    if not model: stats['empty_model'] += 1
    out.append(rec)

json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=0)
print(dict(stats))
print('season result:', Counter(r.get('season') for r in out if r['action'] == 'update'))
