using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.RateLimiting;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Autograt.Api.Controllers;

/// <summary>Changes to the signed-in user's own account.</summary>
/// <remarks>
/// A wrong password is a 400, not a 401: the frontend treats any 401 as an expired session and logs out.
/// Endpoints that check a password share the login rate limit, so a stolen token can't be used to guess it.
/// </remarks>
[ApiController]
[Route("api/account")]
public class AccountController(AccountService accountService, TokenService tokenService, ILogger<AccountController> logger)
    : ControllerBase
{
    /// <returns>A new token for this session; every other session is signed out.</returns>
    [EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
    [HttpPut("password")]
    public async Task<ActionResult<LoginResponse>> ChangePassword(ChangePasswordRequest request)
    {
        if (request.NewPassword == request.CurrentPassword)
        {
            ModelState.AddModelError(nameof(request.NewPassword), "The new password must be different from the current one.");
            return ValidationProblem(ModelState);
        }

        var result = await accountService.ChangePasswordAsync(User.GetUserId(), request.CurrentPassword, request.NewPassword);
        if (result.IsSuccess == false)
        {
            return ToErrorResult(result.Error.Value);
        }

        logger.LogInformation("User {UserId} changed their password.", result.Value.Id);
        return CreateSession(result.Value);
    }

    /// <returns>A new token carrying the new username.</returns>
    [HttpPut("username")]
    public async Task<ActionResult<LoginResponse>> ChangeUsername(ChangeUsernameRequest request)
    {
        var result = await accountService.ChangeUsernameAsync(User.GetUserId(), request.Username);
        if (result.IsSuccess == false)
        {
            return ToErrorResult(result.Error.Value);
        }

        logger.LogInformation("User {UserId} changed their username to {Username}.", result.Value.Id, result.Value.Username);
        return CreateSession(result.Value);
    }

    /// <summary>Ends every session on every device, this one included.</summary>
    [HttpPost("sign-out-everywhere")]
    public async Task<IActionResult> SignOutEverywhere()
    {
        var result = await accountService.SignOutEverywhereAsync(User.GetUserId());
        if (result.IsSuccess == false)
        {
            return ToErrorResult(result.Error.Value);
        }

        logger.LogInformation("User {UserId} signed out everywhere.", result.Value.Id);
        return NoContent();
    }

    /// <summary>Deletes the account and all its data.</summary>
    [EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
    [HttpDelete]
    public async Task<IActionResult> Delete(DeleteAccountRequest request)
    {
        var result = await accountService.DeleteAsync(User.GetUserId(), request.Password);
        if (result.IsSuccess == false)
        {
            return ToErrorResult(result.Error.Value);
        }

        logger.LogInformation("User {UserId} deleted their account.", result.Value.Id);
        return NoContent();
    }

    private LoginResponse CreateSession(User user)
    {
        var (token, expiresAtUtc) = tokenService.CreateToken(user);
        return new LoginResponse(token, expiresAtUtc, UserResponse.From(user));
    }

    private ActionResult ToErrorResult(ServiceError error)
    {
        if (error == ServiceError.WrongPassword)
        {
            // A stolen token can't guess the password quietly.
            logger.LogWarning("User {UserId} entered the wrong password from {ClientIp}.", User.GetUserId(), HttpContext.GetClientIp());
        }

        return error switch
        {
            ServiceError.WrongPassword => BadRequest(new ProblemDetails { Title = "Current password is incorrect." }),
            ServiceError.Conflict => Conflict(new ProblemDetails { Title = "That username is already taken." }),
            ServiceError.InvalidState => BadRequest(new ProblemDetails { Title = "Promote another admin before deleting your account." }),
            // The user was deleted after the token was checked, e.g. by a request from another device.
            ServiceError.NotFound => Unauthorized(),
            _ => throw new InvalidOperationException($"Unexpected error: {error}."),
        };
    }
}
