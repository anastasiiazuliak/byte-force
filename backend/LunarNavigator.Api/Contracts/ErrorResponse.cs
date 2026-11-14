namespace LunarNavigator.Api.Contracts;

/// <summary>The shared envelope for API errors.</summary>
public sealed record ErrorResponse(ErrorDetail Error);
