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

