using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Autograt.Tests.Infrastructure;

namespace Autograt.Tests.Services;

public class ReminderMessagesTests
{
    private static readonly TimeOnly Noon = new(12, 0);
    private static readonly Streaks NoStreak = new(0, null);

    [Theory]
    [InlineData(8, 0, "How is your day going?")]
    [InlineData(16, 59, "How is your day going?")]
    [InlineData(17, 0, "How has your day been?")]
    [InlineData(22, 30, "How has your day been?")]
    public void Question_DependsOnTheLocalTime(int hour, int minute, string question)
    {
        var message = ReminderMessages.For(new TimeOnly(hour, minute), hasEntries: false, hasRating: false, NoStreak, new FakeRandom(0));

        Assert.StartsWith(question, message?.Body);
    }

    [Theory]
    [InlineData(true, false, "Take a minute to rate it.")]
    [InlineData(false, true, "Take a minute to add an entry.")]
    [InlineData(false, false, "Take a minute to reflect.")]
    public void Prompt_AsksForWhatTheDayIsMissing(bool hasEntries, bool hasRating, string prompt)
    {
        var message = ReminderMessages.For(Noon, hasEntries, hasRating, NoStreak, new FakeRandom(0));

        Assert.EndsWith(prompt, message?.Body);
    }

    [Theory]
    [InlineData(12, true, false)]
    [InlineData(12, false, true)]
    [InlineData(12, false, false)]
    [InlineData(20, true, false)]
    [InlineData(20, false, true)]
    [InlineData(20, false, false)]
    public void Phrasing_IsPickedAtRandom_AndFitsANotificationPreview(int hour, bool hasEntries, bool hasRating)
    {
        var bodies = Enumerable.Range(0, 3)
            .Select(index => ReminderMessages.For(new TimeOnly(hour, 0), hasEntries, hasRating, NoStreak, new FakeRandom(index))!.Body)
            .ToList();

        Assert.Equal(bodies.Count, bodies.Distinct().Count());
        Assert.All(bodies, body => Assert.True(body.Length <= 80, $"\"{body}\" is too long for a preview."));
    }

    [Fact]
    public void DayWithEntriesAndARating_NeedsNoReminder()
    {
        Assert.Null(ReminderMessages.For(Noon, hasEntries: true, hasRating: true, NoStreak, new FakeRandom()));
    }

    [Theory]
    [InlineData(0, "Keep your 5 day streak going and journal today.")]
    [InlineData(1, "You're on a 5 day streak. Add today to it.")]
    [InlineData(2, "5 days in a row! Make it 6.")]
    public void Streak_WhenPicked_IsMentioned(int index, string body)
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(5, longest: 10), new FakeRandom(0, index));

        Assert.Equal(body, message?.Body);
    }

    [Fact]
    public void Streak_WhenNotPicked_UsesTheUsualPhrasing()
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(5, longest: 10), new FakeRandom(1, 0));

        Assert.Equal("How is your day going? Take a minute to reflect.", message?.Body);
    }

    [Fact]
    public void OneDayStreak_IsNotWorthMentioning()
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(1, longest: 3), new FakeRandom(0, 0));

        Assert.DoesNotContain("streak", message?.Body);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void JournaledDay_DoesNotMentionTheStreak(bool hasEntries, bool hasRating)
    {
        // An entry or a rating already keeps the streak going, so only the missing part is asked for.
        var message = ReminderMessages.For(Noon, hasEntries, hasRating, Streak(5, longest: 10), new FakeRandom(0, 0));

        Assert.DoesNotContain("streak", message?.Body);
    }

    [Theory]
    [InlineData(6, "Journal today to reach a 7 day streak!")]
    [InlineData(29, "Journal today to reach a 30 day streak!")]
    [InlineData(99, "Journal today to reach a 100 day streak!")]
    [InlineData(364, "Journal today to reach a 365 day streak!")]
    public void Streak_CallsOutMilestones(int current, string body)
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(current, longest: current), new FakeRandom(0));

        Assert.Equal(body, message?.Body);
    }

    [Fact]
    public void Streak_OneDayShortOfTheLongest_OffersToMatchIt()
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(8, longest: 9), new FakeRandom(0));

        Assert.Equal("Journal today to match your longest streak of 9 days.", message?.Body);
    }

    [Fact]
    public void Streak_AtTheLongest_OffersANewRecord()
    {
        var message = ReminderMessages.For(Noon, hasEntries: false, hasRating: false, Streak(9, longest: 9), new FakeRandom(0));

        Assert.Equal("Journal today for your longest streak yet: 10 days.", message?.Body);
    }

    private static Streaks Streak(int current, int longest)
    {
        var to = TestClock.DefaultToday.AddDays(-1);
        return new Streaks(current, new StreakRun(longest, to.AddDays(1 - longest), to));
    }
}
