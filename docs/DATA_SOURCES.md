# NASA Data Sources & Terrain Model Specification (HUM-02)

## Audit caveat

> **Audit qualification, not a rewrite of the original claims below:** HUM-02 was
> already merged in PR #4 (`c960326`, merge `92de0e8`); it has not been redone.
> The original “complete / Ready for Review” status and metadata claims below are
> historical contributor assertions, not new validation results. See the
> [existing-code audit](architecture/EXISTING_CODE_AUDIT.md).
>
> Outstanding: checksums/content integrity; Python short-response success and
> combined verify/download behavior; PowerShell failure exit status; environment
> path semantics; atomic download handling; original reproducible GDAL logs;
> source-specific terms; point-specific citations and height evidence; actual
> imagery alignment; two-person acquisition evidence; coverage/NoData footprint
> versus square raster bounds; DEM/Horizons frame and vertical-datum alignment.
> HTTP byte counts and Accept-Ranges alone do not establish raster validity or COG
> conformance. No live download, HEAD check or scientific verification was performed
> by this documentation reconciliation. Existing acquisition code/data is unchanged.


**Проєкт:** Lunar Landing Site Navigator — Byte Force (NASA Space Apps 2026)  
**Відповідальний:** Людина №4 (LOLA / Data)  
**Статус задачі:** Завершено (Ready for Review)  
**Пов'язані задачі:** [HUM-02](Lunar_Navigator_TASK_BACKLOG.md#hum-02), [ARC-03](Lunar_Navigator_TASK_BACKLOG.md#arc-03), [DATA-01](Lunar_Navigator_TASK_BACKLOG.md#data-01)

---

## 1. Загальний огляд

Для моделювання умов посадки, аналізу прямої видимості Землі та Сонця щодо рельєфу (LOS) і побудови інтерактивної 3D-поверхні в проєкті використовуються виключно **офіційні первинні наукові дані NASA**:
1. **NASA LOLA (Lunar Orbiter Laser Altimeter)** — цифрова модель висот (DEM) Південного полюса Місяця.
2. **NASA LOLA Hillshade & LROC (Lunar Reconnaissance Orbiter Camera)** — растрові шари текстур та ортофотознімків.
3. **NASA JPL Horizons API** — високоточні ефемериди положення Сонця й Землі відносно місячного спостерігача.

> [!IMPORTANT]
> **Усі дані є відкритими та офіційними.** Великі сирі растрові файли зберігаються поза Git-репозиторієм і завантажуються за допомогою відтворюваних скриптів або налаштовуються через змінні середовища.

---

## 2. Основна модель висот: NASA LOLA DEM

### 2.1. Паспорт набору даних

