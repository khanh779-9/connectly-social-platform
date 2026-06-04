using BuildingBlocks.Messaging.Consuming;
using BuildingBlocks.Messaging.Events;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Chat.Domain;
using Chat.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Chat.Messaging.Consumers;

/// <summary>social.user-blocked.v1 -> maintain blocked pair projection so Chat can enforce sender/receiver policy without touching the Social DB.</summary>
[EventHandler(EventTypes.Social.Blocked)]
public class BlockedConsumer : IntegrationEventHandler<ChatDbContext, BlockedV1>
{
    public override async Task OnHandleAsync(BlockedV1 evt, ChatDbContext db, EventContext ctx, CancellationToken ct)
    {
        if (await db.BlockedPairs.FindAsync([evt.BlockerId, evt.BlockedUserId], ct) is not null) return;
        db.BlockedPairs.Add(new BlockedPairProjection { BlockerId = evt.BlockerId, BlockedUserId = evt.BlockedUserId, BlockedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
    }
}

