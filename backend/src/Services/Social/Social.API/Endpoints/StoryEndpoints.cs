using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The stories that disappear after a day, and the highlights that keep them.</summary>
public static class StoryEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapPost("/stories", async ([FromBody] CreateStoryRequest request, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.CreateStoryAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        group.MapGet("/stories/feed", async ([FromServices] StoryService stories, CancellationToken ct) =>
            Results.Ok(await stories.GetStoryFeedAsync(ct)));

        group.MapGet("/stories/{storyId:guid}", async (Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.GetStoryAsync(storyId, ct)); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        group.MapPost("/stories/{storyId:guid}/view", async (Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.ViewStoryAsync(storyId, ct)); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        group.MapPut("/stories/{storyId:guid}", async (Guid storyId, [FromBody] UpdateStoryRequest request, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.UpdateStoryAsync(storyId, request, ct)); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        group.MapDelete("/stories/{storyId:guid}", async (Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { await stories.DeleteStoryAsync(storyId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        group.MapGet("/stories/{storyId:guid}/views", async (Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.ListViewsAsync(storyId, ct)); }
            catch (Exception ex) { return ex.ToProblem("story_state"); }
        });

        // ---------- Highlights ----------
        group.MapPost("/highlights", async ([FromBody] CreateHighlightRequest request, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.CreateHighlightAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("highlight_state"); }
        });

        group.MapGet("/highlights/mine", async ([FromServices] StoryService stories, CancellationToken ct) =>
            Results.Ok(await stories.ListMyHighlightsAsync(ct)));

        group.MapGet("/highlights/{ownerUserId:guid}", async (Guid ownerUserId, [FromServices] StoryService stories, CancellationToken ct) =>
            Results.Ok(await stories.ListHighlightsAsync(ownerUserId, ct)));

        group.MapGet("/highlights/{highlightId:guid}/stories", async (Guid highlightId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { return Results.Ok(await stories.GetHighlightStoriesAsync(highlightId, ct)); }
            catch (Exception ex) { return ex.ToProblem("highlight_state"); }
        });

        group.MapPost("/highlights/{highlightId:guid}/stories/{storyId:guid}", async (Guid highlightId, Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { await stories.AddStoryToHighlightAsync(highlightId, storyId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("highlight_state"); }
        });

        group.MapDelete("/highlights/{highlightId:guid}/stories/{storyId:guid}", async (Guid highlightId, Guid storyId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { await stories.RemoveStoryFromHighlightAsync(highlightId, storyId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("highlight_state"); }
        });

        group.MapDelete("/highlights/{highlightId:guid}", async (Guid highlightId, [FromServices] StoryService stories, CancellationToken ct) =>
        {
            try { await stories.DeleteHighlightAsync(highlightId, ct); return Results.NoContent(); }
            catch (Exception ex) { return ex.ToProblem("highlight_state"); }
        });
    }
}
