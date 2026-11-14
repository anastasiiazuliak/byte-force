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
            .ToDictionary(pair => pair[0], pair => Uri.UnescapeDataString(pair[1]).Trim('\''));
        var time = DateTime.ParseExact(parameters["TLIST"], "yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)
            .ToString("yyyy-MMM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture);
        // Synthetic angles in a captured Horizons column layout; no test value is a NASA observation.
        var json = JsonSerializer.Serialize(new
        {
            signature = new { version = "1.3", source = "SYNTHETIC TEST ONLY" },
            result = "Date__(UT)__HR:MN:SC.fff, , ,Azimuth_(a-app), Elevation_(a-app),\n***\n$$SOE\n" +
                $"{time},*, ,360,1,\n$$EOE\n"
        });
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}
