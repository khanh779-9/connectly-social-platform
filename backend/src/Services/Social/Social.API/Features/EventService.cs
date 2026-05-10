using BuildingBlocks.Auth;
using BuildingBlocks.Pagination;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

public sealed record CreateEventRequest(
    string Title,
    string? Description,
    string? LocationText,
    string? OnlineUrl,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    Guid? GroupId);
public sealed record UpdateEventRequest(
    string? Title,
    string? Description,
    string? LocationText,
    string? OnlineUrl,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt);
public sealed record SetRsvpRequest(string Rsvp);
public sealed record EventDto(
    Guid Id,
    Guid HostUserId,
    Guid? GroupId,
    string Title,
    string? Description,
    string? LocationText,
    string? OnlineUrl,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    DateTimeOffset CreatedAt,
    int GoingCount = 0,
    int InterestedCount = 0,
    string? ViewerRsvp = null);
public sealed record EventAttendeeDto(Guid UserId, string Rsvp, DateTimeOffset CreatedAt);

public class EventService(
    SocialDbContext db,
    ICurrentUser currentUser,
    GroupService groups,
    ILogger<EventService> logger)
{
    private Guid ViewerId => currentUser.RequireUserId();

    private static EventDto ToDto(Event evt, int going, int interested, string? viewerRsvp) => new(
        evt.Id, evt.HostUserId, evt.GroupId, evt.Title, evt.Description, evt.LocationText,
        evt.OnlineUrl, evt.StartsAt, evt.EndsAt, evt.CreatedAt, going, interested, viewerRsvp);

    /// <summary>Creates an event; the viewer becomes host. Group events require an active membership.</summary>
    public async Task<EventDto> CreateEventAsync(CreateEventRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 140)
            throw new ArgumentException("Event title is empty or too long.");
        if (request.StartsAt < DateTimeOffset.UtcNow - BuildingBlocks.Env.ConnectlyEnv.EventStartGrace())
            throw new ArgumentException("Event must start in the future.");
        if (request.EndsAt is { } ends && ends < request.StartsAt)
            throw new ArgumentException("Event must end after it starts.");

        var me = ViewerId;
        if (request.GroupId is { } groupId && !await groups.IsMemberAsync(groupId, me, ct))
            throw new UnauthorizedAccessException("Only group members can create group events.");

        var now = DateTimeOffset.UtcNow;
        var evt = new Event
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            LocationText = request.LocationText?.Trim(),
            OnlineUrl = request.OnlineUrl?.Trim(),
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            HostUserId = me,
            GroupId = request.GroupId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Events.Add(evt);
        db.EventAttendees.Add(new EventAttendee
        {
            EventId = evt.Id, UserId = me, Rsvp = RsvpStatus.Going, CreatedAt = now
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Event {EventId} created by {User}", evt.Id, me);
        return ToDto(evt, 1, 0, "going");
    }

    public async Task<EventDto> GetEventAsync(Guid eventId, CancellationToken ct)
    {
        var evt = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new KeyNotFoundException("Event not found.");
        await EnsureEventVisibleAsync(evt, ct);
        return await WithStatsAsync(evt, ct);
    }

    /// <summary>
    /// An event that belongs to a group is only readable by the host and active members
    /// of that group — a private group must not leak its events to the outside.
    /// </summary>
    private async Task EnsureEventVisibleAsync(Event evt, CancellationToken ct)
    {
        if (evt.GroupId is not { } groupId) return;
        if (evt.HostUserId == ViewerId) return;
        if (!await groups.IsMemberAsync(groupId, ViewerId, ct))
            throw new UnauthorizedAccessException("You cannot view this event.");
    }

    /// <summary>Upcoming events the viewer can see: own events, events of their groups, and those they RSVPed to.</summary>
    public async Task<CursorPageOf<EventDto>> ListEventsAsync(string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var me = ViewerId;
        var myGroupIds = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == me && m.Status == GroupMemberStatus.Active)
            .Select(m => m.GroupId).ToListAsync(ct);
        var attending = await db.EventAttendees.AsNoTracking()
            .Where(a => a.UserId == me).Select(a => a.EventId).ToListAsync(ct);

        var query = db.Events.AsNoTracking()
            .Where(e => e.StartsAt >= DateTimeOffset.UtcNow &&
                        (e.HostUserId == me || e.GroupId != null && myGroupIds.Contains(e.GroupId.Value) ||
                         attending.Contains(e.Id)))
            .OrderBy(e => e.StartsAt).ThenBy(e => e.Id);
        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(e => e.StartsAt > time || (e.StartsAt == time && e.Id.CompareTo(id) > 0))
                .OrderBy(e => e.StartsAt).ThenBy(e => e.Id);
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);
        var nextCursor = rows.Count > limit ? Cursor.Encode(rows[limit].StartsAt, rows[limit].Id) : null;
        var dtos = new List<EventDto>();
        foreach (var evt in page) dtos.Add(await WithStatsAsync(evt, ct));
        return new CursorPageOf<EventDto>(dtos, nextCursor);
    }

    /// <summary>
    /// Server-side search over the upcoming events the viewer may see (own, their groups', RSVPed).
    /// </summary>
    public async Task<List<EventDto>> SearchEventsAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var needle = query.Trim().ToLowerInvariant();
        if (needle.Length < 2) return [];

        var me = ViewerId;
        var myGroupIds = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == me && m.Status == GroupMemberStatus.Active)
            .Select(m => m.GroupId).ToListAsync(ct);
        var attending = await db.EventAttendees.AsNoTracking()
            .Where(a => a.UserId == me).Select(a => a.EventId).ToListAsync(ct);

        var rows = await db.Events.AsNoTracking()
            .Where(e => e.StartsAt >= DateTimeOffset.UtcNow &&
                        (e.HostUserId == me || e.GroupId != null && myGroupIds.Contains(e.GroupId.Value) ||
                         attending.Contains(e.Id)))
            .Where(e => e.Title.ToLower().Contains(needle)
                || (e.Description != null && e.Description.ToLower().Contains(needle))
                || (e.LocationText != null && e.LocationText.ToLower().Contains(needle)))
            .OrderBy(e => e.StartsAt).ThenBy(e => e.Id)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<EventDto>();
        foreach (var evt in rows) dtos.Add(await WithStatsAsync(evt, ct));
        return dtos;
    }

    public async Task<EventDto> UpdateEventAsync(Guid eventId, UpdateEventRequest request, CancellationToken ct)
    {
        var evt = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new KeyNotFoundException("Event not found.");
        if (evt.HostUserId != ViewerId) throw new UnauthorizedAccessException("Only the host can update this event.");

        if (request.Title is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 140)
                throw new ArgumentException("Event title is empty or too long.");
            evt.Title = request.Title.Trim();
        }
        if (request.Description is not null) evt.Description = request.Description.Trim();
        if (request.LocationText is not null) evt.LocationText = request.LocationText.Trim();
        if (request.OnlineUrl is not null) evt.OnlineUrl = request.OnlineUrl.Trim();
        if (request.StartsAt is { } starts)
        {
            // only future events enforce the "starts in the future" rule (already-started events may be corrected)
            if (starts < DateTimeOffset.UtcNow.AddMinutes(-5) && evt.StartsAt > DateTimeOffset.UtcNow)
                throw new ArgumentException("Event must start in the future.");
            evt.StartsAt = starts;
        }
        if (request.EndsAt is { } ends) evt.EndsAt = ends;
        evt.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return await WithStatsAsync(evt, ct);
    }

    public async Task DeleteEventAsync(Guid eventId, CancellationToken ct)
    {
        var evt = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new KeyNotFoundException("Event not found.");
        if (evt.HostUserId != ViewerId) throw new UnauthorizedAccessException("Only the host can delete this event.");
        await db.EventAttendees.Where(a => a.EventId == eventId).ExecuteDeleteAsync(ct);
        db.Events.Remove(evt);
        await db.SaveChangesAsync(ct);
    }

    public async Task<SetRsvpRequest> SetRsvpAsync(Guid eventId, SetRsvpRequest request, CancellationToken ct)
    {
        var evt = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new KeyNotFoundException("Event not found.");
        // visible RSVP: host events, personal events, and group events for members only
        var allowed = evt.HostUserId == ViewerId || evt.GroupId == null ||
                      await groups.IsMemberAsync(evt.GroupId.Value, ViewerId, ct);
        if (!allowed) throw new UnauthorizedAccessException("You cannot RSVP to this event.");

        if (!Enum.TryParse<RsvpStatus>(request.Rsvp, ignoreCase: true, out var rsvp))
            throw new ArgumentException("Unknown RSVP.");

        var existing = await db.EventAttendees.FindAsync([eventId, ViewerId]);
        if (rsvp == RsvpStatus.NotGoing)
        {
            if (existing is not null)
                db.EventAttendees.Remove(existing);
        }
        else if (existing is not null)
        {
            if (existing.Rsvp == rsvp)
            {
                return new SetRsvpRequest(rsvp.ToString().ToLowerInvariant());
            }
            existing.Rsvp = rsvp;
            existing.CreatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            db.EventAttendees.Add(new EventAttendee
            {
                EventId = eventId,
                UserId = ViewerId,
                Rsvp = rsvp,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        await db.SaveChangesAsync(ct);
        return new SetRsvpRequest(rsvp.ToString().ToLowerInvariant());
    }

    public async Task<CursorPageOf<EventAttendeeDto>> ListAttendeesAsync(
        Guid eventId, string? rsvp, string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 100);
        var evt = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new KeyNotFoundException("Event not found.");
        await EnsureEventVisibleAsync(evt, ct);

        var query = db.EventAttendees.AsNoTracking().Where(a => a.EventId == eventId);
        if (Enum.TryParse<RsvpStatus>(rsvp, ignoreCase: true, out var status))
            query = query.Where(a => a.Rsvp == status);
        query = query.OrderBy(a => a.CreatedAt).ThenBy(a => a.UserId);
        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(a => a.CreatedAt > time || (a.CreatedAt == time && a.UserId.CompareTo(id) > 0));
        }

        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);
        var nextCursor = rows.Count > limit ? Cursor.Encode(rows[limit - 1].CreatedAt, rows[limit - 1].UserId) : null;
        return new CursorPageOf<EventAttendeeDto>(
            page.Select(a => new EventAttendeeDto(a.UserId, a.Rsvp.ToString().ToLowerInvariant(), a.CreatedAt)).ToList(),
            nextCursor);
    }

    private async Task<EventDto> WithStatsAsync(Event evt, CancellationToken ct)
    {
        var counts = await db.EventAttendees.AsNoTracking()
            .Where(a => a.EventId == evt.Id)
            .GroupBy(a => a.Rsvp)
            .Select(g => new { Rsvp = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var viewer = await db.EventAttendees.AsNoTracking()
            .SingleOrDefaultAsync(a => a.EventId == evt.Id && a.UserId == ViewerId, ct);
        return ToDto(
            evt,
            counts.FirstOrDefault(c => c.Rsvp == RsvpStatus.Going)?.Count ?? 0,
            counts.FirstOrDefault(c => c.Rsvp == RsvpStatus.Interested)?.Count ?? 0,
            viewer?.Rsvp.ToString().ToLowerInvariant());
    }
}
