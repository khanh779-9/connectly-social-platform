using BuildingBlocks.Exceptions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Social.Features;

namespace Social.Endpoints;

/// <summary>The profile of a user and the privacy settings behind it.</summary>
public static class ProfileEndpoints
{
    public static void Map(IEndpointRouteBuilder group)
    {
        group.MapGet("/me/profile", async ([FromServices] ProfileService profiles, CancellationToken ct) =>
            Results.Ok(await profiles.GetMyProfileAsync(ct)));

        group.MapPatch("/me/profile", async ([FromBody] UpdateProfileRequest request, [FromServices] ProfileService profiles, CancellationToken ct) =>
        {
            try { return Results.Ok(await profiles.UpdateMyProfileAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("profile_state"); }
        });

        group.MapGet("/me/privacy", async ([FromServices] ProfileService profiles, CancellationToken ct) =>
            Results.Ok(await profiles.GetPrivacyAsync(ct)));

        group.MapPut("/me/privacy", async ([FromBody] UpdatePrivacyRequest request, [FromServices] ProfileService profiles, CancellationToken ct) =>
        {
            try { return Results.Ok(await profiles.SavePrivacyAsync(request, ct)); }
            catch (Exception ex) { return ex.ToProblem("privacy_state"); }
        });

        group.MapPatch("/me/profile/avatar", async ([FromBody] UpdateProfileMediaRequest request, [FromServices] ProfileService profiles, CancellationToken ct) =>
        {
            try { return Results.Ok(await profiles.UpdateAvatarAsync(request.MediaId, ct)); }
            catch (Exception ex) { return ex.ToProblem("media_state"); }
        });

        group.MapPatch("/me/profile/cover", async ([FromBody] UpdateProfileMediaRequest request, [FromServices] ProfileService profiles, CancellationToken ct) =>
        {
            try { return Results.Ok(await profiles.UpdateCoverAsync(request.MediaId, ct)); }
            catch (Exception ex) { return ex.ToProblem("media_state"); }
        });

