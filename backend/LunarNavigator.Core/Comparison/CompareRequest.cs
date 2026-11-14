using System.Text.Json.Serialization;

namespace LunarNavigator.Core.Comparison;

public sealed record CompareRequest([property: JsonRequired] IReadOnlyList<CompareScenarioRequest> Scenarios);
