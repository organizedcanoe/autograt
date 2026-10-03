using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Autograt.Tests.Infrastructure;

/// <summary>Captures the API's log messages so tests can check what was logged.</summary>
public sealed class TestLogs : ILoggerProvider
{
    private readonly ConcurrentQueue<LogEntry> _entries = new();

    public IReadOnlyList<LogEntry> Entries => _entries.ToList();

    public ILogger CreateLogger(string categoryName) => new Logger(categoryName, _entries);

    public void Dispose()
    {
    }

    public sealed record LogEntry(string Category, LogLevel Level, string Message);

    private sealed class Logger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception)));
    }
}
