using Microsoft.AspNetCore.Authorization;
using Social.Endpoints;

namespace Social.Endpoints;

/// <summary>
/// All routes of the Social service. The routes themselves live in one file per
/// area, so each file stays short and easy to find.
/// </summary>
public static class SocialEndpoints
{
    public const string BasePath = "/api/v1";

    public static IEndpointRouteBuilder MapSocialEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath).RequireAuthorization();

        ProfileEndpoints.Map(group);
        RelationshipEndpoints.Map(group);
        SearchEndpoints.Map(group);
        MediaEndpoints.Map(group);
        PostEndpoints.Map(group);
        CommentEndpoints.Map(group);
        ReactionEndpoints.Map(group);
        FeedEndpoints.Map(group);
        GroupEndpoints.Map(group);
        EventEndpoints.Map(group);
        PageEndpoints.Map(group);
        StoryEndpoints.Map(group);
        ReelEndpoints.Map(group);

        return app;
    }
}
