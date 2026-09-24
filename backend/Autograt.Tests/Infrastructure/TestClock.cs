namespace Autograt.Tests.Infrastructure;

/// <summary>
/// A settable clock for the API under test. It starts at noon UTC on <see cref="DefaultToday"/>,
/// when that date is "today" in every time zone.
/// </summary>
public sealed class TestClock : TimeProvider
{
    public static readonly DateOnly DefaultToday = new(2026, 9, 23);

    private DateTimeOffset _utcNow = NoonUtc(DefaultToday);

    public override DateTimeOffset GetUtcNow() => _utcNow;

    /// <summary>Moves the clock to noon UTC on <paramref name="date"/> until the returned scope is disposed.</summary>
    public IDisposable TravelTo(DateOnly date) => TravelTo(NoonUtc(date));

    /// <summary>Moves the clock to <paramref name="utcNow"/> until the returned scope is disposed.</summary>
    public IDisposable TravelTo(DateTimeOffset utcNow)
    {
        var previous = _utcNow;
        _utcNow = utcNow;
        return new RestoreScope(() => _utcNow = previous);
    }

    private static DateTimeOffset NoonUtc(DateOnly date) => new(date.ToDateTime(new TimeOnly(12, 0)), TimeSpan.Zero);

    private sealed class RestoreScope(Action restore) : IDisposable
    {
        public void Dispose() => restore();
    }
}
