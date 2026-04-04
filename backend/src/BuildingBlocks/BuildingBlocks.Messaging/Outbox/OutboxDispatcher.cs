using BuildingBlocks.Env;
using BuildingBlocks.Messaging.Events;
using BuildingBlocks.Messaging.Publishing;
using BuildingBlocks.Messaging.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BuildingBlocks.Messaging.Outbox;

/// <summary>
/// Reads pending outbox rows and publishes them to RabbitMQ.
/// Publication happens before marking processed — crash in between may duplicate an
/// event, therefore consumers MUST be idempotent (inbox table).
/// </summary>
public sealed class OutboxDispatcher<TDb> : BackgroundService where TDb : DbContext, IOutboxDbContext
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MessagingOptions _options;
    private readonly ILogger<OutboxDispatcher<TDb>> _logger;

    public OutboxDispatcher(IServiceScopeFactory scopeFactory, MessagingOptions options, ILogger<OutboxDispatcher<TDb>> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Outbox dispatcher started for {Service}", _options.ServiceName);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var published = await DispatchBatchAsync(stoppingToken);
                // a partial batch means the dispatcher stopped on a failing row:
                // wait before the next pass so a poison event does not spin the loop.
                if (published < _options.OutboxDispatchBatchSize)
                    await Task.Delay(ConnectlyEnv.OutboxIdleDelay(), stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Outbox dispatch loop failed");
                try { await Task.Delay(ConnectlyEnv.OutboxRetryDelay(), stoppingToken); } catch (OperationCanceledException) { break; }
            }
        }
    }

    private async Task<int> DispatchBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TDb>();
        var publisher = scope.ServiceProvider.GetRequiredService<IRabbitEventPublisher>();

        var pending = await db.OutboxMessages
            .Where(m => m.ProcessedAt == null)
            .OrderBy(m => m.OccurredAt)
            .Take(_options.OutboxDispatchBatchSize)
            .ToListAsync(ct);
        if (pending.Count == 0) return 0;

        var published = 0;
        foreach (var message in pending)
        {
            try
            {
                // events that intentionally have no consumer today are fire-and-forget:
                // there is no queue to deliver to, so a missing binding must not keep
                // the row in the outbox forever
                var expectsConsumer = _options.ExpectsConsumer?.Invoke(message.EventType) ?? true;
                await publisher.EnvelopePublishAsync(message.EventType, message.Payload, expectsConsumer);
                message.ProcessedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
                published++;
            }
            catch (Exception ex)
            {
                message.Attempts++;
                message.LastError = ex.Message[..Math.Min(ex.Message.Length, 500)];
                await db.SaveChangesAsync(ct);
                _logger.LogWarning(ex, "Outbox publish attempt {Attempt} failed for {EventType}", message.Attempts, message.EventType);
                // stop the batch: the next pass retries this row, so a failing event
                // does not spin the dispatcher at full speed
                break;
            }
        }
        return published;
    }
}

