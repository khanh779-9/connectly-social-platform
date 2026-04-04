using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace BuildingBlocks.Messaging;

/// <summary>Transactional outbox row — written in the SAME DbContext transaction as domain changes.</summary>
public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventType { get; set; } = default!;
    /// <summary>Serialized EventEnvelope (payload included).</summary>
    public string Payload { get; set; } = default!;
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

/// <summary>Inbox row for consumer idempotency (at-least-once delivery => process once).</summary>
public class InboxMessage
{
    [Key]
    public Guid EventId { get; set; }
    public string EventType { get; set; } = default!;
    public DateTimeOffset ProcessedAt { get; set; }
}

public interface IOutboxDbContext
{
    Microsoft.EntityFrameworkCore.DbSet<OutboxMessage> OutboxMessages { get; }
    Microsoft.EntityFrameworkCore.DbSet<InboxMessage> InboxMessages { get; }
}

public sealed record MessagingOptions
{
    /// <summary>e.g. "identity", "chat" — used for queue naming.</summary>
    public required string ServiceName { get; init; }
    /// <summary>e.g. "connectly-identity" — stamped into event envelopes.</summary>
    public required string Producer { get; init; }
    public int OutboxDispatchBatchSize { get; init; }

    /// <summary>
    /// Tells whether an event type has a consumer today. False for fire-and-forget
    /// events: nobody subscribes to them, so a missing queue binding must not keep
    /// the row in the outbox forever. Defaults to "every event expects a consumer".
    /// </summary>
    public Func<string, bool>? ExpectsConsumer { get; init; }
}

public static class OutboxModelExtensions
{
    /// <summary>Adds the shared outbox/inbox tables to each service's model.</summary>
    public static void ApplyOutboxModule(this Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
    {
        var outbox = modelBuilder.Entity<OutboxMessage>();
        outbox.ToTable("outbox_messages");
        outbox.HasKey(m => m.Id);
        outbox.HasIndex(m => new { m.ProcessedAt, m.OccurredAt });
        outbox.Property(m => m.Id).HasColumnName("id");
        outbox.Property(m => m.EventType).HasColumnName("event_type");
        outbox.Property(m => m.Payload).HasColumnName("payload");
        outbox.Property(m => m.OccurredAt).HasColumnName("occurred_at");
        outbox.Property(m => m.ProcessedAt).HasColumnName("processed_at");
        outbox.Property(m => m.Attempts).HasColumnName("attempts");
        outbox.Property(m => m.LastError).HasColumnName("last_error");

        var inbox = modelBuilder.Entity<InboxMessage>();
        inbox.ToTable("inbox_messages");
        inbox.HasKey(m => m.EventId);
        inbox.Property(m => m.EventId).HasColumnName("event_id");
        inbox.Property(m => m.EventType).HasColumnName("event_type");
        inbox.Property(m => m.ProcessedAt).HasColumnName("processed_at");
    }
}

public static class OutboxExtensions
{
    /// <summary>
    /// Enqueues an integration event on the outbox. MUST be called inside the caller's
    /// SaveChanges/transaction so domain data + event commit atomically.
    /// </summary>
    public static void EnqueueEvent<TDb, TPayload>(this TDb db, string eventType, TPayload payload, string producer)
        where TDb : DbContext, IOutboxDbContext
    {
        var envelope = new Events.EventEnvelope
        {
            EventId = Guid.NewGuid(),
            EventType = eventType,
            OccurredAt = DateTimeOffset.UtcNow,
            Producer = producer,
            CorrelationId = Guid.NewGuid(),
            Payload = System.Text.Json.JsonSerializer.SerializeToElement(payload, Serialization.Json.Options)
        };
        db.OutboxMessages.Add(new OutboxMessage
        {
            EventType = eventType,
            Payload = System.Text.Json.JsonSerializer.Serialize(envelope, Serialization.Json.Options),
            OccurredAt = envelope.OccurredAt
        });
    }
}

