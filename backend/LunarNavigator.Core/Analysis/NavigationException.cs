namespace LunarNavigator.Core.Analysis;

/// <summary>A public, contract-compatible failure, without internal implementation details.</summary>
public sealed class NavigationException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
