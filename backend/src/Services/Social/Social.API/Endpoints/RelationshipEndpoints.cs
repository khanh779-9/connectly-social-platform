using BuildingBlocks.Auth;
using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>Friend requests, follows, blocks and mutes.</summary>
public static class RelationshipEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/friend-requests", async (Guid userId, [FromServices] FriendService friends, CancellationToken ct) =>
        {
            try { var result = await friends.SendFriendRequestAsync(userId, ct); return Results.Ok(result); }
            catch (Exception ex) { return ex.ToProblem("friendship_conflict"); }
        });

        group.MapGet("/friend-requests/received", async ([FromServices] FriendService friends, [FromServices] ICurrentUser currentUser, CancellationToken ct) =>
            Results.Ok(await friends.GetPendingInvitesForAsync(currentUser.RequireUserId(), incoming: true, ct)));

        group.MapGet("/friend-requests/sent", async ([FromServices] FriendService friends, [FromServices] ICurrentUser currentUser, CancellationToken ct) =>
            Results.Ok(await friends.GetPendingInvitesForAsync(currentUser.RequireUserId(), incoming: false, ct)));

        group.MapPost("/friend-requests/{requestId:guid}/accept", async (Guid requestId, [FromServices] FriendService friends, CancellationToken ct) =>
        {
            try { return Results.Ok(await friends.AcceptFriendRequestAsync(requestId, ct)); }
            catch (Exception ex) { return ex.ToProblem("friendship_state"); }
        });

        group.MapPost("/friend-requests/{requestId:guid}/decline", async (Guid requestId, [FromServices] FriendService friends, CancellationToken ct) =>
        {
            try { return Results.Ok(await friends.DeclineFriendRequestAsync(requestId, ct)); }
            catch (Exception ex) { return ex.ToProblem("friendship_state"); }
        });

        group.MapDelete("/friend-requests/{requestId:guid}", async (Guid requestId, [FromServices] FriendService friends, CancellationToken ct) =>
        {
            try { return Results.Ok(await friends.CancelFriendRequestAsync(requestId, ct)); }
            catch (Exception ex) { return ex.ToProblem("friendship_state"); }
        });

