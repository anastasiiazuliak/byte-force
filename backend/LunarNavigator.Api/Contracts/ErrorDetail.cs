using System.Text.Json.Serialization;

namespace LunarNavigator.Api.Contracts;

/// <summary>A public error code and message without internal exception details.</summary>
public sealed record ErrorDetail(
    string Code,
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] object? Details = null);
