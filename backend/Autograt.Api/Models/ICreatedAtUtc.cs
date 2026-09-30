namespace Autograt.Api.Models;

/// <summary>
/// Marks an entity whose creation timestamp is stamped automatically by <see cref="Data.AutogratDbContext"/>
/// when it is added, unless it is already set.
/// </summary>
public interface ICreatedAtUtc
{
    DateTime CreatedAtUtc { get; set; }
}
