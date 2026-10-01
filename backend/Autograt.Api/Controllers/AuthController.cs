using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.RateLimiting;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Autograt.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService, UserService userService, TokenService tokenService) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
    [HttpPost("register")]
    public async Task<ActionResult<UserResponse>> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request.Username, request.Password);
        return result.Error switch
        {
            null => CreatedAtAction(nameof(Me), UserResponse.From(result.Value!)),
            ServiceError.Conflict => Conflict(new ProblemDetails { Title = "That username is already taken." }),
            ServiceError.InvalidState => Problem(title: "Registration is closed.", statusCode: StatusCodes.Status403Forbidden),
            _ => throw new InvalidOperationException($"Unexpected error: {result.Error}."),
        };
    }

    [AllowAnonymous]
    [HttpGet("registration")]
    public async Task<RegistrationStatusResponse> Registration() => new(await authService.IsRegistrationOpenAsync());

    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await authService.ValidateCredentialsAsync(request.Username, request.Password);
        if (user is null)
        {
            return Unauthorized(new ProblemDetails { Title = "Invalid username or password." });
        }

        if (user.Role == UserRole.Pending)
        {
            return Problem(title: "Your account is awaiting admin approval.", statusCode: StatusCodes.Status403Forbidden);
        }

        if (user.Role == UserRole.Disabled)
        {
            return Problem(title: "This account has been disabled.", statusCode: StatusCodes.Status403Forbidden);
        }

        var (token, expiresAtUtc) = tokenService.CreateToken(user);
        return new LoginResponse(token, expiresAtUtc, UserResponse.From(user));
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await userService.FindAsync(User.GetUserId());
        return user is null ? Unauthorized() : UserResponse.From(user);
    }
}
