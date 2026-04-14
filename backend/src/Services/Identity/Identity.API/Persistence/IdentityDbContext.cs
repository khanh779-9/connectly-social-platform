using Identity.Domain;
using BuildingBlocks.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Identity.Persistence;

public class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options), IOutboxDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserPreferences> UserPreferences => Set<UserPreferences>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("identity");
        modelBuilder.ApplyOutboxModule();

        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasIndex(u => u.Email).IsUnique();
            b.Property(u => u.Id).HasColumnName("id");
            b.Property(u => u.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            b.Property(u => u.DisplayName).HasColumnName("display_name").HasMaxLength(120).IsRequired();
            b.Property(u => u.PasswordHash).HasColumnName("password_hash").IsRequired();
            b.Property(u => u.Status).HasColumnName("status").HasMaxLength(20);
            b.Property(u => u.CreatedAt).HasColumnName("created_at");
            b.Property(u => u.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.ToTable("refresh_tokens");
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => t.UserId);
            b.Property(t => t.Id).HasColumnName("id");
            b.Property(t => t.UserId).HasColumnName("user_id");
            b.Property(t => t.TokenHash).HasColumnName("token_hash");
            b.Property(t => t.ExpiresAt).HasColumnName("expires_at");
            b.Property(t => t.CreatedAt).HasColumnName("created_at");
            b.Property(t => t.RevokedAt).HasColumnName("revoked_at");
            b.Property(t => t.DeviceId).HasColumnName("device_id").HasMaxLength(64);
            b.Property(t => t.DeviceLabel).HasColumnName("device_label").HasMaxLength(120);
            b.Property(t => t.UserAgent).HasColumnName("user_agent").HasMaxLength(400);
            b.Property(t => t.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
            b.Property(t => t.Location).HasColumnName("location").HasMaxLength(160);
            b.Property(t => t.LastUsedAt).HasColumnName("last_used_at");
            b.HasIndex(t => new { t.UserId, t.DeviceId });
            b.HasOne(t => t.User).WithMany(u => u.RefreshTokens).HasForeignKey(t => t.UserId);
        });

        modelBuilder.Entity<UserPreferences>(b =>
        {
            b.ToTable("user_preferences");
            b.HasKey(p => p.UserId);
            b.Property(p => p.UserId).HasColumnName("user_id");
            b.Property(p => p.Theme).HasColumnName("theme").HasMaxLength(16).IsRequired();
            b.Property(p => p.CreatedAt).HasColumnName("created_at");
            b.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            b.HasOne(p => p.User).WithOne().HasForeignKey<UserPreferences>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

