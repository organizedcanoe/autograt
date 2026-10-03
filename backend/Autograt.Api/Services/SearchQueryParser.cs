namespace Autograt.Api.Services;

public sealed record SearchQuery(IReadOnlyList<string> Terms, bool CaseSensitive)
{
    public static readonly SearchQuery Empty = new([], CaseSensitive: false);

    public bool IsEmpty => Terms.Count == 0;
}

/// <summary>
/// Parses search input per the spec: <c>"quoted"</c> is one exact, case-sensitive term;
/// <c>a, b</c> matches any term; anything else is one term. Unquoted terms ignore case.
/// The frontend highlights matches with the same rules (keep in sync with frontend/src/utils/searchTerms.ts).
/// </summary>
public static class SearchQueryParser
{
    public static SearchQuery Parse(string? raw)
    {
        var query = raw?.Trim() ?? "";

        if (query.Length >= 2 && query.StartsWith('"') && query.EndsWith('"'))
        {
            var exact = query[1..^1];
            return exact.Length == 0 ? SearchQuery.Empty : new SearchQuery([exact], CaseSensitive: true);
        }

        if (query.Contains(','))
        {
            var terms = query.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            return new SearchQuery(terms, CaseSensitive: false);
        }

        return query.Length == 0 ? SearchQuery.Empty : new SearchQuery([query], CaseSensitive: false);
    }
}
