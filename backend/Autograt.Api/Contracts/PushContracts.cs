using System.ComponentModel.DataAnnotations;

namespace Autograt.Api.Contracts;

public sealed record PushPublicKeyResponse(string PublicKey);

/// <summary>A browser's push subscription, in the shape of the Push API's <c>PushSubscription.toJSON()</c>.</summary>
public sealed record SubscribePushRequest : IValidatableObject
{
    [Required]
    public string Endpoint { get; init; } = "";

    [Required]
    public PushKeys? Keys { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // Browsers only hand out HTTPS push endpoints; anything else is not a real subscription.
        if (Uri.TryCreate(Endpoint, UriKind.Absolute, out var uri) == false || uri.Scheme != Uri.UriSchemeHttps)
        {
            yield return new ValidationResult("The endpoint must be an HTTPS URL.", [nameof(Endpoint)]);
        }
    }
}

public sealed record PushKeys
{
    [Required]
    public string P256dh { get; init; } = "";

    [Required]
    public string Auth { get; init; } = "";
}

public sealed record UnsubscribePushRequest
{
    [Required]
    public string Endpoint { get; init; } = "";
}
