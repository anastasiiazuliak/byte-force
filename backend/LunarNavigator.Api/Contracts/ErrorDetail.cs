namespace LunarNavigator.Api.Contracts;

/// <summary>A public error code and message without internal exception details.</summary>
public sealed record ErrorDetail(string Code, string Message, object? Details = null);
