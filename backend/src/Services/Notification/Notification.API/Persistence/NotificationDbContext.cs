using BuildingBlocks.Messaging;
using NotificationService.Domain;
using Microsoft.EntityFrameworkCore;
// "Notification" is also a namespace in this project, so the entity needs an alias.
using NotificationEntity = NotificationService.Domain.Notification;

namespace NotificationService.Persistence;

public class NotificationDbContext(DbContextOptions<NotificationDbContext> options) : DbContext(options), IOutboxDbContext
{
    public DbSet<NotificationEntity> Notifications => Set<NotificationEntity>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("notification");
        modelBuilder.ApplyOutboxModule();

        modelBuilder.Entity<NotificationEntity>(b =>
        {
            b.ToTable("notifications");
            b.HasIndex(n => new { n.RecipientUserId, n.CreatedAt });
            b.HasIndex(n => new { n.RecipientUserId, n.Status });
            b.Property(n => n.Id).HasColumnName("id");
            b.Property(n => n.RecipientUserId).HasColumnName("recipient_user_id");
            b.Property(n => n.Type).HasColumnName("type");
            b.Property(n => n.ActorUserId).HasColumnName("actor_user_id");
            b.Property(n => n.TargetPostId).HasColumnName("target_post_id");
            b.Property(n => n.TargetCommentId).HasColumnName("target_comment_id");
            b.Property(n => n.Preview).HasColumnName("preview");
            b.Property(n => n.DeviceLabel).HasColumnName("device_label").HasMaxLength(120);
            b.Property(n => n.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
            b.Property(n => n.Location).HasColumnName("location").HasMaxLength(160);
            b.Property(n => n.Status).HasColumnName("status");
            b.Property(n => n.CreatedAt).HasColumnName("created_at");
            b.Property(n => n.ReadAt).HasColumnName("read_at");
        });
    }
}


