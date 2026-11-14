namespace LunarNavigator.Api.Contracts;

/// <summary>Web-server liveness and version; does not report external-service health.</summary>
public sealed record HealthResponse(string Status, string Version);
