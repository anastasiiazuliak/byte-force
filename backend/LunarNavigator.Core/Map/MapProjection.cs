using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Map;

public sealed record MapProjection(
    [property: JsonRequired] string Name,
    [property: JsonRequired] string? ProjDefinition,
    [property: JsonRequired] string? SourceFrame,
    [property: JsonRequired] string LinearUnit);
