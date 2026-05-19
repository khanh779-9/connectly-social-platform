using BuildingBlocks.Messaging.Consuming;
using BuildingBlocks.Messaging.Events;
using Connectly.Contracts.EventTypes;
using Connectly.Contracts.Events.Identity;
using Social.Features;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Messaging.Consumers;

[EventHandler(EventTypes.Identity.UserRegistered)]
public class UserRegisteredConsumer : IntegrationEventHandler<SocialDbContext, UserRegisteredV1>
{
    public override async Task OnHandleAsync(UserRegisteredV1 evt, SocialDbContext db, EventContext ctx, CancellationToken ct)
    {
        // Idempotent: the profile may already exist because the client asked for it
        // before this event arrived.
        await ProfileBootstrapper.EnsureAsync(db, evt.UserId, evt.DisplayName, ct);
    }
}

