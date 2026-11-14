namespace LunarNavigator.Core.Analysis;

public sealed record BodyPosition(
    double AzimuthDeg, double ElevationDeg, double? HorizonDeg, double? ClearanceDeg, bool? Visible);
