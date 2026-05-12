using BuildingBlocks.Auth;
using BuildingBlocks.Pagination;
using Social.Domain;
using Social.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Social.Features;

public sealed record CreatePageRequest(string Name, string? Description, string? Category);
public sealed record UpdatePageRequest(string? Name, string? Description, string? Category);
public sealed record PageDto(
    Guid Id,
    Guid OwnerUserId,
    string Name,
    string? Description,
    string? Category,
    DateTimeOffset CreatedAt,
    int AdminCount = 0,
    int PostCount = 0,
    string? ViewerRole = null);
public sealed record PageAdminDto(Guid UserId, string Role, DateTimeOffset AddedAt);

public class PageService(
    SocialDbContext db,
    ICurrentUser currentUser,
    ILogger<PageService> logger)
{
    private Guid ViewerId => currentUser.RequireUserId();

    private static PageDto ToDto(Page page) => new(
        page.Id, page.OwnerUserId, page.Name, page.Description, page.Category, page.CreatedAt);

    public async Task<PageDto> CreatePageAsync(CreatePageRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
            throw new ArgumentException("Page name is empty or too long.");

        var me = ViewerId;
        var now = DateTimeOffset.UtcNow;
        var page = new Page
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Category = request.Category?.Trim(),
            OwnerUserId = me,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Pages.Add(page);
        db.PageAdmins.Add(new PageAdmin { PageId = page.Id, UserId = me, Role = PageAdminRole.Owner, AddedAt = now });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Page {PageId} created by {User}", page.Id, me);
        return await WithViewerAsync(ToDto(page), ct);
    }

    /// <summary>Adds the viewer's role plus admin/post counters.</summary>
    public async Task<PageDto> WithViewerAsync(PageDto dto, CancellationToken ct)
    {
        var adminCount = await db.PageAdmins.AsNoTracking().CountAsync(a => a.PageId == dto.Id, ct);
        var postCount = await db.Posts.AsNoTracking()
            .CountAsync(p => p.PageId == dto.Id && p.Status == PostStatus.Published, ct);
        var mine = await db.PageAdmins.AsNoTracking()
            .SingleOrDefaultAsync(a => a.PageId == dto.Id && a.UserId == ViewerId, ct);
        return dto with
        {
            AdminCount = adminCount,
            PostCount = postCount,
            ViewerRole = mine?.Role.ToString().ToLowerInvariant()
        };
    }

    public async Task<PageDto> GetPageAsync(Guid pageId, CancellationToken ct)
    {
        var page = await db.Pages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == pageId, ct)
            ?? throw new KeyNotFoundException("Page not found.");
        return await WithViewerAsync(ToDto(page), ct);
    }

    /// <summary>All pages, newest first — pages are public entities like Facebook business pages.</summary>
    public async Task<CursorPageOf<PageDto>> ListPagesAsync(string? cursor, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var query = db.Pages.AsNoTracking().OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id);
        if (!string.IsNullOrEmpty(cursor))
        {
            var (time, id) = Cursor.Parse(cursor);
            query = query.Where(p => p.CreatedAt < time || (p.CreatedAt == time && p.Id.CompareTo(id) < 0))
                .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id);
        }
        var rows = await query.Take(limit + 1).ToListAsync(ct);
        var page = rows.Take(limit);
        var nextCursor = rows.Count > limit ? Cursor.Encode(rows[limit].CreatedAt, rows[limit].Id) : null;
        var dtos = new List<PageDto>();
        foreach (var item in page) dtos.Add(await WithViewerAsync(ToDto(item), ct));
        return new CursorPageOf<PageDto>(dtos, nextCursor);
    }

    /// <summary>Server-side search over page names, descriptions and categories.</summary>
    public async Task<List<PageDto>> SearchPagesAsync(string query, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 30);
        var needle = query.Trim().ToLowerInvariant();
        if (needle.Length < 2) return [];

        var rows = await db.Pages.AsNoTracking()
            .Where(p => p.Name.ToLower().Contains(needle)
                || (p.Description != null && p.Description.ToLower().Contains(needle))
                || (p.Category != null && p.Category.ToLower().Contains(needle)))
            .OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<PageDto>();
        foreach (var item in rows) dtos.Add(await WithViewerAsync(ToDto(item), ct));
        return dtos;
    }

