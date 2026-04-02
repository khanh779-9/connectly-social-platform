using System.Text.Json;

namespace BuildingBlocks.Messaging.Events;

/// <summary>
/// Versioned event envelope shared across the platform:
/// { eventId, eventType, eventVersion, occurredAt, producer, correlationId, payload }
/// </summary>
public sealed record EventEnvelope
{
    public Guid EventId { get; init; }
    public string EventType { get; init; } = default!;
    public int EventVersion { get; init; } = 1;
    public DateTimeOffset OccurredAt { get; init; }
    public string Producer { get; init; } = default!;
    public Guid CorrelationId { get; init; }
    public JsonElement Payload { get; init; }
}

public sealed record EventContext(EventEnvelope Envelope);

public interface IIntegrationEventHandler
{
    /// <summary>
    /// Type-erased entry point. The consumer only learns the payload type at runtime, so
    /// it cannot call the generic method without reflection; this keeps the dispatch
    /// strongly typed instead of going through `dynamic`.
    /// </summary>
    Task HandleAsync(object payload, Microsoft.EntityFrameworkCore.DbContext db, EventContext ctx, CancellationToken ct);
}

/// <summary>
/// Base class for handlers. `TDb` (the owning service's DbContext) is passed into OnHandleAsync so the
/// consumer can wrap idempotency insert + handling in ONE transaction.
/// </summary>
public abstract class IntegrationEventHandler<TDb, TPayload> : IIntegrationEventHandler
    where TDb : Microsoft.EntityFrameworkCore.DbContext, IOutboxDbContext
{
    public abstract System.Threading.Tasks.Task OnHandleAsync(TPayload payload, TDb db, EventContext ctx, CancellationToken ct);

    Task IIntegrationEventHandler.HandleAsync(
        object payload,
        Microsoft.EntityFrameworkCore.DbContext db,
        EventContext ctx,
        CancellationToken ct) =>
        OnHandleAsync((TPayload)payload, (TDb)db, ctx, ct);
}

/// <summary>Marks a handler with the event type it consumes, e.g. `[EventHandler(EventTypes.Social.PostPublishedV1)]`.</summary>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public sealed class EventHandlerAttribute(string eventType) : Attribute
{
    public string EventType { get; } = eventType;
}

public sealed record RegisteredHandler(string EventType, Type PayloadType, Type HandlerType);

public static class EventHandlerConvention
{
    public static RegisteredHandler Describe(Type handlerType)
    {
        var attribute = handlerType.GetCustomAttributes(typeof(EventHandlerAttribute), inherit: false)
            .OfType<EventHandlerAttribute>().FirstOrDefault();
        if (attribute is null)
            throw new InvalidOperationException($"{handlerType.Name} must be marked with [EventHandler(...)].");

        // payload is 2nd generic arg of IntegrationEventHandler<TDb, TPayload>
        var baseType = handlerType;
        while (baseType is not null
               && (!baseType.IsGenericType
                   || baseType.GetGenericTypeDefinition() != typeof(IntegrationEventHandler<,>)))
            baseType = baseType.BaseType;
        if (baseType is null)
            throw new InvalidOperationException($"{handlerType.Name} must inherit IntegrationEventHandler<TDb, TPayload>.");

        var payloadType = baseType.GetGenericArguments()[1];
        return new RegisteredHandler(attribute.EventType, payloadType, handlerType);
    }

    public static object? DeserializePayload(RegisteredHandler handler, JsonElement payload, JsonSerializerOptions options)
    {
        var json = payload.GetRawText();
        return JsonSerializer.Deserialize(json, handler.PayloadType, options);
    }
}

