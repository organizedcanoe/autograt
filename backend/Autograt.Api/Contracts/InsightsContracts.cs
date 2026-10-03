namespace Autograt.Api.Contracts;

/// <summary>Summary statistics of the signed-in user's journal, as of <paramref name="Today"/> in their time zone.</summary>
public sealed record InsightsResponse(DateOnly Today, RatingAverages Ratings, CategoryCounts Categories, Streaks Streaks);

public sealed record RatingAverages(RatingAverage AllTime, RatingAverage Last7Days, RatingAverage Last30Days);

/// <summary>The mean rating of the rated days in a period; <paramref name="Average"/> is null when there are none.</summary>
public sealed record RatingAverage(double? Average, int RatedDays);

/// <summary>The number of sub-entries in each category, all time. Appends are not counted.</summary>
public sealed record CategoryCounts(int Good, int Bad, int Neutral);

/// <summary>Runs of consecutive journaled days. <paramref name="Longest"/> is null when no day is journaled.</summary>
public sealed record Streaks(int Current, StreakRun? Longest);

/// <summary>A run of consecutive journaled days, both dates inclusive.</summary>
public sealed record StreakRun(int Days, DateOnly From, DateOnly To);
