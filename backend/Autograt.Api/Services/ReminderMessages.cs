namespace Autograt.Api.Services;

/// <summary>The notifications Autograt sends. Clicking one opens the today page.</summary>
public static class ReminderMessages
{
    private const string Title = "Autograt";
    private const string Url = "/";

    // From this local time the day is treated as mostly over, so the question looks back on it.
    private static readonly TimeOnly EveningStarts = new(17, 0);

    public static readonly PushMessage Test = new(Title, "Reminders are working on this device.", Url);

    /// <summary>
    /// A reminder worded for the time of day and asking for whatever the day is still missing.
    /// </summary>
    /// <param name="localTime">The reminder time in the user's time zone.</param>
    /// <returns>The message, or null when the day already has entries and a rating, so needs no reminder.</returns>
    public static PushMessage? For(TimeOnly localTime, bool hasEntries, bool hasRating)
    {
        var prompt = (hasEntries, hasRating) switch
        {
            (true, true) => null,
            (true, false) => "rate it",
            (false, true) => "add an entry",
            (false, false) => "reflect",
        };
        if (prompt is null)
        {
            return null;
        }

        var question = localTime < EveningStarts ? "How is your day going?" : "How has your day been?";
        return new PushMessage(Title, $"{question} Take a minute to {prompt}.", Url);
    }
}
