namespace Autograt.Api.Models;

/// <summary>
/// One saved value of a user's setting. A setting with no rows uses its default; settings that allow
/// several values (such as future notification times) have one row per value.
/// </summary>
public class UserSetting
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public Setting Setting { get; set; }

    public required string Value { get; set; }

    public User? User { get; set; }
}
