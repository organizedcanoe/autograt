using System.Diagnostics.CodeAnalysis;

namespace Autograt.Api.Services;

/// <summary>
/// The outcome of an operation that either succeeds with a value or conflicts with existing data.
/// </summary>
public sealed class ServiceResult<T> where T : class
{
    private ServiceResult(T? value) => Value = value;

    public T? Value { get; }

    [MemberNotNullWhen(false, nameof(Value))]
    public bool IsConflict => Value is null;

    public static ServiceResult<T> Success(T value) => new(value);

    public static ServiceResult<T> Conflict() => new(null);
}
