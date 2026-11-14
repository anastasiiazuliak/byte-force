using System.Text.Json.Serialization;
using LunarNavigator.Core.Map;

namespace LunarNavigator.Api.Infrastructure.Map;

/// <summary>Local handoff envelope; only Metadata is returned over the frozen HTTP API.</summary>
public sealed record MapManifest(
    [property: JsonRequired] int SchemaVersion,
    [property: JsonRequired] MapMetadata Metadata,
    IReadOnlyList<string>? RequiredAssets = null);
