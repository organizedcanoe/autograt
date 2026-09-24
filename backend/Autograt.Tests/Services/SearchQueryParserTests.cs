using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class SearchQueryParserTests
{
    [Fact]
    public void QuotedQuery_IsSingleCaseSensitiveTermWithQuotesRemoved()
    {
        var query = SearchQueryParser.Parse("\"dog, cat\"");

        Assert.Equal(["dog, cat"], query.Terms);
        Assert.True(query.CaseSensitive);
    }

    [Fact]
    public void QuotedQuery_KeepsInnerWhitespaceLiterally()
    {
        var query = SearchQueryParser.Parse("  \" the dog \"  ");

        Assert.Equal([" the dog "], query.Terms);
    }

    [Fact]
    public void CommaQuery_SplitsAndTrimsIntoCaseInsensitiveTerms()
    {
        var query = SearchQueryParser.Parse("dog,  cat ,bird");

        Assert.Equal(["dog", "cat", "bird"], query.Terms);
        Assert.False(query.CaseSensitive);
    }

    [Fact]
    public void CommaQuery_DropsEmptyTerms()
    {
        var query = SearchQueryParser.Parse("dog, , cat,");

        Assert.Equal(["dog", "cat"], query.Terms);
    }

    [Fact]
    public void StandardQuery_IsSingleTrimmedCaseInsensitiveTerm()
    {
        var query = SearchQueryParser.Parse("  walked the dog ");

        Assert.Equal(["walked the dog"], query.Terms);
        Assert.False(query.CaseSensitive);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\"\"")]
    [InlineData(" , ,")]
    public void EmptyQueries_HaveNoTerms(string? raw)
    {
        Assert.True(SearchQueryParser.Parse(raw).IsEmpty);
    }

    [Fact]
    public void SingleQuoteCharacter_IsTreatedAsStandardTerm()
    {
        var query = SearchQueryParser.Parse("\"");

        Assert.Equal(["\""], query.Terms);
        Assert.False(query.CaseSensitive);
    }
}
