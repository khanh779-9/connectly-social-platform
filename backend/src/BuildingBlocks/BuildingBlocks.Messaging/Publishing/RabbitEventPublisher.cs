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

