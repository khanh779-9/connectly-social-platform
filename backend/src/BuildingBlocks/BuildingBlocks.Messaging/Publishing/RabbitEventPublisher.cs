using System.Collections.Concurrent;
using System.Text;
using BuildingBlocks.Env;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace BuildingBlocks.Messaging.Publishing;

/// <summary>Publisher used by the outbox dispatcher (not by controllers — always go through the outbox).</summary>
public interface IRabbitEventPublisher
{
    /// <param name="requireRouting">
    /// True when the event must reach a consumer: the broker then reports a missing
    /// queue binding instead of dropping the message silently. False for
    /// fire-and-forget events, which nobody consumes today.
    /// </param>
    Task EnvelopePublishAsync(string eventType, string jsonEnvelope, bool requireRouting = true);
}

public sealed class RabbitEventPublisher : IRabbitEventPublisher, IDisposable
{
    private readonly ConnectionFactory _factory;

    /// <summary>Message ids the broker returned because no queue was bound to them.</summary>
    private readonly ConcurrentDictionary<string, string> _returned = new();

    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitEventPublisher()
    {
        _factory = new ConnectionFactory { Uri = new Uri(ConnectlyEnv.RabbitMqUri()), AutomaticRecoveryEnabled = true };
    }

    private async Task<IChannel> GetChannelAsync(CancellationToken ct)
    {
        _connection ??= await _factory.CreateConnectionAsync(ct);
        if (_channel is null || !_channel.IsOpen)
        {
            // publisher confirms: BasicPublishAsync only completes once the broker
            // has taken responsibility for the message.
            _channel = await _connection.CreateChannelAsync(
                new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
                cancellationToken: ct);
            await _channel.ExchangeDeclareAsync(
                exchange: ConnectlyEnv.RabbitEventExchange(),
                type: ExchangeType.Topic,
                durable: true,
                autoDelete: false,
                arguments: null,
                cancellationToken: ct);
            _channel.BasicReturnAsync += OnBasicReturn;
        }
        return _channel;
    }

    /// <summary>
    /// A message published with mandatory=true and no matching queue comes back to the
    /// publisher instead of being dropped by the broker.
    /// </summary>
    private Task OnBasicReturn(object? sender, BasicReturnEventArgs args)
    {
        var messageId = args.BasicProperties.MessageId;
        if (!string.IsNullOrEmpty(messageId)) _returned[messageId] = $"{args.ReplyCode} {args.ReplyText}";
        return Task.CompletedTask;
    }

    public async Task EnvelopePublishAsync(string eventType, string jsonEnvelope, bool requireRouting = true)
    {
        using var linked = new CancellationTokenSource(ConnectlyEnv.RabbitPublishTimeout());
        var channel = await GetChannelAsync(linked.Token);
        var messageId = Guid.NewGuid().ToString();
        var properties = new BasicProperties
        {
            Persistent = true,
            ContentType = "application/json",
            Type = eventType,
            MessageId = messageId,
        };

        // mandatory=true: the broker must not discard the message when nothing is bound to it.
        await channel.BasicPublishAsync(
            exchange: ConnectlyEnv.RabbitEventExchange(),
            routingKey: eventType,
            mandatory: requireRouting,
            basicProperties: properties,
            body: Encoding.UTF8.GetBytes(jsonEnvelope),
            cancellationToken: linked.Token);

        // The broker confirms the publish even for an unroutable message; only basic.return
        // reports that there was no queue. Without this check the outbox would mark the
        // event as sent and the event would be lost for good.
        if (requireRouting && _returned.TryRemove(messageId, out var reason))
            throw new InvalidOperationException(
                $"Event '{eventType}' was returned by the broker ({reason}): no queue is bound to this routing key.");
    }

    public void Dispose()
    {
        try { _channel?.Dispose(); } catch { }
        try { _connection?.Dispose(); } catch { }
    }
}
