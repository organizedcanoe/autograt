namespace Autograt.Tests.Infrastructure;

/// <summary>A <see cref="Random"/> that returns the given values in order, then 0, so picks are predictable.</summary>
public sealed class FakeRandom(params int[] values) : Random
{
    private readonly Queue<int> _values = new(values);

    public override int Next(int maxValue)
    {
        var value = _values.Count > 0 ? _values.Dequeue() : 0;
        if (value >= maxValue)
        {
            throw new InvalidOperationException($"Fake value {value} is not below {maxValue}.");
        }

        return value;
    }
}
