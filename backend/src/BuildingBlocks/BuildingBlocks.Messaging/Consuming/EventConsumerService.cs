using System.Text;
using System.Text.Json;
using BuildingBlocks.Env;
using BuildingBlocks.Messaging.Events;
using BuildingBlocks.Messaging.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace BuildingBlocks.Messaging.Consuming;

/// <summary>
/// One hosted consumer per handler: declares its own queue bound by event type,
/// consumes with a DB transaction that includes the inbox marker (idempotency),
/// and dead-letters unrecoverable failures instead of retrying forever.
/// </summary>
public sealed class EventConsumerService<TDb, THandler> : BackgroundService
    where TDb : DbContext, IOutboxDbContext
    where THandler : IIntegrationEventHandler
{
    private static readonly string Exchange = ConnectlyEnv.RabbitEventExchange();
    private static readonly string DeadLetterExchange = ConnectlyEnv.RabbitDeadLetterExchange();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RegisteredHandler _registration;
    private readonly MessagingOptions _options;
    private readonly ILogger _logger;

    public EventConsumerService(
        IServiceScopeFactory scopeFactory,
        MessagingOptions options,
        ILogger<EventConsumerService<TDb, THandler>> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _registration = EventHandlerConvention.Describe(typeof(THandler));
        _logger = logger;
    }

    private string QueueName => $"{ConnectlyEnv.RabbitQueuePrefix()}.{_options.ServiceName}.{_registration.EventType}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeLoopAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                var retryDelay = ConnectlyEnv.RabbitReconnectDelay();
                _logger.LogError(ex, "Consumer {Queue} crashed, reconnecting in {Delay}", QueueName, retryDelay);
                try { await Task.Delay(retryDelay, stoppingToken); } catch (OperationCanceledException) { break; }
            }
        }
    }

    private async Task ConsumeLoopAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory { Uri = new Uri(ConnectlyEnv.RabbitMqUri()), AutomaticRecoveryEnabled = true };
        await using var connection = await factory.CreateConnectionAsync(stoppingToken);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, cancellationToken: stoppingToken);
        await channel.ExchangeDeclareAsync(DeadLetterExchange, ExchangeType.Topic, durable: true, cancellationToken: stoppingToken);

        var dlqName = $"{ConnectlyEnv.RabbitDeadLetterQueuePrefix()}.{_registration.EventType}";
        await channel.QueueDeclareAsync(dlqName, durable: true, exclusive: false, autoDelete: false, cancellationToken: stoppingToken);
        await channel.QueueBindAsync(dlqName, DeadLetterExchange, _registration.EventType, cancellationToken: stoppingToken);

        var arguments = new Dictionary<string, object?> { ["x-dead-letter-exchange"] = DeadLetterExchange };
        await channel.QueueDeclareAsync(
            QueueName, durable: true, exclusive: false, autoDelete: false,
            arguments: arguments, cancellationToken: stoppingToken);
        await channel.QueueBindAsync(QueueName, Exchange, _registration.EventType, cancellationToken: stoppingToken);
        await channel.BasicQosAsync(
            0, prefetchCount: ConnectlyEnv.RabbitPrefetchCount(), global: false, cancellationToken: stoppingToken);

        _logger.LogInformation("Consumer {Queue} listening on {Event}", QueueName, _registration.EventType);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, deliver) =>
        {
            try
            {
                await HandleMessageAsync(deliver, stoppingToken);
                await channel.BasicAckAsync(deliver.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Handler {Handler} failed, dead-lettering message", _registration.HandlerType.Name);
                await channel.BasicNackAsync(deliver.DeliveryTag, multiple: false, requeue: false);
            }
        };
        await channel.BasicConsumeAsync(queue: QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        // keep alive while connection persists
        while (!stoppingToken.IsCancellationRequested && connection.IsOpen)
            await Task.Delay(ConnectlyEnv.Milliseconds("RABBIT_CONNECTION_POLL_MILLISECONDS", 1000), stoppingToken);
    }

    private async Task HandleMessageAsync(BasicDeliverEventArgs deliver, CancellationToken ct)
    {
        var raw = Encoding.UTF8.GetString(deliver.Body.ToArray());
        var envelope = JsonSerializer.Deserialize<EventEnvelope>(raw, Json.Options)
            ?? throw new InvalidOperationException("Malformed event envelope.");

        if (envelope.EventType != _registration.EventType)
            throw new InvalidOperationException(
                $"Envelope eventType {envelope.EventType} does not match consumer {_registration.EventType}.");

        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TDb>();
        var handler = (IIntegrationEventHandler)scope.ServiceProvider.GetRequiredService<THandler>();

        // idempotent processing: inbox row + handler work share ONE transaction
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var already = await db.InboxMessages.AnyAsync(m => m.EventId == envelope.EventId, ct);
        if (already)
        {
            await transaction.RollbackAsync(ct);
            return;
        }

        var payload = EventHandlerConvention.DeserializePayload(_registration, envelope.Payload, Json.Options);
        if (payload is null) throw new InvalidOperationException($"Payload of {_registration.EventType} could not be deserialized.");

        await handler.HandleAsync(payload, db, new EventContext(envelope), ct);
        db.InboxMessages.Add(new InboxMessage
        {
            EventId = envelope.EventId,
            EventType = envelope.EventType,
            ProcessedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}



