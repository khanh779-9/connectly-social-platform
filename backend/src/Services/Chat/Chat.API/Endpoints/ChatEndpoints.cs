using BuildingBlocks.Exceptions;
using Chat.Features;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Chat.Endpoints;

public static class ChatEndpoints
{
    public const string BasePath = "/api/v1";

    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath).RequireAuthorization();

        // ---------- presence ----------
        // One lookup for a list of ids (the friends dock asks about everybody at once).
        group.MapGet("/presence", async (string? userIds, [FromServices] Chat.Realtime.PresenceService presence, ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            var ids = (userIds ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(value => Guid.TryParse(value, out var id) ? id : (Guid?)null)
                .Where(id => id is not null)
                .Select(id => id!.Value)
                .Distinct()
                .Take(200)
                .ToArray();

            try
            {
                var snapshots = await presence.GetSnapshotsAsync(ids, ct);
                return Results.Ok(snapshots.ToDictionary(
                    entry => entry.Key.ToString(),
                    entry => new { online = entry.Value.Online, lastSeenAt = entry.Value.LastSeenAt }));
            }
            catch (Exception ex)
            {
                // Redis is ephemeral: when it is unavailable everyone simply reads as offline.
                loggerFactory.CreateLogger("ChatPresence").LogWarning(ex, "Presence lookup failed");
                return Results.Ok(ids.ToDictionary(
                    id => id.ToString(),
                    _ => new { online = false, lastSeenAt = (DateTimeOffset?)null }));
            }
        });

        // ---------- per-user chat settings ----------
        group.MapGet("/me/chat-settings", async ([FromServices] ChatSettingsService settings, [FromServices] BuildingBlocks.Auth.ICurrentUser currentUser, CancellationToken ct) =>
            Results.Ok(await settings.GetAsync(currentUser.RequireUserId(), ct)));
        group.MapPut("/me/chat-settings", async ([FromBody] UpdateChatSettingsRequest request, [FromServices] ChatSettingsService settings, [FromServices] BuildingBlocks.Auth.ICurrentUser currentUser, CancellationToken ct) =>
        {
            try { return Results.Ok(await settings.SaveAsync(currentUser.RequireUserId(), request, ct)); }
            catch (Exception ex) { return ex.ToProblem("chat_settings"); }
        });

        // ---------- conversations ----------
        group.MapPost("/conversations", async ([FromBody] CreateConversationRequest request, [FromServices] ConversationService conversations, CancellationToken ct) =>
        {
            try { return Results.Ok(await conversations.CreateConversationAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("blocked"); }
        });

        group.MapGet("/conversations", async ([FromServices] ConversationService conversations, CancellationToken ct) =>
            Results.Ok(await conversations.GetConversationsAsync(ct)));

        group.MapGet("/conversations/{conversationId:guid}", async (Guid conversationId, [FromServices] ConversationService conversations, CancellationToken ct) =>
        {
            try { return Results.Ok(await conversations.GetConversationAsync(conversationId, ct)); }
            catch (Exception ex) { return ex.ToProblem(); }
        });

        // ---------- messages ----------
        // attachments tickets
        group.MapPost("/conversations/{conversationId:guid}/attachments/ticket", async (Guid conversationId, string fileName, string contentType, [FromServices] MessageService messages, CancellationToken ct) =>
        {
            try { return Results.Ok(await messages.CreateAttachmentTicketAsync(conversationId, fileName, contentType, ct)); }
            catch (Exception ex) { return ex.ToProblem(); }
        });

