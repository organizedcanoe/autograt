using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class ReminderMessagesTests
{
    [Theory]
    [InlineData(8, 0, "How is your day going?")]
    [InlineData(16, 59, "How is your day going?")]
    [InlineData(17, 0, "How has your day been?")]
    [InlineData(22, 30, "How has your day been?")]
    public void Question_DependsOnTheLocalTime(int hour, int minute, string question)
    {
        var message = ReminderMessages.For(new TimeOnly(hour, minute), hasEntries: false, hasRating: false);

        Assert.StartsWith(question, message?.Body);
    }

    [Theory]
    [InlineData(true, false, "Take a minute to rate it.")]
    [InlineData(false, true, "Take a minute to add an entry.")]
    [InlineData(false, false, "Take a minute to reflect.")]
    public void Prompt_AsksForWhatTheDayIsMissing(bool hasEntries, bool hasRating, string prompt)
    {
        var message = ReminderMessages.For(new TimeOnly(12, 0), hasEntries, hasRating);

        Assert.EndsWith(prompt, message?.Body);
    }

    [Fact]
    public void DayWithEntriesAndARating_NeedsNoReminder()
    {
        Assert.Null(ReminderMessages.For(new TimeOnly(12, 0), hasEntries: true, hasRating: true));
    }
}
