using System.ComponentModel.DataAnnotations;
using Autograt.Api.Models;

namespace Autograt.Api.Contracts;

public sealed record RegisterRequest
{
    [Required, StringLength(50)]
    public string Username { get; init; } = "";

    [Required, MinLength(8)]
    public string Password { get; init; } = "";
}

public sealed record LoginRequest
{
    [Required]
    public string Username { get; init; } = "";

    [Required]
    public string Password { get; init; } = "";
}

public sealed record UserResponse(int Id, string Username, UserRole Role, bool MustChangePassword)
{
    public static UserResponse From(User user) => new(user.Id, user.Username, user.Role, user.MustChangePassword);
}

public sealed record LoginResponse(string Token, DateTime ExpiresAtUtc, UserResponse User);

public sealed record ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; init; } = "";

    [Required, MinLength(8)]
    public string NewPassword { get; init; } = "";
}

public sealed record ChangeUsernameRequest
{
    [Required, StringLength(50)]
    public string Username { get; init; } = "";
}

public sealed record DeleteAccountRequest
{
    [Required]
    public string Password { get; init; } = "";
}

/// <summary>The temporary password an admin set for a user. It is only ever shown in this response.</summary>
public sealed record ResetPasswordResponse(string TemporaryPassword);
