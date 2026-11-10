# UniChef Brand Guide

This guide covers the UniChef logo, its colours and its type, and how to rebuild every master file by hand in Inkscape or Illustrator or with the generator script. The masters live in [`assets/branding/source/`](../../assets/branding/source/).

## 1. The idea

The mark is a **U with a combining diaeresis**: `U` + `U+0308 COMBINING DIAERESIS`. Together, a base letter and a combining mark form one *grapheme cluster*, the unit of text UniChef is built to inspect. The violet U doubles as a mixing bowl and the two amber dots as ingredients dropping into it, which ties the mark to the "recipe" model of the app.

The name is set as **Uni** in near-white (or ink on light backgrounds) and **Chef** in brand violet.

UniChef branding must never use a chef's hat, the CyberChef name or logo, GCHQ marks, or UniView branding (PRD §1.3).

## 2. Files

| File | Use | Background |
|---|---|---|
| `unichef-logo.svg` | Horizontal lockup, mark + wordmark | Dark (`#0F1020` or darker) |
| `unichef-logo-light.svg` | Horizontal lockup | Light (white or `#F6F5FB`) |
| `unichef-logo-mono.svg` | Lockup in one colour (black). Recolour the fills for other single-colour uses. | Any |
| `unichef-mark.svg` | Icon on a transparent 1024×1024 canvas | Dark |
| `unichef-mark-light.svg` | Icon on a transparent canvas | Light |
| `unichef-mark-mono.svg` | One-colour icon: Safari pinned tab, embossing, stamps | Any |
| `unichef-mark-maskable.svg` | Icon at 80 % inside a solid `#0F1020` square, for PWA maskable icons | Built in |
| `unichef-mark-16.svg` | Pixel-fitted icon for 16 px only (favicon) | Dark |

Every SVG is plain SVG 1.1 with a `viewBox`. Text is converted to outlines, and the files contain no fonts, scripts, `foreignObject`, raster images or external references. Inside each file the elements carry stable ids: `mark`, `mark-u`, `mark-dots`, `wordmark`, `wordmark-uni`, `wordmark-chef` and `background`. Illustrator and Inkscape import top-level groups by these names.

`unichef-logo.ai` (PRD §9.1) has not been created yet. When a designer creates it, build it by opening `unichef-logo.svg` in Illustrator and following §6.2. Commit it through Git LFS.

Derived PNG, ICO and PDF files are build output (`assets/branding/dist/`, gitignored) and are produced by `scripts/assets/build.py` from these masters (PRD §9.2). Run `make assets` to build them (it needs rsvg-convert, ImageMagick and oxipng, which the dev container has); `assets/branding/manifest.json` lists every output and its size. `uv run scripts/assets/build.py --lint` checks the masters, and `make lint` runs it.

Where the brand appears:

| Place | Asset | Built from |
|---|---|---|
| Web app header | `unichef-logo.svg` on dark, `unichef-logo-light.svg` on light, swapped with the theme | The masters, bundled as-is |
| Browser tab | `icon.svg` (the mark), plus `favicon.ico` at 16, 32 and 48 px | `dist/web/` |
| Home screen (PWA) | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and the SVG and maskable SVG | `dist/web/` |
| iOS home screen | `apple-touch-icon.png` (180 px, on `#0F1020`) | `dist/web/` |
| Link previews (Open Graph, X) | `og-image.png` (1200 × 630) | `dist/web/` |
| Repository social preview | `social-preview.png` (1280 × 640). Upload it under GitHub **Settings → General → Social preview**; there is no API for it. | `dist/github/` |
| Browser extensions and stores | `16.png` to `128.png`, plus the store tiles | `dist/ext/`, `dist/store/` |
| README and docs | `<picture>` with the dark and light lockups | The masters |

The Pages workflow and the `e2e` CI job run `build.py --only web/`, and the web build fails if an icon is missing.

Masters are append-only (GOV-020). To change a master, add a versioned file such as `unichef-mark.v2.svg`. Do not edit the existing file.

## 3. Colours

The logo uses the brand tokens from PRD §5.5. The dark set is the primary identity. The light set exists because the dark-theme violet and amber are too pale on white.

### 3.1 Logo on dark backgrounds

| Role | Token | HEX | RGB | HSL |
|---|---|---|---|---|
| U (bowl), "Chef" | `brand.primary` (dark) | `#8B7CF6` | 139, 124, 246 | 247°, 87 %, 73 % |
| Dots | `brand.accent` (dark) | `#F5A524` | 245, 165, 36 | 37°, 91 %, 55 % |
| "Uni" | `text` (dark) | `#E6E8EE` | 230, 232, 238 | 225°, 19 %, 92 % |
| Background | surface | `#0F1020` | 15, 16, 32 | 236°, 36 %, 9 % |

### 3.2 Logo on light backgrounds

