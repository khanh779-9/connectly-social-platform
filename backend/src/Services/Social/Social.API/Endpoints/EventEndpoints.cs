using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The events and who is going to them.</summary>
public static class EventEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/events", async ([FromBody] CreateEventRequest request, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { return Results.Ok(await events.CreateEventAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });

        group.MapGet("/events", async (string? cursor, int limit, [FromServices] EventService events, CancellationToken ct) =>
            Results.Ok(await events.ListEventsAsync(cursor, limit, ct)));

        group.MapGet("/events/{eventId:guid}", async (Guid eventId, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { return Results.Ok(await events.GetEventAsync(eventId, ct)); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });

        group.MapPatch("/events/{eventId:guid}", async (Guid eventId, [FromBody] UpdateEventRequest request, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { return Results.Ok(await events.UpdateEventAsync(eventId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });

        group.MapDelete("/events/{eventId:guid}", async (Guid eventId, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { await events.DeleteEventAsync(eventId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });

        group.MapPut("/events/{eventId:guid}/rsvp", async (Guid eventId, [FromBody] SetRsvpRequest request, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { await events.SetRsvpAsync(eventId, request, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });

        group.MapGet("/events/{eventId:guid}/attendees", async (Guid eventId, string? rsvp, string? cursor, int limit, [FromServices] EventService events, CancellationToken ct) =>
        {
            try { return Results.Ok(await events.ListAttendeesAsync(eventId, rsvp, cursor, limit, ct)); }
            catch (Exception ex) { return ex.ToProblem("event_state"); }
        });
    }
}
