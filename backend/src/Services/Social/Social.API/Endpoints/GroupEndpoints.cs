using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The groups and their members.</summary>
public static class GroupEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/groups", async ([FromBody] CreateGroupRequest request, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { return Results.Ok(await groups.CreateGroupAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapGet("/groups", async (string? cursor, int limit, [FromServices] GroupService groups, CancellationToken ct) =>
            Results.Ok(await groups.ListGroupsAsync(cursor, limit, ct)));

        group.MapGet("/groups/mine", async ([FromServices] GroupService groups, CancellationToken ct) =>
            Results.Ok(await groups.ListMyGroupsAsync(ct)));

        group.MapGet("/groups/{groupId:guid}", async (Guid groupId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { return Results.Ok(await groups.GetGroupAsync(groupId, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapPatch("/groups/{groupId:guid}", async (Guid groupId, [FromBody] UpdateGroupRequest request, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { return Results.Ok(await groups.UpdateGroupAsync(groupId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapDelete("/groups/{groupId:guid}", async (Guid groupId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { await groups.DeleteGroupAsync(groupId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapPost("/groups/{groupId:guid}/join", async (Guid groupId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { return Results.Ok(await groups.JoinGroupAsync(groupId, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapDelete("/groups/{groupId:guid}/join", async (Guid groupId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { await groups.LeaveGroupAsync(groupId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapGet("/groups/{groupId:guid}/members", async (Guid groupId, string? status, string? cursor, int limit, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { return Results.Ok(await groups.ListMembersAsync(groupId, status, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapPost("/groups/{groupId:guid}/members/{userId:guid}/approve", async (Guid groupId, Guid userId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { await groups.ApproveMemberAsync(groupId, userId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapDelete("/groups/{groupId:guid}/members/{userId:guid}", async (Guid groupId, Guid userId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { await groups.RemoveMemberAsync(groupId, userId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });

        group.MapDelete("/groups/{groupId:guid}/members/{userId:guid}/request", async (Guid groupId, Guid userId, [FromServices] GroupService groups, CancellationToken ct) =>
        {
            try { await groups.DeclineMemberAsync(groupId, userId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("group_state"); }
        });
    }
}
