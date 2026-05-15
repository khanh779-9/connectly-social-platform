using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "highlight_stories",
                schema: "social",
                columns: table => new
                {
                    highlight_id = table.Column<Guid>(type: "uuid", nullable: false),
                    story_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_highlight_stories", x => new { x.highlight_id, x.story_id });
                });

            migrationBuilder.CreateTable(
                name: "highlights",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_highlights", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stories",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    media_asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    visibility = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "story_views",
                schema: "social",
                columns: table => new
                {
                    story_id = table.Column<Guid>(type: "uuid", nullable: false),
                    viewer_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    viewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_story_views", x => new { x.story_id, x.viewer_user_id });
                });

            migrationBuilder.CreateIndex(
                name: "IX_highlight_stories_story_id",
                schema: "social",
                table: "highlight_stories",
                column: "story_id");

            migrationBuilder.CreateIndex(
                name: "IX_highlights_owner_user_id",
                schema: "social",
                table: "highlights",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_stories_author_user_id_created_at",
                schema: "social",
                table: "stories",
                columns: new[] { "author_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_stories_expires_at",
                schema: "social",
                table: "stories",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "IX_story_views_viewer_user_id",
                schema: "social",
                table: "story_views",
                column: "viewer_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "highlight_stories",
                schema: "social");

            migrationBuilder.DropTable(
                name: "highlights",
                schema: "social");

            migrationBuilder.DropTable(
                name: "stories",
                schema: "social");

            migrationBuilder.DropTable(
                name: "story_views",
                schema: "social");
        }
    }
}
