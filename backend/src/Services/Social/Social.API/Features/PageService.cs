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

    /// <summary>Pages where the viewer is an admin (or the owner).</summary>
    public async Task<List<PageDto>> ListMyPagesAsync(CancellationToken ct)
    {
        var rows = await db.PageAdmins.AsNoTracking()
            .Where(a => a.UserId == ViewerId)
            .Join(db.Pages.AsNoTracking(), a => a.PageId, p => p.Id, (a, p) => new { p, a })
            .OrderByDescending(x => x.p.CreatedAt)
            .ToListAsync(ct);
        var result = new List<PageDto>();
        foreach (var row in rows) result.Add(await WithViewerAsync(ToDto(row.p), ct));
        return result;
    }

    public async Task<PageDto> UpdatePageAsync(Guid pageId, UpdatePageRequest request, CancellationToken ct)
    {
        var page = await db.Pages.SingleOrDefaultAsync(p => p.Id == pageId, ct)
            ?? throw new KeyNotFoundException("Page not found.");
        await RequireEditorAsync(pageId, ct);

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
                throw new ArgumentException("Page name is empty or too long.");
            page.Name = request.Name.Trim();
        }
        if (request.Description is not null) page.Description = request.Description.Trim();
        if (request.Category is not null) page.Category = request.Category.Trim();
        page.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDto(page);
    }

    public async Task DeletePageAsync(Guid pageId, CancellationToken ct)
    {
        var page = await db.Pages.SingleOrDefaultAsync(p => p.Id == pageId, ct)
            ?? throw new KeyNotFoundException("Page not found.");
        if (page.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Only the page owner can delete it.");

        var now = DateTimeOffset.UtcNow;
        await db.Posts.Where(p => p.PageId == pageId && p.Status != PostStatus.Deleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, PostStatus.Deleted)
                .SetProperty(p => p.DeletedAt, now), ct);
        await db.PageAdmins.Where(a => a.PageId == pageId).ExecuteDeleteAsync(ct);
        db.Pages.Remove(page);
        await db.SaveChangesAsync(ct);
    }

    // ---------- Admins ----------
    public async Task<PageAdminDto> AddAdminAsync(Guid pageId, Guid userId, PageAdminRole role, CancellationToken ct)
    {
        var page = await db.Pages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == pageId, ct)
            ?? throw new KeyNotFoundException("Page not found.");
        if (page.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Only the page owner can manage admins.");
        if (userId == page.OwnerUserId) throw new ArgumentException("The owner is already an admin.");

        var existing = await db.PageAdmins.FindAsync([pageId, userId]);
        if (existing is not null)
        {
            existing.Role = role;
            await db.SaveChangesAsync(ct);
            return new PageAdminDto(userId, role.ToString().ToLowerInvariant(), existing.AddedAt);
        }
        var admin = new PageAdmin { PageId = pageId, UserId = userId, Role = role, AddedAt = DateTimeOffset.UtcNow };
        db.PageAdmins.Add(admin);
        await db.SaveChangesAsync(ct);
        return new PageAdminDto(userId, role.ToString().ToLowerInvariant(), admin.AddedAt);
    }

    public async Task RemoveAdminAsync(Guid pageId, Guid userId, CancellationToken ct)
    {
        var page = await db.Pages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == pageId, ct)
            ?? throw new KeyNotFoundException("Page not found.");
        if (page.OwnerUserId != ViewerId) throw new UnauthorizedAccessException("Only the page owner can manage admins.");
        var admin = await db.PageAdmins.FindAsync([pageId, userId])
            ?? throw new KeyNotFoundException("Admin not found.");
        if (admin.Role == PageAdminRole.Owner) throw new InvalidOperationException("The owner cannot be removed.");
        db.PageAdmins.Remove(admin);
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<PageAdminDto>> ListAdminsAsync(Guid pageId, CancellationToken ct)
    {
        if (!await db.Pages.AsNoTracking().AnyAsync(p => p.Id == pageId, ct))
            throw new KeyNotFoundException("Page not found.");
        var rows = await db.PageAdmins.AsNoTracking()
            .Where(a => a.PageId == pageId)
            .OrderBy(a => a.Role)
            .ToListAsync(ct);
        return rows.Select(a => new PageAdminDto(a.UserId, a.Role.ToString().ToLowerInvariant(), a.AddedAt)).ToList();
    }

    /// <summary>True when the viewer may publish on the page (owner/admin/editor).</summary>
    public async Task<bool> CanPublishAsync(Guid pageId, Guid userId, CancellationToken ct) =>
        await db.PageAdmins.AsNoTracking().AnyAsync(a =>
            a.PageId == pageId && a.UserId == userId &&
            (a.Role == PageAdminRole.Owner || a.Role == PageAdminRole.Admin || a.Role == PageAdminRole.Editor), ct);

    private async Task RequireEditorAsync(Guid pageId, CancellationToken ct)
    {
        if (!await CanPublishAsync(pageId, ViewerId, ct))
            throw new UnauthorizedAccessException("Only page admins can do this.");
    }
}
