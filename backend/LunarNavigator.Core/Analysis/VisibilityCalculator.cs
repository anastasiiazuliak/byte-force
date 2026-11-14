namespace LunarNavigator.Core.Analysis;

/// <summary>Integrates linear clearance crossings between samples, including the terminal sample.</summary>
public static class VisibilityCalculator
{
    public static IReadOnlyList<VisibilityInterval> GetIntervals(
        IReadOnlyList<AnalysisSample> samples, Func<AnalysisSample, BodyPosition> select)
    {
        var intervals = new List<VisibilityInterval>();
        for (var index = 0; index + 1 < samples.Count; index++)
        {
            var left = samples[index];
            var right = samples[index + 1];
            var a = select(left).ClearanceDeg!.Value;
            var b = select(right).ClearanceDeg!.Value;
            if (a <= 0 && b <= 0) continue;
            var start = left.TimeUtc;
            var end = right.TimeUtc;
            if (a <= 0 || b <= 0)
            {
                var fraction = Math.Clamp(a / (a - b), 0, 1);
                var crossing = start.AddTicks((long)Math.Round((end - start).Ticks * fraction));
                if (a > 0) end = crossing;
                else start = crossing;
            }
            if (end <= start) continue;
            if (intervals.Count > 0 && intervals[^1].EndUtc == start)
                intervals[^1] = intervals[^1] with { EndUtc = end };
            else intervals.Add(new VisibilityInterval(start, end));
        }
        return intervals;
    }

    public static double Hours(IReadOnlyList<VisibilityInterval> intervals) =>
        intervals.Sum(interval => (interval.EndUtc - interval.StartUtc).TotalHours);

    public static double BothHours(IReadOnlyList<VisibilityInterval> sun, IReadOnlyList<VisibilityInterval> earth)
    {
        var hours = 0.0;
        var a = 0;
        var b = 0;
        while (a < sun.Count && b < earth.Count)
        {
            var start = sun[a].StartUtc > earth[b].StartUtc ? sun[a].StartUtc : earth[b].StartUtc;
            var end = sun[a].EndUtc < earth[b].EndUtc ? sun[a].EndUtc : earth[b].EndUtc;
            if (end > start) hours += (end - start).TotalHours;
            if (sun[a].EndUtc <= earth[b].EndUtc) a++;
            else b++;
        }
        return hours;
    }

    public static double InterpolateHorizon(IReadOnlyList<HorizonPoint> points, double azimuth)
    {
        var upper = 0;
        while (upper < points.Count && points[upper].AzimuthDeg <= azimuth) upper++;
        upper %= points.Count;
        var lower = (upper + points.Count - 1) % points.Count;
        var low = points[lower].AzimuthDeg;
        var high = points[upper].AzimuthDeg;
        if (high <= low) high += 360;
        if (azimuth < low) azimuth += 360;
        var fraction = (azimuth - low) / (high - low);
        return points[lower].ElevationDeg + fraction * (points[upper].ElevationDeg - points[lower].ElevationDeg);
    }
}
