namespace Autograt.Api.Models;

/// <summary>
/// Marks an entity whose creation timestamp is stamped automatically by <see cref="Data.AutogratDbContext"/>.
/// </summary>
public interface ICreatedAtUtc
{
    DateTime CreatedAtUtc { get; set; }
}
