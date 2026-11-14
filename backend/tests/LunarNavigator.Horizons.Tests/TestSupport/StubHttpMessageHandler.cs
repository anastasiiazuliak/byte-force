namespace LunarNavigator.Horizons.Tests.TestSupport;

internal sealed class StubHttpMessageHandler(
    Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    private int _calls;
    public int Calls => _calls;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
        => respond(request, Interlocked.Increment(ref _calls) - 1, cancellationToken);
}
