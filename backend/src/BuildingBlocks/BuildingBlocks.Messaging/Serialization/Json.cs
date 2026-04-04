using System.Text.Json;
using System.Text.Json.Serialization;

namespace BuildingBlocks.Messaging.Serialization;

/// <summary>One JSON contract for all services: camelCase, enums as strings, no C#-style snake_case.</summary>
public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}

