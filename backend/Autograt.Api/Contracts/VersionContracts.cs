namespace Autograt.Api.Contracts;

/// <summary>The running build, e.g. version "1.2.3" (or "1.2.3-4-gabc1234" after a release), commit "abc1234". Builds without git report "0.0.0-dev" / "local".</summary>
public sealed record VersionResponse(string Version, string Commit, string? BuildDate)
{
    public const string DevVersion = "0.0.0-dev";
    public const string DevCommit = "local";

    /// <param name="informationalVersion">The assembly's "version+commit" string, set by the Docker build or from git.</param>
    /// <param name="buildDate">The UTC build timestamp, or null/empty when not built by CI.</param>
    public static VersionResponse FromBuild(string? informationalVersion, string? buildDate)
    {
        var parts = (informationalVersion ?? "").Split('+', 2);
        var version = string.IsNullOrWhiteSpace(parts[0]) ? DevVersion : parts[0];
        var commit = parts.Length > 1 && string.IsNullOrWhiteSpace(parts[1]) == false ? parts[1] : DevCommit;
        return new VersionResponse(version, commit, string.IsNullOrWhiteSpace(buildDate) ? null : buildDate);
    }
}
