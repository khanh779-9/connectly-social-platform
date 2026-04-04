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

