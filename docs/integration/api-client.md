# INT-01 — використання клієнта без залежності від UI/3D

```ts
import { createConfiguredClient } from './integration/client'; // відносно src
import { ApiClientError, analysisCacheKey } from './api';
import type { AnalysisRequest } from './api';
const api = await createConfiguredClient();
const controller = new AbortController();
const config = await api.getConfig(controller.signal);
const input: AnalysisRequest = {
  location: { latitude: -89.5, longitude: 25 },
  period: { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z', stepMinutes: 60 },
};
const key = analysisCacheKey(input); // location + period + options, без UI cache dependency
try {
  const analysis = await api.analyze(input, controller.signal);
  // Unknown visibility залишається null; quality.warnings обов'язково показати.
} catch (error) {
  if (error instanceof ApiClientError) {
    // error.kind: http/network/decode; error.status; error.body (JSON або text)
    // error.apiError?.error — типізований frozen envelope code/message/details
  }
  // AbortError обробляти окремо; не показувати як серверний збій.
}
const comparison = await api.compare({ scenarios: [
  { id: 'A', ...input },
  { id: 'B', ...input, location: { latitude: -88.7, longitude: 42 } },
] }, controller.signal);
```

Для автономного test/demo harness:

```ts
import { createApiClient } from './api';
import { createMockTransport } from './mocks/transport';
const api = createApiClient({ transport: createMockTransport() });
const metadata = await api.getMapMetadata(); // null CRS/transform, unverified
```

Використання прямого mock factory — явний opt-in лише для tests/dev harness, не production app composition. У застосунку використовуй `createConfiguredClient()`: лише DEV + `VITE_USE_MOCKS=true` завантажує synthetic transport. Помилка реального API НІКОЛИ не перемикає transport автоматично.

Mock analyze/compare повертають clone вихідного partial fixture, підставляють request location/period і один synthetic sample на startUtc. Це НЕ повний науковий часовий ряд і НЕ scientific calculation. Summaries та visibility невідомі; не заповнюйте їх нулями. Ephemeris навмисно 503 EPHEMERIS_UNAVAILABLE. Усі mock responses мають X-Lunar-Data: synthetic-mock; config/site labels та analysis quality явно synthetic. Metadata з вихідного fixture не підтверджені.

Facade сумісний із frozen LunarApiClient (короткі health/config/landingSites/mapMetadata/ephemeris) і має aliases getConfig/getLandingSites/getMapMetadata/getEphemeris. Обидві форми приймають AbortSignal; DTO не перевизначені. Custom baseUrl містить повний API prefix, наприклад `/api/v1`. Для custom mock prefix передай його також у createMockTransport(baseUrl).

Немає hooks, state store або інтеграції в AppShell: №2 сам вирішує кеш/стан. Cache key стабільний для порядку властивостей; має містити додатково ознаку transport/source, якщо один кеш використовується між real та mock mode. Таймлайн використовує вже отримані samples, не запит кожного кадру.
