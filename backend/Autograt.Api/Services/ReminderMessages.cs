namespace Autograt.Api.Services;

/// <summary>The notifications Autograt sends. Clicking one opens the today page.</summary>
public static class ReminderMessages
{
    private const string Title = "Autograt";

    public static readonly PushMessage Daytime = new(Title, "What went well today? Take a minute to add an entry.", "/");

    /// <summary>Sent at the last of several reminder times, when the day is nearly over.</summary>
    public static readonly PushMessage Evening = new(Title, "How was your day? Rate it and add an entry.", "/");

    public static readonly PushMessage Test = new(Title, "Reminders are working on this device.", "/");
}
