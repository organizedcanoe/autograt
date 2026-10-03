using Autograt.Api.Contracts;

namespace Autograt.Api.Services;

/// <summary>The calculations behind the insights page, kept free of the database so they are easy to test.</summary>
public static class InsightsStats
{
    /// <returns>The mean of the rated days; unrated days are ignored rather than counted as 0.</returns>
    public static RatingAverage GetAverage(IEnumerable<int?> ratings)
    {
        var rated = ratings.OfType<int>().ToList();
        return new RatingAverage(rated.Count == 0 ? null : rated.Average(), rated.Count);
    }

    /// <summary>
    /// Finds runs of consecutive journaled days. The current streak ends today, or yesterday while today isn't
    /// journaled yet, so it doesn't drop to 0 every morning. A tie for the longest goes to the most recent run.
    /// </summary>
    public static Streaks GetStreaks(IEnumerable<DateOnly> journaledDays, DateOnly today)
    {
        var runs = ToRuns(journaledDays.Distinct().Order());
        var longest = runs.OrderByDescending(r => r.Days).ThenByDescending(r => r.To).FirstOrDefault();
        var current = runs.LastOrDefault(r => r.To == today || r.To == today.AddDays(-1));
        return new Streaks(current?.Days ?? 0, longest);
    }

    private static List<StreakRun> ToRuns(IEnumerable<DateOnly> orderedDays)
    {
        var runs = new List<StreakRun>();
        foreach (var day in orderedDays)
        {
            if (runs.Count > 0 && runs[^1].To.AddDays(1) == day)
            {
                runs[^1] = runs[^1] with { Days = runs[^1].Days + 1, To = day };
            }
            else
            {
                runs.Add(new StreakRun(1, day, day));
            }
        }

        return runs;
    }
}
