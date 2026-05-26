using BuildingBlocks.Messaging;
using Chat.Domain;
using Microsoft.EntityFrameworkCore;

namespace Chat.Persistence;

public class ChatDbContext(DbContextOptions<ChatDbContext> options) : DbContext(options), IOutboxDbContext
{
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
    public DbSet<MessageHiddenForUser> HiddenMessages => Set<MessageHiddenForUser>();
    public DbSet<BlockedPairProjection> BlockedPairs => Set<BlockedPairProjection>();
    public DbSet<ChatUserSettings> UserSettings => Set<ChatUserSettings>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("chat");
        modelBuilder.ApplyOutboxModule();

        modelBuilder.Entity<Conversation>(b =>
        {
            b.ToTable("conversations");
            b.Property(c => c.Id).HasColumnName("id");
            b.Property(c => c.Type).HasColumnName("type").HasMaxLength(10);
            b.Property(c => c.Title).HasColumnName("title");
            b.Property(c => c.CreatedByUserId).HasColumnName("created_by_user_id");
            b.Property(c => c.CreatedAt).HasColumnName("created_at");
            b.Property(c => c.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<ConversationMember>(b =>
        {
            b.ToTable("conversation_members");
            b.HasKey(x => new { x.ConversationId, x.UserId });
            b.HasIndex(x => x.UserId);
            b.Property(x => x.ConversationId).HasColumnName("conversation_id");
            b.Property(x => x.UserId).HasColumnName("user_id");
            b.Property(x => x.JoinedAt).HasColumnName("joined_at");
            b.Property(x => x.Role).HasColumnName("role");
            b.Property(x => x.LastReadAt).HasColumnName("last_read_at");
            b.Property(x => x.LastAckedMessageAt).HasColumnName("last_acked_message_at");
            b.HasOne(x => x.Conversation).WithMany(c => c.Members).HasForeignKey(x => x.ConversationId);
        });

        modelBuilder.Entity<Message>(b =>
        {
            b.ToTable("messages");
            b.HasIndex(m => new { m.ConversationId, m.SentAt });
            b.HasIndex(m => m.SenderUserId);
            b.Property(m => m.Id).HasColumnName("id");
            b.Property(m => m.ConversationId).HasColumnName("conversation_id");
            b.Property(m => m.SenderUserId).HasColumnName("sender_user_id");
            b.Property(m => m.Body).HasColumnName("body").HasMaxLength(8000);
            b.Property(m => m.Status).HasColumnName("status");
            b.Property(m => m.SentAt).HasColumnName("sent_at");
            b.Property(m => m.EditedAt).HasColumnName("edited_at");
            b.Property(m => m.DeletedAt).HasColumnName("deleted_at");
            b.Property(m => m.ReplyToMessageId).HasColumnName("reply_to_message_id");
            b.HasIndex(m => m.ReplyToMessageId);
            b.HasOne(m => m.ReplyToMessage).WithMany().HasForeignKey(m => m.ReplyToMessageId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MessageAttachment>(b =>
        {
            b.ToTable("message_attachments");
            b.HasKey(a => a.Id);
            b.HasIndex(a => a.MessageId);
            b.Property(a => a.Id).HasColumnName("id");
            b.Property(a => a.MessageId).HasColumnName("message_id");
            b.Property(a => a.ObjectKey).HasColumnName("object_key");
            b.Property(a => a.ContentType).HasColumnName("content_type");
            b.Property(a => a.SizeBytes).HasColumnName("size_bytes");
            b.Property(a => a.FileName).HasColumnName("file_name");
            b.HasOne(a => a.Message).WithMany(m => m.Attachments).HasForeignKey(a => a.MessageId);
        });

        modelBuilder.Entity<MessageReaction>(b =>
        {
            b.ToTable("message_reactions");
            b.HasKey(x => new { x.MessageId, x.UserId, x.ReactionType });
            b.HasIndex(x => x.MessageId);
            b.HasIndex(x => x.UserId);
            b.Property(x => x.MessageId).HasColumnName("message_id");
            b.Property(x => x.UserId).HasColumnName("user_id");
            b.Property(x => x.ReactionType).HasColumnName("reaction_type").HasMaxLength(16);
            b.Property(x => x.CreatedAt).HasColumnName("created_at");
            b.HasOne(x => x.Message).WithMany(m => m.Reactions).HasForeignKey(x => x.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MessageHiddenForUser>(b =>
        {
            b.ToTable("message_hidden_for_users");
            b.HasKey(x => new { x.MessageId, x.UserId });
            b.HasIndex(x => x.UserId);
            b.Property(x => x.MessageId).HasColumnName("message_id");
            b.Property(x => x.UserId).HasColumnName("user_id");
            b.Property(x => x.HiddenAt).HasColumnName("hidden_at");
            b.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BlockedPairProjection>(b =>
        {
            b.ToTable("blocked_pair_projections");
            b.HasKey(x => new { x.BlockerId, x.BlockedUserId });
            b.Property(x => x.BlockerId).HasColumnName("blocker_id");
            b.Property(x => x.BlockedUserId).HasColumnName("blocked_user_id");
            b.Property(x => x.BlockedAt).HasColumnName("blocked_at");
        });

        modelBuilder.Entity<ChatUserSettings>(b =>
        {
            b.ToTable("chat_user_settings");
            b.HasKey(x => x.UserId);
            b.Property(x => x.UserId).HasColumnName("user_id");
            b.Property(x => x.MessagePrivacy).HasColumnName("message_privacy").HasMaxLength(16);
            b.Property(x => x.CreatedAt).HasColumnName("created_at");
            b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });
    }
}

