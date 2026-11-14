using Xunit;

namespace LunarNavigator.Api.Tests.Ephemeris;

public sealed class LiveHorizonsFactAttribute : FactAttribute
{
    public LiveHorizonsFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("LUNAR_RUN_LIVE_HORIZONS") != "1")
            Skip = "Explicit opt-in required: LUNAR_RUN_LIVE_HORIZONS=1; makes real NASA requests.";
    }
}