| Role | Token | HEX | RGB | HSL |
|---|---|---|---|---|
| U (bowl), "Chef" | `brand.primary` (light) | `#5B4BD8` | 91, 75, 216 | 247°, 64 %, 57 % |
| Dots | `brand.accent` (light) | `#B26B00` | 178, 107, 0 | 36°, 100 %, 35 % |
| "Uni" | `text` (light) | `#1B1F2A` | 27, 31, 42 | 224°, 22 %, 14 % |
| Background | white | `#FFFFFF` | 255, 255, 255 | 0°, 0 %, 100 % |

### 3.3 Supporting colour

The code-point colour is used in the UI, not in the logo.

| Token | Dark | Light |
|---|---|---|
| `cp` | `#22D3EE` (34, 211, 238) | `#0E7490` (14, 116, 144) |

### 3.4 Contrast (WCAG 2.x)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#E6E8EE` "Uni" | `#0F1020` | 15.37 : 1 | Passes AAA |
| `#8B7CF6` U, "Chef" | `#0F1020` | 5.66 : 1 | Passes AA |
| `#F5A524` dots | `#0F1020` | 9.23 : 1 | Passes AAA |
| `#1B1F2A` "Uni" | `#FFFFFF` | 16.46 : 1 | Passes AAA |
| `#5B4BD8` U, "Chef" | `#FFFFFF` | 6.10 : 1 | Passes AA |
| `#B26B00` dots | `#FFFFFF` | 4.20 : 1 | Passes the 3 : 1 rule for graphics |
| `#8B7CF6` (dark set) | `#FFFFFF` | 3.33 : 1 | Too weak. Use the light set on light backgrounds. |
| `#F5A524` (dark set) | `#FFFFFF` | 2.04 : 1 | Fails. Use the light set on light backgrounds. |

### 3.5 Print

No CMYK or Pantone values are defined yet. They depend on the printer's profile. Whoever creates the `.ai` master should convert the HEX values with the target profile (for example, FOGRA39 or GRACoL), check a proof, and add the result to this table.

## 4. Typography

| Use | Typeface | Settings |
|---|---|---|
| Wordmark (outlined, never live text) | [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), variable font, version 1.001 | Weight 700, width 100, optical size 48, tracking −0.02 em (−20 in Illustrator), kerning on, no ligatures |

Bricolage Grotesque is licensed under the SIL Open Font License 1.1. Copyright 2022 The Bricolage Grotesque Project Authors. The logo contains outlines only, not the font software, so no font files are shipped. The font file used is `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf` from [google/fonts](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque).

The app UI uses its own type stack (PRD §5.5). The wordmark face is not used for UI text.

## 5. Usage rules

**Clear space.** Keep empty space around the logo at least equal to the diameter of one dot: 192 units on the 1024 grid, which is 21.6 % of the mark's height.

**Minimum size.**

| Asset | Smallest size |
|---|---|
| Mark | 24 px. Below that, use `unichef-mark-16.svg` at exactly 16 px. |
| Lockup | 24 px tall (screen) or 8 mm tall (print). Below that, use the mark alone. |

**Do:**
- Use the dark set on backgrounds darker than `#3A3D5C`, and the light set on lighter ones.
- Use the mono files for single-colour printing, engraving and system pinned-tab icons.
- Scale the files proportionally.

**Don't:**
- Recolour the parts independently (for example, a violet dot or an amber U).
- Change the wordmark font, weight or spacing.
- Rotate, skew, outline, add shadows or gradients, or place the logo on busy photos.
- Separate the dots from the U, or move them.
- Put the dark-set logo on white.
- Add a chef's hat or any other kitchen icon.

## 6. Rebuilding the logo

All coordinates use a 1024 × 1024 canvas with the origin at the top left and y pointing down. The design grid is 64 × 64 units, scaled by 16.

### 6.1 Geometry

| Part | Exact definition |
|---|---|
| U (centre line) | `M224 404 V596 A288 288 0 0 0 800 596 V404`, stroke width 144, round caps, then converted to a filled outline |
| U (filled outline, as stored) | `M152 404A72 72 0 0 1 296 404V596A216 216 0 0 0 728 596V404A72 72 0 0 1 872 404V596A360 360 0 0 1 152 596Z` |
| Left dot | Circle, centre (352, 164), radius 96. The bounding box is x 256, y 68, 192 × 192. |
| Right dot | Circle, centre (672, 164), radius 96. The bounding box is x 576, y 68, 192 × 192. |
| Mark bounds | x 152 to 872, y 68 to 956 (720 × 888), centred on the canvas |
| Maskable | The same mark scaled to 80 % around the centre (512, 512), on a 1024 × 1024 `#0F1020` square |
| 16 px variant | 16 × 16 canvas. U: `M3 8A1 1 0 0 1 5 8V10A3 3 0 0 0 11 10V8A1 1 0 0 1 13 8V10A5 5 0 0 1 3 10Z`. Dots: circles of radius 1.5 at (5.5, 3.5) and (10.5, 3.5). |
| Wordmark | Starts at x = 1072, which leaves a 200-unit gap after the mark. The baseline is at y = 722. Cap height is 420 units, which needs font size 636.36 px, because Bricolage's cap height is 0.66 em. |
| Lockup bounds | `viewBox="152 68 3223 888"` |

### 6.2 Adobe Illustrator

