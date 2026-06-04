using BuildingBlocks.Messaging.Consuming;
using BuildingBlocks.Messaging.Events;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Social;
using Chat.Domain;
using Chat.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Chat.Messaging.Consumers;

/// <summary>
/// social.user-unblocked.v1 -> drop the blocked pair projection again.
/// Without this the conversation stays blocked in Chat long after Social lifted
/// the block, and every message sent in it fails with a conflict.
/// </summary>
[EventHandler(EventTypes.Social.Unblocked)]
public class UnblockedConsumer : IntegrationEventHandler<ChatDbContext, UnblockedV1>
{
    public override async Task OnHandleAsync(UnblockedV1 evt, ChatDbContext db, EventContext ctx, CancellationToken ct)
    {
        var projection = await db.BlockedPairs
            .FindAsync([evt.BlockerId, evt.BlockedUserId], ct);
        if (projection is null) return;

        db.BlockedPairs.Remove(projection);
        await db.SaveChangesAsync(ct);
    }
}
