using BuildingBlocks.Env;
using BuildingBlocks.Messaging.Consuming;
using BuildingBlocks.Messaging.Events;
using BuildingBlocks.Messaging.Outbox;
using BuildingBlocks.Messaging.Publishing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BuildingBlocks.Messaging;

public static class MessagingSetup
{
    /// <summary>
    /// Registers RabbitMQ publisher + outbox dispatcher for a service context.
    /// Consumers are registered separately via AddConnectlyEventConsumer.
    /// </summary>
    public static IServiceCollection AddConnectlyMessaging<TDb>(
        this IServiceCollection services,
        string serviceName,
        string producer,
        Func<string, bool>? expectsConsumer = null)
        where TDb : DbContext, IOutboxDbContext
    {
        services.AddSingleton(new MessagingOptions
        {
            ServiceName = serviceName,
            Producer = producer,
            OutboxDispatchBatchSize = ConnectlyEnv.OutboxDispatchBatchSize(),
            ExpectsConsumer = expectsConsumer,
        });
        services.AddSingleton<IRabbitEventPublisher, RabbitEventPublisher>();
        services.AddHostedService<OutboxDispatcher<TDb>>();
        return services;
    }

    /// <summary>Registers one event handler + its dedicated queue consumer (idempotent, dead-letters on failure).</summary>
    public static IServiceCollection AddConnectlyEventConsumer<TDb, THandler>(this IServiceCollection services)
        where TDb : DbContext, IOutboxDbContext
        where THandler : class, IIntegrationEventHandler
    {
        services.AddScoped<THandler>();
        services.AddHostedService<EventConsumerService<TDb, THandler>>();
        return services;
    }
}

