using System.Net;
using System.Text;
using System.Text.Json;

namespace ByteForce.Horizons.Tests.TestSupport;

internal static class HorizonsTestData
{
    public static DateTimeOffset Time { get; } =
        new DateTimeOffset(2026, 11, 13, 0, 0, 0, TimeSpan.Zero).AddMilliseconds(123);

    public static LunarObserver Observer { get; } = new(-89.5, 0, 0.08);

    public static string Payload(
        string angles, string version = "1.2", string time = "2026-Nov-13 00:00:00.123", bool duplicate = false)
    {
        // Column layout captured from a live NASA lunar observer response on 2026-11-13.
        var row = $" {time},*, ,{angles},\n";
        return JsonSerializer.Serialize(new
        {
            signature = new { version, source = "NASA/JPL Horizons API" },
            result = " Date__(UT)__HR:MN:SC.fff, , ,Azimuth_(a-app), Elevation_(a-app),\n***\n$$SOE\n"
                + row + (duplicate ? row : "") + "$$EOE\n"
        });
    }

    public static HttpResponseMessage JsonResponse(string content) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(content, Encoding.UTF8, "application/json")
    };
}
