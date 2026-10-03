using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Models;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autograt.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = AuthClaims.AdminRole)]
public class AdminController(UserService userService, AccountService accountService, ILogger<AdminController> logger)
    : ControllerBase
{
    [HttpGet]
    public async Task<List<UserResponse>> ListUsers() =>
        (await userService.ListAsync()).Select(UserResponse.From).ToList();

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id) =>
        ToActionResult(id, "approved", await userService.ApproveAsync(id), "Only pending users can be approved.");

    [HttpPost("{id:int}/promote")]
    public async Task<IActionResult> Promote(int id) =>
        ToActionResult(id, "promoted to admin", await userService.PromoteToAdminAsync(id), "Only standard users can be promoted.");

    [HttpPost("{id:int}/demote")]
    public async Task<IActionResult> Demote(int id)
    {
        if (id == User.GetUserId())
        {
            return BadRequest(new ProblemDetails { Title = "Another admin must demote you." });
        }

        return ToActionResult(id, "demoted to standard", await userService.DemoteToStandardAsync(id), "Only admins can be demoted, and not the last one.");
    }

    [HttpPost("{id:int}/disable")]
    public async Task<IActionResult> Disable(int id) =>
        ToActionResult(id, "disabled", await userService.DisableAsync(id), "Only standard users can be disabled. Demote admins first.");

    [HttpPost("{id:int}/enable")]
    public async Task<IActionResult> Enable(int id) =>
        ToActionResult(id, "enabled", await userService.EnableAsync(id), "Only disabled users can be enabled.");

    /// <summary>Deletes a pending, standard or disabled user and all their data.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id) =>
        ToActionResult(id, "deleted", await userService.DeleteAsync(id), "Admins can't be deleted. Demote them first.");

    /// <summary>
    /// Sets a random temporary password for an approved user, signs them out everywhere, and makes them choose
    /// a new password after logging in. The temporary password is only ever returned here.
    /// </summary>
    [HttpPost("{id:int}/reset-password")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(int id)
    {
        if (id == User.GetUserId())
        {
            return BadRequest(new ProblemDetails { Title = "Use Settings to change your own password." });
        }

        var result = await accountService.ResetPasswordAsync(id);
        if (result.IsSuccess)
        {
            logger.LogInformation("Admin {AdminId} reset the password of user {UserId}.", User.GetUserId(), id);
        }

        return result.Error switch
        {
            null => new ResetPasswordResponse(result.Value!),
            ServiceError.NotFound => NotFound(),
            ServiceError.InvalidState => BadRequest(new ProblemDetails { Title = "Pending users can't have their password reset." }),
            _ => throw new InvalidOperationException($"Unexpected error: {result.Error}."),
        };
    }

    /// <param name="action">What was done to the user, for the log, e.g. "approved".</param>
    private IActionResult ToActionResult(int userId, string action, ServiceResult<User> result, string invalidStateMessage)
    {
        if (result.IsSuccess)
        {
            logger.LogInformation("Admin {AdminId} {Action} user {UserId}.", User.GetUserId(), action, userId);
        }

        return result.Error switch
        {
            null => NoContent(),
            ServiceError.NotFound => NotFound(),
            ServiceError.InvalidState => BadRequest(new ProblemDetails { Title = invalidStateMessage }),
            _ => throw new InvalidOperationException($"Unexpected error: {result.Error}."),
        };
    }
}
