namespace ByteForce.Horizons;

/// <summary>A Horizons service error or an unsupported/malformed response.</summary>
public sealed class HorizonsException : Exception
{
    public HorizonsException(string message) : base(message) { }
    public HorizonsException(string message, Exception innerException) : base(message, innerException) { }
}
