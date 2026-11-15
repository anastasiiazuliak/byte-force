using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;

namespace LunarNavigator.Api.Tests.TestSupport;

internal sealed class StubHorizonsHttpFactory : HttpMessageHandler, IHttpClientFactory
{
    private int _calls;
    public int Calls => _calls;
    public Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>>? Respond { get; init; }

    public HttpClient CreateClient(string name) => new(this, disposeHandler: false);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var call = Interlocked.Increment(ref _calls);
        return Respond?.Invoke(request, call, cancellationToken) ?? Task.FromResult(Payload(request));
    }

    public static HttpResponseMessage Payload(HttpRequestMessage request)
    {
        var parameters = request.RequestUri!.Query.TrimStart('?').Split('&').Select(part => part.Split('=', 2))
            .ToDictionary(pair => pair[0], pair => Uri.UnescapeDataString(pair[1]));

        var times = new List<DateTime>();
        if (parameters.TryGetValue("TLIST", out var tlistRaw))
        {
            foreach (var entry in tlistRaw.Split(','))
            {
                var trimmed = entry.Trim().Trim('\'');
                times.Add(DateTime.ParseExact(trimmed, "yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture));
            }
        }
        else if (parameters.TryGetValue("START_TIME", out var startRaw)
            && parameters.TryGetValue("STOP_TIME", out var stopRaw)
            && parameters.TryGetValue("STEP_SIZE", out var stepRaw))
        {
            var start = DateTime.ParseExact(startRaw.Trim('\''), "yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);
            var stop = DateTime.ParseExact(stopRaw.Trim('\''), "yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);
            var stepMinutes = int.Parse(stepRaw.Trim('\'').TrimEnd('m'), CultureInfo.InvariantCulture);
            for (var current = start; current <= stop; current = current.AddMinutes(stepMinutes))
                times.Add(current);
        }

        var rows = string.Join("\n", times.Select(t =>
            $"{t.ToString("yyyy-MMM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)},*, ,360,1,"));
        // Synthetic angles in a captured Horizons column layout; no test value is a NASA observation.
        var json = JsonSerializer.Serialize(new
        {
            signature = new { version = "1.3", source = "SYNTHETIC TEST ONLY" },
            result = "Date__(UT)__HR:MN:SC.fff, , ,Azimuth_(a-app), Elevation_(a-app),\n***\n$$SOE\n" +
                rows + "\n$$EOE\n"
        });
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}