* **Офіційна назва файлу:** `LDEM_80S_80MPP_ADJ.TIF`
* **Каталог NASA:** Planetary Geodynamics Data Archive (PGDA), Goddard Space Flight Center (GSFC)
* **Сторінка продукту:** [NASA PGDA Product 90 — A New View of the Lunar South Pole from LOLA](https://pgda.gsfc.nasa.gov/products/90)
* **Прямий URL завантаження:** `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`
* **Розмір файлу:** 189,158,392 байт (~180.40 МБ)
* **Дата останньої модифікації на сервері:** `Fri, 07 Jul 2023 22:03:02 GMT`
* **HTTP ETag:** `W/"b4653f8-189326141f0"`
* **Підтримка Range-запитів:** `Accept-Ranges: bytes` (повноцінний Cloud-Optimized GeoTIFF)
* **Формат збереження:** BigTIFF (TIFF magic 43, 64-бітне зміщення тегів), плитки 512×512, компресія Adobe Deflate

### 2.2. Просторові та координатні характеристики (CRS / Projection)

* **Координатна система (CRS):** `Moon (2015) - Sphere / Ocentric / South Polar`
* **Тип проєктування:** Polar Stereographic (Південна полярна стереографічна)
* **Опорний сфероїд / Датум:** Сфера Місяця (Moon 2015 Sphere):
  * Велика піввісь ($a$): `1,737,400.0 м` ($1737.4\text{ км}$)
  * Мала піввісь ($b$): `1,737,400.0 м` ($1737.4\text{ км}$)
  * Стиснення ($f$): `0.0`
* **Стандартна паралель (Latitude of True Scale):** `-90.0°` (South Pole)
* **Центральний меридіан (Longitude of Origin):** `0.0°`
* **Масштабний фактор (Scale factor at origin):** `1.0`
* **False Easting / Northing:** `0.0 м / 0.0 м`
* **Розмір растру:** $7600 \times 7600$ пікселів
* **Просторове розрізнення (Pixel Scale):** `80.0 м/піксель` (по осях X та Y)
* **Проєктні межі (Projected Extents):**
  * $X_{\min} = -304,000.0\text{ м}$, $X_{\max} = +304,000.0\text{ м}$ (Ширина = $608\text{ км}$)
  * $Y_{\min} = -304,000.0\text{ м}$, $Y_{\max} = +304,000.0\text{ м}$ (Висота = $608\text{ км}$)
  * Центр растру $(0.0, 0.0)$ точно відповідає географічному Південному полюсу (широта $-90.0^\circ$).
* **Географічне покриття:** від $80.0^\circ\text{S}$ до $90.0^\circ\text{S}$ по всій довготі $[-180^\circ, +180^\circ]$.

### 2.3. Висоти, тип даних та NoData

* **Тип семплів:** 32-бітне дійсне число з плаваючою комою (Float32 / IEEE 754, little-endian)
* **Діапазон висот у файлі:** від `-7295.52 м` до `+7026.33 м`
* **Вертикальний нуль (Datum):** Висота над сферою радіусом $R = 1737.4\text{ км}$ (MOON_ME reference frame).
* **Спеціальне значення NoData:** `NaN` (`nan`)

### 2.4. Автентичні вихідні метадані (BigTIFF Header & GDAL Metadata)

```xml
<GDALMetadata>
  <Item name="NC_GLOBAL#Conventions">CF-1.7</Item>
  <Item name="NC_GLOBAL#description">Mean value per bin</Item>
  <Item name="NC_GLOBAL#GMT_version">6.5.0_2402709_2023.01.09 [64-bit]</Item>
  <Item name="NC_GLOBAL#history">gmt grdmath ldem_80s_final_adj_80mpp_surf.grd 1000.0 MUL = test.grd</Item>
  <Item name="NC_GLOBAL#node_offset">1</Item>
  <Item name="NC_GLOBAL#title">Produced by grdmath</Item>
  <Item name="x#actual_range">{-304,304}</Item>
  <Item name="x#axis">X</Item>
  <Item name="x#long_name">x</Item>
  <Item name="y#actual_range">{-304,304}</Item>
  <Item name="y#axis">Y</Item>
  <Item name="y#long_name">y</Item>
  <Item name="z#actual_range">{-7295.51708984375,7026.3310546875}</Item>
  <Item name="z#long_name">z</Item>
  <Item name="z#_FillValue">nan</Item>
  <Item name="actual_range" sample="0">{-7295.51708984375,7026.3310546875}</Item>
  <Item name="long_name" sample="0">z</Item>
  <Item name="NETCDF_VARNAME" sample="0">z</Item>
  <Item name="_FillValue" sample="0">nan</Item>
</GDALMetadata>
```

**Геоприв'язка (GeoTIFF Tags):**
* `ModelPixelScaleTag`: `(80.0, 80.0, 0.0)`
* `ModelTiepointTag`: `(0.0, 0.0, 0.0, -304000.0, 304000.0, 0.0)`
* `GeoAsciiParams`: `Moon (2015) - Sphere / Ocentric / South Polar|GCS Name = Moon (2015) - Sphere / Ocentric|Datum = Moon (2015) - Sphere|Ellipsoid = Moon (2015) - Sphere|Primem = Reference Meridian||`
* `GeoDoubleParams`: `(-90.0, 0.0, 1.0, 0.0, 0.0, 1737400.0, 1737400.0, 0.0)`

---

## 3. Сумісні зображення та текстури

### 3.1. Офіційний шар LOLA Hillshade (Ідеальна сумісність 1:1)

* **Файл:** `LDEM_80S_80MPP_ADJ_HILL.TIF`
* **Джерело:** [NASA PGDA Product 90](https://pgda.gsfc.nasa.gov/products/90)
* **URL:** `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF`
* **Розмір:** 88,474,342 байт (~84.38 МБ)
* **Опис:** Розрахований NASA відмив рельєфу (Hillshade) при куті висоти джерела $45^\circ$ та азимуті $45^\circ$.
* **Перевага:** Має **абсолютно ідентичну сітку пікселів ($7600 \times 7600$), крок 80 м/px та прив'язку до проєкції**, що виключає похибки інтерполяції чи зсуву при накладанні на 3D mesh.

### 3.2. Ортофотознімки LROC (Lunar Reconnaissance Orbiter Camera)

* **WAC South Pole Summer Mosaic:**
  * Огляд великих ділянок полярної зони в період південного літа (мінімальні тіні).
  * Доступний через репозиторій [ASU LROC](https://lroc.sese.asu.edu/) та [USGS Astropedia](https://astrogeology.usgs.gov/).
* **NAC Controlled Polar Mosaics:**
  * Високодетальні знімки камер NAC (розрізнення до 1 м/px) для цільових ділянок кандидатів Artemis (наприклад, Connecting Ridge, Malapert).
  * Використовуватимуться на етапі P1/P2 для накладання фотореалістичних текстур на локальні ділянки.

---

## 4. Контрольні точки та перспективні ділянки посадки (Ground Truth)

У межах робочої області ($[-90^\circ, -80^\circ]$ пд. ш.) визначено 6 опорних точок із офіційних матеріалів місій NASA Artemis та наукових досліджень LOLA:

| № | Назва локації | Широта (Lat) | Довгота (Lon) | Орієнтовна висота | Науковий контекст / Опис |
|:---:|:---|:---:|:---:|:---:|:---|
| 1 | **Connecting Ridge (CR1)** | $-89.45^\circ$ | $-137.31^\circ$ ($222.69^\circ\text{E}$) | $+1450\text{ м}$ | Хребет між кратерами Shackleton та de Gerlache. Кандидатний район Artemis III. Високий коефіцієнт сонячного освітлення в полярне літо. |
| 2 | **South Pole (Shackleton Rim)** | $-89.90^\circ$ | $0.00^\circ$ | $+1280\text{ м}$ | Точка на гребені кратера Шеклтон безпосередньо біля географічного полюса. Критична точка для тесту виродження координат на полюсі. |
| 3 | **Malapert Mountain (Massif)** | $-85.99^\circ$ | $-3.00^\circ$ ($357.00^\circ\text{E}$) | $+5000\text{ м}$ | Найвища гора поблизу Південного полюса (пік Малаперт). Постійна пряма радіовидимість Землі; кандидатний район Artemis III. |
| 4 | **Faustini Rim A** | $-87.31^\circ$ | $+77.02^\circ$ | $+2100\text{ м}$ | Край кратера Фаустіні. Поєднання добре освітлених підвищень та доступу до вічно затінених кратерних пасток водного льоду (PSR). |
| 5 | **Haworth Rim** | $-87.40^\circ$ | $-5.10^\circ$ ($354.90^\circ\text{E}$) | $+1850\text{ м}$ | Підвищений вал кратера Гаворт. Важливий кандидат для астрофізичних спостережень та відбору зразків криги. |
| 6 | **Amundsen Rim** | $-84.50^\circ$ | $+82.80^\circ$ | $+2400\text{ м}$ | Вал великого кратера Амундсен на межі робочої зони $84^\circ$–$85^\circ\text{S}$. |

> [!NOTE]
> Усі координати базуються на збірці кандидатних посадкових регіонів NASA Artemis III (*NASA Artemis Campaign Development Plan / Technical Reports*) та каталозі LRO/LOLA Science Team.

---

## 5. Організація зберігання та доступ команди

Щоб уникнути збереження бінарних 180+ МБ файлів у системі контролю версій Git:

1. **`.gitignore`:** Директорію `data/raw/` та патерни `*.tif`, `*.tiff`, `*.glb` внесено до файлу ігнорування.
2. **Автоматизований скрипт завантаження:**
   * Python CLI: [data/scripts/download_data.py](../data/scripts/download_data.py)
   * PowerShell: [data/scripts/download_data.ps1](../data/scripts/download_data.ps1)
3. **Змінні середовища:**
   * `LUNAR_DEM_PATH` — прямий шлях до `.TIF` файлу.
   * `LUNAR_DATA_DIR` — каталог із набором растрових даних.
4. **Команда перевірки без скачування (Verification):**
   ```bash
   python data/scripts/download_data.py --verify-only
   ```
5. **Команда повного завантаження:**
   ```bash
   python data/scripts/download_data.py --download
   ```

---

## 6. Атрибуція та наукова література

При публікації результатів або демонстрації обов'язково наводити посилання на авторів моделі:
* **Основна стаття:**  
  Barker, M. K., Mazarico, E., Neumann, G. A., et al. (2023). *A New View of the Lunar South Pole from LOLA*. The Planetary Science Journal, 4(10), 183.  
  DOI: [10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1)
* **Постійний ідентифікатор даних (Data DOI):**  
  [10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole)
* **Куратор архіву:**  
  Dr. Erwan Mazarico, Planetary Geology, Geophysics and Geochemistry Laboratory, NASA Goddard Space Flight Center.

---

## 7. Високодетальний DEM 5 м/піксель для локальної зони (P2-03)

Для деталізації вибраного посадкового майданчика (наприклад, **Connecting Ridge CR1**) використовується офіційний високодетальний продукт NASA PGDA:

* **Продукт:** `LDEM_875S_5MPP` (South Pole 5 m/pixel Polar Stereographic LOLA DEM, $87.5^\circ\text{S} - 90^\circ\text{S}$).
* **Джерело:** [NASA GSFC PGDA](https://pgda.gsfc.nasa.gov/products/78) (Barker et al. / LOLA Science Team, Public Domain).
* **CRS та датум:** `Moon (2015) - Sphere / Ocentric / South Polar`, $R = 1,737,400.0\text{ м}$, крок $5.0\text{ м/px}$.
* **Нормалізація та перехід LOD (`data-pipeline/highres/build_highres_tiles.py`):**
  * Всі high-res тайли (`/terrain/highres/{z}/{x}/{y}.glb`) приводяться до **тієї ж самої** висотної бази (`referenceElevationMeters`) та `meshLocalOrigin`, що й базовий $80\text{ м/px}$ DEM (`lod-tileset.json`), що гарантує відсутність вертикальних стрибків при зумі.
  * Покриття обмежене лише локальним вікном (`fullSouthPoleCoverage: false`). Поза межами покриття або при `enabled: false` система безпечно використовує базовий $80\text{ м/px}$ DEM без поломки MVP.
  * Маніфест [public-assets/metadata/highres-manifest.json](../public-assets/metadata/highres-manifest.json) містить явне provenance (`"High-resolution local DEM"`) та застереження, що науковий горизонт продовжує використовувати $80\text{ м/px}$ DEM, доки не підключено high-res horizon.
