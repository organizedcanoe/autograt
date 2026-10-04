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
public class AuthController(AuthService authService, UserService userService, TokenService tokenService, ILogger<AuthController> logger)
    : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
    [HttpPost("register")]
    public async Task<ActionResult<UserResponse>> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request.Username, request.Password);
        if (result.IsSuccess)
        {
            logger.LogInformation("User {UserId} registered as {Username} ({Role}) from {ClientIp}.",
                result.Value.Id, result.Value.Username, result.Value.Role, HttpContext.GetClientIp());
        }

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
            logger.LogWarning("Failed login for {Username} from {ClientIp}.",
                SecurityLogging.MaskUsername(request.Username), HttpContext.GetClientIp());
            return Unauthorized(new ProblemDetails { Title = "Invalid username or password." });
        }

        if (user.Role is UserRole.Pending or UserRole.Disabled)
        {
            logger.LogInformation("Refused login for {Role} user {UserId} from {ClientIp}.", user.Role, user.Id, HttpContext.GetClientIp());
            var title = user.Role == UserRole.Pending ? "Your account is awaiting admin approval." : "This account has been disabled.";
            return Problem(title: title, statusCode: StatusCodes.Status403Forbidden);
        }

        logger.LogInformation("User {UserId} logged in from {ClientIp}.", user.Id, HttpContext.GetClientIp());
        var (token, expiresAtUtc) = tokenService.CreateToken(user);
        return new LoginResponse(token, expiresAtUtc, UserResponse.From(user));
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await userService.FindAsync(User.GetUserId());
        return user is null ? Unauthorized() : UserResponse.From(user);
    }

    /// <returns>
    /// A new token for this session, so a session in use doesn't expire until <see cref="TokenService.MaxSessionAge"/>
    /// after logging in. Ended sessions, and tokens without a login time, are rejected with 401.
    /// </returns>
    [HttpPost("refresh")]
    public async Task<ActionResult<LoginResponse>> Refresh()
    {
        var user = await userService.FindAsync(User.GetUserId());
        var authTimeUtc = User.GetAuthTimeUtc();
        if (user is null || authTimeUtc is null || DateTime.UtcNow - authTimeUtc.Value >= TokenService.MaxSessionAge)
        {
            return Unauthorized();
        }

        var (token, expiresAtUtc) = tokenService.CreateToken(user, authTimeUtc.Value);
        return new LoginResponse(token, expiresAtUtc, UserResponse.From(user));
    }
}
