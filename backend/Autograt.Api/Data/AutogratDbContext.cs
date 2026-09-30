using Autograt.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Autograt.Api.Data;

public class AutogratDbContext(DbContextOptions<AutogratDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();

    public DbSet<JournalSubEntry> JournalSubEntries => Set<JournalSubEntry>();

    public DbSet<JournalAppend> JournalAppends => Set<JournalAppend>();

    public DbSet<UserSetting> UserSettings => Set<UserSetting>();

    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampCreatedAtUtc();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampCreatedAtUtc();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            user.ToTable("User");
            user.Property(u => u.Username).IsRequired().UseCollation("NOCASE");
            user.HasIndex(u => u.Username).IsUnique();
            user.Property(u => u.PasswordHash).IsRequired();
            user.Property(u => u.Role).HasDefaultValue(UserRole.Pending);
        });

        modelBuilder.Entity<JournalEntry>(entry =>
        {
            entry.ToTable("JournalEntry", table =>
                table.HasCheckConstraint("CK_JournalEntry_DayRating", "\"DayRating\" BETWEEN 0 AND 10"));
            entry.HasIndex(e => new { e.UserId, e.EntryDate }).IsUnique();
            entry.HasOne(e => e.User)
                .WithMany(u => u.JournalEntries)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JournalSubEntry>(subEntry =>
        {
            subEntry.ToTable("JournalSubEntry");
            subEntry.Property(s => s.Content).IsRequired();
            subEntry.HasOne(s => s.JournalEntry)
                .WithMany(e => e.SubEntries)
                .HasForeignKey(s => s.JournalEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JournalAppend>(append =>
        {
            append.ToTable("JournalAppend");
            append.Property(a => a.Content).IsRequired();
            append.HasOne(a => a.JournalSubEntry)
                .WithMany(s => s.Appends)
                .HasForeignKey(a => a.JournalSubEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSetting>(setting =>
        {
            setting.ToTable("UserSetting");
            setting.Property(s => s.Value).IsRequired();
            setting.HasIndex(s => new { s.UserId, s.Setting });
            setting.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PushSubscription>(subscription =>
        {
            subscription.ToTable("PushSubscription");
            subscription.Property(s => s.Endpoint).IsRequired();
            subscription.HasIndex(s => s.Endpoint).IsUnique();
            subscription.Property(s => s.P256dh).IsRequired();
            subscription.Property(s => s.Auth).IsRequired();
            subscription.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void StampCreatedAtUtc()
    {
        var now = DateTime.UtcNow;
        // A timestamp that is already set, such as one from an imported file, is kept.
        foreach (var entry in ChangeTracker.Entries<ICreatedAtUtc>()
                     .Where(e => e.State == EntityState.Added && e.Entity.CreatedAtUtc == default))
        {
            entry.Entity.CreatedAtUtc = now;
        }
    }

    /// <summary>
    /// SQLite stores DateTime as text without a kind, so values read back are marked as UTC explicitly.
    /// </summary>
    private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
        value => value,
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
