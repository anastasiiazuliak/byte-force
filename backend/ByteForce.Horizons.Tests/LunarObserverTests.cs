using Xunit;

namespace ByteForce.Horizons.Tests;

public sealed class LunarObserverTests
{
    [Theory]
    [InlineData(double.NaN, 0, 0, "latitudeDegrees")]
    [InlineData(-91, 0, 0, "latitudeDegrees")]
    [InlineData(0, 361, 0, "longitudeDegreesEast")]
    [InlineData(0, 0, double.PositiveInfinity, "altitudeKilometers")]
    [InlineData(0, 0, -1737.4, "altitudeKilometers")]
    public void Constructor_RejectsInvalidCoordinates(
        double latitude, double longitude, double altitude, string parameterName)
    {
        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new LunarObserver(latitude, longitude, altitude));

        Assert.Equal(parameterName, exception.ParamName);
    }
}