1. **File ▸ New**: 1024 × 1024 px, RGB colour mode, 72 ppi.
2. Open the Layers panel and create four layers: `guides`, `background`, `mark`, `wordmark`.
3. **The U** (on the `mark` layer):
   1. With the Pen tool, click (224, 404), then (224, 596).
   2. Draw the half circle to (800, 596): use the Ellipse tool for a 576 × 576 circle at x 224, y 308 (centre 512, 596), cut it at the left and right anchors with the Scissors tool, keep the lower half, and join it to the stems.
   3. Finish at (800, 404).
   4. Set the stroke to 144 pt with a round cap and no fill.
   5. **Object ▸ Path ▸ Outline Stroke**, then fill with `#8B7CF6`.
4. **Dots**: Ellipse tool, click once on the artboard and enter 192 × 192. Position them at x 256, y 68 and at x 576, y 68 (Transform panel, top-left reference point). Fill with `#F5A524`.
5. **Wordmark** (on the `wordmark` layer):
   1. Type "UniChef" in Bricolage Grotesque. In the Variable Font panel set Weight 700, Width 100, Optical size 48.
   2. Set the size to 636.36 px, tracking to −20, kerning to Auto (metrics).
   3. Place the baseline at y 722 and the left edge of the text at x 1072.
   4. Colour "Uni" `#E6E8EE` and "Chef" `#8B7CF6`.
   5. **Type ▸ Create Outlines.**
6. **Light variant**: duplicate the artboard and swap in the light colours from §3.2.
7. **Save** as `unichef-logo.ai` with *Create PDF Compatible File* turned on.
8. **Export SVG** (File ▸ Export ▸ Export As ▸ SVG):

   | Setting | Value |
   |---|---|
   | Styling | Presentation Attributes |
   | Font | Convert to Outlines |
   | Images | Embed (there should be none) |
   | Object IDs | Layer Names |
   | Decimal | 2 |
   | Minify | Off |
   | Responsive | Off |

   Then crop the `viewBox` to the bounds in §6.1.

### 6.3 Inkscape 1.3 or later

The quickest exact method is to paste the geometry from §6.1 into the XML Editor.

1. **File ▸ Document Properties**: set the size to 1024 × 1024 px, scale 1, and make sure the viewBox is `0 0 1024 1024`.
2. **Layer ▸ Add Layer**: add `mark` and `wordmark`.
3. **The U**: either way works.
   - Open the XML Editor (Ctrl+Shift+X), add a new `svg:path` node, set `d` to the filled outline from §6.1, and set `fill` to `#8B7CF6`.
   - Or draw by hand: draw the centre line from §6.1 with the Pen tool (type the coordinates in the toolbar), set the stroke to 144 px with a round cap in Fill & Stroke (Ctrl+Shift+F), then use **Path ▸ Stroke to Path**.
4. **Dots**: Ellipse tool. In the toolbar set Rx = Ry = 96, then in the X/Y/W/H fields set X 256, Y 68, W 192, H 192, and repeat with X 576. Fill with `#F5A524`.
5. **Wordmark**:
   1. Text tool: type "UniChef".
   2. In **Text ▸ Text and Font**, choose Bricolage Grotesque. Under Variants set wght 700, wdth 100, opsz 48.
   3. Set the font size to 636.36 px and the letter spacing to −12.73 px (−0.02 em).
   4. Put the baseline at y 722 and the start at x 1072.
   5. Colour "Uni" `#E6E8EE` and "Chef" `#8B7CF6`.
   6. **Path ▸ Object to Path** (Shift+Ctrl+C).
6. **Save As ▸ Plain SVG**, then set the root `viewBox` to the lockup bounds in §6.1 in the XML Editor. For the mark-only files, delete the `wordmark` layer and keep `0 0 1024 1024`.
7. To export PNGs for checking: **File ▸ Export** (Shift+Ctrl+E), page area, enter the width in pixels.

Inkscape's command line can do the same export:

```sh
inkscape assets/branding/source/unichef-mark.svg --export-type=png -w 512 -h 512 --export-filename=mark-512.png
```

### 6.4 Generator script (reproducible)

`scripts/assets/make_masters.py` holds the geometry in §6.1 and writes every master. It outlines the wordmark with HarfBuzz shaping (with kerning) and fontTools.

1. Download `BricolageGrotesque[opsz,wdth,wght].ttf` from the google/fonts link in §4.
2. Run:

   ```sh
   uv run --no-project --with fonttools==4.68.0 --with uharfbuzz==0.57.0 \
       python scripts/assets/make_masters.py \
       --font "BricolageGrotesque[opsz,wdth,wght].ttf" --out assets/branding/source
   ```

Because masters are append-only, write to a scratch directory first, compare, and add the result under a versioned name if anything changed.

## 7. Checking a new master

Before committing a new or changed master:

1. Render the mark at 16, 32 and 48 px on `#0F1020` and check that the two dots stay separate from each other and from the U.
2. Search the file for `<script`, `foreignObject`, `xlink:href`, `@font-face` and `<text`. None may appear.
3. Check that the colours match §3 exactly, with uppercase hex.
