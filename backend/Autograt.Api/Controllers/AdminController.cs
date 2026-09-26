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
public class AdminController(UserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<List<UserResponse>> ListUsers() =>
        (await userService.ListAsync()).Select(UserResponse.From).ToList();

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id) =>
        ToActionResult(await userService.ApproveAsync(id), "Only pending users can be approved.");

    /// <remarks>The promoted user receives admin rights in tokens issued from their next login.</remarks>
    [HttpPost("{id:int}/promote")]
    public async Task<IActionResult> Promote(int id) =>
        ToActionResult(await userService.PromoteToAdminAsync(id), "Only approved, non-admin users can be promoted.");

    private IActionResult ToActionResult(ServiceResult<User> result, string invalidStateMessage) => result.Error switch
    {
        null => NoContent(),
        ServiceError.NotFound => NotFound(),
        ServiceError.InvalidState => BadRequest(new ProblemDetails { Title = invalidStateMessage }),
        _ => throw new InvalidOperationException($"Unexpected error: {result.Error}."),
    };
}
