# Visual design method

The interface is a science dashboard with an exploratory scene, not a spacecraft simulator. Keep the selected site, UTC interval and data quality legible before adding spectacle.

- Give the lunar scene a clear focal area; keep controls and analysis panels from hiding site selection.
- Use warm Sun and cool Earth accents consistently across charts, legends and numerical readouts. Unknown/partial states need text, not merely a different color.
- Use readable labels and aligned numeric values. Distinguish coordinates, units and UTC from decorative scene elements.
- Preserve keyboard access, visible focus, touch targets and reduced-motion behavior. Check narrow viewports, panel overflow and export controls as well as the large desktop scene.
- Make loading, missing assets, API errors and unverified previews explicit. Never turn absence of evidence into a green availability state.
- Evaluate orbit/zoom, selection, timeline scrubbing and A/B comparison together. Camera movement should not create an accidental site selection.
- Do not restore camera-anchored Sun/Earth ornaments. Before Analyze, show no sky bodies. Globe markers require a real, exact cached Analyze sample, verified Globe geometry, JPL provenance and finite observer height, at the shared UTC and optional Site A/B reference.
- Convert airless apparent azimuth/elevation through ENU to Moon_ME and scene `(Y, -Z, -X)`. Keep marker directions world-fixed, not camera-relative; short arrows at the selected site show actual bearing. Allow offscreen and occluded markers rather than forcing them always onscreen.
- Label the 8R endpoint distance and symbol radii as display-only. The canonical API has no real orbital distances; these markers do not depict actual celestial positions, phase or physical scale.
- TerrainView uses a compass and cached Sun lighting, with no global vector-endpoint claims. Approximate lighting, graphic shadows and sky markers do not establish visibility; preserve explicit unknown/partial science states. Respect reduced motion.
- Use DEM-derived cartographic relief only on the polar-cap material; it averages native heights and gradients without displacing geometry. Muted whole-globe SVS imagery supplies context, not verified polar photography. A missing optional relief texture should fall back to neutral mesh-normal rendering.

Review with representative desktop and mobile viewports, reduced motion, keyboard-only input and unavailable services. Measure frame time, transfer size and resource behavior on named devices before making performance claims; no universal FPS or external usability certification is implied.
