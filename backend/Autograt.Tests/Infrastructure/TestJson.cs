using System.Text.Json;
using System.Text.Json.Serialization;

namespace Autograt.Tests.Infrastructure;

/// <summary>
/// JSON settings matching the API: camelCase properties and enums as strings.
/// </summary>
public static class TestJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };
}
