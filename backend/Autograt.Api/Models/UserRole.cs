namespace Autograt.Api.Models;

public enum UserRole
{
    /// <summary>Registered but not yet approved by an admin; cannot log in.</summary>
    Pending = 0,
    Standard = 1,
    Admin = 2,
}
