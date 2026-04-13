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

