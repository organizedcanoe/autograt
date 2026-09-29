using Autograt.Api.Services;

namespace Autograt.Tests.Services;

public class ReminderScheduleTests
{
    private static readonly TimeZoneInfo Toronto = TimeZoneInfo.FindSystemTimeZoneById("America/Toronto");
    private static readonly TimeZoneInfo Tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
    private static readonly TimeOnly[] NoonAndEvening = [new(12, 0), new(20, 0)];

    [Theory]
    [InlineData(12, 0)]
    [InlineData(12, 7)]
    [InlineData(12, 15)]
    public void WithinGraceWindow_IsDue(int hour, int minute)
    {
        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, hour, minute), TimeZoneInfo.Utc, NoonAndEvening, lastSentUtc: null);

        Assert.NotNull(slot);
        Assert.Equal(Utc(2026, 9, 23, 12, 0), slot.Utc);
        Assert.Equal(new DateOnly(2026, 9, 23), slot.LocalDate);
    }

    [Theory]
    [InlineData(11, 59)]
    [InlineData(12, 16)]
    [InlineData(19, 0)]
    public void BeforeASlotOrAfterItsWindow_IsNotDue(int hour, int minute)
    {
        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, hour, minute), TimeZoneInfo.Utc, NoonAndEvening, lastSentUtc: null);

        Assert.Null(slot);
    }

    [Fact]
    public void AlreadySent_IsNotDueAgain()
    {
        var slot = ReminderSchedule.GetDueSlot(
            Utc(2026, 9, 23, 12, 5), TimeZoneInfo.Utc, NoonAndEvening, lastSentUtc: Utc(2026, 9, 23, 12, 0));

        Assert.Null(slot);
    }

    [Fact]
    public void SentOnAnEarlierSlot_IsDue()
    {
        var slot = ReminderSchedule.GetDueSlot(
            Utc(2026, 9, 23, 12, 5), TimeZoneInfo.Utc, NoonAndEvening, lastSentUtc: Utc(2026, 9, 22, 20, 0));

        Assert.NotNull(slot);
    }

    [Fact]
    public void TimeZoneBehindUtc_UsesLocalTime()
    {
        // Toronto is UTC−4 in September, so noon there is 16:00 UTC.
        Assert.Null(ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, 12, 5), Toronto, NoonAndEvening, null));

        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, 16, 5), Toronto, NoonAndEvening, null);

        Assert.Equal(Utc(2026, 9, 23, 16, 0), slot?.Utc);
    }

    [Fact]
    public void TimeZoneAheadOfUtc_UsesLocalDate()
    {
        // 20:00 in Tokyo (UTC+9) on the 24th is 11:00 UTC on the 24th; noon on the 24th is 03:00 UTC.
        var evening = ReminderSchedule.GetDueSlot(Utc(2026, 9, 24, 11, 0), Tokyo, NoonAndEvening, null);
        var noon = ReminderSchedule.GetDueSlot(Utc(2026, 9, 24, 3, 10), Tokyo, NoonAndEvening, null);

        Assert.Equal(Utc(2026, 9, 24, 11, 0), evening?.Utc);
        Assert.Equal(new DateOnly(2026, 9, 24), evening?.LocalDate);
        Assert.Equal(Utc(2026, 9, 24, 3, 0), noon?.Utc);
    }

    [Fact]
    public void SeveralSlotsInTheWindow_PicksTheLatest()
    {
        TimeOnly[] times = [new(12, 0), new(12, 10), new(20, 0)];

        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, 12, 12), TimeZoneInfo.Utc, times, null);

        Assert.Equal(Utc(2026, 9, 23, 12, 10), slot?.Utc);
        Assert.False(slot?.IsLastOfDay);
    }

    [Fact]
    public void LastSlotOfTheDay_IsMarked_WhateverTheOrderOfTimes()
    {
        TimeOnly[] times = [new(20, 0), new(12, 0)];

        var evening = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, 20, 1), TimeZoneInfo.Utc, times, null);
        var noon = ReminderSchedule.GetDueSlot(Utc(2026, 9, 23, 12, 1), TimeZoneInfo.Utc, times, null);

        Assert.True(evening?.IsLastOfDay);
        Assert.False(noon?.IsLastOfDay);
    }

    [Fact]
    public void SlotJustBeforeMidnight_IsDueAfterMidnight_ForThePreviousDay()
    {
        TimeOnly[] times = [new(23, 55)];

        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 9, 24, 0, 5), TimeZoneInfo.Utc, times, null);

        Assert.Equal(Utc(2026, 9, 23, 23, 55), slot?.Utc);
        Assert.Equal(new DateOnly(2026, 9, 23), slot?.LocalDate);
    }

    [Fact]
    public void DaylightSavingStart_ShiftsTheOffset()
    {
        // Toronto moves from UTC−5 to UTC−4 on 2026-03-08; noon that day is 16:00 UTC, the day before 17:00 UTC.
        var before = ReminderSchedule.GetDueSlot(Utc(2026, 3, 7, 17, 0), Toronto, NoonAndEvening, null);
        var after = ReminderSchedule.GetDueSlot(Utc(2026, 3, 8, 16, 0), Toronto, NoonAndEvening, null);

        Assert.Equal(Utc(2026, 3, 7, 17, 0), before?.Utc);
        Assert.Equal(Utc(2026, 3, 8, 16, 0), after?.Utc);
    }

    [Fact]
    public void SlotInTheSkippedHour_IsSentWhenTheClockJumpsPastIt()
    {
        // 02:30 doesn't exist in Toronto on 2026-03-08: 02:00 EST jumps to 03:00 EDT (07:00 UTC).
        TimeOnly[] times = [new(2, 30)];

        var slot = ReminderSchedule.GetDueSlot(Utc(2026, 3, 8, 7, 35), Toronto, times, null);

        Assert.Equal(Utc(2026, 3, 8, 7, 30), slot?.Utc);
    }

    [Fact]
    public void SlotInTheRepeatedHour_IsSentOnlyOnce()
    {
        // 01:30 happens twice in Toronto on 2026-11-01: at 05:30 UTC (EDT) and again at 06:30 UTC (EST).
        TimeOnly[] times = [new(1, 30)];

        var first = ReminderSchedule.GetDueSlot(Utc(2026, 11, 1, 5, 35), Toronto, times, null);
        var repeat = ReminderSchedule.GetDueSlot(Utc(2026, 11, 1, 6, 35), Toronto, times, lastSentUtc: first?.Utc);

        Assert.Equal(Utc(2026, 11, 1, 5, 30), first?.Utc);
        Assert.Null(repeat);
    }

    private static DateTime Utc(int year, int month, int day, int hour, int minute) =>
        new(year, month, day, hour, minute, 0, DateTimeKind.Utc);
}
