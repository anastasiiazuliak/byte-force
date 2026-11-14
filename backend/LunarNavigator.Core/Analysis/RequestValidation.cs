namespace LunarNavigator.Core.Analysis;

public static class RequestValidation
{
    public static void Validate(AnalysisRequest? request, AnalysisPolicy policy)
    {
        if (request is null || request.Location is null)
            throw Invalid("Location and period are required.");
        var location = request.Location;
        if (!double.IsFinite(location.Latitude) || !double.IsFinite(location.Longitude))
            throw Invalid("Coordinates must be finite numbers.");
        if (location.Latitude is < -90 or > -80 || location.Longitude is < -180 or > 180)
            throw new NavigationException(422, "LOCATION_OUT_OF_BOUNDS", "Location is outside the supported lunar region.");
        if (request.Options is not null && request.Options.TerrainModel != "lola")
            throw Invalid("Only the lola terrain model is supported.");
        ValidatePeriod(request.Period, policy);
    }

    public static void ValidatePeriod(AnalysisPeriod? period, AnalysisPolicy policy)
    {
        if (period is null || period.EndUtc <= period.StartUtc || period.StartUtc.Offset != TimeSpan.Zero ||
            period.EndUtc.Offset != TimeSpan.Zero || period.StartUtc.Year < 1962 ||
            period.StartUtc.Ticks % TimeSpan.TicksPerMillisecond != 0 ||
            period.EndUtc.Ticks % TimeSpan.TicksPerMillisecond != 0)
            throw Invalid("Provide increasing UTC dates from 1962 onward, with millisecond precision or coarser.");
        if (period.StepMinutes < policy.MinStepMinutes || period.StepMinutes > policy.MaxStepMinutes)
            throw Invalid("The sampling step is outside the configured limits.");
        var stepTicks = (long)period.StepMinutes * TimeSpan.TicksPerMinute;
        var durationTicks = (period.EndUtc - period.StartUtc).Ticks;
        var count = durationTicks / stepTicks + (durationTicks % stepTicks == 0 ? 0 : 1) + 1;
        if (count > policy.MaxSamples)
            throw Invalid("The period exceeds the configured sample limit, including the terminal sample.");
    }

    public static IReadOnlyList<DateTimeOffset> SampleTimes(AnalysisPeriod period)
    {
        if (period.EndUtc <= period.StartUtc || period.StepMinutes <= 0)
            throw Invalid("An increasing period and a positive sampling step are required.");
        var times = new List<DateTimeOffset> { period.StartUtc };
        var step = TimeSpan.FromMinutes(period.StepMinutes);
        while (times[^1] < period.EndUtc)
        {
            var remaining = period.EndUtc - times[^1];
            times.Add(times[^1] + (remaining < step ? remaining : step));
        }
        return times;
    }

    public static NavigationException Invalid(string message) => new(400, "VALIDATION_ERROR", message);
}
