using BuildingBlocks.Auth;
using Chat.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Chat.Realtime;

/// <summary>
/// Connectly realtime hub (SignalR).
/// Auth via `?access_token=` (handled in BuildingBlocks JWT setup).
/// Client user event groups and per-conversation groups.
/// Events sent by server: message-received, message-read, presence-updated, typing.
/// </summary>
[Authorize]
public class ConnectlyChatHub(
    ChatDbContext db,
    PresenceService presence,
    PresenceRegistry registry,
    IHubContext<ConnectlyChatHub> hub) : Hub
{
    public const string Path = "/hubs/chat";

    // JwtBearer maps the inbound "sub" claim to ClaimTypes.NameIdentifier unless mapping
    // is disabled, so both names have to be accepted here.
    private Guid UserId =>
        Guid.TryParse(Context.User?.FindFirst("sub")?.Value, out var id) ? id
        : Guid.TryParse(Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var mapped) ? mapped
        : Guid.Empty;
    private string UserGroup => $"user:{UserId}";
    private string ConversationGroup(Guid conversationId) => $"conversation:{conversationId}";

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        if (UserId == Guid.Empty)
        {
            Context.Abort();
            return;
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup);
        registry.Attach(UserId, Context.ConnectionId);
        await presence.HeartbeatAsync(UserId);
        await hub.Clients.Group(UserGroup).SendAsync("presence-updated", new { userId = UserId, online = true }, Context.ConnectionAborted);
        // note: fan-out to those subscribed on this user — MVP: only interested parties poll presence
    }

