using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService, UserService userService, TokenService tokenService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<UserResponse>> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request.Username, request.Password);
        if (result.IsSuccess == false)
        {
            return Conflict(new ProblemDetails { Title = "That username is already taken." });
        }

        return CreatedAtAction(nameof(Me), UserResponse.From(result.Value));
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await authService.ValidateCredentialsAsync(request.Username, request.Password);
        if (user is null)
        {
            return Unauthorized(new ProblemDetails { Title = "Invalid username or password." });
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
