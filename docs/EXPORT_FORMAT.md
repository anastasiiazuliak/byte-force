# Lunar Site Navigator export

After a successful Analyze or Compare request, choose **Download CSV** for the complete API sample series or **Print report** for a short summary. In the print view, use **Print / Save PDF** and choose the destination in your browser.

The CSV is UTF-8 with a byte-order mark, comma delimiters, and CRLF record endings. Times use ISO 8601 UTC with `Z`. Numeric values use decimal points. Column suffixes specify degrees, metres, hours, minutes, or percent.

Filter by `record_type` to select the rows you need:

- `sample` has one row per sample returned by the API, in API order. It includes location, period, and Sun/Earth elevation, azimuth, terrain horizon, clearance, and visibility.
- `summary` has one row per requested scenario. It includes duration and percent totals, location, period, sampling step, ephemeris and terrain sources, terrain application, DEM resolution, and visibility method. A failed scenario has an `unavailable` summary with its error.
- `warning` preserves one API warning per row, linked to the scenario in the `scenario` column.
- `difference` shows B minus A for sunlight, Earth visibility, and simultaneous visibility in hours. A partial or unavailable scenario makes the differences `unknown`.

`unknown` represents an undetermined value. An empty cell means the column does not apply to that row. `false` and zero retain their original meaning. Export reflects the API response and uses the API version from the health endpoint when available. Moving the timeline cursor has no effect on the exported samples.

Demo exports carry the `demo / synthetic` label and the `-synthetic` filename suffix. Real mode blocks export of results whose source labels mark them as synthetic. CSV text fields that could be parsed as spreadsheet formulas are prefixed with an apostrophe. Numeric cells keep their sign.
- `difference` shows B minus A for sunlight, Earth visibility, and simultaneous visibility in hours. Differences preserve the API values, including `unknown`; export does not infer or recompute them.

`unknown` represents an undetermined value. An empty cell means the column does not apply to that row. `false` and zero retain their original meaning. Export reflects the API response and uses the supplied API version when available. The existing application does not retain the health endpoint version, so its exports label the version `unknown`. Moving the timeline cursor has no effect on the exported samples.

Demo exports carry the `demo / synthetic` label and the `-synthetic` filename suffix. Real mode blocks export of results whose source labels mark them as synthetic. CSV text fields that could be parsed as spreadsheet formulas are prefixed with an apostrophe. Numeric cells keep their sign.

Print reports preserve source labels, quality warnings and unknown metrics; “Live API” does not certify scientific validity. Terrain application is reported separately from DEM resolution and visibility method.
