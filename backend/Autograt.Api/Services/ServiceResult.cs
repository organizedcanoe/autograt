using System.Diagnostics.CodeAnalysis;

namespace Autograt.Api.Services;

/// <summary>Why a service operation could not complete.</summary>
public enum ServiceError
{
    /// <summary>The record does not exist or belongs to another user.</summary>
    NotFound,

    /// <summary>The operation conflicts with existing data.</summary>
    Conflict,

    /// <summary>The record belongs to a past day, which can no longer be changed.</summary>
    ReadOnly,

    /// <summary>The record is not in a state that allows the operation.</summary>
    InvalidState,

    /// <summary>The password given to confirm the operation is wrong.</summary>
    WrongPassword,
}

/// <summary>
/// The outcome of an operation that either succeeds with a value or fails with a <see cref="ServiceError"/>.
/// </summary>
public sealed class ServiceResult<T> where T : class
{
    private ServiceResult(T? value, ServiceError? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }

    public ServiceError? Error { get; }

    [MemberNotNullWhen(true, nameof(Value))]
    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => Error is null;

    public bool IsConflict => Error == ServiceError.Conflict;

    public static ServiceResult<T> Success(T value) => new(value, null);

    public static ServiceResult<T> Failure(ServiceError error) => new(null, error);

    public static ServiceResult<T> Conflict() => Failure(ServiceError.Conflict);
}
