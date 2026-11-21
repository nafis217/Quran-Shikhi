namespace QuranShikkha.Core.Srs;

/// <summary>SM-2 style scheduler. Quality 0..5; below 3 resets repetitions.</summary>
public static class Sm2
{
    public record State(double Ease, int IntervalDays, int Repetitions);

    public static State Next(State s, int quality)
    {
        if (quality is < 0 or > 5) throw new ArgumentOutOfRangeException(nameof(quality));
        if (quality < 3) return new State(Math.Max(1.3, s.Ease - 0.2), 1, 0);

        var reps = s.Repetitions + 1;
        var interval = reps switch
        {
            1 => 1,
            2 => 6,
            _ => (int)Math.Round(s.IntervalDays * s.Ease)
        };
        var ease = s.Ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        return new State(Math.Max(1.3, ease), Math.Max(1, interval), reps);
    }
}
