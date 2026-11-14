# Lunar Landing Site Navigator — Data Directory

Цей каталог містить інструменти та локальні файли геопросторових даних (DEM та зображення) для проєкту **Lunar Landing Site Navigator**.

> [!IMPORTANT]
> **Не комітити сирі растрові файли (`.TIF`, `.TIFF`, `.grd`, `.glb`) у Git!**
> Каталог `data/raw/` додано до `.gitignore`. Кожен учасник команди або середовище розгортання/CI завантажує дані за допомогою скрипта або вказує шлях через змінну середовища.

---

## Структура каталогу

```text
data/
├── README.md               # Цей документ
├── raw/                    # Локальне сховище сирих TIF (ігнорується Git)
│   └── .gitkeep
└── scripts/
    ├── download_data.py    # Python CLI для перевірки та завантаження даних NASA
    └── download_data.ps1   # PowerShell версія для Windows
```

---

## Швидкий старт для учасників команди

### 1. Перевірка доступності на сервері NASA (без завантаження 180 МБ)

```bash
# Python
python data/scripts/download_data.py --verify-only

# або PowerShell
.\data\scripts\download_data.ps1 -VerifyOnly
```

### 2. Завантаження даних у `data/raw/`

```bash
# Python (завантажить LDEM_80S_80MPP_ADJ.TIF та HILL)
python data/scripts/download_data.py --download

# Лише основний DEM (180 МБ)
python data/scripts/download_data.py --download --dem-only

# PowerShell
.\data\scripts\download_data.ps1 -Download
```

---

## Змінні середовища (Environment Variables)

Бекенд та офлайн-пайплайни читають шлях до даних за такими правилами:

1. `LUNAR_DEM_PATH` — прямий абсолютний або відносний шлях до основного файлу DEM, наприклад:
   ```env
   LUNAR_DEM_PATH=D:\byte-force\data\raw\LDEM_80S_80MPP_ADJ.TIF
   ```
2. `LUNAR_DATA_DIR` — каталог із набором растрових даних:
   ```env
   LUNAR_DATA_DIR=D:\byte-force\data\raw
   ```
3. **За замовчуванням (Default Fallback):** Якщо змінні не задані, використовується локальний каталог проєкту `<repo_root>/data/raw/LDEM_80S_80MPP_ADJ.TIF`.

---

## Офіційні джерела NASA PGDA

| Назва файлу | Опис | Розмір | Формат | Джерело |
|---|---|---|---|---|
| `LDEM_80S_80MPP_ADJ.TIF` | LOLA Південний полюс (80°S–90°S), 80 м/px, висоти в метрах | 189,158,392 байт (~180.4 МБ) | Cloud-Optimized GeoTIFF (BigTIFF, Float32) | [NASA PGDA Product 90](https://pgda.gsfc.nasa.gov/products/90) |
| `LDEM_80S_80MPP_ADJ_HILL.TIF` | Хілшейд LOLA для 80°S–90°S (45° кут, 45° азимут) | 88,474,342 байт (~84.4 МБ) | Cloud-Optimized GeoTIFF (BigTIFF, Byte) | [NASA PGDA Product 90](https://pgda.gsfc.nasa.gov/products/90) |

Повний опис проєкції, контрольних точок та наукових параметрів див. у [docs/DATA_SOURCES.md](../docs/DATA_SOURCES.md).

---

## Атрибуція та ліцензійні умови

Будь-ласка, посилайтеся на офіційну публікацію LOLA Science Team при використанні даних:
* **Стаття:** Barker et al., 2023 *Planet. Sci. J.*, 4, 183. [DOI: 10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1)
* **Data DOI:** [10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole)
* **Curator:** Erwan Mazarico, NASA Goddard Space Flight Center (GSFC).
