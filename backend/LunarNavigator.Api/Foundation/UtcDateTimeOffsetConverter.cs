using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LunarNavigator.Api.Foundation;

/// <summary>Requires ISO UTC with Z and writes the same convention for every scientific response.</summary>
public sealed class UtcDateTimeOffsetConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String ||
            !DateTimeOffset.TryParseExact(reader.GetString(),
                ["yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'"],
                CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var time))
            throw new JsonException("Expected an ISO UTC timestamp ending in Z.");
        return time;
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.UtcDateTime.ToString("O", CultureInfo.InvariantCulture));
}
