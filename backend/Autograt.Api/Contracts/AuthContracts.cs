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

public sealed record UserResponse(int Id, string Username, UserRole Role)
{
    public static UserResponse From(User user) => new(user.Id, user.Username, user.Role);
}

public sealed record LoginResponse(string Token, DateTime ExpiresAtUtc, UserResponse User);
