using Autograt.Api.Contracts;

namespace Autograt.Api.Services;

/// <summary>The notifications Autograt sends. Clicking one opens the today page.</summary>
public static class ReminderMessages
{
    private const string Title = "Autograt";
    private const string Url = "/";

    // From this local time the day is treated as mostly over, so the question looks back on it.
    private static readonly TimeOnly EveningStarts = new(17, 0);

    // Streaks of these lengths are called out when journaling today would reach them.
    private static readonly int[] Milestones = [7, 30, 100, 365];

    // A shorter streak isn't worth mentioning.
    private const int MinimumStreakToMention = 2;

    public static readonly PushMessage Test = new(Title, "Reminders are working on this device.", Url);

    // Phrasings for each thing a day can be missing, as (daytime, evening). The first is the plainest.
    private static readonly string[] NeedsReflectionDaytime =
    [
        "How is your day going? Take a minute to reflect.",
        "What's gone well so far today? Jot it down.",
        "A quick check-in: how is today shaping up?",
    ];

    private static readonly string[] NeedsReflectionEvening =
    [
        "How has your day been? Take a minute to reflect.",
        "What made you smile today? Write it down.",
        "Before the day ends, how did it go?",
    ];

    private static readonly string[] NeedsRatingDaytime =
    [
        "How is your day going? Take a minute to rate it.",
        "Nice entries so far. How would you rate today?",
        "Out of 10, how is today going?",
    ];

    private static readonly string[] NeedsRatingEvening =
    [
        "How has your day been? Take a minute to rate it.",
        "You've written about today. Now give it a rating.",
        "Out of 10, how was today?",
    ];

    private static readonly string[] NeedsEntryDaytime =
    [
        "How is your day going? Take a minute to add an entry.",
        "You've rated today. What's behind the score?",
        "Add a good moment from today to your journal.",
    ];

    private static readonly string[] NeedsEntryEvening =
    [
        "How has your day been? Take a minute to add an entry.",
        "You've rated today. What made it that score?",
        "What went well today? Add an entry.",
    ];

    /// <summary>
    /// A reminder asking for whatever the day is still missing, in a phrasing picked at random for the time of day.
    /// A day with nothing yet sometimes mentions the current streak instead, calling out a milestone or the
    /// longest streak when journaling today would reach it.
    /// </summary>
    /// <param name="localTime">The reminder time in the user's time zone.</param>
    /// <param name="streaks">The user's streaks as of the reminder's local date.</param>
    /// <returns>The message, or null when the day already has entries and a rating, so needs no reminder.</returns>
    public static PushMessage? For(TimeOnly localTime, bool hasEntries, bool hasRating, Streaks streaks, Random random)
    {
        // An entry or a rating already journals the day, so the streak is only at stake while both are missing.
        var streakMessage = hasEntries || hasRating ? null : StreakMessage(streaks, random);
        if (streakMessage is not null)
        {
            return new PushMessage(Title, streakMessage, Url);
        }

        var isEvening = localTime >= EveningStarts;
        var phrasings = (hasEntries, hasRating) switch
        {
            (true, true) => null,
            (true, false) => isEvening ? NeedsRatingEvening : NeedsRatingDaytime,
            (false, true) => isEvening ? NeedsEntryEvening : NeedsEntryDaytime,
            (false, false) => isEvening ? NeedsReflectionEvening : NeedsReflectionDaytime,
        };
        return phrasings is null ? null : new PushMessage(Title, Pick(phrasings, random), Url);
    }

    /// <returns>A message about the current streak, or null when it is too short or the coin flip says not this time.</returns>
    private static string? StreakMessage(Streaks streaks, Random random)
    {
        // The streak is mentioned only half the time, so the usual phrasings still come up.
        var current = streaks.Current;
        if (current < MinimumStreakToMention || random.Next(2) != 0)
        {
            return null;
        }

        var next = current + 1;
        if (Milestones.Contains(next))
        {
            return $"Journal today to reach a {next} day streak!";
        }

        var longest = streaks.Longest?.Days ?? 0;
        if (next > longest)
        {
            return $"Journal today for your longest streak yet: {next} days.";
        }

        if (next == longest)
        {
            return $"Journal today to match your longest streak of {longest} days.";
        }

        return Pick(
        [
            $"Keep your {current} day streak going and journal today.",
            $"You're on a {current} day streak. Add today to it.",
            $"{current} days in a row! Make it {next}.",
        ], random);
    }

    private static string Pick(string[] phrasings, Random random) => phrasings[random.Next(phrasings.Length)];
}
