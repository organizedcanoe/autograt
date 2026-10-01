using System.Text;
using System.Text.Json;
using Autograt.Api.Auth;
using Autograt.Api.Contracts;
using Autograt.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Autograt.Api.Controllers;

/// <summary>Exports the signed-in user's journal, and imports one back into their account.</summary>
[ApiController]
[Route("api")]
public class ExportController(
    ExportService exportService,
    ImportService importService,
    IOptions<JsonOptions> jsonOptions,
    TimeProvider timeProvider) : ControllerBase
{
    /// <summary>Large enough for decades of daily entries; nginx allows the same for this path.</summary>
    private const long MaxImportBytes = 25 * 1024 * 1024;

    /// <param name="format">"json" (re-importable) or "markdown" (for reading only).</param>
    [HttpGet("export")]
    public async Task<IActionResult> Export(string? format)
    {
        if (format is not ("json" or "markdown"))
        {
            ModelState.AddModelError(nameof(format), "Choose a format: json or markdown.");
            return ValidationProblem(ModelState);
        }

        var export = await exportService.BuildAsync(User.GetUserId());
        if (export is null)
        {
            return NotFound();
        }

        var fileName = $"autograt-{export.Username}-{timeProvider.GetUtcNow():yyyy-MM-dd}";
        if (format == "json")
        {
            var options = new JsonSerializerOptions(jsonOptions.Value.JsonSerializerOptions) { WriteIndented = true };
            return File(JsonSerializer.SerializeToUtf8Bytes(export, options), "application/json", $"{fileName}.json");
        }

        return File(Encoding.UTF8.GetBytes(ExportService.ToMarkdown(export)), "text/markdown; charset=utf-8", $"{fileName}.md");
    }

    /// <summary>Imports a JSON export. Days and settings in the file replace the user's; nothing else changes.</summary>
    [HttpPost("import")]
    [RequestSizeLimit(MaxImportBytes)]
    public async Task<ActionResult<ImportResponse>> Import(JournalExport file)
    {
        var problems = importService.Validate(file);
        if (problems.Count > 0)
        {
            foreach (var problem in problems)
            {
                ModelState.AddModelError(problem.Field, problem.Message);
            }

            return ValidationProblem(ModelState);
        }

        return await importService.ImportAsync(User.GetUserId(), file);
    }
}
