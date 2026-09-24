using Autograt.Api.Auth;
using Autograt.Api.Contracts;
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

    /// <remarks>The promoted user receives admin rights in tokens issued from their next login.</remarks>
    [HttpPost("{id:int}/promote")]
    public async Task<IActionResult> Promote(int id) =>
        await userService.PromoteToAdminAsync(id) ? NoContent() : NotFound();
}
